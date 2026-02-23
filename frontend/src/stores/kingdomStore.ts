import { create } from 'zustand';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { KingdomResources } from '../types/amplify';
import { calculateCurrentAge } from '../../../shared/mechanics/age-mechanics';
import type { AgeStatus } from '../../../shared/mechanics/age-mechanics';
import { isDemoMode } from '../utils/authMode';

const client = generateClient<Schema>();

export interface KingdomUnit {
  id: string;
  type: string;
  count: number;
  attack: number;
  defense: number;
  health: number;
}

interface KingdomData {
  resources: KingdomResources;
  units: KingdomUnit[];
}

interface KingdomState {
  kingdomId: string | null;
  resources: KingdomResources;
  units: KingdomUnit[];

  // Actions
  setKingdomId: (id: string) => Promise<void>;
  loadKingdom: (id: string) => Promise<void>;
  setResources: (resources: KingdomResources) => void;
  updateResources: (updates: Partial<KingdomResources>) => void;
  addGold: (amount: number) => void;
  addTurns: (amount: number) => void;
  spendGold: (amount: number) => boolean;
  spendTurns: (amount: number) => boolean;
  setUnits: (units: KingdomUnit[]) => void;
  addUnits: (unitType: string, count: number, stats: { attack: number; defense: number; health: number }) => void;
  removeUnits: (unitId: string, count: number) => void;
  updateUnitCount: (unitId: string, newCount: number) => void;
  syncFromServer: (serverState: { resources: KingdomResources; units: KingdomUnit[]; kingdomId?: string }) => void;
  syncToDatabase: () => Promise<void>;
  reset: () => void;
}

const initialResources: KingdomResources = {
  gold: 0,
  population: 0,
  land: 0,
  turns: 0
};

const getKingdomData = (kingdomId: string): KingdomData => {
  const stored = localStorage.getItem(`kingdom-${kingdomId}`);
  return stored ? JSON.parse(stored) : { resources: initialResources, units: [] };
};

const saveKingdomData = (kingdomId: string, data: KingdomData) => {
  localStorage.setItem(`kingdom-${kingdomId}`, JSON.stringify(data));
};

