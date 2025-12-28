/**
 * Territory System State Management
 * IQC Compliant: Integrity (server validation), Quality (typed), Consistency (Zustand slices pattern)
 */

import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import { useKingdomStore } from './kingdomStore';

interface Territory {
  id: string;
  name: string;
  type: 'capital' | 'settlement' | 'outpost' | 'fortress';
  position: { x: number; y: number };
  ownerId: string;
  resources: {
    gold: number;
    population: number;
    land: number;
  };
  buildings: Record<string, number>;
  defenseLevel: number;
  adjacentTerritories: string[];
}

export type { Territory };

interface TerritoryExpansion {
  territoryId: string;
  cost: {
    gold: number;
    turns: number;
    population: number;
  };
  requirements: string[];
  timestamp: number;
}

export const useTerritoryStore = create(
  combine(
    {
      // Kingdom resources (demo mode)
      kingdomResources: {
        gold: 2000,
        population: 1000,
        land: 500
      },
      
      // Territory state
      territories: [] as Territory[],
      ownedTerritories: [] as Territory[],
      selectedTerritory: null as string | null,
      
      // Expansion state
      availableExpansions: [] as TerritoryExpansion[],
      pendingExpansions: [] as TerritoryExpansion[],
      expansionHistory: [] as Array<{
        territoryId: string;
        timestamp: number;
        success: boolean;
        cost: TerritoryExpansion['cost'];
      }>,
      
      // UI state
      showExpansionDialog: false,
      loading: false,
      error: null as string | null,
      
      // Initialization guard to prevent reset on component mount
      initialized: false,
    },
    (set, get) => ({
      // Territory management
      addTerritory: (territory: Territory) => {
        set((state) => ({
          territories: [...state.territories, territory]
        }));
      },

      updateTerritory: (territoryId: string, updates: Partial<Territory>) => {
        set((state) => ({
          territories: state.territories.map(t => 
            t.id === territoryId ? { ...t, ...updates } : t
          )
        }));
      },

      selectTerritory: (territoryId: string | null) => {
        set({ selectedTerritory: territoryId });
      },

      // Expansion management
      claimTerritory: async (territoryId: string) => {
        const state = get();
        const expansion = state.availableExpansions.find(e => e.territoryId === territoryId);
        
        if (!expansion) {
          set({ error: 'Territory not available for expansion' });
          return false;
        }

        // Get resources from centralized kingdom store
        const kingdomStore = useKingdomStore.getState();
        const kingdomResources = kingdomStore.resources;

        // Check if player has enough resources to claim
        if ((kingdomResources.gold || 0) < expansion.cost.gold) {
          set({ error: `Not enough gold! Need ${expansion.cost.gold.toLocaleString()}, have ${(kingdomResources.gold || 0).toLocaleString()}` });
          return false;
        }
        
        if ((kingdomResources.population || 0) < expansion.cost.population) {
          set({ error: `Not enough population! Need ${expansion.cost.population.toLocaleString()} settlers, have ${(kingdomResources.population || 0).toLocaleString()}` });
          return false;
        }

        set({ loading: true, error: null });

        try {
          // Server-side territory claiming would go here
          const success = true; // Mock success
          
          if (success) {
            // Find the territory object
            const territory = state.territories.find(t => t.id === territoryId);
            if (!territory) {
              set({ error: 'Territory not found', loading: false });
              return false;
            }

            // Update territory ownership and add settlers
            // The population moves FROM kingdom TO territory (settlers relocate)
            const updatedTerritory = { 
              ...territory, 
              ownerId: 'current-player',
              resources: {
                ...territory.resources,
                population: territory.resources.population + expansion.cost.population
              }
            };
            
            // Deduct costs from centralized kingdom store
            useKingdomStore.getState().updateResources({
              gold: (kingdomResources.gold || 0) - expansion.cost.gold,
              population: (kingdomResources.population || 0) - expansion.cost.population
            });
            
            set((state) => ({
              territories: state.territories.map(t => 
                t.id === territoryId ? updatedTerritory : t
              ),
              ownedTerritories: [...state.ownedTerritories, updatedTerritory],
              availableExpansions: state.availableExpansions.filter(e => e.territoryId !== territoryId),
              expansionHistory: [{
                territoryId,
                timestamp: Date.now(),
                success: true,
                cost: expansion.cost
              }, ...state.expansionHistory.slice(0, 49)],
              loading: false
            }));

            return true;
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Territory claim failed',
            loading: false 
          });
        }
        
        return false;
      },

      // Territory upgrades
      upgradeTerritory: async (territoryId: string) => {
        const state = get();
        const territory = state.territories.find(t => t.id === territoryId);
        
        if (!territory) {
          set({ error: 'Territory not found' });
          return false;
        }
        
        // Calculate upgrade cost (gold only - for construction and fortifications)
        const currentLevel = territory.defenseLevel || 0;
        const upgradeCost = Math.floor(200 * Math.pow(currentLevel + 1, 1.5));
        
        // Get resources from centralized kingdom store
        const kingdomStore = useKingdomStore.getState();
        const kingdomResources = kingdomStore.resources;
        
        // Check if player has enough gold
        if ((kingdomResources.gold || 0) < upgradeCost) {
          set({ error: `Not enough gold! Need ${upgradeCost.toLocaleString()}, have ${(kingdomResources.gold || 0).toLocaleString()}` });
          return false;
        }
        
        set({ loading: true, error: null });
        
        try {
          // Server-side upgrade logic would go here
          const success = true; // Mock success
          
          if (success) {
            const newLevel = currentLevel + 1;
            
            // Upgrading improves the territory's production capacity
            // The territory itself doesn't store resources, it just generates them per turn
            const upgradedTerritory = {
              ...territory,
              defenseLevel: newLevel
            };
            
            // Deduct gold cost from centralized kingdom store
            useKingdomStore.getState().updateResources({
              gold: (kingdomResources.gold || 0) - upgradeCost
            });
            
            set(state => ({
              territories: state.territories.map(t => 
                t.id === territoryId ? upgradedTerritory : t
              ),
              ownedTerritories: state.ownedTerritories.map(t =>
                t.id === territoryId ? upgradedTerritory : t
              )
            }));
          }
          
          set({ loading: false });
          return success;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Territory upgrade failed',
            loading: false 
          });
          return false;
        }
      },

      // Resource generation
      generateTerritoryResources: () => {
        const state = get();
        state.ownedTerritories.forEach(territory => {
          if (territory) {
            const baseGeneration = {
              gold: 10 * territory.defenseLevel,
              population: 5 * territory.defenseLevel,
              land: 2 * territory.defenseLevel
            };
            
            set(state => ({
              territories: state.territories.map(t => 
                t.id === territory.id 
                  ? {
                      ...t,
                      resources: {
                        gold: territory.resources.gold + baseGeneration.gold,
                        population: territory.resources.population + baseGeneration.population,
                        land: territory.resources.land + baseGeneration.land
                      }
                    }
                  : t
              )
            }));
          }
        });
      },

      // Utility functions
      getTerritoryById: (territoryId: string): Territory | undefined => {
        return get().territories.find(t => t.id === territoryId);
      },

      getOwnedTerritories: (): Territory[] => {
        const state = get();
        return state.ownedTerritories;
      },

      canClaimTerritory: (territoryId: string): boolean => {
        const state = get();
        const expansion = state.availableExpansions.find(e => e.territoryId === territoryId);
        if (!expansion || state.loading) return false;
        
        // Get resources from centralized kingdom store
        const kingdomResources = useKingdomStore.getState().resources;
        
        // Check if player has enough gold and population (settlers)
        return (
          (kingdomResources.gold || 0) >= expansion.cost.gold &&
          (kingdomResources.population || 0) >= expansion.cost.population
        );
      },
      
      getClaimCost: (territoryId: string) => {
        const expansion = get().availableExpansions.find(e => e.territoryId === territoryId);
        if (!expansion) return null;
        
        return {
          gold: expansion.cost.gold,
          population: expansion.cost.population
        };
      },
      
      getUpgradeCost: (territoryId: string) => {
        const territory = get().territories.find(t => t.id === territoryId);
        if (!territory) return null;
        
        const currentLevel = territory.defenseLevel || 0;
        // Upgrade cost: Gold only (for construction, fortifications, workers)
        // Cost scales exponentially to make higher levels more expensive
        return {
          gold: 200 * Math.pow(currentLevel + 1, 1.5)
        };
      },
      
      canAffordUpgrade: (territoryId: string): boolean => {
        const territory = get().territories.find(t => t.id === territoryId);
        if (!territory) return false;
        
        const currentLevel = territory.defenseLevel || 0;
        const cost = { gold: 200 * Math.pow(currentLevel + 1, 1.5) };
        
        // Get resources from centralized kingdom store
        const kingdomResources = useKingdomStore.getState().resources;
        return (kingdomResources.gold || 0) >= cost.gold;
      },

      // UI actions
      showExpansionDialog: (show: boolean) => {
        set({ showExpansionDialog: show });
      },

      clearError: () => {
        set({ error: null });
      },

      // Initialize with mock data (only once)
      initializeTerritories: () => {
        const state = get();
        
        // Guard: Only initialize if not already initialized
        if (state.initialized) {
          return;
        }
        
        const mockTerritories: Territory[] = [
          {
            id: 'capital-1',
            name: 'Royal Capital',
            type: 'capital',
            position: { x: 0, y: 0 },
            ownerId: 'current-player',
            resources: { gold: 1000, population: 500, land: 100 },
            buildings: { castle: 1, barracks: 2 },
            defenseLevel: 3,
            adjacentTerritories: ['settlement-1', 'settlement-2']
          },
          {
            id: 'settlement-1',
            name: 'Northern Outpost',
            type: 'settlement',
            position: { x: 100, y: -100 },
            ownerId: '',
            resources: { gold: 200, population: 100, land: 50 },
            buildings: {},
            defenseLevel: 1,
            adjacentTerritories: ['capital-1', 'fortress-1']
          },
          {
            id: 'settlement-2',
            name: 'Eastern Village',
            type: 'settlement',
            position: { x: 100, y: 100 },
            ownerId: '',
            resources: { gold: 150, population: 80, land: 40 },
            buildings: {},
            defenseLevel: 1,
            adjacentTerritories: ['capital-1', 'outpost-1']
          }
        ];

        const mockExpansions: TerritoryExpansion[] = [
          {
            territoryId: 'settlement-1',
            cost: { gold: 500, turns: 3, population: 50 },
            requirements: ['adjacent_territory'],
            timestamp: Date.now()
          },
          {
            territoryId: 'settlement-2',
            cost: { gold: 400, turns: 2, population: 40 },
            requirements: ['adjacent_territory'],
            timestamp: Date.now()
          }
        ];

        set({
          territories: mockTerritories,
          ownedTerritories: mockTerritories.filter(t => t.ownerId === 'current-player'),
          availableExpansions: mockExpansions,
          initialized: true
        });
      },

      // Reset state
      resetTerritoryState: () => {
        set({
          territories: [],
          ownedTerritories: [] as Territory[],
          selectedTerritory: null,
          availableExpansions: [],
          pendingExpansions: [],
          expansionHistory: [],
          showExpansionDialog: false,
          loading: false,
          error: null,
          initialized: false
        });
      }
    })
  )
);
