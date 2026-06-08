import type { Schema } from '../../data/resource';
import type { KingdomResources, KingdomBuildings } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbUpdate, dbQuery, parseJsonField, persistErrorLog } from '../data-client';
import { verifyOwnership } from '../verify-ownership';
import { checkRateLimit } from '../rate-limiter';
import { TURN_MECHANICS } from '../../../shared/mechanics/turn-mechanics';
import { calculateGenerationRates, type TerritoryLike } from '../../../shared/mechanics/economy-mechanics';

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
    rewardGold?: number | null;
    rewardTurns?: number | null;
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
      const rateLimited = await checkRateLimit(identity.sub, 'resource');
      if (rateLimited) return rateLimited;
      const kingdom = await dbGet<{ id: string; owner?: string; stats?: unknown }>('Kingdom', kingdomId);
      if (!kingdom) {
        return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
      }
      const denied = verifyOwnership(identity, (kingdom.owner ?? null) as string | null);
      if (denied) return denied;
      const currentStats: Record<string, unknown> = parseJsonField<Record<string, unknown>>(kingdom.stats, {});
      await dbUpdate('Kingdom', kingdomId, {
        stats: JSON.stringify({ ...currentStats, defensiveFormation: formationId }),
      });
      log.info('resource-manager', 'defensive-formation-saved', { kingdomId, formationId });
      return { success: true };
    } catch (err) {
      await persistErrorLog('resource-manager', err, { kingdomId, context: 'saveDefensiveFormation' });
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
      const rateLimited = await checkRateLimit(identity.sub, 'resource');
      if (rateLimited) return rateLimited;
      const kingdom = await dbGet<{ id: string; owner?: string; stats?: unknown; resources?: unknown; turnsBalance?: number }>('Kingdom', kingdomId);
      if (!kingdom) {
        return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
      }
      const denied = verifyOwnership(identity, (kingdom.owner ?? null) as string | null);
      if (denied) return denied;
      const currentStats: Record<string, unknown> = parseJsonField<Record<string, unknown>>(kingdom.stats, {});

      // Apply achievement rewards (gold/turns) to kingdom resources atomically
      const rewardGold = rawEvent.arguments.rewardGold as number | null | undefined;
      const rewardTurns = rawEvent.arguments.rewardTurns as number | null | undefined;
      const updateFields: Record<string, unknown> = {
        stats: JSON.stringify({ ...currentStats, unlockedAchievements: parsedIds }),
      };
      if (rewardGold || rewardTurns) {
        const currentResources = parseJsonField<Record<string, number>>(kingdom.resources, {});
        // turnsBalance is the server-authoritative turn count that every action deducts
        // from. Rewarded turns MUST be added there too, not just to resources.turns
        // (which is display-only) — otherwise rewarded turns are silently unspendable.
        const cap = TURN_MECHANICS.BASE_GENERATION.MAX_STORED_TURNS;
        const currentBalance = kingdom.turnsBalance ?? currentResources.turns ?? 0;
        const newBalance = Math.min(cap, currentBalance + (rewardTurns ?? 0));
        updateFields.resources = JSON.stringify({
          ...currentResources,
          gold: (currentResources.gold ?? 0) + (rewardGold ?? 0),
          turns: newBalance,
        });
        if (rewardTurns) {
          updateFields.turnsBalance = newBalance;
        }
      }
      await dbUpdate('Kingdom', kingdomId, updateFields);
      log.info('resource-manager', 'achievements-saved', { kingdomId, count: (parsedIds as string[]).length, rewardGold, rewardTurns });
      return { success: true };
    } catch (err) {
      await persistErrorLog('resource-manager', err, { kingdomId, context: 'saveAchievements' });
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
      const rateLimited = await checkRateLimit(identity.sub, 'resource');
      if (rateLimited) return rateLimited;

      const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
      if (!kingdom) {
        return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
      }

      const denied = verifyOwnership(identity, (kingdom.owner ?? null) as string | null);
      if (denied) return denied;

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
      await persistErrorLog('resource-manager', error, { kingdomId, action: 'encamp' });
      log.error('resource-manager', error, { kingdomId, action: 'encamp' });
      return { success: false, error: 'Encamp failed', errorCode: ErrorCode.INTERNAL_ERROR };
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
    const rateLimited = await checkRateLimit(identity.sub, 'resource');
    if (rateLimited) return rateLimited;

    const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);

    if (!kingdom) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    // Verify kingdom ownership
    const denied = verifyOwnership(identity, (kingdom.owner ?? null) as string | null);
    if (denied) return denied;

    const resources = parseJsonField<KingdomResources>(kingdom.resources, {} as KingdomResources);
    const buildings = parseJsonField<KingdomBuildings>(kingdom.buildings, {} as KingdomBuildings);
    const stats = parseJsonField<Record<string, unknown>>(kingdom.stats, {});
    const currentAge = (kingdom.currentAge as string) ?? 'early';

    const currentGold = resources.gold ?? 0;
    const currentPop = resources.population ?? 0;
    const currentElan = resources.elan ?? 0;
    const currentLand = resources.land ?? 1000;

    const currentRace = (kingdom.race as string) ?? '';

    // Alliance composition and upgrade income bonuses (I/O — fetched here, math in shared module)
    let compositionIncomeBonus = 1.0;
    let upgradeIncomeBonus = 1.0;
    try {
      const kingdomGuildId = (kingdom as Record<string, unknown>).guildId as string | undefined;
      if (kingdomGuildId) {
        const alliance = await dbGet<{ stats?: string }>('Alliance', kingdomGuildId);
        if (alliance?.stats) {
          const allianceStats = parseJsonField<Record<string, unknown>>(alliance.stats, {});
          compositionIncomeBonus = (allianceStats?.compositionBonus as Record<string, number> | undefined)?.income ?? 1.0;
          const now = new Date().toISOString();
          const activeUpgrades = (allianceStats?.activeUpgrades ?? []) as Array<{ type: string; expiresAt: string; effect: Record<string, number> }>;
          const liveUpgrades = activeUpgrades.filter(u => u.expiresAt > now);
          for (const u of liveUpgrades) {
            if (u.effect.incomeBonus) upgradeIncomeBonus *= u.effect.incomeBonus;
          }
        }
      }
    } catch { /* non-fatal */ }

    // ECONOMIC_FOCUS faith effect (+20% gold income)
    const activeFaithEffects = (stats.activeFaithEffects as Array<{ effectType: string; expiresAt: string }>) ?? [];
    const nowIso = new Date().toISOString();
    const hasEconomicFocus = activeFaithEffects.some(e => e.effectType === 'ECONOMIC_FOCUS' && e.expiresAt > nowIso);

    // Territories (I/O — fetched here, math in shared module)
    let territories: TerritoryType[] = [];
    try {
      territories = await dbQuery<TerritoryType>('Territory', 'territoriesByKingdomIdAndCreatedAt', { field: 'kingdomId', value: kingdomId });
    } catch (err) {
      log.warn('resource-manager', 'territory-income-failed', { err });
      // Non-fatal — proceed without territory income
    }

    // Authoritative per-turn rates — SHARED with the frontend display so "+X/turn"
    // shown to the player exactly matches what is granted here.
    const rates = calculateGenerationRates({
      race: currentRace,
      age: currentAge,
      buildings,
      tithe: (stats.tithe as number) ?? 0,
      territories: territories as TerritoryLike[],
      compositionIncomeBonus,
      upgradeIncomeBonus,
      hasEconomicFocus,
    });

    const maintenanceCost = Math.max(0, territories.length - 2) * 5 * turns;

    // Spread existing resources first so turns (and any other fields) are preserved.
    // Previous bug: not including turns caused it to be stripped on every income tick.
    const updated: KingdomResources = {
      ...resources,
      gold: Math.max(0, Math.min(currentGold + rates.goldPerTurn * turns - maintenanceCost, RESOURCE_LIMITS.gold.max)),
      land: Math.max(currentLand + rates.landPerTurn * turns, RESOURCE_LIMITS.land.min),
      population: Math.min(currentPop + rates.populationPerTurn * turns, RESOURCE_LIMITS.population.max),
      elan: Math.min(currentElan + rates.elanPerTurn * turns, RESOURCE_LIMITS.elan.max),
    };

    const totalUnitsObj = (kingdom as Record<string, unknown>).totalUnits;
    const totalUnitsMap = parseJsonField<Record<string, number>>(totalUnitsObj, {});
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
    await persistErrorLog('resource-manager', error, { kingdomId });
    log.error('resource-manager', error, { kingdomId });
    return { success: false, error: 'Resource update failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
