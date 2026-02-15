/**
 * Advanced Combat System State Management
 * IQC Compliant: Integrity (server validation), Quality (typed), Consistency (Zustand pattern)
 * Units are managed in kingdomStore - this store handles combat operations only
 */

import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import { COMBAT } from '../constants/gameConfig';
import { useKingdomStore } from './kingdomStore';
import { useAIKingdomStore, type AIKingdom } from './aiKingdomStore';
import { calculateTurnCost, requiresWarDeclaration, validateAttackType, type WarDeclaration } from "../../../shared/mechanics/combat-mechanics";
import { RACES } from '../../__mocks__/@game-data/races';

interface Unit {
  id: string;
  type: 'peasant' | 'militia' | 'knight' | 'cavalry' | 'archer' | 'mage';
  count: number;
  attack: number;
  defense: number;
  health: number;
  position?: { x: number; y: number };
}

interface Formation {
  id: string;
  name: string;
  units: Unit[];
  bonuses: {
    attack: number;
    defense: number;
    special?: string;
  };
  positions: Record<string, { x: number; y: number }>;
}

export type { Unit, Formation };

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
}

interface SiegeOperation {
  id: string;
  targetTerritoryId: string;
  attackerUnits: Unit[];
  defenderUnits: Unit[];
  turnsRemaining: number;
  siegeEquipment: string[];
  fortificationLevel: number;
}

