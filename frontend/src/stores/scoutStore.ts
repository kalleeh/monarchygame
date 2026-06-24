/**
 * Scout intel store — tracks which enemy kingdoms the player has successfully
 * scouted. The world map keys fog-of-war purely on distance from owned land, so
 * without this a successful scout had no way to reveal a distant target. The map
 * reads this set to un-fog the scouted kingdom's territories. Persisted so intel
 * survives reloads within a session.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ScoutState {
  /** Kingdom ids that have been successfully scouted. */
  scoutedKingdomIds: string[];
  markScouted: (kingdomId: string) => void;
  isScouted: (kingdomId: string) => boolean;
  reset: () => void;
}

export const useScoutStore = create<ScoutState>()(
  persist(
    (set, get) => ({
      scoutedKingdomIds: [],
      markScouted: (kingdomId: string) =>
        set((state) =>
          state.scoutedKingdomIds.includes(kingdomId)
            ? state
            : { scoutedKingdomIds: [...state.scoutedKingdomIds, kingdomId] }
        ),
      isScouted: (kingdomId: string) => get().scoutedKingdomIds.includes(kingdomId),
      reset: () => set({ scoutedKingdomIds: [] }),
    }),
    {
      name: 'scouted-kingdoms',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
