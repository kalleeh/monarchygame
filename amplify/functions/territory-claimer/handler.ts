import type { Schema } from '../../data/resource';
import type { KingdomResources } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbUpdate, dbAtomicAdd, dbQuery, parseJsonField, ensureTurnsBalance } from '../data-client';
import { verifyOwnership } from '../verify-ownership';
import { checkRateLimit } from '../rate-limiter';

const TERRITORY_NAME_LIMITS = { min: 2, max: 50 } as const;
const COORDINATE_LIMITS = { min: -10000, max: 10000 } as const;

// Region slot limits by type — matches REGION_SLOT_COUNTS in TerritoryExpansion.tsx
const REGION_SLOT_COUNTS: Record<string, number> = {
  capital: 5,
  settlement: 3,
  outpost: 2,
  fortress: 4,
};

// World region type lookup — derived from KingdomNode.tsx WORLD_REGIONS
const WORLD_REGION_TYPES: Record<string, string> = {
  'wt-01': 'fortress', 'wt-02': 'outpost',  'wt-03': 'capital',   'wt-04': 'settlement',
  'wt-05': 'fortress', 'wt-06': 'outpost',  'wt-07': 'capital',   'wt-08': 'settlement',
  'wt-09': 'capital',  'wt-10': 'outpost',  'wt-11': 'settlement','wt-12': 'outpost',
  'wt-13': 'fortress', 'wt-14': 'outpost',  'wt-15': 'settlement','wt-16': 'capital',
  'wt-17': 'outpost',  'wt-18': 'settlement','wt-19': 'settlement','wt-20': 'capital',
  'wt-21': 'outpost',  'wt-22': 'capital',  'wt-23': 'settlement','wt-24': 'outpost',
  'wt-25': 'capital',  'wt-26': 'outpost',  'wt-27': 'capital',   'wt-28': 'settlement',
  'wt-29': 'outpost',  'wt-30': 'capital',  'wt-31': 'settlement','wt-32': 'outpost',
  'wt-33': 'outpost',  'wt-34': 'settlement','wt-35': 'outpost',  'wt-36': 'settlement',
  'wt-37': 'outpost',  'wt-38': 'settlement','wt-39': 'outpost',  'wt-40': 'fortress',
  'wt-41': 'capital',  'wt-42': 'settlement','wt-43': 'outpost',  'wt-44': 'outpost',
  'wt-45': 'outpost',  'wt-46': 'outpost',  'wt-47': 'outpost',  'wt-48': 'outpost',
  'wt-49': 'outpost',  'wt-50': 'outpost',
};

type KingdomType = Record<string, unknown> & { turnsBalance?: number | null };
type TerritoryType = { id: string; kingdomId?: string; regionId?: string; coordinates?: string };

