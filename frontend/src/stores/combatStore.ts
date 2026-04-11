/**
 * Advanced Combat System State Management
 * IQC Compliant: Integrity (server validation), Quality (typed), Consistency (Zustand pattern)
 * Units are managed in kingdomStore - this store handles combat operations only.
 * Formation management has been extracted to formationStore.
 */

import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import { useKingdomStore } from './kingdomStore';
import { useAIKingdomStore, type AIKingdom } from './aiKingdomStore';
import { calculateTurnCost, requiresWarDeclaration, validateAttackType, type WarDeclaration } from "../../../shared/mechanics/combat-mechanics";
import { isDemoMode } from '../utils/authMode';
import { ToastService } from '../services/toastService';
import type { BattleReportEvent } from '../services/subscriptionManager';
import { processCombat, declareWar as declareWarApi, refreshKingdomResources } from '../services/domain/CombatService';
import { achievementTriggers } from '../utils/achievementTriggers';
import { GuildService } from '../services/GuildService';
import { useCombatReplayStore } from './combatReplayStore';
import { TerrainType, FormationType } from '../types/combat';
import { useFormationStore, type Unit, type Formation } from './formationStore';
import { simulateBattle } from '../services/combatSimulator';

export type { Unit, Formation };

/**
 * Fire-and-forget: check if attacker and defender are in an active guild war
 * and record the contribution. Points = 1 per 10 acres of enemy land taken.
 * This never blocks the combat result — any errors are swallowed silently.
 *
 * When attackerGuildId is null, it will be resolved by fetching the attacker
 * kingdom record from Amplify (same as defender lookup).
 */
async function maybeRecordGuildWarScore(params: {
  attackerKingdomId: string;
  attackerGuildId: string | null | undefined;
  attackerName: string;
  defenderKingdomId: string;
  landGained: number;
}): Promise<void> {
  try {
    const { attackerKingdomId, defenderKingdomId, landGained } = params;
    let { attackerGuildId, attackerName } = params;
    if (landGained <= 0) return;

    // Fetch both kingdoms from Amplify to resolve guildIds
    const { generateClient } = await import('aws-amplify/data');
    type SchemaType = import('../../../amplify/data/resource').Schema;
    const client = generateClient<SchemaType>();

    // Resolve attacker guildId if not supplied
    if (!attackerGuildId) {
      const { data: atkKingdom } = await client.models.Kingdom.get({ id: attackerKingdomId });
      attackerGuildId = (atkKingdom as { guildId?: string | null; name?: string | null } | null)?.guildId ?? null;
      if (!attackerName || attackerName === attackerKingdomId) {
        attackerName = (atkKingdom as { name?: string | null } | null)?.name ?? attackerKingdomId;
      }
    }
    if (!attackerGuildId) return;

    // Resolve defender guildId
    const { data: defKingdom } = await client.models.Kingdom.get({ id: defenderKingdomId });
    const defenderGuildId = (defKingdom as { guildId?: string | null } | null)?.guildId ?? null;
    if (!defenderGuildId) return;

    // Find active guild war between these two guilds
    const activeWar = GuildService.findActiveWarBetween(attackerGuildId, defenderGuildId);
    if (!activeWar) return;

    // Points: 1 per 10 acres gained (minimum 1)
    const points = Math.max(1, Math.floor(landGained / 10));

    GuildService.recordGuildWarContribution({
      warId: activeWar.id,
      kingdomId: attackerKingdomId,
      kingdomName: attackerName,
      guildId: attackerGuildId,
      points,
    });

    // Wire achievement: track guild war contribution
    achievementTriggers.onGuildWarContribution(points);
  } catch {
    // Fire-and-forget: swallow all errors silently
  }
}

