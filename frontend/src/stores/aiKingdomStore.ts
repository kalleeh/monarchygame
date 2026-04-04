/**
 * AI Kingdom Store - IQC Compliant
 * Integrity: Type-safe state management
 * Quality: Zustand best practices from Context7
 * Consistency: Matches existing store patterns
 */

import { create } from 'zustand';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { NETWORTH, AI_KINGDOM } from '../constants/gameConfig';
import { RACES } from '../../__mocks__/@game-data/races';
import { isDemoMode } from '../utils/authMode';

export interface AIKingdom {
  id: string;
  name: string;
  race: string;
  resources: {
    gold: number;
    population: number;
    land: number;
    turns: number;
  };
  units: {
    tier1: number;
    tier2: number;
    tier3: number;
    tier4: number;
  };
  difficulty: 'easy' | 'medium' | 'hard';
  networth: number;
  terrain?: string;
  terrainType?: string;
}

interface AIKingdomState {
  aiKingdoms: AIKingdom[];
  generateAIKingdoms: (count: number, playerNetworth: number) => void;
  loadAIKingdomsFromServer: () => Promise<void>;
  updateAIKingdom: (id: string, updates: Partial<AIKingdom>) => void;
  removeAIKingdom: (id: string) => void;
  reset: () => void;
}

// AI kingdom name generator
const AI_NAMES = [
  'Northern Empire', 'Shadow Realm', 'Golden Dynasty', 'Iron Fortress',
  'Crystal Kingdom', 'Storm Citadel', 'Ancient Dominion', 'Mystic Enclave',
  'Crimson Legion', 'Emerald Throne'
];

// Calculate networth
function calculateNetworth(kingdom: Omit<AIKingdom, 'networth' | 'difficulty'>): number {
  const landValue = kingdom.resources.land * NETWORTH.LAND_VALUE;
  const goldValue = kingdom.resources.gold;
  const unitValue = Object.values(kingdom.units).reduce((sum, count) => sum + count * NETWORTH.UNIT_VALUE, 0);
  return landValue + goldValue + unitValue;
}

// Generate AI kingdom based on difficulty
function generateAIKingdom(
  index: number,
  difficulty: 'easy' | 'medium' | 'hard',
  playerNetworth: number
): AIKingdom {
  const raceKeys = Object.keys(RACES);
  const randomRace = raceKeys[Math.floor(Math.random() * raceKeys.length)];
  
  // Scale resources based on difficulty relative to player
  const difficultyMultiplier = {
    easy: 0.7,
    medium: 1.0,
    hard: 1.3
  }[difficulty];
  
  // Use player networth directly as base
  const baseNetworth = Math.max(AI_KINGDOM.MINIMUM_NETWORTH, playerNetworth);

  // Calculate base resources from networth
  const baseLand = Math.floor(baseNetworth / AI_KINGDOM.LAND_WORTH);
  const baseGold = Math.floor(baseNetworth * 0.3);
  const basePopulation = Math.floor(baseLand * 2);
  
  const resources = {
    gold: Math.floor(baseGold * difficultyMultiplier * (0.8 + Math.random() * 0.4)),
    population: Math.floor(basePopulation * difficultyMultiplier * (0.8 + Math.random() * 0.4)),
    land: Math.floor(baseLand * difficultyMultiplier * (0.8 + Math.random() * 0.4)),
    turns: 50
  };
  
  const units = {
    tier1: Math.floor((baseLand / 10) * difficultyMultiplier * (0.8 + Math.random() * 0.4)),
    tier2: Math.floor((baseLand / 20) * difficultyMultiplier * (0.8 + Math.random() * 0.4)),
    tier3: Math.floor((baseLand / 40) * difficultyMultiplier * (0.8 + Math.random() * 0.4)),
    tier4: Math.floor((baseLand / 80) * difficultyMultiplier * (0.8 + Math.random() * 0.4))
  };
  
  const kingdom = {
    id: `ai-kingdom-${index}`,
    name: AI_NAMES[index % AI_NAMES.length],
    race: randomRace,
    resources,
    units,
    difficulty
  };
  
  return {
    ...kingdom,
    networth: calculateNetworth(kingdom)
  };
}

export const useAIKingdomStore = create<AIKingdomState>((set) => ({
  aiKingdoms: [],
  
  generateAIKingdoms: (count: number, playerNetworth: number) => {
    const kingdoms: AIKingdom[] = [];
    const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'easy', 'medium', 'medium', 'hard'];

    for (let i = 0; i < count; i++) {
      const difficulty = difficulties[i % difficulties.length];
      kingdoms.push(generateAIKingdom(i, difficulty, playerNetworth));
    }

    set({ aiKingdoms: kingdoms });
  },

  loadAIKingdomsFromServer: async () => {
    if (isDemoMode()) return; // demo mode uses generated kingdoms
    try {
      const client = generateClient<Schema>();
      const { data: allKingdoms } = await client.models.Kingdom.list({ limit: 100 });
      if (!allKingdoms || allKingdoms.length === 0) return;
      const data = allKingdoms.filter(k => (k as Record<string, unknown>).isAI === true);
      if (data.length === 0) return;
      const transformed = data.map(k => {
        const res = typeof k.resources === 'string' ? JSON.parse(k.resources) : (k.resources ?? {});
        const units = typeof k.totalUnits === 'string' ? JSON.parse(k.totalUnits) : (k.totalUnits ?? {});
        return {
          id: k.id,
          name: k.name ?? 'Unknown',
          race: k.race ?? 'Human',
          resources: {
            gold: res.gold ?? 50000,
            population: res.population ?? 10000,
            land: res.land ?? 800,
            turns: res.turns ?? 100,
          },
          units: {
            tier1: units.peasants ?? units.tier1 ?? 200,
            tier2: units.militia ?? units.tier2 ?? 100,
            tier3: units.knights ?? units.tier3 ?? 50,
            tier4: units.cavalry ?? units.tier4 ?? 20,
          },
          difficulty: 'medium' as const,
          networth: k.networth ?? ((res.land ?? 800) * 1000 + (res.gold ?? 50000)),
          isOnline: true,
          lastActive: new Date(),
        } as AIKingdom;
      });
      set({ aiKingdoms: transformed });
    } catch (err) {
      console.warn('[aiKingdomStore] Failed to load AI kingdoms from server:', err);
    }
  },

  updateAIKingdom: (id: string, updates: Partial<AIKingdom>) =>
    set((state) => ({
      aiKingdoms: state.aiKingdoms.map((kingdom) =>
        kingdom.id === id ? { ...kingdom, ...updates } : kingdom
      )
    })),
  
  removeAIKingdom: (id: string) =>
    set((state) => ({
      aiKingdoms: state.aiKingdoms.filter((kingdom) => kingdom.id !== id)
    })),
  
  reset: () => set({ aiKingdoms: [] })
}));