async function handleUpgrade(
  args: { kingdomId: string; territoryId: string; newDefenseLevel: number; goldCost: number },
  identity: { sub?: string; username?: string; claims?: Record<string, string> } | null
) {
  const { kingdomId, territoryId, newDefenseLevel, goldCost } = args;
  try {
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }
    const rateLimited = await checkRateLimit(identity.sub, 'territory');
    if (rateLimited) return rateLimited;
    if (!kingdomId || !territoryId) {
      return { success: false, error: 'Missing kingdomId or territoryId', errorCode: ErrorCode.MISSING_PARAMS };
    }
    if (typeof newDefenseLevel !== 'number' || !Number.isInteger(newDefenseLevel) || newDefenseLevel < 1 || newDefenseLevel > 10) {
      return { success: false, error: 'newDefenseLevel must be an integer 1-10', errorCode: ErrorCode.INVALID_PARAM };
    }

    // Server-side gold cost: 500 gold per defense level
    const serverGoldCost = newDefenseLevel * 500;

    // Verify kingdom ownership
    const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
    if (!kingdom) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }
    const denied = verifyOwnership(identity, kingdom.owner as string | null);
    if (denied) return denied;

    // Verify territory ownership
    const territory = await dbGet<{ id: string; kingdomId?: string }>('Territory', territoryId);
    if (!territory) {
      return { success: false, error: 'Territory not found', errorCode: ErrorCode.NOT_FOUND };
    }
    if (territory.kingdomId !== kingdomId) {
      return { success: false, error: 'You do not own this territory', errorCode: ErrorCode.FORBIDDEN };
    }

    // Check gold
    const resources = parseJsonField<KingdomResources>(kingdom.resources, {} as KingdomResources);
    const currentGold = resources.gold ?? 0;
    if (currentGold < serverGoldCost) {
      return { success: false, error: `Insufficient gold: need ${serverGoldCost}, have ${currentGold}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Deduct gold from kingdom
    await dbUpdate('Kingdom', kingdomId, {
      resources: { ...resources, gold: currentGold - serverGoldCost }
    });

    // Update territory defense level directly via DynamoDB (bypasses AppSync owner check)
    await dbUpdate('Territory', territoryId, { defenseLevel: newDefenseLevel });

    log.info('territory-claimer', 'upgradeTerritory', { kingdomId, territoryId, newDefenseLevel });
    return { success: true, defenseLevel: newDefenseLevel };
  } catch (error) {
    log.error('territory-claimer', error, { kingdomId, territoryId });
    return { success: false, error: error instanceof Error ? error.message : 'Territory upgrade failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
}

// Handles both claimTerritory and upgradeTerritory mutations (same Lambda, routed by fieldName)
export const handler = async (event: Parameters<Schema["claimTerritory"]["functionHandler"]>[0] & { fieldName?: string }) => {
  // Route upgrade requests to dedicated handler
  if (event.fieldName === 'upgradeTerritory') {
    const args = event.arguments as unknown as { kingdomId: string; territoryId: string; newDefenseLevel: number; goldCost: number };
    return handleUpgrade(args, event.identity as { sub?: string; username?: string } | null);
  }

  const { kingdomId, territoryName, territoryType, terrainType, coordinates, regionId, category } = event.arguments;

  try {
    if (!kingdomId || !territoryName) {
      return { success: false, error: 'Missing required parameters: kingdomId, territoryName', errorCode: ErrorCode.MISSING_PARAMS };
    }

    // Validate territory name
    if (typeof territoryName !== 'string' || territoryName.length < TERRITORY_NAME_LIMITS.min || territoryName.length > TERRITORY_NAME_LIMITS.max) {
      return { success: false, error: `Territory name must be ${TERRITORY_NAME_LIMITS.min}-${TERRITORY_NAME_LIMITS.max} characters`, errorCode: ErrorCode.INVALID_PARAM };
    }

    // Validate coordinates if provided
    const parsedCoords = coordinates ?? { x: 0, y: 0 };
    const coordObj = parseJsonField<Record<string, number>>(parsedCoords, {});
    if (
      typeof coordObj.x !== 'number' || typeof coordObj.y !== 'number' ||
      coordObj.x < COORDINATE_LIMITS.min || coordObj.x > COORDINATE_LIMITS.max ||
      coordObj.y < COORDINATE_LIMITS.min || coordObj.y > COORDINATE_LIMITS.max
    ) {
      return { success: false, error: `Coordinates must be between ${COORDINATE_LIMITS.min} and ${COORDINATE_LIMITS.max}`, errorCode: ErrorCode.INVALID_PARAM };
    }

    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string; claims?: Record<string, string> } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }
    const rateLimited = await checkRateLimit(identity.sub, 'territory');
    if (rateLimited) return rateLimited;

    // Verify the kingdom exists
    const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
    if (!kingdom) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    // Verify kingdom ownership
    const denied = verifyOwnership(identity, kingdom.owner as string | null);
    if (denied) return denied;

    // Check restoration status — territory claiming is blocked during restoration
    const allRestoration = await dbQuery<{ kingdomId: string; endTime: string; prohibitedActions?: string }>('RestorationStatus', 'restorationStatusesByKingdomIdAndEndTime', { field: 'kingdomId', value: kingdomId });
    const activeRestoration = allRestoration.find(r => r.kingdomId === kingdomId && new Date(r.endTime) > new Date());
    if (activeRestoration) {
      let prohibited: string[] = [];
      if (typeof activeRestoration.prohibitedActions === 'string') {
        try {
          prohibited = JSON.parse(activeRestoration.prohibitedActions);
        } catch {
          log.warn('territory-claimer', 'prohibitedActionsParseError', { kingdomId });
          prohibited = [];
        }
      } else {
        prohibited = activeRestoration.prohibitedActions ?? [];
      }
      if (prohibited.some(a => ['build', 'attack'].includes(a))) {
        return { success: false, error: 'Kingdom is in restoration and cannot claim territories', errorCode: ErrorCode.RESTORATION_BLOCKED };
      }
    }

    // Check kingdom has enough gold
    const resources = parseJsonField<KingdomResources>(kingdom.resources, {} as KingdomResources);
    const currentGold = resources.gold ?? 0;
    if (currentGold < 500) {
      return { success: false, error: `Insufficient gold: need 500, have ${currentGold}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Check and deduct turns from turnsBalance (server-side pool), falling back to resources.turns
    await ensureTurnsBalance(kingdom as Record<string, unknown>);
    const currentTurns = kingdom.turnsBalance ?? resources.turns ?? 72;
    const turnCost = 1;
    if (currentTurns < turnCost) {
      return { success: false, error: `Not enough turns. Need ${turnCost}, have ${currentTurns}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Check for duplicate territory at same coordinates
    const coordStr = JSON.stringify(coordObj);
    const kingdomTerritories = await dbQuery<TerritoryType>('Territory', 'territoriesByKingdomIdAndCreatedAt', { field: 'kingdomId', value: kingdomId });
    const duplicate = kingdomTerritories.find(
      (t: TerritoryType) => t.coordinates === coordStr
    );
    if (duplicate) {
      return { success: false, error: 'Territory already claimed at these coordinates', errorCode: ErrorCode.INVALID_PARAM };
    }

    // Slot-count validation: cap per region type
    if (regionId) {
      const regionType = WORLD_REGION_TYPES[regionId] ?? 'settlement';
      const maxSlots = REGION_SLOT_COUNTS[regionType] ?? 3;
      const regionTerritories = kingdomTerritories.filter((t: TerritoryType) => t.regionId === regionId);
      if (regionTerritories.length >= maxSlots) {
        return { success: false, error: `Region is full (max ${maxSlots} territories)`, errorCode: 'REGION_FULL' as const };
      }
    }

    // Deduct gold cost and turns
    await dbUpdate('Kingdom', kingdomId, {
      resources: {
        ...resources,
        gold: currentGold - 500,
      }
    });
    await dbAtomicAdd('Kingdom', kingdomId, 'turnsBalance', -turnCost);

    // Store a pending settlement in Kingdom.stats instead of immediately creating Territory
    let currentStats: Record<string, unknown>;
    if (typeof kingdom.stats === 'string') {
      try {
        currentStats = JSON.parse(kingdom.stats as string);
      } catch {
        log.warn('territory-claimer', 'statsParseError', { kingdomId });
        currentStats = {};
      }
    } else {
      currentStats = (kingdom.stats ?? {}) as Record<string, unknown>;
    }
    const pendingSettlements = (currentStats.pendingSettlements as unknown[]) ?? [];
    const completesAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const updatedPendingSettlements = [
      ...pendingSettlements,
      {
        regionId: regionId ?? null,
        category: category ?? null,
        name: territoryName,
        type: territoryType || 'settlement',
        coordinates: JSON.stringify(coordObj),
        terrainType: terrainType || 'plains',
        completesAt,
        startedAt: new Date().toISOString(),
        ownerSub: identity.sub,
      },
    ];
    await dbUpdate('Kingdom', kingdomId, {
      stats: JSON.stringify({ ...currentStats, pendingSettlements: updatedPendingSettlements }),
    });

    log.info('territory-claimer', 'claimTerritory', { kingdomId, territoryName, regionId, category, settling: true, completesAt });
    return { success: true, territory: territoryName, regionId: regionId ?? null, category: category ?? null, settling: true, completesAt };
  } catch (error) {
    log.error('territory-claimer', error, { kingdomId, territoryName });
    return { success: false, error: error instanceof Error ? error.message : 'Territory claim failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
