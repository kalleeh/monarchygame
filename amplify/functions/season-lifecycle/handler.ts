import type { Schema } from '../../data/resource';
import { dbList, dbGet, dbCreate, dbUpdate, dbBatchWrite, getTableSuffix } from '../data-client';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';

const ADMIN_USER_IDS: string[] = process.env.ADMIN_USER_IDS?.split(',').map(s => s.trim()).filter(Boolean) ?? [];

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
  owner?: string;
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
    let existingStats: Record<string, unknown>;
    if (typeof stats === 'string') {
      try {
        existingStats = JSON.parse(stats) as Record<string, unknown>;
      } catch {
        log.warn('season-lifecycle', 'statsParseError', { id });
        existingStats = {};
      }
    } else {
      existingStats = (stats ?? {}) as Record<string, unknown>;
    }
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

// ---------------------------------------------------------------------------
// AI Kingdom seeding
// ---------------------------------------------------------------------------

const NAME_PREFIXES = [
  'Iron', 'Golden', 'Shadow', 'Crystal', 'Silver', 'Storm', 'Dark', 'Blood',
  'Frost', 'Ember', 'Stone', 'Thunder', 'Ash', 'Jade', 'Obsidian', 'Crimson',
  'Azure', 'Gilded', 'Ancient', 'Twilight', 'Blessed', 'Cursed', 'Eternal',
  'Savage', 'Noble', 'Hollow', 'Sunken', 'Rising', 'Fallen', 'Burning',
];

const NAME_SUFFIXES = [
  'Empire', 'Kingdom', 'Realm', 'Dynasty', 'Fortress', 'Citadel', 'Domain',
  'Throne', 'Crown', 'Dominion', 'Sovereignty', 'Principality', 'Hold',
  'Bastion', 'Stronghold', 'March', 'Keep', 'Tower', 'Hall', 'Lodge',
];

const ALL_RACES = [
  'Human', 'Elven', 'Goblin', 'Droben', 'Vampire',
  'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae',
] as const;

/** Race-based offense/defense multipliers (relative to base of 1.0). */
const RACE_STATS: Record<string, { warOffense: number; warDefense: number }> = {
  Human:     { warOffense: 1.1, warDefense: 1.1 },
  Elven:     { warOffense: 1.2, warDefense: 1.2 },
  Goblin:    { warOffense: 1.3, warDefense: 0.9 },
  Droben:    { warOffense: 1.4, warDefense: 1.0 },
  Vampire:   { warOffense: 1.4, warDefense: 1.1 },
  Elemental: { warOffense: 1.3, warDefense: 1.3 },
  Centaur:   { warOffense: 1.2, warDefense: 1.1 },
  Sidhe:     { warOffense: 1.1, warDefense: 1.4 },
  Dwarven:   { warOffense: 1.0, warDefense: 1.5 },
  Fae:       { warOffense: 1.2, warDefense: 1.3 },
};

