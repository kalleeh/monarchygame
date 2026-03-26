import type { Schema } from '../../data/resource';
import type { KingdomResources, KingdomBuildings } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbUpdate, dbList } from '../data-client';
import { TURN_MECHANICS } from '../../../shared/mechanics/turn-mechanics';

const RESOURCE_LIMITS = {
  gold: { min: 0, max: 1000000 },
  population: { min: 0, max: 100000 },
  elan: { min: 0, max: 500 },
  land: { min: 1000, max: 100000 }
} as const;

type KingdomType = {
  id: string;
  owner?: string | null;
  resources?: KingdomResources | null;
  buildings?: KingdomBuildings | null;
  stats?: Record<string, unknown> | null;
  currentAge?: string | null;
  race?: string | null;
  encampEndTime?: string | null;
  encampBonusTurns?: number | null;
};

type TerritoryType = {
  id: string;
  kingdomId?: string | null;
  category?: string | null;
  terrainType?: string | null;
  defenseLevel?: number;
  regionId?: string;
};

// The handler is invoked for updateResources, encampKingdom, and saveDefensiveFormation mutations.
// We use a loose event type to handle all argument shapes.
type ResourceManagerEvent = {
  arguments: {
    kingdomId?: string;
    turns?: number | null;
    duration?: number | null;
    formationId?: string | null;
    achievementIds?: string | null;
  };
  identity?: { sub?: string; username?: string; } | null;
};

