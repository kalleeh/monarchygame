/**
 * Territory System State Management
 * IQC Compliant: Integrity (server validation), Quality (typed), Consistency (Zustand slices pattern)
 */

import { create } from 'zustand';
import { combine } from 'zustand/middleware';

const DEMO_KINGDOM_ID = 'current-player';
import { useKingdomStore } from './kingdomStore';
import { calculateActionTurnCost } from '../../../shared/mechanics/turn-mechanics';
import { isDemoMode } from '../utils/authMode';
import { claimTerritory as claimTerritoryApi, upgradeTerritory as upgradeTerritoryApi } from '../services/domain/TerritoryService';
import { refreshKingdomResources } from '../services/domain/CombatService';

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
  regionId?: string;
  category?: 'farmland' | 'mine' | 'forest' | 'port' | 'stronghold' | 'ruins';
  /** True when loaded from server (has real DynamoDB UUID). False for client-side pending territories. */
  serverConfirmed?: boolean;
}

export type { Territory };

export interface PendingSettlement {
  regionId: string;         // which WORLD_REGIONS slot
  regionName: string;       // display name
  kingdomId: string;        // 'current-player' in demo mode
  turnsRemaining: number;   // countdown to completion
  totalTurns: number;       // original settling duration
  goldRefund: number;       // 50% of gold paid, returned if raided
  startedAtTurns: number;   // kingdom turns count when started
}

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
      pendingSettlements: [] as PendingSettlement[],
      
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
          territories: [...state.territories, territory],
          ownedTerritories: territory.ownerId === DEMO_KINGDOM_ID
            ? [...state.ownedTerritories, territory]
            : state.ownedTerritories,
        }));
      },

      // Settler mechanic actions
      startSettlement: (settlement: PendingSettlement): void => {
        set((state) => {
          const updated = [...state.pendingSettlements, settlement];
          localStorage.setItem('pendingSettlements', JSON.stringify(updated));
          return { pendingSettlements: updated };
        });
      },

      raidSettlement: (regionId: string): { refundGold: number } | null => {
        const state = get();
        const target = state.pendingSettlements.find(
          (ps) => ps.kingdomId !== DEMO_KINGDOM_ID && ps.regionId === regionId
        );
        if (!target) return null;
        const remaining = state.pendingSettlements.filter((ps) => ps !== target);
        localStorage.setItem('pendingSettlements', JSON.stringify(remaining));
        set({ pendingSettlements: remaining });
        return { refundGold: target.goldRefund };
      },

      tickSettlements: (turnsAdded: number): PendingSettlement[] => {
        const state = get();
        const completed: PendingSettlement[] = [];
        const remaining: PendingSettlement[] = [];

        for (const ps of state.pendingSettlements) {
          if (ps.kingdomId !== DEMO_KINGDOM_ID) {
            remaining.push(ps); // AI/other players' settlements don't tick (demo mode)
            continue;
          }
          const newTurns = ps.turnsRemaining - turnsAdded;
          if (newTurns <= 0) {
            completed.push(ps);
          } else {
            remaining.push({ ...ps, turnsRemaining: newTurns });
          }
        }

        localStorage.setItem('pendingSettlements', JSON.stringify(remaining));
        set({ pendingSettlements: remaining });
        return completed;
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
        if (get().loading) return false;
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

        // Check turns using shared turn-mechanics cost calculation
        const turnCost = calculateActionTurnCost('BUILDING');
        if ((kingdomResources.turns || 0) < turnCost) {
          set({ error: `Not enough turns! Need ${turnCost}, have ${kingdomResources.turns || 0}` });
          return false;
        }

        set({ loading: true, error: null });

        try {
          let success = true;

          if (!isDemoMode()) {
            // Auth mode: call Lambda for server-authoritative territory claiming
            const kingdomId = useKingdomStore.getState().kingdomId;
            if (!kingdomId) {
              set({ error: 'No kingdom selected', loading: false });
              return false;
            }

            try {
              const territory = state.territories.find(t => t.id === territoryId);
              const result = await claimTerritoryApi({
                kingdomId,
                name: territory?.name || 'New Territory',
                terrainType: 'plains',
                coordinates: territory?.position || { x: 0, y: 0 },
                territoryAmount: 1,
                goldCost: expansion.cost.gold
              });

              const parsed = typeof result === 'string' ? JSON.parse(result) : result;
              if (!parsed.success) {
                set({ error: parsed.error || 'Territory claim failed', loading: false });
                return false;
              }
              success = true;
            } catch (err) {
              set({ error: err instanceof Error ? err.message : 'Territory claim failed', loading: false });
              return false;
            }
          }

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
              ownerId: DEMO_KINGDOM_ID,
              resources: {
                ...territory.resources,
                population: territory.resources.population + expansion.cost.population
              }
            };
            
            // Deduct costs from centralized kingdom store (re-read fresh state to avoid race conditions)
            const freshResources = useKingdomStore.getState().resources;
            useKingdomStore.getState().updateResources({
              gold: (freshResources.gold || 0) - expansion.cost.gold,
              population: (freshResources.population || 0) - expansion.cost.population,
              turns: (freshResources.turns || 0) - turnCost
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

            // Sync authoritative resource values from server — the Lambda
            // deducts costs server-side; re-fetch to avoid local desync.
            if (!isDemoMode()) {
              const kingdomId = useKingdomStore.getState().kingdomId;
              if (kingdomId) void refreshKingdomResources(kingdomId);
            }

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
          const newLevel = currentLevel + 1;

          if (!isDemoMode()) {
            const result = await upgradeTerritoryApi(
              useKingdomStore.getState().kingdomId || '',
              territoryId,
              newLevel,
              upgradeCost
            );
            if (!result.success) {
              set({ error: result.error || 'Territory upgrade failed', loading: false });
              return false;
            }
            // Server deducted gold — refresh authoritative resources
            const kingdomId = useKingdomStore.getState().kingdomId;
            if (kingdomId) void refreshKingdomResources(kingdomId);
          } else {
            // Demo mode: deduct locally
            useKingdomStore.getState().updateResources({
              gold: (kingdomResources.gold || 0) - upgradeCost,
            });
          }

          const upgradedTerritory = { ...territory, defenseLevel: newLevel };
          set(state => ({
            territories: state.territories.map(t =>
              t.id === territoryId ? upgradedTerritory : t
            ),
            ownedTerritories: state.ownedTerritories.map(t =>
              t.id === territoryId ? upgradedTerritory : t
            ),
            loading: false,
          }));

          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Territory upgrade failed',
            loading: false,
          });
          return false;
        }
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

        // Load any saved pending settlements from localStorage
        const savedSettlements = localStorage.getItem('pendingSettlements');
        if (savedSettlements) {
          try {
            const parsed = JSON.parse(savedSettlements) as PendingSettlement[];
            set({ pendingSettlements: parsed });
          } catch { /* ignore malformed data */ }
        }
        
        const mockTerritories: Territory[] = [
          {
            id: 'capital-1',
            name: 'Royal Capital',
            type: 'capital',
            position: { x: 0, y: 0 },
            ownerId: DEMO_KINGDOM_ID,
            resources: { gold: 1000, population: 500, land: 100 },
            buildings: { castle: 1, barracks: 2 },
            defenseLevel: 3,
            adjacentTerritories: ['settlement-1', 'settlement-2'],
            regionId: 'wt-03',
            category: 'farmland'
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
            adjacentTerritories: ['capital-1', 'fortress-1'],
            regionId: 'wt-02',
            category: 'forest'
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
            adjacentTerritories: ['capital-1', 'outpost-1'],
            regionId: 'wt-04',
            category: 'farmland'
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
          ownedTerritories: mockTerritories.filter(t => t.ownerId === DEMO_KINGDOM_ID),
          availableExpansions: mockExpansions,
          initialized: true
        });
      },

      /** Load real territories from server (auth mode only) so upgrade/claim uses real DynamoDB IDs */
      loadTerritoriesFromServer: async (kingdomId: string) => {
        if (isDemoMode() || !kingdomId) return;
        try {
          const { generateClient } = await import('aws-amplify/data');
          type Schema = import('../../../amplify/data/resource').Schema;
          const client = generateClient<Schema>();
          const { data } = await client.models.Territory.list({
            filter: { kingdomId: { eq: kingdomId } },
            limit: 200,
          });
          // In auth mode, always use server data (even empty) — mock IDs cause upgrade failures
          if (!data) return;
          if (data.length === 0) { set({ ownedTerritories: [] }); return; }
          const serverTerritories: Territory[] = data.map(t => ({
            id: t.id,
            name: t.name ?? 'Territory',
            type: t.type ?? 'settlement',
            position: { x: 0, y: 0 },
            ownerId: 'current-player',
            resources: (() => { try { return typeof t.resources === 'string' ? JSON.parse(t.resources as string) : (t.resources ?? {}); } catch { return {}; } })(),
            buildings: (() => { try { return typeof t.buildings === 'string' ? JSON.parse(t.buildings as string) : (t.buildings ?? {}); } catch { return {}; } })(),
            defenseLevel: t.defenseLevel ?? 0,
            adjacentTerritories: [],
            regionId: t.regionId ?? undefined,
            category: (t.category as Territory['category']) ?? undefined,
            serverConfirmed: true,
          }));
          set({ ownedTerritories: serverTerritories });
        } catch (err) {
          console.error('[territoryStore] loadTerritoriesFromServer failed:', err);
        }
      },

      // Reset state
      resetTerritoryState: () => {
        set({
          territories: [],
          ownedTerritories: [] as Territory[],
          selectedTerritory: null,
          pendingSettlements: [] as PendingSettlement[],
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
