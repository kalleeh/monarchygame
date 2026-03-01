/**
 * Turn ticker — scheduled Lambda invoked by EventBridge every 20 minutes.
 *
 * Generates +1 turn for every active kingdom, capped at MAX_STORED_TURNS (100).
 * This is the server-side equivalent of the client-side useTurnGeneration hook,
 * ensuring turns accumulate even when players are offline.
 *
 * Turn rate: 3/hour (1 per 20 min), matching the game's TURNS_PER_HOUR constant.
 */
import { dbList, dbAtomicAdd } from '../data-client';
import { log } from '../logger';

const MAX_STORED_TURNS = 100;

interface KingdomRow {
  id: string;
  isActive?: boolean;
  turnsBalance?: number;
}

export const handler = async (_event: unknown): Promise<{ success: boolean; ticked: number; skipped: number }> => {
  try {
    const kingdoms = await dbList<KingdomRow>('Kingdom');
    const active = kingdoms.filter(k => k.isActive === true);

    let ticked = 0;
    let skipped = 0;

    for (const kingdom of active) {
      try {
        // Skip kingdoms that have already accumulated the cap in turnsBalance.
        // turnsBalance is a separate top-level Number attribute updated atomically,
        // so this ADD never races with the action lambdas that write the resources JSON.
        const currentBalance = kingdom.turnsBalance ?? 0;

        if (currentBalance >= MAX_STORED_TURNS) {
          skipped++;
          continue;
        }

        await dbAtomicAdd('Kingdom', kingdom.id, 'turnsBalance', 1);
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
