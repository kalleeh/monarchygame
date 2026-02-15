import { create } from 'zustand';
import type { KingdomResources } from '../types/amplify';
import { calculateCurrentAge } from '../../../shared/mechanics/age-mechanics';
import type { AgeStatus } from '../../../shared/mechanics/age-mechanics';

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
  setKingdomId: (id: string) => void;
  loadKingdom: (id: string) => void;
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

export const useKingdomStore = create<KingdomState>((set, get) => ({
  kingdomId: null,
  resources: initialResources,
  units: [],

  setKingdomId: (id: string) => {
    const data = getKingdomData(id);
    set({ kingdomId: id, resources: data.resources, units: data.units });
  },

  loadKingdom: (id: string) => {
    const data = getKingdomData(id);
    set({ kingdomId: id, resources: data.resources, units: data.units });
  },

  setResources: (resources: KingdomResources) => {
    set({ resources });
    const { kingdomId } = get();
    if (kingdomId) saveKingdomData(kingdomId, { resources, units: get().units });
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
  },

  addGold: (amount: number) => {
    const resources = { ...get().resources, gold: (get().resources.gold || 0) + amount };
    set({ resources });
    const { kingdomId, units } = get();
    if (kingdomId) saveKingdomData(kingdomId, { resources, units });
  },

  addTurns: (amount: number) => {
    const resources = { ...get().resources, turns: (get().resources.turns || 0) + amount };
    set({ resources });
    const { kingdomId, units } = get();
    if (kingdomId) saveKingdomData(kingdomId, { resources, units });
  },

  spendGold: (amount: number) => {
    if (typeof amount !== 'number' || amount <= 0 || !isFinite(amount)) return false;
    const currentGold = get().resources.gold || 0;
    if (currentGold >= amount) {
      const resources = { ...get().resources, gold: currentGold - amount };
      set({ resources });
      const { kingdomId, units } = get();
      if (kingdomId) saveKingdomData(kingdomId, { resources, units });
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
      return true;
    }
    return false;
  },

  setUnits: (units: KingdomUnit[]) => {
    set({ units });
    const { kingdomId, resources } = get();
    if (kingdomId) saveKingdomData(kingdomId, { resources, units });
  },

  addUnits: (unitType: string, count: number, stats: { attack: number; defense: number; health: number }) => {
    const existingUnit = get().units.find(u => u.type === unitType);
    const units = existingUnit
      ? get().units.map(u => u.type === unitType ? { ...u, count: u.count + count } : u)
      : [...get().units, { id: `${unitType}-${Date.now()}`, type: unitType, count, ...stats }];
    set({ units });
    const { kingdomId, resources } = get();
    if (kingdomId) saveKingdomData(kingdomId, { resources, units });
  },

  removeUnits: (unitId: string, count: number) => {
    const units = get().units.map(u => u.id === unitId ? { ...u, count: Math.max(0, u.count - count) } : u).filter(u => u.count > 0);
    set({ units });
    const { kingdomId, resources } = get();
    if (kingdomId) saveKingdomData(kingdomId, { resources, units });
  },

  updateUnitCount: (unitId: string, newCount: number) => {
    const units = get().units.map(u => u.id === unitId ? { ...u, count: newCount } : u).filter(u => u.count > 0);
    set({ units });
    const { kingdomId, resources } = get();
    if (kingdomId) saveKingdomData(kingdomId, { resources, units });
  },

  reset: () => set({ kingdomId: null, resources: initialResources, units: [] })
}));

/**
 * Calculate the current game age from an ageStartTime.
 * Components can call this with the kingdom's ageStartTime field.
 */
export const getKingdomAge = (ageStartTime: Date | string): AgeStatus => {
  const startDate = typeof ageStartTime === 'string' ? new Date(ageStartTime) : ageStartTime;
  return calculateCurrentAge(startDate);
};

export type { AgeStatus };