export const handler: Schema["updateResources"]["functionHandler"] = async (event) => {
  const rawEvent = event as unknown as ResourceManagerEvent;
  const kingdomId = rawEvent.arguments.kingdomId;

  // --- Save defensive formation branch: triggered by saveDefensiveFormation mutation ---
  if (rawEvent.arguments.formationId != null) {
    const formationId = rawEvent.arguments.formationId as string;
    try {
      if (!kingdomId) {
        return { success: false, error: 'Missing kingdomId', errorCode: ErrorCode.MISSING_PARAMS };
      }
      if (typeof kingdomId !== 'string' || kingdomId.length > 128) {
        return { success: false, error: 'Invalid kingdomId format', errorCode: ErrorCode.INVALID_PARAM };
      }
      if (typeof formationId !== 'string' || formationId.length > 64) {
        return { success: false, error: 'Invalid formationId', errorCode: ErrorCode.INVALID_PARAM };
      }
      const identity = rawEvent.identity;
      if (!identity?.sub) {
        return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
      }
      const kingdom = await dbGet<{ id: string; owner?: string; stats?: unknown }>('Kingdom', kingdomId);
      if (!kingdom) {
        return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
      }
      const ownerField = (kingdom.owner ?? null) as string | null;
      const _ownerIds = [identity.sub ?? '', (identity as any).username ?? '',
        (identity as any).claims?.email ?? '', (identity as any).claims?.['preferred_username'] ?? '',
        (identity as any).claims?.['cognito:username'] ?? ''].filter(Boolean);
      if (!ownerField || !_ownerIds.some(id => ownerField.includes(id))) {
        return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
      }
      const currentStats: Record<string, unknown> = typeof kingdom.stats === 'string'
        ? (JSON.parse(kingdom.stats as string) as Record<string, unknown>)
        : ((kingdom.stats ?? {}) as Record<string, unknown>);
      await dbUpdate('Kingdom', kingdomId, {
        stats: JSON.stringify({ ...currentStats, defensiveFormation: formationId }),
      });
      log.info('resource-manager', 'defensive-formation-saved', { kingdomId, formationId });
      return { success: true };
    } catch (err) {
      log.error('resource-manager', err, { kingdomId, context: 'saveDefensiveFormation' });
      return { success: false, error: 'Failed to save defensive formation', errorCode: ErrorCode.INTERNAL_ERROR };
    }
  }

  // --- Save achievements branch: triggered by saveAchievements mutation ---
  if (rawEvent.arguments.achievementIds != null) {
    const achievementIds = rawEvent.arguments.achievementIds as string;
    try {
      if (!kingdomId) {
        return { success: false, error: 'Missing kingdomId', errorCode: ErrorCode.MISSING_PARAMS };
      }
      if (typeof kingdomId !== 'string' || kingdomId.length > 128) {
        return { success: false, error: 'Invalid kingdomId format', errorCode: ErrorCode.INVALID_PARAM };
      }
      let parsedIds: unknown;
      try {
        parsedIds = JSON.parse(achievementIds);
      } catch {
        return { success: false, error: 'Invalid achievementIds: must be a JSON array', errorCode: ErrorCode.INVALID_PARAM };
      }
      if (!Array.isArray(parsedIds) || parsedIds.some(id => typeof id !== 'string')) {
        return { success: false, error: 'Invalid achievementIds: must be an array of strings', errorCode: ErrorCode.INVALID_PARAM };
      }
      const identity = rawEvent.identity;
      if (!identity?.sub) {
        return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
      }
      const kingdom = await dbGet<{ id: string; owner?: string; stats?: unknown }>('Kingdom', kingdomId);
      if (!kingdom) {
        return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
      }
      const ownerField = (kingdom.owner ?? null) as string | null;
      const _ownerIds = [identity.sub ?? '', (identity as any).username ?? '',
        (identity as any).claims?.email ?? '', (identity as any).claims?.['preferred_username'] ?? '',
        (identity as any).claims?.['cognito:username'] ?? ''].filter(Boolean);
      if (!ownerField || !_ownerIds.some(id => ownerField.includes(id))) {
        return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
      }
      const currentStats: Record<string, unknown> = typeof kingdom.stats === 'string'
        ? (JSON.parse(kingdom.stats as string) as Record<string, unknown>)
        : ((kingdom.stats ?? {}) as Record<string, unknown>);
      await dbUpdate('Kingdom', kingdomId, {
        stats: JSON.stringify({ ...currentStats, unlockedAchievements: parsedIds }),
      });
      log.info('resource-manager', 'achievements-saved', { kingdomId, count: (parsedIds as string[]).length });
      return { success: true };
    } catch (err) {
      log.error('resource-manager', err, { kingdomId, context: 'saveAchievements' });
      return { success: false, error: 'Failed to save achievements', errorCode: ErrorCode.INTERNAL_ERROR };
    }
  }

  // --- Encamp branch: triggered by encampKingdom mutation (duration arg present, no turns arg) ---
  if (rawEvent.arguments.duration != null && rawEvent.arguments.turns == null) {
    const duration = rawEvent.arguments.duration as number;
    try {
      if (!kingdomId) {
        return { success: false, error: 'Missing kingdomId', errorCode: ErrorCode.MISSING_PARAMS };
      }
      if (typeof kingdomId !== 'string' || kingdomId.length > 128) {
        return { success: false, error: 'Invalid kingdomId format', errorCode: ErrorCode.INVALID_PARAM };
      }
      if (duration !== 16 && duration !== 24) {
        return { success: false, error: 'Invalid duration: must be 16 or 24', errorCode: ErrorCode.INVALID_PARAM };
      }

      const identity = rawEvent.identity as { sub?: string; username?: string } | null;
      if (!identity?.sub) {
        return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
      }

      const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
      if (!kingdom) {
        return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
      }

      const ownerField = (kingdom.owner ?? null) as string | null;
      const _frmIds = [identity.sub ?? '', (identity as any).username ?? '',
        (identity as any).claims?.email ?? '', (identity as any).claims?.['preferred_username'] ?? '',
        (identity as any).claims?.['cognito:username'] ?? ''].filter(Boolean);
      if (!ownerField || !_frmIds.some(id => ownerField.includes(id))) {
        return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
      }

      // Reject if already encamped
      if (kingdom.encampEndTime) {
        const existingEnd = new Date(kingdom.encampEndTime).getTime();
        if (existingEnd > Date.now()) {
          return { success: false, error: 'Kingdom is already encamped', errorCode: ErrorCode.VALIDATION_FAILED };
        }
      }

      const bonusTurns = duration === 24
        ? TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_24_HOURS.bonusTurns
        : TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_16_HOURS.bonusTurns;

      const encampEndTime = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();

      await dbUpdate('Kingdom', kingdomId, {
        encampEndTime,
        encampBonusTurns: bonusTurns,
      });

      log.info('resource-manager', 'encamp', { kingdomId, duration, bonusTurns, encampEndTime });
      return { success: true, encampEndTime, encampBonusTurns: bonusTurns };
    } catch (error) {
      log.error('resource-manager', error, { kingdomId, action: 'encamp' });
      return { success: false, error: error instanceof Error ? error.message : 'Encamp failed', errorCode: ErrorCode.INTERNAL_ERROR };
    }
  }

  // --- updateResources branch (original logic) ---
  const { turns: rawTurns } = event.arguments;
  const turns = Math.max(1, rawTurns ?? 1);

  try {
    if (!kingdomId) {
      return { success: false, error: 'Missing kingdomId', errorCode: ErrorCode.MISSING_PARAMS };
    }

    if (typeof kingdomId !== 'string' || kingdomId.length > 128) {
      return { success: false, error: 'Invalid kingdomId format', errorCode: ErrorCode.INVALID_PARAM };
    }

    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }

    const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);

    if (!kingdom) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    // Verify kingdom ownership
    const ownerField = (kingdom.owner ?? null) as string | null;
    const _ids = [identity.sub ?? '', identity.username ?? '',
      (identity as any).claims?.email ?? '', (identity as any).claims?.['preferred_username'] ?? '',
      (identity as any).claims?.['cognito:username'] ?? ''].filter(Boolean);
    if (!ownerField || !_ids.some(id => ownerField.includes(id))) {
      return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
    }

    const resources = (typeof kingdom.resources === 'string' ? JSON.parse(kingdom.resources) : (kingdom.resources ?? {})) as KingdomResources;
    const buildings = (typeof kingdom.buildings === 'string' ? JSON.parse(kingdom.buildings) : (kingdom.buildings ?? {})) as KingdomBuildings;
    const stats = (typeof kingdom.stats === 'string' ? JSON.parse(kingdom.stats) : (kingdom.stats ?? {})) as Record<string, unknown>;
    const currentAge = (kingdom.currentAge as string) ?? 'early';

    const currentGold = resources.gold ?? 0;
    const currentPop = resources.population ?? 0;
    const currentElan = resources.elan ?? 0;
    const currentLand = resources.land ?? 1000;

    // Tithe income from temples: tithe stat (0–10 scale) acts as a multiplier
    const titheMultiplier = ((stats.tithe as number) ?? 0) / 10; // 0–1.0 range
    const tithePerTurn = Math.floor((buildings.temple ?? 0) * 5 * Math.max(titheMultiplier, 0.5));

    // Age multipliers for income — kingdoms generate more in later ages
    const AGE_INCOME_MULTIPLIERS: Record<string, number> = {
      'early': 1.2,    // 20% bonus — growth phase (matches age-mechanics.ts incomeMultiplier: 1.2)
      'middle': 1.15,  // 15% bonus — kingdoms have developed
      'late': 1.30,    // 30% bonus — peak civilization
    };
    const ageMultiplier = AGE_INCOME_MULTIPLIERS[currentAge] ?? 1.0;

    // Building-based income per turn (tithe is separated so it can be floored before age scaling)
    let baseGoldPerTurn = (buildings.mine ?? 0) * 20 + (buildings.farm ?? 0) * 8 + (buildings.tower ?? 0) * 50 + 100;
    const populationPerTurn = (buildings.farm ?? 0) * 10;
    // Race-specific elan generation per turn (matches shared/mechanics/elan-mechanics.ts)
    const currentRace = (kingdom.race as string) ?? '';

    // Castle: small gold income for all races (10 gold per castle)
    baseGoldPerTurn += (buildings.castle ?? 0) * 10;

    // Barracks: small income from military levies (15 gold per barracks)
    baseGoldPerTurn += (buildings.barracks ?? 0) * 15;

    // Dwarven castle bonus: +30 gold per castle (stone mastery — castles doubly valuable)
    if (currentRace.toLowerCase() === 'dwarven') {
      baseGoldPerTurn += (buildings.castle ?? 0) * 30;
    }

    const ELAN_RATE = (['Sidhe', 'Vampire'].includes(currentRace)) ? 0.15 : 0.10;
    const elanPerTurn = Math.ceil((buildings.temple ?? 0) * ELAN_RATE);

    // Human caravan bonus: +20% gold income from double-frequency trade caravans
    const caravan_bonus = currentRace === 'Human' ? Math.floor(baseGoldPerTurn * 0.20) : 0;

    // Alliance composition and upgrade income bonuses
    let compositionIncomeBonus = 1.0;
    let upgradeIncomeBonus = 1.0;
    try {
      const kingdomGuildId = (kingdom as Record<string, unknown>).guildId as string | undefined;
      if (kingdomGuildId) {
        const alliance = await dbGet<{ stats?: string }>('Alliance', kingdomGuildId);
        if (alliance?.stats) {
          const allianceStats = typeof alliance.stats === 'string' ? JSON.parse(alliance.stats) : alliance.stats;
          compositionIncomeBonus = allianceStats?.compositionBonus?.income ?? 1.0;
          const now = new Date().toISOString();
          const activeUpgrades = (allianceStats?.activeUpgrades ?? []) as Array<{ type: string; expiresAt: string; effect: Record<string, number> }>;
          const liveUpgrades = activeUpgrades.filter(u => u.expiresAt > now);
          for (const u of liveUpgrades) {
            if (u.effect.incomeBonus) upgradeIncomeBonus *= u.effect.incomeBonus;
          }
        }
      }
    } catch { /* non-fatal */ }

    // Apply age multiplier and alliance bonuses to all gold income (base + tithe + caravan bonus)
    const totalGoldPerTurn = Math.floor((baseGoldPerTurn + tithePerTurn + caravan_bonus) * ageMultiplier * compositionIncomeBonus * upgradeIncomeBonus);

    // Territory-based income (Tier 2 production)
    const CATEGORY_PRODUCTION: Record<string, { gold: number; population: number; land: number }> = {
      farmland:   { gold: 20,  population: 30, land: 50 },
      mine:       { gold: 60,  population: 5,  land: 10 },
      forest:     { gold: 10,  population: 10, land: 30 },
      port:       { gold: 80,  population: 20, land: 5  },
      stronghold: { gold: 5,   population: 0,  land: 0  },
      ruins:      { gold: 0,   population: 0,  land: 0  },
    };

    const TERRAIN_MULTIPLIERS: Record<string, Partial<Record<string, number>>> = {
      mountains: { mine: 1.5 },
      coastal:   { port: 1.5 },
      forest:    { forest: 1.5 },
      plains:    {},
    };

    // Race-specific territory income bonuses by category
    const RACE_TERRITORY_BONUS: Record<string, Partial<Record<string, number>>> = {
      'Goblin':    { mine: 1.20 },                           // strip miners
      'Dwarven':   { mine: 1.25, stronghold: 1.15 },         // master miners + fortress builders
      'Elven':     { forest: 1.20 },                         // forest race
      'Fae':       { farmland: 1.20 },                       // nature spirits
      'Sidhe':     { farmland: 1.15 },                       // mystical nature race
      'Human':     { port: 1.20 },                           // trade/caravan race
      'Centaur':   { farmland: 1.10 },                       // plains runners
      'Vampire':   { stronghold: 1.15 },                     // fortress race
      'Elemental': { mine: 1.10, forest: 1.10 },             // nature hybrid
      'Droben':    {},                                        // pure warrior, no territory bonus
    };

    const REGION_SLOT_COUNTS: Record<string, number> = { capital: 5, settlement: 3, outpost: 2, fortress: 4 };
    const WORLD_REGION_TYPES: Record<string, string> = {
      'wt-01':'fortress','wt-02':'outpost','wt-03':'capital','wt-04':'settlement','wt-05':'fortress',
      'wt-06':'outpost','wt-07':'capital','wt-08':'settlement','wt-09':'capital','wt-10':'outpost',
      'wt-11':'settlement','wt-12':'outpost','wt-13':'fortress','wt-14':'outpost','wt-15':'settlement',
      'wt-16':'capital','wt-17':'outpost','wt-18':'settlement','wt-19':'settlement','wt-20':'capital',
      'wt-21':'outpost','wt-22':'capital','wt-23':'settlement','wt-24':'outpost','wt-25':'capital',
      'wt-26':'outpost','wt-27':'capital','wt-28':'settlement','wt-29':'outpost','wt-30':'capital',
      'wt-31':'settlement','wt-32':'outpost','wt-33':'outpost','wt-34':'settlement','wt-35':'outpost',
      'wt-36':'settlement','wt-37':'outpost','wt-38':'settlement','wt-39':'outpost','wt-40':'fortress',
      'wt-41':'capital','wt-42':'settlement','wt-43':'settlement','wt-44':'outpost','wt-45':'settlement',
      'wt-46':'outpost','wt-47':'settlement','wt-48':'fortress','wt-49':'capital','wt-50':'outpost',
    };

    let territories: TerritoryType[] = [];
    let territoryGold = 0;
    let territoryPop = 0;
    let territoryLand = 0;

    try {
      const allTerritories = await dbList<TerritoryType>('Territory');
      territories = allTerritories.filter(t => t.kingdomId === kingdomId);

      for (const t of territories) {
        const cat = t.category ?? 'farmland';
        const terrain = t.terrainType ?? 'plains';
        const base = CATEGORY_PRODUCTION[cat] ?? CATEGORY_PRODUCTION.farmland;
        const mult = TERRAIN_MULTIPLIERS[terrain]?.[cat] ?? 1.0;
        const dlvlMult = 1 + 0.1 * (t.defenseLevel ?? 0);
        const raceBonus = RACE_TERRITORY_BONUS[currentRace]?.[cat] ?? 1.0;
        territoryGold += Math.floor(base.gold * mult * dlvlMult * raceBonus);
        territoryPop  += Math.floor(base.population * mult * dlvlMult);  // race bonus only applies to gold
        territoryLand += Math.floor(base.land * mult * dlvlMult);
      }

      // Region completion bonus: +20% gold for fully-controlled regions
      const regionGroups: Record<string, number> = {};
      for (const t of territories) {
        if (t.regionId) regionGroups[t.regionId] = (regionGroups[t.regionId] ?? 0) + 1;
      }
      for (const [regionId, count] of Object.entries(regionGroups)) {
        const rtype = WORLD_REGION_TYPES[regionId];
        if (rtype && count >= (REGION_SLOT_COUNTS[rtype] ?? 99)) {
          const regionGold = territories
            .filter(t => t.regionId === regionId)
            .reduce((sum, t) => {
              const cat = t.category ?? 'farmland';
              const terrain = t.terrainType ?? 'plains';
              const b = CATEGORY_PRODUCTION[cat] ?? CATEGORY_PRODUCTION.farmland;
              const m = TERRAIN_MULTIPLIERS[terrain]?.[cat] ?? 1.0;
              return sum + Math.floor(b.gold * m * (1 + 0.1 * (t.defenseLevel ?? 0)));
            }, 0);
          territoryGold += Math.floor(regionGold * 0.20);
        }
      }
    } catch (err) {
      log.warn('resource-manager', 'territory-income-failed', { err });
      // Non-fatal — proceed without territory income
    }

    const maintenanceCost = Math.max(0, territories.length - 2) * 5 * turns;

    // Spread existing resources first so turns (and any other fields) are preserved.
    // Previous bug: not including turns caused it to be stripped on every income tick.
    const updated: KingdomResources = {
      ...resources,
      gold: Math.max(0, Math.min(currentGold + (totalGoldPerTurn + territoryGold) * turns - maintenanceCost, RESOURCE_LIMITS.gold.max)),
      land: Math.max(currentLand + territoryLand * turns, RESOURCE_LIMITS.land.min),
      population: Math.min(currentPop + (populationPerTurn + territoryPop) * turns, RESOURCE_LIMITS.population.max),
      elan: Math.min(currentElan + elanPerTurn * turns, RESOURCE_LIMITS.elan.max),
    };

    const totalUnitsObj = (kingdom as Record<string, unknown>).totalUnits;
    const totalUnitsMap = typeof totalUnitsObj === 'string'
      ? (JSON.parse(totalUnitsObj) as Record<string, number>)
      : ((totalUnitsObj ?? {}) as Record<string, number>);
    const totalUnits = Object.values(totalUnitsMap).reduce((sum, n) => sum + (n ?? 0), 0);
    const networth = (updated.land ?? 0) * 1000 + (updated.gold ?? 0) + totalUnits * 100;

    await dbUpdate('Kingdom', kingdomId, {
      resources: updated,
      networth,
      lastResourceTick: new Date().toISOString()
    });

    log.info('resource-manager', 'updateResources', { kingdomId, turns });
    return { success: true, resources: JSON.stringify(updated), newTurns: turns };
  } catch (error) {
    log.error('resource-manager', error, { kingdomId });
    return { success: false, error: error instanceof Error ? error.message : 'Resource update failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
