import type { Schema } from '../../data/resource';
import { dbList, dbUpdate } from '../data-client';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';

// Season duration: 6 weeks total, 2 weeks per age
const SEASON_DURATION_WEEKS = 6;
const AGE_DURATION_WEEKS = 2;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type SeasonType = {
  id: string;
  seasonNumber: number;
  status: string;
  startDate: string;
  currentAge: string;
  ageTransitions: string;
  endDate?: string;
};

function calculateCurrentAge(startDate: Date): 'early' | 'middle' | 'late' {
  const elapsed = Date.now() - startDate.getTime();
  const weeksElapsed = elapsed / WEEK_MS;

  if (weeksElapsed < AGE_DURATION_WEEKS) return 'early';
  if (weeksElapsed < AGE_DURATION_WEEKS * 2) return 'middle';
  return 'late';
}

function isSeasonExpired(startDate: Date): boolean {
  const elapsed = Date.now() - startDate.getTime();
  return elapsed >= SEASON_DURATION_WEEKS * WEEK_MS;
}

// Handler for getActiveSeason query
export const handler: Schema["getActiveSeason"]["functionHandler"] = async (event) => {
  try {
    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return JSON.stringify({ success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED });
    }

    // Find the active season
    const allSeasons = await dbList<SeasonType>('GameSeason');
    const seasons = allSeasons.filter(s => s.status === 'active');

    if (!seasons || seasons.length === 0) {
      return JSON.stringify({ success: false, error: 'No active season', errorCode: ErrorCode.SEASON_INACTIVE });
    }

    const season = seasons[0];
    const startDate = new Date(season.startDate);
    const currentAge = calculateCurrentAge(startDate);

    // Check if season has expired
    if (isSeasonExpired(startDate)) {
      await dbUpdate('GameSeason', season.id, {
        status: 'completed',
        endDate: new Date().toISOString()
      });
      return JSON.stringify({ success: false, error: 'Season has ended', errorCode: ErrorCode.SEASON_INACTIVE });
    }

    // Update age if it has changed
    if (currentAge !== season.currentAge) {
      await dbUpdate('GameSeason', season.id, {
        currentAge,
        ageTransitions: JSON.stringify({
          ...JSON.parse((season.ageTransitions as string) || '{}'),
          [currentAge]: new Date().toISOString()
        })
      });
    }

    log.info('season-manager', 'getActiveSeason', { seasonId: season.id, currentAge });
    return JSON.stringify({
      success: true,
      season: {
        id: season.id,
        seasonNumber: season.seasonNumber,
        status: season.status,
        startDate: season.startDate,
        currentAge,
        weeksRemaining: Math.max(0, SEASON_DURATION_WEEKS - Math.floor((Date.now() - startDate.getTime()) / WEEK_MS))
      }
    });
  } catch (error) {
    log.error('season-manager', error);
    return JSON.stringify({ success: false, error: 'Season query failed', errorCode: ErrorCode.INTERNAL_ERROR });
  }
};
