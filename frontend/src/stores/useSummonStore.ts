import { create } from 'zustand';
import { type TrainableUnit } from '../services/TrainingService';
import { useKingdomStore } from './kingdomStore';
import { getUnitsForRace, type UnitType } from '../utils/units';
import { calculateActionTurnCost } from '../../../shared/mechanics/turn-mechanics';
import { isDemoMode } from '../utils/authMode';
import { trainUnits, refreshKingdomResources } from '../services/domain/TrainingService';
import { achievementTriggers } from '../utils/achievementTriggers';

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
  summonUnits: (kingdomId: string, unitType: string, quantity: number) => Promise<{ success: boolean; error?: string }>;
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
    const { availableUnits, currentRace } = get();

    // If availableUnits isn't loaded yet (e.g. dashboard before Summon page opened),
    // fall back to deriving upkeep directly from race definition.
    const raceUnits = availableUnits.length > 0
      ? availableUnits
      : getUnitsForRace(currentRace || 'Human').map(u => ({
          id: u.id, name: u.name, tier: u.tier,
          cost: u.stats.cost.gold, population: u.stats.cost.population,
          upkeep: u.stats.upkeep, attack: u.stats.offense, defense: u.stats.defense,
          health: u.stats.hitPoints,
        }));

    let totalUpkeep = 0;
    kingdomStore.units.forEach(unit => {
      const unitData = raceUnits.find(u => u.id === unit.type);
      if (unitData && unitData.upkeep) {
        totalUpkeep += unitData.upkeep * unit.count;
      }
    });

    return totalUpkeep;
  },

  // Summon units (instant, gold-cost-based) - adds to kingdom store
  summonUnits: async (_kingdomId: string, unitType: string, quantity: number): Promise<{ success: boolean; error?: string }> => {
    if (get().loading) return { success: false, error: 'Already loading' };
    set({ loading: true, error: null });

    try {
      const kingdomStore = useKingdomStore.getState();
      const resources = kingdomStore.resources;
      const { availableUnits, accumulatedGoldSpent } = get();
      
      // Check turns using shared turn-mechanics cost calculation
      const turnCost = calculateActionTurnCost('TRAINING');
      if ((resources.turns || 0) < turnCost) {
        set({ error: `Not enough turns (need ${turnCost})`, loading: false });
        return { success: false, error: `Not enough turns (need ${turnCost})` };
      }
      
      // Get unit data for costs
      const unitData = availableUnits.find(u => u.id === unitType);
      
      if (!unitData) {
        set({ error: 'Unit type not found', loading: false });
        return { success: false, error: 'Unit type not found' };
      }

      // Calculate total costs
      const totalGold = unitData.goldCost * quantity;
      const totalPop = unitData.populationCost * quantity;
      
      // Check gold cap (accumulated gold cost)
      if (accumulatedGoldSpent + totalGold > TROOP_CAP_GOLD) {
        const remaining = TROOP_CAP_GOLD - accumulatedGoldSpent;
        const maxUnits = Math.floor(remaining / unitData.goldCost);
        const capMsg = `Troop cap reached! Can only summon ${maxUnits} more ${unitData.name} (${remaining.toLocaleString()}g capacity remaining)`;
        set({ error: capMsg, loading: false });
        return { success: false, error: capMsg };
      }
      
      // Check resources
      if ((resources.gold || 0) < totalGold) {
        set({ error: `Not enough gold (need ${totalGold.toLocaleString()})`, loading: false });
        return { success: false, error: `Not enough gold (need ${totalGold.toLocaleString()})` };
      }
      
      if ((resources.population || 0) < totalPop) {
        set({ error: `Not enough population (need ${totalPop.toLocaleString()})`, loading: false });
        return { success: false, error: `Not enough population (need ${totalPop.toLocaleString()})` };
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
          const raw = await trainUnits({
            kingdomId: _kingdomId,
            unitType,
            quantity,
            goldCost: unitData.goldCost
          }) as unknown;

          // Amplify client wraps custom mutation responses in { data, errors };
          // unwrap .data when present, otherwise fall back to the raw value.
          const result = (raw && raw.data !== undefined) ? raw.data : raw;
          const parsed = typeof result === 'string' ? JSON.parse(result) : result;
          if (!parsed.success) {
            const rawError: string = parsed.error || 'Failed to summon units';
            // Give a clearer message when the kingdom is in post-battle restoration
            const userFacingError = parsed.errorCode === 'RESTORATION_BLOCKED' || rawError.toLowerCase().includes('restoration')
              ? 'Your kingdom is in restoration and cannot train units. Return to your dashboard to see when restoration ends.'
              : rawError;
            set({ error: userFacingError, loading: false });
            return { success: false, error: userFacingError };
          }

          // Server handled resource deduction and unit creation
          // Update accumulated gold spent locally
          set({
            accumulatedGoldSpent: accumulatedGoldSpent + totalGold,
            loading: false
          });

          // Refresh authoritative kingdom state (resources + units) from server
          void refreshKingdomResources(_kingdomId);

          // Fire achievement trigger on confirmed server unit training
          achievementTriggers.onGoldChanged();

          return { success: true };
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to summon units', loading: false });
          return { success: false, error: err instanceof Error ? err.message : 'Failed to summon units' };
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
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to summon units';
      set({ error: msg, loading: false });
      return { success: false, error: msg };
    }
  },

  clearError: () => set({ error: null }),
}));
