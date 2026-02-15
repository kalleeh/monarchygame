import { create } from 'zustand';
import { type TrainableUnit } from '../services/TrainingService';
import { useKingdomStore } from './kingdomStore';
import { getUnitsForRace, type UnitType } from '../utils/units';
import { calculateActionTurnCost } from '../../../shared/mechanics/turn-mechanics';
import { isDemoMode } from '../utils/authMode';
import { AmplifyFunctionService } from '../services/amplifyFunctionService';

// Troop cap based on accumulated gold cost (from hire-screen.md)
const TROOP_CAP_GOLD = 10_000_000; // 10 million gold cap

// Convert game-data UnitType to TrainableUnit format
function convertToTrainableUnit(unit: UnitType): TrainableUnit {
  return {
    id: unit.id,
    type: unit.id,
    name: unit.name,
    description: unit.description,
    goldCost: unit.stats.cost.gold,
    populationCost: unit.stats.cost.population,
    trainingTime: 0, // Instant summon
    requirements: [],
    tier: unit.tier,
    upkeep: unit.stats.upkeep
  };
}

interface SummonStore {
  // State
  availableUnits: TrainableUnit[];
  accumulatedGoldSpent: number; // Track total gold spent on troops
  currentRace: string; // Track race for unit lookups
  loading: boolean;
  error: string | null;

  // Actions
  loadSummonData: (kingdomId: string, race: string) => Promise<void>;
  summonUnits: (kingdomId: string, unitType: string, quantity: number) => Promise<void>;
  calculateRemainingCapacity: () => number;
  calculateMaxAffordable: (unitGoldCost: number) => number;
  getTotalUpkeep: () => number;
  clearError: () => void;
}


