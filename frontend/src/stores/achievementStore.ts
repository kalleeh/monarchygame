import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { isDemoMode } from '../utils/authMode';

// Achievement categories
export const AchievementCategory = {
  COMBAT: 'COMBAT',
  ECONOMY: 'ECONOMY',
  TERRITORY: 'TERRITORY',
  SOCIAL: 'SOCIAL',
  MAGIC: 'MAGIC',
  EXPLORATION: 'EXPLORATION',
} as const;

export type AchievementCategory = typeof AchievementCategory[keyof typeof AchievementCategory];

// Achievement tiers
export const AchievementTier = {
  COMMON: 'COMMON',
  RARE: 'RARE',
  EPIC: 'EPIC',
  LEGENDARY: 'LEGENDARY',
} as const;

export type AchievementTier = typeof AchievementTier[keyof typeof AchievementTier];

// Achievement definition
export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon: string;
  criteria: {
    type: 'count' | 'threshold' | 'boolean';
    target: number;
  };
  reward?: {
    gold?: number;
    turns?: number;
  };
}

// Player progress
export interface AchievementProgress {
  achievementId: string;
  progress: number;
  completed: boolean;
  unlockedAt?: string;
}

// Store state
interface AchievementStore {
  achievements: Achievement[];
  progress: Record<string, AchievementProgress>;
  updateProgress: (achievementId: string, progress: number) => void;
  unlockAchievement: (achievementId: string, kingdomId?: string) => void;
  getProgress: (achievementId: string) => AchievementProgress | undefined;
  resetProgress: () => void;
  persistToDatabase: (kingdomId: string) => Promise<void>;
  loadFromDatabase: (kingdomId: string) => Promise<void>;
}

export const useAchievementStore = create<AchievementStore>()(
  persist(
    (set, get) => ({
      achievements: [],
      progress: {},

      updateProgress: (achievementId: string, progress: number) => {
        const achievement = get().achievements.find((a) => a.id === achievementId);
        if (!achievement) return;

        const currentProgress = get().progress[achievementId] || {
          achievementId,
          progress: 0,
          completed: false,
        };

        const newProgress = Math.min(progress, achievement.criteria.target);
        const completed = newProgress >= achievement.criteria.target;

        set((state) => ({
          progress: {
            ...state.progress,
            [achievementId]: {
              ...currentProgress,
              progress: newProgress,
              completed,
              unlockedAt: completed && !currentProgress.completed ? new Date().toISOString() : currentProgress.unlockedAt,
            },
          },
        }));
      },

      unlockAchievement: (achievementId: string, kingdomId?: string) => {
        const achievement = get().achievements.find((a) => a.id === achievementId);
        if (!achievement) return;

        set((state) => ({
          progress: {
            ...state.progress,
            [achievementId]: {
              achievementId,
              progress: achievement.criteria.target,
              completed: true,
              unlockedAt: new Date().toISOString(),
            },
          },
        }));

        // Persist to database in auth mode
        if (!isDemoMode() && kingdomId) {
          void get().persistToDatabase(kingdomId);
        }
      },

      getProgress: (achievementId: string) => {
        return get().progress[achievementId];
      },

      resetProgress: () => {
        set({ progress: {} });
      },

      persistToDatabase: async (kingdomId: string) => {
        if (isDemoMode()) return;

        const client = generateClient<Schema>();

        // Collect all completed achievement IDs from store state
        const unlockedIds = Object.values(get().progress)
          .filter((p) => p.completed)
          .map((p) => p.achievementId);

        try {
          const result = await client.models.Kingdom.get({ id: kingdomId });
          if (!result.data) return;

          const rawStats = result.data.stats;
          const currentStats: Record<string, unknown> =
            typeof rawStats === 'string'
              ? (JSON.parse(rawStats) as Record<string, unknown>)
              : ((rawStats ?? {}) as Record<string, unknown>);

          await client.models.Kingdom.update({
            id: kingdomId,
            stats: JSON.stringify({ ...currentStats, unlockedAchievements: unlockedIds }),
          });
        } catch (err) {
          console.error('[achievementStore] persistToDatabase failed:', err);
        }
      },

      loadFromDatabase: async (kingdomId: string) => {
        if (isDemoMode()) return;

        const client = generateClient<Schema>();

        try {
          const result = await client.models.Kingdom.get({ id: kingdomId });
          if (!result.data) return;

          const rawStats = result.data.stats;
          const stats: Record<string, unknown> =
            typeof rawStats === 'string'
              ? (JSON.parse(rawStats) as Record<string, unknown>)
              : ((rawStats ?? {}) as Record<string, unknown>);

          const serverIds = Array.isArray(stats.unlockedAchievements)
            ? (stats.unlockedAchievements as string[])
            : [];

          if (serverIds.length === 0) return;

          // Merge server achievements with localStorage achievements (union)
          const achievements = get().achievements;
          const currentProgress = get().progress;

          const merged: Record<string, AchievementProgress> = { ...currentProgress };

          for (const id of serverIds) {
            if (!merged[id]?.completed) {
              const achievement = achievements.find((a) => a.id === id);
              merged[id] = {
                achievementId: id,
                progress: achievement ? achievement.criteria.target : 1,
                completed: true,
                unlockedAt: merged[id]?.unlockedAt ?? new Date().toISOString(),
              };
            }
          }

          set({ progress: merged });
        } catch (err) {
          console.error('[achievementStore] loadFromDatabase failed:', err);
        }
      },
    }),
    {
      name: 'achievement-progress',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ progress: state.progress }),
    }
  )
);
