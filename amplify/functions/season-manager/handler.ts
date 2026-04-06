import type { Schema } from '../../data/resource';
import { dbList, dbUpdate, dbGet, parseJsonField } from '../data-client';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { verifyOwnership } from '../verify-ownership';

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

// Router: both getActiveSeason and fetchWorldState route to this handler
export const handler: Schema['getActiveSeason']['functionHandler'] = async (event) => {
  const args = event.arguments as Record<string, string> | null;
  if (args && 'kingdomId' in args && 'seasonId' in args) {
    return handleFetchWorldState(event);
  }
  return handleGetActiveSeason(event);
};

async function handleGetActiveSeason(event: { identity?: unknown }): Promise<string> {
  try {
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return JSON.stringify({ success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED });
    }

    const allSeasons = await dbList<SeasonType>('GameSeason');
    const seasons = allSeasons.filter(s => s.status === 'active');

    if (!seasons || seasons.length === 0) {
      return JSON.stringify({ success: false, error: 'No active season', errorCode: ErrorCode.SEASON_INACTIVE });
    }

    const season = seasons[0];
    const startDate = new Date(season.startDate);
    const currentAge = calculateCurrentAge(startDate);

    if (isSeasonExpired(startDate)) {
      await dbUpdate('GameSeason', season.id, {
        status: 'completed',
        endDate: new Date().toISOString()
      });
      return JSON.stringify({ success: false, error: 'Season has ended', errorCode: ErrorCode.SEASON_INACTIVE });
    }

    if (currentAge !== season.currentAge) {
      await dbUpdate('GameSeason', season.id, {
        currentAge,
        ageTransitions: JSON.stringify({
          ...parseJsonField<Record<string, unknown>>(season.ageTransitions, {}),
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
    return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Season query failed', errorCode: ErrorCode.INTERNAL_ERROR });
  }
}

async function handleFetchWorldState(event: { identity?: unknown; arguments?: unknown }): Promise<string> {
  try {
    const identity = event.identity as { sub?: string } | null;
    if (!identity?.sub) {
      return JSON.stringify({ success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED });
    }

    const { kingdomId, seasonId } = event.arguments as { kingdomId: string; seasonId: string };
    if (!kingdomId || !seasonId) {
      return JSON.stringify({ success: false, error: 'Missing kingdomId or seasonId', errorCode: ErrorCode.MISSING_PARAMS });
    }

    // Verify caller owns the requested kingdom
    const kingdom = await dbGet<{ owner?: string | null }>('Kingdom', kingdomId);
    if (!kingdom) {
      return JSON.stringify({ success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND });
    }
    const denied = verifyOwnership(identity as { sub: string; username?: string }, kingdom.owner ?? null);
    if (denied) return JSON.stringify(denied);

    const allStates = await dbList<{ id: string; kingdomId: string; seasonId: string; visibleKingdoms: unknown; fogOfWar: unknown }>('WorldState');
    const state = allStates.find(s => s.kingdomId === kingdomId && s.seasonId === seasonId);

    log.info('season-manager', 'fetchWorldState', { kingdomId, seasonId, found: !!state });
    return JSON.stringify({
      success: true,
      worldState: state ?? { kingdomId, seasonId, visibleKingdoms: [], fogOfWar: {} },
    });
  } catch (error) {
    log.error('season-manager', error);
    return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'World state query failed', errorCode: ErrorCode.INTERNAL_ERROR });
  }
}
