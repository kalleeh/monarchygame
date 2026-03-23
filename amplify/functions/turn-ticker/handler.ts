/**
 * Turn ticker — scheduled Lambda invoked by EventBridge every 20 minutes.
 *
 * Generates +1 turn for every active kingdom, capped at MAX_STORED_TURNS (100).
 * This is the server-side equivalent of the client-side useTurnGeneration hook,
 * ensuring turns accumulate even when players are offline.
 *
 * Turn rate: 3/hour (1 per 20 min), matching the game's TURNS_PER_HOUR constant.
 */
import { dbList, dbAtomicAdd, dbUpdate } from '../data-client';
import { log } from '../logger';

const MAX_STORED_TURNS = 100;
const AI_GOLD_PER_TICK = 5000;
const AI_POPULATION_PER_TICK = 500;
const AI_GOLD_CAP = 500000;
const AI_POPULATION_CAP = 100000;
const AI_LAND_VARIANCE = 10; // ±10 land per tick

interface KingdomRow {
  id: string;
  isActive?: boolean;
  isAI?: boolean;
  turnsBalance?: number;
  encampEndTime?: string | null;
  encampBonusTurns?: number | null;
  resources?: string | Record<string, number>;
  totalUnits?: string | Record<string, number>;
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

        // Encamp completion check: if the encamp window has closed, atomically
        // credit the stored bonus turns and clear the encamp fields.
        if (kingdom.encampEndTime) {
          const encampEnd = new Date(kingdom.encampEndTime).getTime();
          if (encampEnd <= Date.now() && kingdom.encampBonusTurns) {
            const bonus = kingdom.encampBonusTurns;
            try {
              await dbAtomicAdd('Kingdom', kingdom.id, 'turnsBalance', bonus);
              await dbUpdate('Kingdom', kingdom.id, {
                encampEndTime: null,
                encampBonusTurns: null,
              });
              log.info('turn-ticker', 'encamp-bonus-awarded', { kingdomId: kingdom.id, bonus });
            } catch (encampErr) {
              log.error('turn-ticker', encampErr, { kingdomId: kingdom.id, context: 'encamp-bonus' });
            }
          }
        }
      } catch (err) {
        log.error('turn-ticker', err, { kingdomId: kingdom.id });
        skipped++;
      }
    }

    // Process AI kingdoms: apply income and slight land variance each tick
    const aiKingdoms = kingdoms.filter(k => k.isAI === true && k.isActive === true);
    let aiTicked = 0;
    for (const kingdom of aiKingdoms) {
      try {
        const rawResources = kingdom.resources;
        const resources: Record<string, number> = typeof rawResources === 'string'
          ? (JSON.parse(rawResources) as Record<string, number>)
          : ((rawResources ?? {}) as Record<string, number>);

        const newGold = Math.min(AI_GOLD_CAP, (resources.gold ?? 0) + AI_GOLD_PER_TICK);
        const newPopulation = Math.min(AI_POPULATION_CAP, (resources.population ?? 0) + AI_POPULATION_PER_TICK);
        const landDelta = Math.floor(Math.random() * (AI_LAND_VARIANCE * 2 + 1)) - AI_LAND_VARIANCE;
        const newLand = Math.max(100, (resources.land ?? 800) + landDelta);

        const rawTotalUnits = (kingdom as Record<string, unknown>).totalUnits;
        const totalUnitsMap = typeof rawTotalUnits === 'string'
          ? (JSON.parse(rawTotalUnits) as Record<string, number>)
          : ((rawTotalUnits ?? {}) as Record<string, number>);
        const totalUnits = Object.values(totalUnitsMap).reduce((sum, n) => sum + (n ?? 0), 0);
        const networth = newLand * 1000 + newGold + totalUnits * 100;

        await dbUpdate('Kingdom', kingdom.id, {
          resources: JSON.stringify({ ...resources, gold: newGold, population: newPopulation, land: newLand }),
          networth,
        });
        aiTicked++;
      } catch (err) {
        log.error('turn-ticker', err, { kingdomId: kingdom.id, context: 'ai-tick' });
      }
    }

    log.info('turn-ticker', 'tick', { ticked, skipped, total: active.length, aiTicked });
    return { success: true, ticked, skipped };
  } catch (err) {
    log.error('turn-ticker', err);
    return { success: false, ticked: 0, skipped: 0 };
  }
};
