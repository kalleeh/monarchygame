import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { configureAmplify } from '../amplify-configure';

configureAmplify();
const client = generateClient<Schema>({ authMode: 'iam' });

const SEASON_DURATION_WEEKS = 6;
const AGE_DURATION_WEEKS = 2;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Calculate networth for ranking: land * 1000 + gold */
function calculateNetworth(resources: Record<string, number>): number {
  return (resources.land ?? 0) * 1000 + (resources.gold ?? 0);
}

/**
 * Rank all active kingdoms by networth and store the result in each kingdom's
 * stats JSON as { previousSeasonRank, previousSeasonNetworth, previousSeasonNumber }.
 * Called when any season transitions to "completed".
 */
async function recordSeasonRankings(seasonNumber: number): Promise<void> {
  const { data: kingdoms } = await client.models.Kingdom.list({
    filter: { isActive: { eq: true } }
  });
  if (!kingdoms || kingdoms.length === 0) return;

  // Parse resources (stored as JSON string in DB) and compute networth
  const ranked = kingdoms
    .map((k: typeof kingdoms[0]) => {
      const resources = typeof k.resources === 'string'
        ? (JSON.parse(k.resources) as Record<string, number>)
        : ((k.resources ?? {}) as Record<string, number>);
      return { id: k.id, networth: calculateNetworth(resources), stats: k.stats };
    })
    .sort((a, b) => b.networth - a.networth);

  // Write rank back to each kingdom's stats JSON
  for (let i = 0; i < ranked.length; i++) {
    const { id, networth, stats } = ranked[i];
    const existingStats = typeof stats === 'string'
      ? (JSON.parse(stats) as Record<string, unknown>)
      : ((stats ?? {}) as Record<string, unknown>);
    const updatedStats = {
      ...existingStats,
      previousSeasonRank: i + 1,
      previousSeasonNetworth: networth,
      previousSeasonNumber: seasonNumber,
    };
    await client.models.Kingdom.update({ id, stats: updatedStats });
  }
}

type GameAge = 'early' | 'middle' | 'late';

function calculateCurrentAge(startDate: Date): GameAge {
  const elapsed = Date.now() - startDate.getTime();
  const weeksElapsed = elapsed / WEEK_MS;
  if (weeksElapsed < AGE_DURATION_WEEKS) return 'early';
  if (weeksElapsed < AGE_DURATION_WEEKS * 2) return 'middle';
  return 'late';
}

function isSeasonExpired(startDate: Date): boolean {
  return (Date.now() - startDate.getTime()) >= SEASON_DURATION_WEEKS * WEEK_MS;
}

/**
 * Season lifecycle handler — manages season creation, age transitions, and expiry.
 * Intended to be called by a scheduled event (e.g., EventBridge rule every hour)
 * or by an admin mutation.
 */
export const handler: Schema["manageSeason"]["functionHandler"] = async (event) => {
  const args = event.arguments;

  try {
    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return JSON.stringify({ success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED });
    }

    const action = args.action;

    switch (action) {
      case 'create': {
        // Create a new season
        const { data: activeSeasons } = await client.models.GameSeason.list({
          filter: { status: { eq: 'active' } }
        });

        if (activeSeasons && activeSeasons.length > 0) {
          return JSON.stringify({ success: false, error: 'An active season already exists', errorCode: ErrorCode.VALIDATION_FAILED });
        }

        // Find the latest season number
        const { data: allSeasons } = await client.models.GameSeason.list();
        const maxNumber = allSeasons?.reduce((max: number, s: { seasonNumber: number }) => Math.max(max, s.seasonNumber), 0) ?? 0;

        const season = await client.models.GameSeason.create({
          seasonNumber: maxNumber + 1,
          status: 'active',
          startDate: new Date().toISOString(),
          currentAge: 'early',
          ageTransitions: JSON.stringify({ early: new Date().toISOString() }),
          participantCount: 0
        });

        log.info('season-lifecycle', 'createSeason', { seasonNumber: maxNumber + 1 });
        return JSON.stringify({
          success: true,
          season: {
            id: season.data?.id,
            seasonNumber: maxNumber + 1,
            status: 'active',
            currentAge: 'early'
          }
        });
      }

      case 'check': {
        // Check and update all active seasons (age transitions + expiry)
        const { data: activeSeasons } = await client.models.GameSeason.list({
          filter: { status: { eq: 'active' } }
        });

        if (!activeSeasons || activeSeasons.length === 0) {
          return JSON.stringify({ success: true, message: 'No active seasons to process' });
        }

        const results = [];
        for (const season of activeSeasons) {
          const startDate = new Date(season.startDate);

          // Check expiry
          if (isSeasonExpired(startDate)) {
            // Record final rankings before closing the season
            await recordSeasonRankings(season.seasonNumber);

            await client.models.GameSeason.update({
              id: season.id,
              status: 'completed',
              endDate: new Date().toISOString()
            });

            // Clean up: expire all open trade offers
            const { data: openOffers } = await client.models.TradeOffer.list({
              filter: { seasonId: { eq: season.id }, status: { eq: 'open' } }
            });
            if (openOffers) {
              for (const offer of openOffers) {
                await client.models.TradeOffer.update({ id: offer.id, status: 'expired' });
                // Refund escrowed resources
                const { data: seller } = await client.models.Kingdom.get({ id: offer.sellerId });
                if (seller) {
                  const resources = (seller.resources ?? {}) as Record<string, number>;
                  resources[offer.resourceType] = (resources[offer.resourceType] ?? 0) + offer.quantity;
                  await client.models.Kingdom.update({ id: offer.sellerId, resources });
                }
              }
            }

            results.push({ seasonId: season.id, action: 'completed', seasonNumber: season.seasonNumber });
            continue;
          }

          // Check age transition
          const currentAge = calculateCurrentAge(startDate);
          if (currentAge !== season.currentAge) {
            const transitions = JSON.parse((season.ageTransitions as string) || '{}');
            transitions[currentAge] = new Date().toISOString();

            await client.models.GameSeason.update({
              id: season.id,
              currentAge,
              ageTransitions: JSON.stringify(transitions)
            });

            results.push({ seasonId: season.id, action: 'age_transition', from: season.currentAge, to: currentAge });
          } else {
            results.push({ seasonId: season.id, action: 'no_change', currentAge });
          }
        }

        log.info('season-lifecycle', 'checkSeasons', { processedCount: results.length });
        return JSON.stringify({ success: true, processed: results });
      }

      case 'end': {
        // Force-end a specific season
        const seasonId = args.seasonId;
        if (!seasonId) {
          return JSON.stringify({ success: false, error: 'seasonId required for end action', errorCode: ErrorCode.MISSING_PARAMS });
        }

        const { data: season } = await client.models.GameSeason.get({ id: seasonId });
        if (!season) {
          return JSON.stringify({ success: false, error: 'Season not found', errorCode: ErrorCode.NOT_FOUND });
        }

        // Record final rankings before closing the season
        await recordSeasonRankings(season.seasonNumber);

        await client.models.GameSeason.update({
          id: seasonId,
          status: 'completed',
          endDate: new Date().toISOString()
        });

        log.info('season-lifecycle', 'endSeason', { seasonId });
        return JSON.stringify({ success: true, seasonId, action: 'force_ended' });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}`, errorCode: ErrorCode.INVALID_PARAM });
    }
  } catch (error) {
    log.error('season-lifecycle', error, { action: args.action });
    return JSON.stringify({ success: false, error: 'Season lifecycle operation failed', errorCode: ErrorCode.INTERNAL_ERROR });
  }
};