export const useCombatStore = create(
  combine(
    {
      // Unit selection (reads from kingdomStore)
      selectedUnits: [] as Unit[],
      
      // Formation system
      formations: [] as Formation[],
      activeFormation: null as string | null,
      formationPositions: {} as Record<string, { x: number; y: number }>,
      
      // Battle state
      currentBattle: null as BattleReport | null,
      battleHistory: [] as BattleReport[],
      
      // War declarations (from documentation)
      warDeclarations: [] as WarDeclaration[],
      attackCounts: {} as Record<string, number>, // Track attacks per target
      
      // Siege warfare
      activeSieges: [] as SiegeOperation[],
      siegeHistory: [] as Array<{
        id: string;
        timestamp: number;
        success: boolean;
        duration: number;
      }>,
      
      // UI state
      showFormationEditor: false,
      selectedBattleReport: null as string | null,
      loading: false,
      error: null as string | null,
    },
    (set, get) => ({
      // Unit selection (reads from kingdomStore)
      selectUnit: (unitId: string) => {
        const kingdomUnits = useKingdomStore.getState().units;
        const unit = kingdomUnits.find(u => u.id === unitId);
        if (unit && !get().selectedUnits.find(u => u.id === unitId)) {
          set((state) => ({
            selectedUnits: [...state.selectedUnits, unit as Unit]
          }));
        }
      },

      deselectUnit: (unitId: string) => {
        set((state) => ({
          selectedUnits: state.selectedUnits.filter(u => u.id !== unitId)
        }));
      },

      // Formation management
      createFormation: (name: string, units: Unit[]) => {
        const formation: Formation = {
          id: `formation-${Date.now()}`,
          name,
          units,
          bonuses: calculateFormationBonuses(units),
          positions: {}
        };

        set((state) => ({
          formations: [...state.formations, formation]
        }));

        return formation.id;
      },

      updateFormationPositions: (formationId: string, positions: Record<string, { x: number; y: number }>) => {
        set((state) => ({
          formations: state.formations.map(f => 
            f.id === formationId ? { ...f, positions } : f
          )
        }));
      },

      setActiveFormation: (formationId: string | null) => {
        set({ activeFormation: formationId });
      },

      // Battle execution
      executeBattle: async (targetId: string) => {
        const state = get();
        if (state.selectedUnits.length === 0) {
          set({ error: 'No units selected for battle' });
          return null;
        }

        set({ loading: true, error: null });

        try {
          // Get defender kingdom data from AI store
          const aiKingdoms = useAIKingdomStore.getState().aiKingdoms;
          const defenderKingdom = aiKingdoms.find(k => k.id === targetId);
          
          if (!defenderKingdom) {
            set({ error: 'Defender kingdom not found', loading: false });
            return null;
          }

          // Check if defender is eliminated (in restoration)
          if (defenderKingdom.resources.population <= 0 && defenderKingdom.resources.land <= 0) {
            set({ error: 'Target kingdom is in restoration and cannot be attacked', loading: false });
            return null;
          }

          // Validate defender has valid unit data
          if (!defenderKingdom.units) {
            set({ error: 'Defender kingdom has no army data', loading: false });
            return null;
          }

          // Battle calculation with real defender data
          const battleResult = await simulateBattle(
            state.selectedUnits,
            defenderKingdom,
            state.activeFormation ? (state.formations.find(f => f.id === state.activeFormation) || null) : null
          );

          const battleReport: BattleReport = {
            id: `battle-${Date.now()}`,
            timestamp: Date.now(),
            attacker: 'current-player',
            defender: targetId,
            attackerUnits: state.selectedUnits,
            defenderUnits: battleResult.defenderUnits,
            result: battleResult.result,
            casualties: battleResult.casualties,
            landGained: battleResult.landGained,
            resourcesGained: battleResult.resourcesGained
          };

          // Apply casualties atomically to avoid race conditions between sequential removeUnits calls
          const kingdomUnits = useKingdomStore.getState().units;
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
            selectedUnits: [], // Clear selected units after battle
            loading: false
          }));

          return battleReport;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Battle execution failed',
            loading: false 
          });
          return null;
        }
      },

      // Siege warfare
      startSiege: async (territoryId: string, units: Unit[]) => {
        const siege: SiegeOperation = {
          id: `siege-${Date.now()}`,
          targetTerritoryId: territoryId,
          attackerUnits: units,
          defenderUnits: [],
          turnsRemaining: 5, // 5-turn siege
          siegeEquipment: ['catapult', 'ram'],
          fortificationLevel: 3
        };

        set((state) => ({
          activeSieges: [...state.activeSieges, siege]
        }));

        return siege.id;
      },

      updateSiege: (siegeId: string, updates: Partial<SiegeOperation>) => {
        set((state) => ({
          activeSieges: state.activeSieges.map(s => 
            s.id === siegeId ? { ...s, ...updates } : s
          )
        }));
      },

      completeSiege: (siegeId: string, success: boolean) => {
        const state = get();
        const siege = state.activeSieges.find(s => s.id === siegeId);
        
        if (siege) {
          set((state) => ({
            activeSieges: state.activeSieges.filter(s => s.id !== siegeId),
            siegeHistory: [{
              id: siegeId,
              timestamp: Date.now(),
              success,
              duration: 5 - siege.turnsRemaining
            }, ...state.siegeHistory.slice(0, 19)]
          }));
        }
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
      showFormationEditor: (show: boolean) => {
        set({ showFormationEditor: show });
      },

      selectBattleReport: (reportId: string | null) => {
        set({ selectedBattleReport: reportId });
      },

      clearError: () => {
        set({ error: null });
      },

      // Initialize formations only (units come from kingdomStore)
      initializeCombatData: () => {
        const mockFormations: Formation[] = [
          {
            id: 'defensive-wall',
            name: 'Defensive Wall',
            units: [],
            bonuses: { attack: 0, defense: 20 },
            positions: {}
          },
          {
            id: 'cavalry-charge',
            name: 'Cavalry Charge',
            units: [],
            bonuses: { attack: 30, defense: -10 },
            positions: {}
          },
          {
            id: 'balanced',
            name: 'Balanced Formation',
            units: [],
            bonuses: { attack: 10, defense: 10 },
            positions: {}
          }
        ];

        set({ formations: mockFormations });
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

// Helper functions
function calculateFormationBonuses(units: Unit[]): { attack: number; defense: number; special?: string } {
  // Formation bonuses based on unit composition
  let attackBonus = 0;
  let defenseBonus = 0;
  let special: string | undefined;

  // Heavy infantry formation
  if (units.filter(u => u.type === 'knight' || u.type === 'militia').length >= 2) {
    defenseBonus += 15;
  }

  // Cavalry formation
  if (units.filter(u => u.type === 'cavalry').length > 0) {
    attackBonus += 20;
    special = 'mobility';
  }

  // Ranged formation
  if (units.filter(u => u.type === 'archer' || u.type === 'mage').length >= 2) {
    attackBonus += 10;
    special = 'ranged_advantage';
  }

  return { attack: attackBonus, defense: defenseBonus, special };
}

async function simulateBattle(
  attackerUnits: Unit[],
  defenderKingdom: AIKingdom,
  formation: Formation | null
): Promise<{
  result: 'victory' | 'defeat' | 'draw';
  casualties: { attacker: Record<string, number>; defender: Record<string, number> };
  defenderUnits: Unit[];
  landGained?: number;
  resourcesGained?: Record<string, number>;
}> {
  // Scale defender unit combat values by race stats (warOffense/warDefense are 1-5)
  const raceStats = RACES[defenderKingdom.race as keyof typeof RACES]?.stats;
  const offenseScale = raceStats ? raceStats.warOffense : 3;
  const defenseScale = raceStats ? raceStats.warDefense : 3;

  // Convert defender kingdom units to Unit format with race-scaled values
  const defenderUnits: Unit[] = [
    { id: 'def-tier1', type: 'peasant' as const, count: defenderKingdom.units.tier1, attack: 1 * offenseScale, defense: 1 * defenseScale, health: 10 },
    { id: 'def-tier2', type: 'militia' as const, count: defenderKingdom.units.tier2, attack: 2 * offenseScale, defense: 3 * defenseScale, health: 20 },
    { id: 'def-tier3', type: 'knight' as const, count: defenderKingdom.units.tier3, attack: 4 * offenseScale, defense: 4 * defenseScale, health: 40 },
    { id: 'def-tier4', type: 'cavalry' as const, count: defenderKingdom.units.tier4, attack: 5 * offenseScale, defense: 2 * defenseScale, health: 30 }
  ].filter(u => u.count > 0);

  // Calculate total power
  const attackerPower = attackerUnits.reduce((sum, u) => sum + (u.attack * u.count), 0);
  const defenderPower = defenderUnits.reduce((sum, u) => sum + (u.defense * u.count), 0);

  // Apply formation bonuses (percentage-based)
  const formationAttackBonus = formation ? (formation.bonuses.attack / 100) : 0;
  const formationDefenseBonus = formation ? (formation.bonuses.defense / 100) : 0;
  const totalAttackerPower = attackerPower * (1 + formationAttackBonus);

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

  attackerUnits.forEach(unit => {
    // Weight casualties by unit defense - tougher units take fewer losses
    const defenseModifier = Math.max(0.5, 1 - (unit.defense * 0.05));
    const casualties = Math.floor(unit.count * attackerCasualtyRate * defenseModifier);
    if (casualties > 0) {
      attackerCasualties[unit.id] = casualties;
    }
  });

  defenderUnits.forEach(unit => {
    const casualties = Math.floor(unit.count * defenderCasualtyRate);
    if (casualties > 0) {
      defenderCasualties[unit.id] = casualties;
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
  const goldGained = landGained * COMBAT.GOLD_LOOTED_PER_ACRE;

  return {
    result,
    casualties: { attacker: attackerCasualties, defender: defenderCasualties },
    defenderUnits,
    landGained,
    resourcesGained: goldGained > 0 ? { gold: goldGained } : {}
  };
}
