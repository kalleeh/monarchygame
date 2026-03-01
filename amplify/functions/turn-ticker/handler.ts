/**
 * Turn ticker — scheduled Lambda invoked by EventBridge every 20 minutes.
 *
 * Generates +1 turn for every active kingdom, capped at MAX_STORED_TURNS (100).
 * This is the server-side equivalent of the client-side useTurnGeneration hook,
 * ensuring turns accumulate even when players are offline.
 *
 * Turn rate: 3/hour (1 per 20 min), matching the game's TURNS_PER_HOUR constant.
 */
import { dbList, dbUpdate } from '../data-client';
import { log } from '../logger';

const MAX_STORED_TURNS = 100;

interface KingdomRow {
  id: string;
  isActive?: boolean;
  resources?: string | Record<string, unknown>;
}

export const handler = async (_event: unknown): Promise<{ success: boolean; ticked: number; skipped: number }> => {
  try {
    const kingdoms = await dbList<KingdomRow>('Kingdom');
    const active = kingdoms.filter(k => k.isActive === true);

    let ticked = 0;
    let skipped = 0;

    for (const kingdom of active) {
      try {
        const resources: Record<string, number> = typeof kingdom.resources === 'string'
          ? JSON.parse(kingdom.resources)
          : { ...(kingdom.resources ?? {}) } as Record<string, number>;

        const currentTurns = (resources.turns ?? 0) as number;

        if (currentTurns >= MAX_STORED_TURNS) {
          skipped++;
          continue;
        }

        const newTurns = Math.min(currentTurns + 1, MAX_STORED_TURNS);
        const updatedResources = { ...resources, turns: newTurns };

        await dbUpdate('Kingdom', kingdom.id, { resources: updatedResources });
        ticked++;
      } catch (err) {
        log.error('turn-ticker', err, { kingdomId: kingdom.id });
        skipped++;
      }
    }

    log.info('turn-ticker', 'tick', { ticked, skipped, total: active.length });
    return { success: true, ticked, skipped };
  } catch (err) {
    log.error('turn-ticker', err);
    return { success: false, ticked: 0, skipped: 0 };
  }
};
