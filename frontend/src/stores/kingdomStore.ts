import { create } from 'zustand';
import { getClient } from '../utils/amplifyClient';
import type { KingdomResources } from '../types/amplify';
import { calculateCurrentAge } from '../../../shared/mechanics/age-mechanics';
import type { AgeStatus } from '../../../shared/mechanics/age-mechanics';
import { isDemoMode } from '../utils/authMode';
import { getUnitsForRace } from '../utils/units';
import { parseKingdomResources, parseKingdomUnits } from '../utils/dynamoDbParsers';

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
  buildings?: Record<string, number>;
}

interface KingdomState {
  kingdomId: string | null;
  resources: KingdomResources;
  units: KingdomUnit[];
  buildings: Record<string, number>;

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
  setBuildings: (buildings: Record<string, number>) => void;
  syncFromServer: (serverState: { resources: KingdomResources; units: KingdomUnit[]; kingdomId?: string; buildings?: Record<string, number> }) => void;
  syncToDatabase: () => Promise<void>;
  reset: () => void;
}

const initialResources: KingdomResources = {
  gold: 0,
  population: 0,
  land: 0,
  turns: 0
};

const MAX_TURNS = 250;

/** Parse a buildings field that may be a JSON string, an object, or absent. */
const parseBuildings = (raw: unknown): Record<string, number> => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as Record<string, number>; } catch { return {}; }
  }
  return raw as Record<string, number>;
};