/** Simple seeded pseudo-random number generator (mulberry32). */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return function (): number {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a random integer in [min, max] inclusive using the provided rng. */
function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Creates 500 AI kingdoms for the given season in batches of 25. No-ops if they already exist. */
async function seedAIKingdoms(seasonId: string): Promise<{ created: number }> {
  // Check if AI kingdoms already exist for this season
  const allKingdoms = await dbList<{ id: string; isAI?: boolean; seasonId?: string }>('Kingdom');
  const existing = allKingdoms.filter(k => k.isAI === true && k.seasonId === seasonId);
  if (existing.length >= 490) {
    return { created: existing.length };
  }

  const rng = makeRng(0xdeadbeef);
  const now = new Date().toISOString();
  const tableSuffix = await getTableSuffix();
  const tableName = `Kingdom-${tableSuffix}-NONE`;

  // Build tier distribution: 100 small, 200 medium, 150 large, 50 huge
  const tiers: Array<{ count: number; goldMin: number; goldMax: number; landMin: number; landMax: number }> = [
    { count: 100, goldMin: 5000,    goldMax: 20000,   landMin: 100,  landMax: 300   },
    { count: 200, goldMin: 50000,   goldMax: 200000,  landMin: 500,  landMax: 1500  },
    { count: 150, goldMin: 200000,  goldMax: 500000,  landMin: 2000, landMax: 5000  },
    { count: 50,  goldMin: 500000,  goldMax: 2000000, landMin: 5000, landMax: 15000 },
  ];

  // Pre-generate all kingdom items
  const items: Record<string, unknown>[] = [];
  let nameIndex = 0;
  let tierKingdomIndex = 0;

  for (const tier of tiers) {
    for (let t = 0; t < tier.count; t++) {
      const prefix = NAME_PREFIXES[nameIndex % NAME_PREFIXES.length];
      const suffix = NAME_SUFFIXES[(nameIndex + Math.floor(nameIndex / NAME_PREFIXES.length)) % NAME_SUFFIXES.length];
      const disambiguator = Math.floor(tierKingdomIndex / (NAME_PREFIXES.length * NAME_SUFFIXES.length));
      const name = disambiguator > 0 ? `${prefix} ${suffix} ${disambiguator + 1}` : `${prefix} ${suffix}`;
      nameIndex++;
      tierKingdomIndex++;

      const race = ALL_RACES[nameIndex % ALL_RACES.length];
      const raceStats = RACE_STATS[race] ?? { warOffense: 1.0, warDefense: 1.0 };

      const gold = randInt(rng, tier.goldMin, tier.goldMax);
      const land = randInt(rng, tier.landMin, tier.landMax);
      const population = randInt(rng, 1000, 50000);

      const peasants = randInt(rng, 50, 300);
      const militia  = randInt(rng, 20, 150);
      const knights  = randInt(rng, 10, 80);
      const cavalry  = randInt(rng, 5,  40);
      const totalUnitsCount = peasants + militia + knights + cavalry;
      const networth = land * 1000 + gold + totalUnitsCount * 100;

      const warOffense = raceStats.warOffense + (rng() * 3 + 2) / 10; // 2–5 range contribution
      const warDefense = raceStats.warDefense + (rng() * 3 + 2) / 10;

      items.push({
        id: crypto.randomUUID(),
        name,
        race,
        resources: JSON.stringify({ gold, population, land, turns: 100 }),
        stats: JSON.stringify({ warOffense, warDefense }),
        buildings: JSON.stringify({}),
        totalUnits: JSON.stringify({ peasants, militia, knights, cavalry }),
        currentAge: 'early',
        isAI: true,
        isActive: true,
        isOnline: false,
        seasonId,
        owner: 'system',
        networth,
        createdAt: now,
        updatedAt: now,
        __typename: 'Kingdom',
      });
    }
  }

  // Batch write in groups of 25
  const BATCH_SIZE = 25;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await dbBatchWrite(tableName, batch);
  }

  return { created: items.length };
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

    // Verify caller is an admin
    if (!ADMIN_USER_IDS.includes(identity.sub)) {
      return JSON.stringify({ success: false, error: 'Forbidden: admin access required', errorCode: ErrorCode.FORBIDDEN });
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
          participantCount: 0,
          owner: identity.sub
        });

        // Seed AI kingdoms for the new season
        const { created: aiCreated } = await seedAIKingdoms(season.id);

        log.info('season-lifecycle', 'createSeason', { seasonNumber: maxNumber + 1, aiKingdomsSeeded: aiCreated });
        return JSON.stringify({
          success: true,
          season: {
            id: season.id,
            seasonNumber: maxNumber + 1,
            status: 'active',
            currentAge: 'early'
          },
          aiKingdomsSeeded: aiCreated
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

            let existingTransitions: Record<string, unknown> = {};
            try {
              existingTransitions = JSON.parse(season.ageTransitions || '{}');
            } catch {
              log.warn('season-lifecycle', 'ageTransitionsParseError', { seasonId: season.id });
            }
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
                  const resources = (typeof seller.resources === 'string' ? JSON.parse(seller.resources) : (seller.resources ?? {})) as Record<string, number>;
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
            let transitions: Record<string, unknown> = {};
          try {
            transitions = JSON.parse((season.ageTransitions as string) || '{}');
          } catch {
            log.warn('season-lifecycle', 'ageTransitionsParseError', { seasonId: season.id });
          }
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

        let existingTransitions: Record<string, unknown> = {};
        try {
          existingTransitions = JSON.parse(season.ageTransitions || '{}');
        } catch {
          log.warn('season-lifecycle', 'ageTransitionsParseError', { seasonId });
        }
        await dbUpdate('GameSeason', seasonId, {
          status: 'completed',
          endDate: new Date().toISOString(),
          ageTransitions: JSON.stringify({ ...existingTransitions, victoryResults }),
        });

        log.info('season-lifecycle', 'endSeason', { seasonId });
        return JSON.stringify({ success: true, seasonId, action: 'force_ended' });
      }

      case 'seed_ai_kingdoms': {
        const seasonId = args.seasonId;
        if (!seasonId) {
          return JSON.stringify({ success: false, error: 'seasonId required for seed_ai_kingdoms action', errorCode: ErrorCode.MISSING_PARAMS });
        }
        const { created } = await seedAIKingdoms(seasonId);
        log.info('season-lifecycle', 'seedAIKingdoms', { seasonId, created });
        return JSON.stringify({ success: true, created });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}`, errorCode: ErrorCode.INVALID_PARAM });
    }
  } catch (error) {
    log.error('season-lifecycle', error, { action: args.action });
    return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Season lifecycle operation failed', errorCode: ErrorCode.INTERNAL_ERROR });
  }
};
