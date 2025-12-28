import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CombatReplay } from '../types/combat';

interface CombatReplayStore {
  replays: CombatReplay[];
  addReplay: (replay: CombatReplay) => void;
  getReplay: (battleId: string) => CombatReplay | undefined;
  getRecentReplays: (limit?: number) => CombatReplay[];
  clearReplays: () => void;
}

export const useCombatReplayStore = create<CombatReplayStore>()(
  persist(
    (set, get) => ({
      replays: [],

      addReplay: (replay: CombatReplay) => {
        set((state) => ({
          replays: [replay, ...state.replays].slice(0, 50), // Keep last 50 replays
        }));
      },

      getReplay: (battleId: string) => {
        return get().replays.find((r) => r.battleId === battleId);
      },

      getRecentReplays: (limit = 10) => {
        return get().replays.slice(0, limit);
      },

      clearReplays: () => {
        set({ replays: [] });
      },
    }),
    {
      name: 'combat-replays',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
