import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { CombatReplay } from '../types/combat';
import { isDemoMode } from '../utils/authMode';

interface CombatReplayStore {
  replays: CombatReplay[];
  addReplay: (replay: CombatReplay) => void;
  getReplay: (battleId: string) => CombatReplay | undefined;
  getRecentReplays: (limit?: number) => CombatReplay[];
  clearReplays: () => void;
  loadReplaysFromBattleReports: (kingdomId: string) => Promise<void>;
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

      loadReplaysFromBattleReports: async (kingdomId: string) => {
        if (isDemoMode()) return;
        try {
          const client = generateClient<Schema>();
          const { data: reports } = await client.models.BattleReport.list({
            filter: { or: [{ attackerId: { eq: kingdomId } }, { defenderId: { eq: kingdomId } }] },
            limit: 20,
          });
          for (const report of (reports ?? [])) {
            if (get().getReplay(report.id)) continue;
            try {
              const parsed: Record<string, unknown> = typeof report.result === 'string'
                ? JSON.parse(report.result as string)
                : ((report.result ?? {}) as Record<string, unknown>);
              if (!parsed.attackerUnits || !parsed.defenderUnits) continue;
              get().addReplay({
                id: report.id,
                battleId: report.id,
                attackerId: report.attackerId ?? '',
                attackerName: (parsed.attackerName as string) ?? report.attackerId ?? 'Attacker',
                defenderId: report.defenderId ?? '',
                defenderName: (parsed.defenderName as string) ?? report.defenderId ?? 'Defender',
                rounds: [],
                result: (parsed.result === 'victory' && report.attackerId === kingdomId) ? 'victory' : 'defeat',
                landGained: (parsed.landGained as number) ?? 0,
                timestamp: report.timestamp ?? new Date().toISOString(),
                terrain: 'PLAINS',
                attackerFormation: 'BALANCED',
                defenderFormation: 'BALANCED',
              });
            } catch { /* skip malformed */ }
          }
        } catch { /* non-fatal — local cache still works */ }
      },
    }),
    {
      name: 'combat-replays',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
