import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
  unlockAchievement: (achievementId: string) => void;
  getProgress: (achievementId: string) => AchievementProgress | undefined;
  resetProgress: () => void;
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

      unlockAchievement: (achievementId: string) => {
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
      },

      getProgress: (achievementId: string) => {
        return get().progress[achievementId];
      },

      resetProgress: () => {
        set({ progress: {} });
      },
    }),
    {
      name: 'achievement-progress',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ progress: state.progress }),
    }
  )
);
