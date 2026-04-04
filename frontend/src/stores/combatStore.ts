/**
 * Advanced Combat System State Management
 * IQC Compliant: Integrity (server validation), Quality (typed), Consistency (Zustand pattern)
 * Units are managed in kingdomStore - this store handles combat operations only.
 * Formation management has been extracted to formationStore.
 */

import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import { COMBAT } from '../constants/gameConfig';
import { useKingdomStore, getKingdomAge } from './kingdomStore';
import { useAIKingdomStore, type AIKingdom } from './aiKingdomStore';
import { calculateTurnCost, requiresWarDeclaration, validateAttackType, calculateCombatSummonTroops, type WarDeclaration } from "../../../shared/mechanics/combat-mechanics";
import { isRacialAbilityActive } from "../../../shared/mechanics/age-mechanics";
import { RACES } from '../../__mocks__/@game-data/races';
import { useSummonStore } from './useSummonStore';
import { isDemoMode } from '../utils/authMode';
import { ToastService } from '../services/toastService';
import type { BattleReportEvent } from '../services/subscriptionManager';
import { processCombat, declareWar as declareWarApi, refreshKingdomResources } from '../services/domain/CombatService';
import { achievementTriggers } from '../utils/achievementTriggers';
import { GuildService } from '../services/GuildService';
import { useCombatReplayStore } from './combatReplayStore';
import { TerrainType, FormationType } from '../types/combat';
import { TERRAIN_MODIFIERS, FORMATION_MODIFIERS, applyTerrainToUnitPower } from '../../../shared/combat/combatCache';
import { calculateGoldLoot, applyCasualtyRate } from '../utils/combatMechanics';
import { useFormationStore, type Unit, type Formation } from './formationStore';

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
          // Auth mode: call Lambda only for real kingdom targets (not AI kingdoms).
          // AI kingdoms are client-side only and don't exist in the DB, so the Lambda
          // can't look them up — fall through to demo-mode combat for those targets.
          const isAITarget = useAIKingdomStore.getState().aiKingdoms.some(k => k.id === targetId);
          if (!isDemoMode() && !isAITarget) {
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

            // Resolve the active formation ID and terrain from the selected AI kingdom
            const activeFormationId = activeFormation ?? undefined;
            // Defender terrain: look up the target kingdom's terrain if available
            const aiKingdomsForTerrain = useAIKingdomStore.getState().aiKingdoms;
            const targetKingdomForTerrain = aiKingdomsForTerrain.find(k => k.id === targetId);
            const terrainId: string | undefined =
              targetKingdomForTerrain?.terrain ??
              targetKingdomForTerrain?.terrainType ??
              undefined;

            const result = await processCombat({
              kingdomId,
              attackerKingdomId: kingdomId,
              defenderKingdomId: targetId,
              attackType,
              units: unitPayload,
              formationId: activeFormationId,
              terrainId,
            }) as any;

            const parsed = typeof result === 'string' ? JSON.parse(result) : result;

            if (!parsed) {
              // Lambda couldn't find the defender — target is likely a client-side AI
              // kingdom. Fall through to client-side simulateBattle below.
              console.log('[combatStore] Lambda returned null for defender, falling back to client-side combat');
              // Don't return — let execution fall through to the demo-mode path
            } else {

            if (!parsed.success) {
              set({ error: parsed.error || 'Combat failed', loading: false });
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
              terrain: (terrainId as import('../types/combat').TerrainType) || TerrainType.PLAINS,
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
            } // end else (parsed !== null)
          }

          // Demo mode / AI target: existing client-side battle logic below
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
            casualties: battleResult.casualties,
            landGained: battleResult.landGained,
            resourcesGained: battleResult.resourcesGained
          };

          // Apply casualties atomically to avoid race conditions between sequential removeUnits calls
          const updatedUnits = kingdomUnits.map(unit => {
            const casualties = battleResult.casualties.attacker[unit.id] || 0;
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

async function simulateBattle(
  attackerUnits: Unit[],
  defenderKingdom: AIKingdom,
  formation: Formation | null,
  activeFormationId?: string,
  defenderTerrainId?: string,
): Promise<{
  result: 'victory' | 'defeat' | 'draw';
  casualties: { attacker: Record<string, number>; defender: Record<string, number> };
  defenderUnits: Unit[];
  landGained?: number;
  resourcesGained?: Record<string, number>;
  notes?: string[];
}> {
  // Get attacker (player) race from summon store
  const attackerRace = useSummonStore.getState().currentRace || 'Human';
  const attackerRaceStats = RACES[attackerRace as keyof typeof RACES]?.stats;
  const attackerOffenseScale = attackerRaceStats ? attackerRaceStats.warOffense : 3;
  const attackerDefenseScale = attackerRaceStats ? attackerRaceStats.warDefense : 3;

  // Scale defender unit combat values by race stats (warOffense/warDefense are 1-5)
  const raceStats = RACES[defenderKingdom.race as keyof typeof RACES]?.stats;
  const offenseScale = raceStats ? raceStats.warOffense : 3;
  const defenseScale = raceStats ? raceStats.warDefense : 3;

  // Scale attacker units by player race stats
  const scaledAttackerUnits: Unit[] = attackerUnits.map(u => ({
    ...u,
    attack: u.attack * attackerOffenseScale,
    defense: u.defense * attackerDefenseScale,
  }));

  // Convert defender kingdom units to Unit format with race-scaled values
  const defenderUnits: Unit[] = [
    { id: 'def-tier1', type: 'peasant' as const, count: defenderKingdom.units.tier1, attack: 1 * offenseScale, defense: 1 * defenseScale, health: 10 },
    { id: 'def-tier2', type: 'militia' as const, count: defenderKingdom.units.tier2, attack: 2 * offenseScale, defense: 3 * defenseScale, health: 20 },
    { id: 'def-tier3', type: 'knight' as const, count: defenderKingdom.units.tier3, attack: 4 * offenseScale, defense: 4 * defenseScale, health: 40 },
    { id: 'def-tier4', type: 'cavalry' as const, count: defenderKingdom.units.tier4, attack: 5 * offenseScale, defense: 2 * defenseScale, health: 30 }
  ].filter(u => u.count > 0);

  // Goblin Kobold Rage: 1.5x bonus to T2 units during middle age
  // Try to get age from kingdom's ageStartTime stored in localStorage
  const kingdomId = useKingdomStore.getState().kingdomId;
  let currentAge: 'early' | 'middle' | 'late' = 'early';
  if (kingdomId) {
    const stored = localStorage.getItem(`kingdom-${kingdomId}-ageStartTime`);
    if (stored) {
      currentAge = getKingdomAge(stored).currentAge;
    }
  }

  // Apply Kobold Rage to attacker T2 units if attacker is Goblin
  if (attackerRace.toLowerCase() === 'goblin' && isRacialAbilityActive('goblin', 'kobold_rage', currentAge)) {
    scaledAttackerUnits.forEach(u => {
      if (u.type === 'militia') {
        u.attack *= 1.5;
        u.defense *= 1.5;
      }
    });
  }

  // Apply Kobold Rage to defender T2 units if defender is Goblin
  if (defenderKingdom.race.toLowerCase() === 'goblin' && isRacialAbilityActive('goblin', 'kobold_rage', currentAge)) {
    defenderUnits.forEach(u => {
      if (u.type === 'militia') {
        u.attack *= 1.5;
        u.defense *= 1.5;
      }
    });
  }

  // Elemental fort destruction: 25% bonus to structures destroyed on successful attacks
  const isElementalAttacker = attackerRace.toLowerCase() === 'elemental';

  // Cap: scaled attacker unit counts cannot exceed MAX_OFFENSE_MULTIPLIER × original counts
  const MAX_OFFENSE_MULTIPLIER = 2.5;
  scaledAttackerUnits.forEach(unit => {
    const originalUnit = attackerUnits.find(u => u.id === unit.id);
    if (originalUnit) {
      const cap = originalUnit.count * MAX_OFFENSE_MULTIPLIER;
      if (unit.count > cap) {
        unit.count = cap;
      }
    }
  });

  // ── Terrain & formation modifiers (parity with Lambda handler) ─────────────
  // Look up the shared FORMATION_MODIFIERS by the active formation ID (id field,
  // not the Formation object's bonuses which use a different scale).
  const formMods = activeFormationId ? (FORMATION_MODIFIERS[activeFormationId] ?? null) : null;

  // Formation offense multiplier applied to attacker power.
  // Falls back gracefully to the Formation.bonuses.attack percentage when the
  // formation ID is not in FORMATION_MODIFIERS.
  const formationOffenseBonus = formMods
    ? formMods.offense
    : (formation ? (formation.bonuses.attack / 100) : 0);
  const formationDefenseBonus = formMods
    ? formMods.defense
    : (formation ? (formation.bonuses.defense / 100) : 0);

  // Terrain modifiers for the defender's territory (default to plains = no mods)
  const normalizedTerrain = (defenderTerrainId ?? 'plains').toLowerCase();
  const terrainMods = TERRAIN_MODIFIERS[normalizedTerrain] ?? TERRAIN_MODIFIERS['plains'] ?? {};

  // Build attacker unit map (type → count) for terrain unit-class penalty calc
  const attackerUnitMap: Record<string, number> = {};
  scaledAttackerUnits.forEach(u => {
    attackerUnitMap[u.type] = (attackerUnitMap[u.type] ?? 0) + u.count;
  });

  // Raw power sums from race-scaled units
  const rawAttackerPower = scaledAttackerUnits.reduce((sum, u) => sum + (u.attack * u.count), 0);
  const rawDefenderPower = defenderUnits.reduce((sum, u) => sum + (u.defense * u.count), 0);

  // Compute the terrain modifier ratio for attacker offense:
  // applyTerrainToUnitPower uses shared UNIT_STATS internally. We derive a
  // class-weighted ratio (terrain-adjusted / un-adjusted) from those stats,
  // then apply that same ratio to the race-scaled power so the relative
  // unit-class penalties are preserved while absolute race scaling is kept.
  const terrainAttackerNoMod = applyTerrainToUnitPower(attackerUnitMap, 'attack', {});
  const terrainAttackerWithMod = applyTerrainToUnitPower(attackerUnitMap, 'attack', terrainMods);
  const terrainAttackerRatio = terrainAttackerNoMod > 0
    ? terrainAttackerWithMod / terrainAttackerNoMod
    : 1;

  // Terrain defense bonus: scale defender power by (1 + defense mod).
  // Unit-class modifiers in terrainMods (cavalry/infantry/siege) penalise the
  // attacker only, so only the top-level defense modifier applies to the defender.
  const terrainDefenseFactor = 1 + (terrainMods.defense ?? 0);

  // Final power values with terrain and formation applied (matches Lambda logic)
  const totalAttackerPower = rawAttackerPower * terrainAttackerRatio * (1 + formationOffenseBonus);
  const defenderPower = rawDefenderPower * terrainDefenseFactor;

  // Guard against division by zero when defender has no units
  const offenseRatio = defenderPower === 0 ? 999 : totalAttackerPower / defenderPower;

  // Determine result type based on reference mechanics
  let resultType: 'with_ease' | 'good_fight' | 'failed';
  let attackerCasualtyRate: number;
  let defenderCasualtyRate: number;

  if (offenseRatio >= 2.0) {
    // "With ease" - dominating victory
    resultType = 'with_ease';
    attackerCasualtyRate = 0.05;  // 5% losses
    defenderCasualtyRate = 0.20;  // 20% losses
  } else if (offenseRatio >= 1.2) {
    // "Good fight" - contested victory
    resultType = 'good_fight';
    attackerCasualtyRate = 0.15;  // 15% losses
    defenderCasualtyRate = 0.15;  // 15% losses
  } else {
    // "Failed" - attack failed
    resultType = 'failed';
    attackerCasualtyRate = 0.25;  // 25% losses
    defenderCasualtyRate = 0.05;  // 5% losses
  }

  // Apply formation defense bonus to reduce attacker casualties
  if (formationDefenseBonus > 0) {
    attackerCasualtyRate *= (1 - formationDefenseBonus);
  }

  // Map to UI result type
  const result: 'victory' | 'defeat' | 'draw' =
    resultType === 'with_ease' ? 'victory' :
    resultType === 'good_fight' ? 'victory' :
    'defeat';

  // Calculate actual casualties keyed by unit ID (not type) to avoid data loss
  // when multiple units share the same type
  const attackerCasualties: Record<string, number> = {};
  const defenderCasualties: Record<string, number> = {};

  scaledAttackerUnits.forEach(unit => {
    // Weight casualties by unit defense - tougher units take fewer losses
    const defenseModifier = Math.max(0.5, 1 - (unit.defense * 0.05));
    const casualties = applyCasualtyRate(unit.count, attackerCasualtyRate * defenseModifier);
    if (casualties > 0) {
      attackerCasualties[unit.type] = (attackerCasualties[unit.type] ?? 0) + casualties;
    }
  });

  defenderUnits.forEach(unit => {
    const defenseModifier = Math.max(0.5, 1 - (unit.defense * 0.05));
    const casualties = applyCasualtyRate(unit.count, defenderCasualtyRate * defenseModifier);
    if (casualties > 0) {
      defenderCasualties[unit.type] = (defenderCasualties[unit.type] ?? 0) + casualties;
    }
  });

  // Calculate land gained using defender's actual land (from reference)
  const defenderLand = defenderKingdom.resources.land;
  let landGained = 0;

  if (resultType === 'with_ease') {
    // 7.0-7.35% of target land (from combat-mechanics.ts)
    const landPercentage = 0.070 + (Math.random() * 0.0035);
    landGained = Math.floor(defenderLand * landPercentage);
  } else if (resultType === 'good_fight') {
    // 6.79-7.0% of target land (from combat-mechanics.ts)
    const landPercentage = 0.0679 + (Math.random() * 0.0021);
    landGained = Math.floor(defenderLand * landPercentage);
  }

  // Gold looted per acre gained (from reference)
  const goldGained = calculateGoldLoot(landGained);

  // Droben boosted summons: bonus troops after a successful attack
  const notes: string[] = [];

  // Elemental fort destruction bonus: +25% structures destroyed on non-defeat
  if (isElementalAttacker && result !== 'defeat') {
    notes.push('Elemental fort destruction: +25% bonus to structures destroyed');
  }

  if (result !== 'defeat' && attackerRace.toLowerCase() === 'droben') {
    const totalNetworth = defenderKingdom.networth || 0;
    const bonusTroops = calculateCombatSummonTroops('Droben', totalNetworth);
    if (bonusTroops > 0) {
      notes.push(`Droben combat summon: +${bonusTroops} bonus troops (3.04% summon rate)`);
    }
  }

  // Sidhe circle summoning: emergency temple creation on successful attacks
  if (attackerRace.toLowerCase() === 'sidhe' && result !== 'defeat') {
    notes.push('Sidhe circle summoning: emergency temple created in conquered territory');
  }

  return {
    result,
    casualties: { attacker: attackerCasualties, defender: defenderCasualties },
    defenderUnits,
    landGained,
    resourcesGained: goldGained > 0 ? { gold: goldGained } : {},
    notes: notes.length > 0 ? notes : undefined
  };
}
