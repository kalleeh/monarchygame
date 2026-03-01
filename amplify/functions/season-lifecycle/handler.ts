import type { Schema } from '../../data/resource';
import { dbList, dbGet, dbCreate, dbUpdate } from '../data-client';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';

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
  participantCount?: number;
};

type KingdomType = {
  id: string;
  isActive: boolean;
  resources: string | Record<string, number>;
  stats: string | Record<string, unknown>;
};

type TradeOfferType = {
  id: string;
  seasonId: string;
  status: string;
  sellerId: string;
  resourceType: string;
  quantity: number;
};

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
  const allKingdoms = await dbList<KingdomType>('Kingdom');
  const kingdoms = allKingdoms.filter(k => k.isActive === true);
  if (!kingdoms || kingdoms.length === 0) return;

  // Parse resources (stored as JSON string in DB) and compute networth
  const ranked = kingdoms
    .map((k) => {
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
    await dbUpdate('Kingdom', id, { stats: updatedStats });
  }
}

/** Compute alliance-level victory track winners for the season that is ending */
async function computeSeasonVictory(seasonId: string): Promise<{
  militaryChampion?: { allianceId: string; totalLandGained: number };
  economicPowerhouse?: { allianceId: string; totalNetworth: number };
  strategistGuild?: { allianceId: string; territoriesControlled: number };
}> {
  void seasonId; // parameter reserved for future per-season filtering

  // Military: alliance with most land gained from BattleReports this season
  const allBattles = await dbList<{ attackerId: string; landGained?: number; timestamp?: string }>('BattleReport');

  // Economic: alliance with highest combined networth
  const allKingdoms = await dbList<{ guildId?: string; resources?: string; totalUnits?: string; stats?: string }>('Kingdom');

  // Strategic: alliance controlling most territories (3+ territories in same region)
  const allTerritories = await dbList<{ kingdomId?: string; regionId?: string }>('Territory');

  // Build per-alliance stats
  const allianceMilitary: Record<string, number> = {};
  const allianceNetworth: Record<string, number> = {};
  const allianceTerritories: Record<string, number> = {};

  // Compute military champion
  for (const battle of allBattles) {
    const kingdom = allKingdoms.find(k => (k as Record<string, unknown>).id === battle.attackerId);
    const guildId = (kingdom as Record<string, unknown>)?.guildId as string | undefined;
    if (guildId && battle.landGained) {
      allianceMilitary[guildId] = (allianceMilitary[guildId] ?? 0) + (battle.landGained ?? 0);
    }
  }

  // Compute economic powerhouse
  for (const kingdom of allKingdoms) {
    const guildId = (kingdom as Record<string, unknown>)?.guildId as string | undefined;
    if (guildId) {
      const res = typeof kingdom.resources === 'string' ? JSON.parse(kingdom.resources as string) : (kingdom.resources ?? {});
      const nw = ((res as Record<string, number>).land ?? 0) * 1000 + ((res as Record<string, number>).gold ?? 0);
      allianceNetworth[guildId] = (allianceNetworth[guildId] ?? 0) + nw;
    }
  }

  // Compute strategic guild (territories per region per alliance; 3+ in a region = control)
  const regionsByAlliance: Record<string, Record<string, number>> = {};
  for (const territory of allTerritories) {
    const kingdom = allKingdoms.find(k => (k as Record<string, unknown>).id === territory.kingdomId);
    const guildId = (kingdom as Record<string, unknown>)?.guildId as string | undefined;
    if (guildId && territory.regionId) {
      if (!regionsByAlliance[guildId]) regionsByAlliance[guildId] = {};
      regionsByAlliance[guildId][territory.regionId] = (regionsByAlliance[guildId][territory.regionId] ?? 0) + 1;
    }
  }
  for (const [guildId, regions] of Object.entries(regionsByAlliance)) {
    allianceTerritories[guildId] = Object.values(regions).filter(count => count >= 3).length;
  }

  const topMilitary  = Object.entries(allianceMilitary).sort(([, a], [, b]) => b - a)[0];
  const topEconomic  = Object.entries(allianceNetworth).sort(([, a], [, b]) => b - a)[0];
  const topStrategic = Object.entries(allianceTerritories).sort(([, a], [, b]) => b - a)[0];

  return {
    militaryChampion:  topMilitary  ? { allianceId: topMilitary[0],  totalLandGained:      topMilitary[1]  } : undefined,
    economicPowerhouse:topEconomic  ? { allianceId: topEconomic[0],  totalNetworth:         topEconomic[1]  } : undefined,
    strategistGuild:   topStrategic ? { allianceId: topStrategic[0], territoriesControlled: topStrategic[1] } : undefined,
  };
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
        const allSeasons = await dbList<SeasonType>('GameSeason');
        const activeSeasons = allSeasons.filter(s => s.status === 'active');

        if (activeSeasons && activeSeasons.length > 0) {
          return JSON.stringify({ success: false, error: 'An active season already exists', errorCode: ErrorCode.VALIDATION_FAILED });
        }

        // Find the latest season number
        const maxNumber = allSeasons.reduce((max: number, s: { seasonNumber: number }) => Math.max(max, s.seasonNumber), 0) ?? 0;

        const season = await dbCreate<SeasonType>('GameSeason', {
          id: crypto.randomUUID(),
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
            id: season.id,
            seasonNumber: maxNumber + 1,
            status: 'active',
            currentAge: 'early'
          }
        });
      }

      case 'check': {
        // Check and update all active seasons (age transitions + expiry)
        const allSeasons = await dbList<SeasonType>('GameSeason');
        const activeSeasons = allSeasons.filter(s => s.status === 'active');

        if (!activeSeasons || activeSeasons.length === 0) {
          return JSON.stringify({ success: true, message: 'No active seasons to process' });
        }

        const results = [];
        for (const season of activeSeasons) {
          const startDate = new Date(season.startDate);

          // Check expiry
          if (isSeasonExpired(startDate)) {
            // Compute victory tracks before closing the season
            const victoryResults = await computeSeasonVictory(season.id);

            // Record final rankings before closing the season
            await recordSeasonRankings(season.seasonNumber);

            const existingTransitions = JSON.parse(season.ageTransitions || '{}');
            await dbUpdate('GameSeason', season.id, {
              status: 'completed',
              endDate: new Date().toISOString(),
              ageTransitions: JSON.stringify({ ...existingTransitions, victoryResults }),
            });

            // Clean up: expire all open trade offers
            const allOffers = await dbList<TradeOfferType>('TradeOffer');
            const openOffers = allOffers.filter(o => o.seasonId === season.id && o.status === 'open');
            if (openOffers) {
              for (const offer of openOffers) {
                await dbUpdate('TradeOffer', offer.id, { status: 'expired' });
                // Refund escrowed resources
                const seller = await dbGet<KingdomType>('Kingdom', offer.sellerId);
                if (seller) {
                  const resources = (seller.resources ?? {}) as Record<string, number>;
                  resources[offer.resourceType] = (resources[offer.resourceType] ?? 0) + offer.quantity;
                  await dbUpdate('Kingdom', offer.sellerId, { resources });
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

            await dbUpdate('GameSeason', season.id, {
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

        const season = await dbGet<SeasonType>('GameSeason', seasonId);
        if (!season) {
          return JSON.stringify({ success: false, error: 'Season not found', errorCode: ErrorCode.NOT_FOUND });
        }

        // Compute victory tracks before closing the season
        const victoryResults = await computeSeasonVictory(season.id);

        // Record final rankings before closing the season
        await recordSeasonRankings(season.seasonNumber);

        const existingTransitions = JSON.parse(season.ageTransitions || '{}');
        await dbUpdate('GameSeason', seasonId, {
          status: 'completed',
          endDate: new Date().toISOString(),
          ageTransitions: JSON.stringify({ ...existingTransitions, victoryResults }),
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