const getKingdomData = (kingdomId: string): KingdomData => {
  const stored = localStorage.getItem(`kingdom-${kingdomId}`);
  let data: KingdomData;
  try {
    data = stored ? JSON.parse(stored) : { resources: initialResources, units: [], buildings: {} };
  } catch {
    data = { resources: initialResources, units: [], buildings: {} };
  }
  // Clamp stored turns to the game cap (prevents pre-existing values exceeding the limit)
  if (data.resources?.turns !== undefined) {
    data.resources.turns = Math.min(MAX_TURNS, data.resources.turns);
  }
  data.buildings = parseBuildings(data.buildings);
  return data;
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
    buildings: {},

    setKingdomId: async (id: string) => {
      const localData = getKingdomData(id);
      set({ kingdomId: id, resources: localData.resources, units: localData.units, buildings: localData.buildings ?? {} });

      if (!isDemoMode()) {
        try {
          const result = await getClient().models.Kingdom.get({ id });
          if (result.data) {
            const serverResources = parseKingdomResources(result.data.resources ?? localData.resources);
            // turnsBalance is the server-authoritative turn count; overlay it for display.
            const turnsBalance = (result.data as Record<string, unknown>).turnsBalance;
            if (turnsBalance != null) {
              serverResources.turns = Number(turnsBalance);
            }
            const raceKey = result.data.race || 'Human';
            const raceUnits = getUnitsForRace(raceKey);
            const serverUnits = typeof result.data.totalUnits === 'string'
              ? Object.entries(parseKingdomUnits(result.data.totalUnits))
                  .filter(([, count]) => count > 0)
                  .map(([type, count]) => {
                    const def = raceUnits.find(u => u.id === type);
                    return {
                      id: `${type}-server`,
                      type,
                      count,
                      attack: def?.stats.offense ?? 1,
                      defense: def?.stats.defense ?? 1,
                      health: def?.stats.hitPoints ?? 10,
                    };
                  })
              : localData.units;
            const serverBuildings = parseBuildings((result.data as Record<string, unknown>).buildings ?? localData.buildings);
            saveKingdomData(id, { resources: serverResources, units: serverUnits, buildings: serverBuildings });
            set({ resources: serverResources, units: serverUnits, buildings: serverBuildings });
          }
        } catch (err) {
          console.error('[kingdomStore] setKingdomId: Failed to load from server, using local data:', err);
        }
      }
    },

    loadKingdom: async (id: string) => {
      // Always load from localStorage first (instant, good for demo mode)
      const localData = getKingdomData(id);
      set({ kingdomId: id, resources: localData.resources, units: localData.units, buildings: localData.buildings ?? {} });

      // In auth mode, fetch authoritative state from server
      if (!isDemoMode()) {
        try {
          const result = await getClient().models.Kingdom.get({ id });
          if (result.data) {
            const serverResources = parseKingdomResources(result.data.resources ?? localData.resources);
            const raceKey = result.data.race || 'Human';
            // turnsBalance is the server-authoritative turn count; overlay it for display.
            const turnsBalance = (result.data as Record<string, unknown>).turnsBalance;
            if (turnsBalance != null) {
              serverResources.turns = Number(turnsBalance);
            }
            const raceUnits = getUnitsForRace(raceKey);
            const serverUnits = typeof result.data.totalUnits === 'string'
              ? Object.entries(parseKingdomUnits(result.data.totalUnits))
                  .filter(([, count]) => count > 0)
                  .map(([type, count]) => {
                    const def = raceUnits.find(u => u.id === type);
                    return {
                      id: `${type}-server`,
                      type,
                      count,
                      attack: def?.stats.offense ?? 1,
                      defense: def?.stats.defense ?? 1,
                      health: def?.stats.hitPoints ?? 10,
                    };
                  })
              : localData.units;
            const serverBuildings = parseBuildings((result.data as Record<string, unknown>).buildings ?? localData.buildings);
            // Sync server state to local store and localStorage
            saveKingdomData(id, { resources: serverResources, units: serverUnits, buildings: serverBuildings });
            set({ resources: serverResources, units: serverUnits, buildings: serverBuildings });
          }
        } catch (err) {
          console.error('[kingdomStore] loadKingdom: Failed to load from server, using local data:', err);
        }
      }
    },

    setResources: (resources: KingdomResources) => {
      set({ resources });
      const { kingdomId } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units: get().units, buildings: get().buildings });
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
      if (kingdomId) saveKingdomData(kingdomId, { resources, units, buildings: get().buildings });
      scheduleDatabaseSync();
    },

    addGold: (amount: number) => {
      const resources = { ...get().resources, gold: (get().resources.gold || 0) + amount };
      set({ resources });
      const { kingdomId, units } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units, buildings: get().buildings });
      scheduleDatabaseSync();
    },

    addTurns: (amount: number) => {
      const resources = { ...get().resources, turns: (get().resources.turns || 0) + amount };
      set({ resources });
      const { kingdomId, units } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units, buildings: get().buildings });
      scheduleDatabaseSync();
    },

    spendGold: (amount: number) => {
      if (typeof amount !== 'number' || amount <= 0 || !isFinite(amount)) return false;
      const currentGold = get().resources.gold || 0;
      if (currentGold >= amount) {
        const resources = { ...get().resources, gold: currentGold - amount };
        set({ resources });
        const { kingdomId, units } = get();
        if (kingdomId) saveKingdomData(kingdomId, { resources, units, buildings: get().buildings });
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
        if (kingdomId) saveKingdomData(kingdomId, { resources, units, buildings: get().buildings });
        scheduleDatabaseSync();
        return true;
      }
      return false;
    },

    setUnits: (units: KingdomUnit[]) => {
      set({ units });
      const { kingdomId, resources } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units, buildings: get().buildings });
      scheduleDatabaseSync();
    },

    addUnits: (unitType: string, count: number, stats: { attack: number; defense: number; health: number }) => {
      const existingUnit = get().units.find(u => u.type === unitType);
      const units = existingUnit
        ? get().units.map(u => u.type === unitType ? { ...u, count: u.count + count } : u)
        : [...get().units, { id: `${unitType}-${Date.now()}`, type: unitType, count, ...stats }];
      set({ units });
      const { kingdomId, resources } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units, buildings: get().buildings });
      scheduleDatabaseSync();
    },

    removeUnits: (unitId: string, count: number) => {
      const units = get().units.map(u => u.id === unitId ? { ...u, count: Math.max(0, u.count - count) } : u).filter(u => u.count > 0);
      set({ units });
      const { kingdomId, resources } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units, buildings: get().buildings });
      scheduleDatabaseSync();
    },

    updateUnitCount: (unitId: string, newCount: number) => {
      const units = get().units.map(u => u.id === unitId ? { ...u, count: newCount } : u).filter(u => u.count > 0);
      set({ units });
      const { kingdomId, resources } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units, buildings: get().buildings });
      scheduleDatabaseSync();
    },

    setBuildings: (buildings: Record<string, number>) => {
      set({ buildings });
      const { kingdomId, resources, units } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units, buildings });
    },

    reset: () => {
      if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
      set({ kingdomId: null, resources: initialResources, units: [], buildings: {} });
    },

    /**
     * Apply authoritative server state to the store.
     * Called after every Lambda response in auth mode.
     */
    syncFromServer: (serverState: { resources: KingdomResources; units: KingdomUnit[]; kingdomId?: string; buildings?: Record<string, number> }) => {
      const kingdomId = serverState.kingdomId || get().kingdomId;
      const resources = serverState.resources;
      const units = serverState.units || get().units;
      const buildings = serverState.buildings ?? get().buildings;

      set({ resources, units, buildings, kingdomId: kingdomId || get().kingdomId });

      // In demo mode, also persist to localStorage for consistency
      if (isDemoMode() && kingdomId) {
        saveKingdomData(kingdomId, { resources, units, buildings });
      }
      // No scheduleDatabaseSync — server data is already in the DB
    },

    /**
     * Update the safe presence fields (lastActive) on the Kingdom record.
     * Sensitive fields (resources, totalUnits) are written only by Lambda functions —
     * direct client writes are blocked by the Kingdom authorization model.
     */
    syncToDatabase: async () => {
      if (isDemoMode()) return;

      const { kingdomId } = get();
      if (!kingdomId) return;

      try {
        // Only lastActive is safe for the owner to write directly
        await getClient().models.Kingdom.update({
          id: kingdomId,
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