export const useKingdomStore = create<KingdomState>((set, get) => {
  let syncTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleDatabaseSync = () => {
    if (isDemoMode()) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => void get().syncToDatabase(), 3000);
  };

  return {
    kingdomId: null,
    resources: initialResources,
    units: [],

    setKingdomId: async (id: string) => {
      const localData = getKingdomData(id);
      set({ kingdomId: id, resources: localData.resources, units: localData.units });

      if (!isDemoMode()) {
        try {
          const result = await client.models.Kingdom.get({ id });
          if (result.data) {
            const serverResources = typeof result.data.resources === 'string'
              ? JSON.parse(result.data.resources)
              : (result.data.resources ?? localData.resources);
            const serverUnits = typeof result.data.totalUnits === 'string'
              ? Object.entries(JSON.parse(result.data.totalUnits)).map(([type, count]) => ({
                  id: `${type}-server`,
                  type,
                  count: count as number,
                  attack: 1, defense: 1, health: 1
                }))
              : localData.units;
            saveKingdomData(id, { resources: serverResources, units: serverUnits });
            set({ resources: serverResources, units: serverUnits });
          }
        } catch (err) {
          console.error('[kingdomStore] setKingdomId: Failed to load from server, using local data:', err);
        }
      }
    },

    loadKingdom: async (id: string) => {
      // Always load from localStorage first (instant, good for demo mode)
      const localData = getKingdomData(id);
      set({ kingdomId: id, resources: localData.resources, units: localData.units });

      // In auth mode, fetch authoritative state from server
      if (!isDemoMode()) {
        try {
          const result = await client.models.Kingdom.get({ id });
          if (result.data) {
            const serverResources = typeof result.data.resources === 'string'
              ? JSON.parse(result.data.resources)
              : (result.data.resources ?? localData.resources);
            const serverUnits = typeof result.data.totalUnits === 'string'
              ? Object.entries(JSON.parse(result.data.totalUnits)).map(([type, count]) => ({
                  id: `${type}-server`,
                  type,
                  count: count as number,
                  attack: 1, defense: 1, health: 1
                }))
              : localData.units;
            // Sync server state to local store and localStorage
            saveKingdomData(id, { resources: serverResources, units: serverUnits });
            set({ resources: serverResources, units: serverUnits });
          }
        } catch (err) {
          console.error('[kingdomStore] loadKingdom: Failed to load from server, using local data:', err);
        }
      }
    },

    setResources: (resources: KingdomResources) => {
      set({ resources });
      const { kingdomId } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units: get().units });
      // Intentionally no scheduleDatabaseSync — called on initial server load
    },

    updateResources: (updates: Partial<KingdomResources>) => {
      const current = get().resources;
      const merged = { ...current, ...updates };
      // Clamp all numeric values to >= 0
      const resources = Object.fromEntries(
        Object.entries(merged).map(([k, v]) => [k, typeof v === 'number' ? Math.max(0, v) : v])
      ) as KingdomResources;
      set({ resources });
      const { kingdomId, units } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units });
      scheduleDatabaseSync();
    },

    addGold: (amount: number) => {
      const resources = { ...get().resources, gold: (get().resources.gold || 0) + amount };
      set({ resources });
      const { kingdomId, units } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units });
      scheduleDatabaseSync();
    },

    addTurns: (amount: number) => {
      const resources = { ...get().resources, turns: (get().resources.turns || 0) + amount };
      set({ resources });
      const { kingdomId, units } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units });
      scheduleDatabaseSync();
    },

    spendGold: (amount: number) => {
      if (typeof amount !== 'number' || amount <= 0 || !isFinite(amount)) return false;
      const currentGold = get().resources.gold || 0;
      if (currentGold >= amount) {
        const resources = { ...get().resources, gold: currentGold - amount };
        set({ resources });
        const { kingdomId, units } = get();
        if (kingdomId) saveKingdomData(kingdomId, { resources, units });
        scheduleDatabaseSync();
        return true;
      }
      return false;
    },

    spendTurns: (amount: number) => {
      if (typeof amount !== 'number' || amount <= 0 || !isFinite(amount)) return false;
      const currentTurns = get().resources.turns || 0;
      if (currentTurns >= amount) {
        const resources = { ...get().resources, turns: currentTurns - amount };
        set({ resources });
        const { kingdomId, units } = get();
        if (kingdomId) saveKingdomData(kingdomId, { resources, units });
        scheduleDatabaseSync();
        return true;
      }
      return false;
    },

    setUnits: (units: KingdomUnit[]) => {
      set({ units });
      const { kingdomId, resources } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units });
      scheduleDatabaseSync();
    },

    addUnits: (unitType: string, count: number, stats: { attack: number; defense: number; health: number }) => {
      const existingUnit = get().units.find(u => u.type === unitType);
      const units = existingUnit
        ? get().units.map(u => u.type === unitType ? { ...u, count: u.count + count } : u)
        : [...get().units, { id: `${unitType}-${Date.now()}`, type: unitType, count, ...stats }];
      set({ units });
      const { kingdomId, resources } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units });
      scheduleDatabaseSync();
    },

    removeUnits: (unitId: string, count: number) => {
      const units = get().units.map(u => u.id === unitId ? { ...u, count: Math.max(0, u.count - count) } : u).filter(u => u.count > 0);
      set({ units });
      const { kingdomId, resources } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units });
      scheduleDatabaseSync();
    },

    updateUnitCount: (unitId: string, newCount: number) => {
      const units = get().units.map(u => u.id === unitId ? { ...u, count: newCount } : u).filter(u => u.count > 0);
      set({ units });
      const { kingdomId, resources } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units });
      scheduleDatabaseSync();
    },

    reset: () => set({ kingdomId: null, resources: initialResources, units: [] }),

    /**
     * Apply authoritative server state to the store.
     * Called after every Lambda response in auth mode.
     */
    syncFromServer: (serverState: { resources: KingdomResources; units: KingdomUnit[]; kingdomId?: string }) => {
      const kingdomId = serverState.kingdomId || get().kingdomId;
      const resources = serverState.resources;
      const units = serverState.units || get().units;

      set({ resources, units, kingdomId: kingdomId || get().kingdomId });

      // In demo mode, also persist to localStorage for consistency
      if (isDemoMode() && kingdomId) {
        saveKingdomData(kingdomId, { resources, units });
      }
      // No scheduleDatabaseSync — server data is already in the DB
    },

    /**
     * Persist kingdom resources and units to AppSync in authenticated mode.
     * Called automatically via 3-second debounce after any state mutation.
     * Converts the internal units array to the flat Record<type, count> the DB expects.
     */
    syncToDatabase: async () => {
      if (isDemoMode()) return;

      const { kingdomId, resources, units } = get();
      if (!kingdomId) return;

      // Convert KingdomUnit[] → Record<unitType, count> for the totalUnits JSON field
      const totalUnitsRecord: Record<string, number> = {};
      for (const unit of units) {
        totalUnitsRecord[unit.type] = unit.count;
      }

      try {
        await client.models.Kingdom.update({
          id: kingdomId,
          resources: JSON.stringify(resources),
          totalUnits: JSON.stringify(totalUnitsRecord),
          lastActive: new Date().toISOString()
        });
      } catch (error) {
        console.error('[kingdomStore] syncToDatabase failed:', error);
      }
    },
  };
});

/**
 * Calculate the current game age from an ageStartTime.
 * Components can call this with the kingdom's ageStartTime field.
 */
export const getKingdomAge = (ageStartTime: Date | string): AgeStatus => {
  const startDate = typeof ageStartTime === 'string' ? new Date(ageStartTime) : ageStartTime;
  return calculateCurrentAge(startDate);
};

export type { AgeStatus };
