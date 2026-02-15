import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import { ErrorCode } from '../../../shared/types/kingdom';

const client = generateClient<Schema>();

const SEASON_DURATION_WEEKS = 6;
const AGE_DURATION_WEEKS = 2;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
        const maxNumber = allSeasons?.reduce((max, s) => Math.max(max, s.seasonNumber), 0) ?? 0;

        const season = await client.models.GameSeason.create({
          seasonNumber: maxNumber + 1,
          status: 'active',
          startDate: new Date().toISOString(),
          currentAge: 'early',
          ageTransitions: JSON.stringify({ early: new Date().toISOString() }),
          participantCount: 0
        });

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

        await client.models.GameSeason.update({
          id: seasonId,
          status: 'completed',
          endDate: new Date().toISOString()
        });

        return JSON.stringify({ success: true, seasonId, action: 'force_ended' });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}`, errorCode: ErrorCode.INVALID_PARAM });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Season lifecycle error:', message);
    return JSON.stringify({ success: false, error: 'Season lifecycle operation failed', errorCode: ErrorCode.INTERNAL_ERROR });
  }
};