export const useSummonStore = create<SummonStore>((set, get) => ({
  // Initial state
  availableUnits: [],
  accumulatedGoldSpent: 0,
  currentRace: 'HUMAN',
  loading: false,
  error: null,

  // Load race-specific summonable units from game-data
  loadSummonData: async (_kingdomId: string, race: string) => {
    try {
      // Get authentic units for this race from reference material
      const raceUnits = getUnitsForRace(race);
      
      // Filter out only peasants (tier 0 population units)
      const summonableUnits = raceUnits.filter(unit => 
        unit.id !== 'peasant' // Peasants are population, not military
      );
      
      const trainableUnits = summonableUnits.map(convertToTrainableUnit);
      
      // Calculate accumulated gold spent from current units
      const kingdomStore = useKingdomStore.getState();
      const currentUnits = kingdomStore.units;
      let totalGoldSpent = 0;
      
      currentUnits.forEach(unit => {
        const unitData = raceUnits.find(u => u.id === unit.type);
        if (unitData) {
          totalGoldSpent += unitData.stats.cost.gold * unit.count;
        }
      });
      
      set({
        availableUnits: trainableUnits,
        accumulatedGoldSpent: totalGoldSpent,
        currentRace: race,
        loading: false,
        error: null
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load units',
        loading: false
      });
    }
  },

  // Calculate remaining capacity based on accumulated gold cost
  calculateRemainingCapacity: () => {
    const { accumulatedGoldSpent } = get();
    return TROOP_CAP_GOLD - accumulatedGoldSpent;
  },

  // Calculate max affordable units based on current gold
  calculateMaxAffordable: (unitGoldCost: number) => {
    const kingdomStore = useKingdomStore.getState();
    const currentGold = kingdomStore.resources.gold || 0;
    const remainingCapacity = get().calculateRemainingCapacity();
    
    // Limited by both current gold and remaining capacity
    const maxByGold = Math.floor(currentGold / unitGoldCost);
    const maxByCapacity = Math.floor(remainingCapacity / unitGoldCost);
    
    return Math.min(maxByGold, maxByCapacity);
  },

  // Calculate total upkeep cost for all units
  getTotalUpkeep: () => {
    const kingdomStore = useKingdomStore.getState();
    const { availableUnits } = get();
    
    let totalUpkeep = 0;
    kingdomStore.units.forEach(unit => {
      const unitData = availableUnits.find(u => u.id === unit.type);
      if (unitData && unitData.upkeep) {
        totalUpkeep += unitData.upkeep * unit.count;
      }
    });
    
    return totalUpkeep;
  },

  // Summon units (instant, gold-cost-based) - adds to kingdom store
  summonUnits: async (_kingdomId: string, unitType: string, quantity: number) => {
    if (get().loading) return;
    set({ loading: true, error: null });

    try {
      const kingdomStore = useKingdomStore.getState();
      const resources = kingdomStore.resources;
      const { availableUnits, accumulatedGoldSpent } = get();
      
      // Check turns using shared turn-mechanics cost calculation
      const turnCost = calculateActionTurnCost('TRAINING');
      if ((resources.turns || 0) < turnCost) {
        set({ error: `Not enough turns (need ${turnCost})`, loading: false });
        return;
      }
      
      // Get unit data for costs
      const unitData = availableUnits.find(u => u.id === unitType);
      
      if (!unitData) {
        set({ error: 'Unit type not found', loading: false });
        return;
      }

      // Calculate total costs
      const totalGold = unitData.goldCost * quantity;
      const totalPop = unitData.populationCost * quantity;
      
      // Check gold cap (accumulated gold cost)
      if (accumulatedGoldSpent + totalGold > TROOP_CAP_GOLD) {
        const remaining = TROOP_CAP_GOLD - accumulatedGoldSpent;
        const maxUnits = Math.floor(remaining / unitData.goldCost);
        set({ 
          error: `Troop cap reached! Can only summon ${maxUnits} more ${unitData.name} (${remaining.toLocaleString()}g capacity remaining)`, 
          loading: false 
        });
        return;
      }
      
      // Check resources
      if ((resources.gold || 0) < totalGold) {
        set({ error: `Not enough gold (need ${totalGold.toLocaleString()})`, loading: false });
        return;
      }
      
      if ((resources.population || 0) < totalPop) {
        set({ error: `Not enough population (need ${totalPop.toLocaleString()})`, loading: false });
        return;
      }
      
      // Calculate new upkeep
      const newUpkeep = (unitData.upkeep || 0) * quantity;
      const totalUpkeep = get().getTotalUpkeep() + newUpkeep;
      
      // Bankruptcy warning if upkeep > 10% of current gold
      if (totalUpkeep > (resources.gold || 0) * 0.1) {
        console.warn(`⚠️ High upkeep: ${totalUpkeep}g/turn (${Math.round(totalUpkeep / (resources.gold || 1) * 100)}% of treasury)`);
      }

      // Auth mode: call Lambda for server-authoritative unit training
      if (!isDemoMode()) {
        try {
          const result = await AmplifyFunctionService.callFunction('unit-trainer', {
            kingdomId: _kingdomId,
            unitType,
            quantity
          }) as any;

          const parsed = typeof result === 'string' ? JSON.parse(result) : result;
          if (!parsed.success) {
            set({ error: parsed.error || 'Failed to summon units', loading: false });
            return;
          }

          // Server handled resource deduction and unit creation
          // Update accumulated gold spent locally
          set({
            accumulatedGoldSpent: accumulatedGoldSpent + totalGold,
            loading: false
          });
          return;
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to summon units', loading: false });
          return;
        }
      }

      // Demo mode: existing local logic below
      // Deduct resources (turn cost from shared turn-mechanics)
      kingdomStore.updateResources({
        gold: (resources.gold || 0) - totalGold,
        population: (resources.population || 0) - totalPop,
        turns: (resources.turns || 0) - turnCost
      });

      // Add units
      const race = get().currentRace || 'HUMAN';
      const raceUnits = getUnitsForRace(race);
      const fullUnitData = raceUnits.find(u => u.id === unitType);
      
      if (fullUnitData) {
        kingdomStore.addUnits(unitType, quantity, {
          attack: fullUnitData.stats.offense,
          defense: fullUnitData.stats.defense,
          health: fullUnitData.stats.hitPoints
        });
      }

      // Update accumulated gold spent
      set({ 
        accumulatedGoldSpent: accumulatedGoldSpent + totalGold,
        loading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to summon units',
        loading: false 
      });
    }
  },

  clearError: () => set({ error: null }),
}));