interface BattleReport {
  id: string;
  timestamp: number;
  attacker: string;
  defender: string;
  attackerUnits: Unit[];
  defenderUnits: Unit[];
  result: 'victory' | 'defeat' | 'draw';
  resultType?: 'with_ease' | 'good_fight' | 'failed';
  casualties: {
    attacker: Record<string, number>;
    defender: Record<string, number>;
  };
  landGained?: number;
  resourcesGained?: Record<string, number>;
  degradedTerritory?: string | null;
}

export const useCombatStore = create(
  combine(
    {
      // Battle state
      currentBattle: null as BattleReport | null,
      battleHistory: [] as BattleReport[],

      // War declarations (from documentation)
      warDeclarations: [] as WarDeclaration[],
      attackCounts: {} as Record<string, number>, // Track attacks per target

      // UI state
      selectedBattleReport: null as string | null,
      loading: false,
      error: null as string | null,
    },
    (set, get) => ({
      // Battle execution
      executeBattle: async (targetId: string, attackType: 'standard' | 'raid' | 'pillage' | 'siege' = 'standard') => {
        if (get().loading) return null;
        // Use all kingdom units automatically (original Monarchy: no unit selection, just total power)
        // Formation choice is an optional modifier applied via formationId
        const formationState = useFormationStore.getState();
        const { activeFormation, formations } = formationState;
        const kingdomUnits = useKingdomStore.getState().units;

        if (kingdomUnits.length === 0) {
          set({ error: 'You have no units trained. Train units before attacking.' });
          return null;
        }

        set({ loading: true, error: null });

        try {
          // Auth mode: ALL combat goes through the Lambda (server-side authority).
          // AI kingdoms exist in DynamoDB (seeded by season-lifecycle) so the Lambda
          // can look them up. Only demo mode uses client-side simulateBattle.
          if (!isDemoMode()) {
            const kingdomId = useKingdomStore.getState().kingdomId;
            if (!kingdomId) {
              set({ error: 'No kingdom selected', loading: false });
              return null;
            }

            // Use all available units (Lambda reads totalUnits from DynamoDB directly)
            const unitPayload: Record<string, number> = {};
            kingdomUnits.forEach(unit => {
              unitPayload[unit.type] = (unitPayload[unit.type] || 0) + unit.count;
            });

            const activeFormationId = activeFormation ?? undefined;

            const result = await processCombat({
              kingdomId,
              attackerKingdomId: kingdomId,
              defenderKingdomId: targetId,
              attackType,
              units: unitPayload,
              formationId: activeFormationId,
            }) as unknown;

            const parsed = typeof result === 'string' ? JSON.parse(result) : result;

            if (!parsed || !parsed.success) {
              console.error('[combatStore] Combat failed:', parsed);
              set({ error: parsed?.error || 'Combat failed', loading: false });
              return null;
            }

            const combatData = typeof parsed.result === 'string' ? JSON.parse(parsed.result) : parsed.result;

            const battleReport: BattleReport = {
              id: `battle-${Date.now()}`,
              timestamp: Date.now(),
              attacker: kingdomId,
              defender: targetId,
              attackerUnits: kingdomUnits,
              defenderUnits: [],
              result: combatData.result === 'with_ease' || combatData.result === 'good_fight' ? 'victory' : 'defeat',
              resultType: combatData.result as 'with_ease' | 'good_fight' | 'failed',
              casualties: combatData.casualties || { attacker: {}, defender: {} },
              landGained: combatData.landGained,
              resourcesGained: combatData.goldLooted ? { gold: combatData.goldLooted } : {},
              degradedTerritory: combatData.degradedTerritory ?? null,
            };

            // Server already updated kingdom state — refresh authoritative resources
            void refreshKingdomResources(kingdomId);

            // Fire achievement triggers on confirmed server victory
            if (battleReport.result === 'victory') {
              achievementTriggers.onBattleWon();
              if ((combatData.landGained || 0) > 0) {
                achievementTriggers.onLandCaptured(combatData.landGained);
              }

              // Guild war contribution — fire-and-forget, never blocks the result.
              // attackerGuildId is passed as null here; the async helper will
              // look it up from the Amplify Kingdom model for both sides.
              void maybeRecordGuildWarScore({
                attackerKingdomId: kingdomId,
                attackerGuildId: null,
                attackerName: kingdomId,
                defenderKingdomId: targetId,
                landGained: combatData.landGained || 0,
              });

              // Auto-complete bounty if the defender was the claimed bounty target
              try {
                const { useBountyStore } = await import('./bountyStore');
                const bountyState = useBountyStore.getState();
                const claimedBounty = bountyState.availableBounties.find(
                  b => b.target.kingdomId === targetId && b.claimed
                );
                if (claimedBounty && (combatData.landGained ?? 0) > 0) {
                  bountyState.completeBounty(targetId, combatData.landGained ?? 0);
                }
              } catch {
                // Non-fatal — bounty completion is a reward, not blocking
              }
            }

            set((state) => ({
              currentBattle: battleReport,
              battleHistory: [battleReport, ...state.battleHistory.slice(0, 49)],
              loading: false
            }));
            // Clear selected units in formationStore after battle
            useFormationStore.getState().clearSelectedUnits();

            // Capture replay for auth-mode battle
            useCombatReplayStore.getState().addReplay({
              id: `replay-${battleReport.id}`,
              battleId: battleReport.id,
              attackerId: kingdomId,
              attackerName: kingdomId,
              defenderId: targetId,
              defenderName: targetId,
              terrain: TerrainType.PLAINS,
              attackerFormation: (activeFormationId as import('../types/combat').FormationType) || FormationType.BALANCED,
              defenderFormation: FormationType.BALANCED,
              rounds: [
                {
                  roundNumber: 1,
                  attackerCasualties: Object.values(battleReport.casualties.attacker).reduce((s, v) => s + v, 0),
                  defenderCasualties: Object.values(battleReport.casualties.defender).reduce((s, v) => s + v, 0),
                  attackerUnitsRemaining: battleReport.attackerUnits.reduce((s, u) => s + u.count, 0),
                  defenderUnitsRemaining: 0,
                },
              ],
              result: battleReport.result === 'victory' ? 'victory' : 'defeat',
              landGained: battleReport.landGained ?? 0,
              timestamp: new Date(battleReport.timestamp).toISOString(),
            });

            return battleReport;
          }

          // Demo mode: existing client-side battle logic below
          // Get defender kingdom data from AI store
          const aiKingdoms = useAIKingdomStore.getState().aiKingdoms;
          const defenderKingdom = aiKingdoms.find(k => k.id === targetId);

          // If the kingdom isn't in the store (timing issue between React state and
          // Zustand), create a reasonable placeholder so the battle can still run.
          const resolvedDefender = defenderKingdom ?? {
            id: targetId,
            name: 'Enemy Kingdom',
            race: 'Human',
            resources: { gold: 50000, population: 5000, land: 500, turns: 10 },
            units: { tier1: 50, tier2: 30, tier3: 10, tier4: 5 },
            networth: 550000,
            terrain: 'plains',
            terrainType: 'PLAINS',
          };
          if (!resolvedDefender) {
            set({ error: 'Defender kingdom not found', loading: false });
            return null;
          }

          // Check if defender is eliminated (in restoration)
          if (resolvedDefender.resources.population <= 0 && resolvedDefender.resources.land <= 0) {
            set({ error: 'Target kingdom is in restoration and cannot be attacked', loading: false });
            return null;
          }

          // Validate defender has valid unit data
          if (!resolvedDefender.units) {
            set({ error: 'Defender kingdom has no army data', loading: false });
            return null;
          }

          // Resolve terrain from the AI kingdom if available; default to 'plains'
          const defenderTerrain: string =
            resolvedDefender.terrain ??
            resolvedDefender.terrainType ??
            'plains';

          // Battle calculation with real defender data
          const battleResult = await simulateBattle(
            kingdomUnits as unknown as Unit[],
            resolvedDefender as AIKingdom,
            activeFormation ? (formations.find(f => f.id === activeFormation) || null) : null,
            activeFormation ?? undefined,
            defenderTerrain,
          );

          const battleReport: BattleReport = {
            id: `battle-${Date.now()}`,
            timestamp: Date.now(),
            attacker: 'current-player',
            defender: targetId,
            attackerUnits: kingdomUnits as unknown as Unit[],
            defenderUnits: battleResult.defenderUnits,
            result: battleResult.result,
            resultType: battleResult.resultType,
            casualties: battleResult.casualties,
            landGained: battleResult.landGained,
            resourcesGained: battleResult.resourcesGained
          };

          // Apply casualties atomically to avoid race conditions between sequential removeUnits calls
          const updatedUnits = kingdomUnits.map(unit => {
            const casualties = battleResult.casualties.attacker[unit.type] || 0;
            if (casualties > 0) {
              return { ...unit, count: Math.max(0, unit.count - casualties) };
            }
            return unit;
          }).filter(u => u.count > 0);
          useKingdomStore.getState().setUnits(updatedUnits);

          set((state) => ({
            currentBattle: battleReport,
            battleHistory: [battleReport, ...state.battleHistory.slice(0, 49)],
            loading: false
          }));
          // Clear selected units in formationStore after battle
          useFormationStore.getState().clearSelectedUnits();

          // Auto-complete bounty if the defender was the claimed bounty target (demo mode)
          if (battleReport.result === 'victory') {
            try {
              const { useBountyStore } = await import('./bountyStore');
              const bountyState = useBountyStore.getState();
              const claimedBounty = bountyState.availableBounties.find(
                b => b.target.kingdomId === targetId && b.claimed
              );
              if (claimedBounty && (battleReport.landGained ?? 0) > 0) {
                bountyState.completeBounty(targetId, battleReport.landGained ?? 0);
              }
            } catch {
              // Non-fatal — bounty completion is a reward, not blocking
            }
          }

          // Capture replay for demo-mode battle
          const demoActiveFormationId = activeFormation ?? undefined;
          const aiKingdomsForReplay = useAIKingdomStore.getState().aiKingdoms;
          const defenderKingdomForReplay = aiKingdomsForReplay.find(k => k.id === targetId);
          const demoTerrainId: string | undefined =
            defenderKingdomForReplay?.terrain ??
            defenderKingdomForReplay?.terrainType ??
            undefined;
          useCombatReplayStore.getState().addReplay({
            id: `replay-${battleReport.id}`,
            battleId: battleReport.id,
            attackerId: 'current-player',
            attackerName: 'You',
            defenderId: targetId,
            defenderName: resolvedDefender.name,
            terrain: (demoTerrainId as import('../types/combat').TerrainType) || TerrainType.PLAINS,
            attackerFormation: (demoActiveFormationId as import('../types/combat').FormationType) || FormationType.BALANCED,
            defenderFormation: FormationType.BALANCED,
            rounds: [
              {
                roundNumber: 1,
                attackerCasualties: Object.values(battleReport.casualties.attacker).reduce((s, v) => s + v, 0),
                defenderCasualties: Object.values(battleReport.casualties.defender).reduce((s, v) => s + v, 0),
                attackerUnitsRemaining: battleReport.attackerUnits.reduce((s, u) => s + u.count, 0),
                defenderUnitsRemaining: battleReport.defenderUnits.reduce((s, u) => s + u.count, 0),
              },
            ],
            result: battleReport.result === 'victory' ? 'victory' : 'defeat',
            landGained: battleReport.landGained ?? 0,
            timestamp: new Date(battleReport.timestamp).toISOString(),
          });

          return battleReport;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Battle execution failed',
            loading: false
          });
          return null;
        }
      },

      // Add a battle report to history (used by AICombatService)
      addBattleToHistory: (report: BattleReport) => {
        set((state) => ({
          currentBattle: report,
          battleHistory: [report, ...state.battleHistory.slice(0, 49)],
        }));
      },

      refreshBattleHistory: (event: BattleReportEvent) => {
        const state = get();
        if (state.battleHistory.some(b => b.id === event.id)) return;
        const report: BattleReport = {
          id: event.id,
          timestamp: new Date(event.timestamp).getTime(),
          attacker: event.attackerId,
          defender: event.defenderId,
          attackerUnits: [],
          defenderUnits: [],
          result: 'defeat' as const,
          casualties: { attacker: {}, defender: {} },
        };
        set((s) => ({
          currentBattle: report,
          battleHistory: [report, ...s.battleHistory.slice(0, 49)],
        }));
      },

      // Battle analytics
      getBattleStats: () => {
        const state = get();
        const victories = state.battleHistory.filter(b => b.result === 'victory').length;
        const defeats = state.battleHistory.filter(b => b.result === 'defeat').length;
        const totalBattles = state.battleHistory.length;

        return {
          totalBattles,
          victories,
          defeats,
          winRate: totalBattles > 0 ? (victories / totalBattles) * 100 : 0,
          totalLandGained: state.battleHistory.reduce((sum, b) => sum + (b.landGained || 0), 0)
        };
      },

      // UI actions
      selectBattleReport: (reportId: string | null) => {
        set({ selectedBattleReport: reportId });
      },

      clearError: () => {
        set({ error: null });
      },

      // Initialize combat data (formations now handled by formationStore.initializeFormations)
      initializeCombatData: () => {
        useFormationStore.getState().initializeFormations();
      },

      // War declaration system (from documentation)
      trackAttack: (defenderId: string) => {
        const { attackCounts } = get();
        const currentCount = attackCounts[defenderId] || 0;
        const newCount = currentCount + 1;

        set((state) => ({
          attackCounts: {
            ...state.attackCounts,
            [defenderId]: newCount
          }
        }));

        // Check if war declaration required
        if (requiresWarDeclaration(newCount)) {
          return {
            requiresDeclaration: true,
            attackCount: newCount,
            message: `⚠️ You have attacked this kingdom ${newCount} times. You must declare war to continue!`
          };
        }

        return {
          requiresDeclaration: false,
          attackCount: newCount,
          message: `Attack ${newCount}/3 before war declaration required`
        };
      },

      declareWar: (attackerId: string, defenderId: string) => {
        const warDeclaration: WarDeclaration = {
          attackerId,
          defenderId,
          attackCount: get().attackCounts[defenderId] || 0,
          declaredAt: Date.now(),
          isActive: true
        };
        // Persist to backend (fire-and-forget — local state is source of truth for UI)
        void declareWarApi({
          action: 'declareWar',
          kingdomId: attackerId,
          attackerId,
          defenderKingdomId: defenderId,
          seasonId: undefined,
          reason: 'Formal war declaration',
        }).catch((err: unknown) => {
          console.warn('[combatStore] war declaration persist failed:', err);
          ToastService.warn('War declaration may not have saved — please try again if needed');
        });
        set((state) => ({
          warDeclarations: [...state.warDeclarations, warDeclaration]
        }));
      },

      isAtWar: (defenderId: string): boolean => {
        const { warDeclarations } = get();
        return warDeclarations.some(
          war => war.defenderId === defenderId && war.isActive
        );
      },

      getAttackCount: (defenderId: string): number => {
        return get().attackCounts[defenderId] || 0;
      },

      // Calculate turn cost based on networth
      calculateAttackCost: (attackerNetworth: number, defenderNetworth: number): number => {
        return calculateTurnCost(attackerNetworth, defenderNetworth);
      },

      // Validate attack type
      validateAttack: (
        attackType: 'controlled_strike' | 'ambush' | 'guerilla_raid' | 'mob_assault' | 'full_attack',
        hasPeasants: boolean
      ) => {
        return validateAttackType(attackType, hasPeasants);
      },
    })
  )
);


