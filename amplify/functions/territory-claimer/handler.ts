import type { Schema } from '../../data/resource';
import type { KingdomResources } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbUpdate, dbList, dbAtomicAdd, dbQuery } from '../data-client';

const TERRITORY_NAME_LIMITS = { min: 2, max: 50 } as const;
const COORDINATE_LIMITS = { min: -10000, max: 10000 } as const;

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
    if (!kingdomId || !territoryId) {
      return { success: false, error: 'Missing kingdomId or territoryId', errorCode: ErrorCode.MISSING_PARAMS };
    }

    // Verify kingdom ownership
    const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
    if (!kingdom) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }
    const ownerField = kingdom.owner as string | null;
    const userSub = identity.sub ?? '';
    const userName = identity.username ?? '';
    const userEmail = identity.claims?.email ?? '';
    const preferredUsername = identity.claims?.['preferred_username'] ?? identity.claims?.['cognito:username'] ?? '';
    const identifiers = [userSub, userName, userEmail, preferredUsername].filter(Boolean);
    const ownerMatches = ownerField && identifiers.some(id => ownerField === id);
    if (!ownerMatches) {
      log.warn('territory-claimer', 'upgradeOwnershipMismatch', { ownerField, userSub, userName, userEmail, kingdomId });
      return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
    }

    // Verify territory ownership
    const territory = await dbGet<{ id: string; kingdomId?: string }>('Territory', territoryId);
    if (!territory) {
      return { success: false, error: 'Territory not found', errorCode: ErrorCode.NOT_FOUND };
    }
    if (territory.kingdomId !== kingdomId) {
      return { success: false, error: 'You do not own this territory', errorCode: ErrorCode.FORBIDDEN };
    }

    // Check gold
    const resources = (typeof kingdom.resources === 'string' ? JSON.parse(kingdom.resources) : (kingdom.resources ?? {})) as KingdomResources;
    const currentGold = resources.gold ?? 0;
    if (currentGold < goldCost) {
      return { success: false, error: `Insufficient gold: need ${goldCost}, have ${currentGold}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Deduct gold from kingdom
    await dbUpdate('Kingdom', kingdomId, {
      resources: { ...resources, gold: currentGold - goldCost }
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
    const coordObj = typeof parsedCoords === 'string' ? JSON.parse(parsedCoords) : parsedCoords;
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

    // Verify the kingdom exists
    const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
    if (!kingdom) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    // Verify kingdom ownership.
    // Amplify Gen 2 stores the owner field using the Cognito username attribute (varies by pool config).
    // We check all possible identity representations: sub, username, email, preferred_username.
    const ownerField = kingdom.owner as string | null;
    const userSub = identity.sub ?? '';
    const userName = identity.username ?? '';
    const userEmail = identity.claims?.email ?? '';
    const preferredUsername = identity.claims?.['preferred_username'] ?? identity.claims?.['cognito:username'] ?? '';
    const identifiers = [userSub, userName, userEmail, preferredUsername].filter(Boolean);
    const ownerMatches = ownerField && identifiers.some(id => ownerField === id);
    if (!ownerMatches) {
      log.warn('territory-claimer', 'ownershipMismatch', {
        ownerField,
        userSub,
        userName,
        userEmail,
        preferredUsername,
        kingdomId,
      });
      return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
    }

    // Check restoration status — territory claiming is blocked during restoration
    const allRestoration = await dbList<{ kingdomId: string; endTime: string; prohibitedActions?: string }>('RestorationStatus');
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
    const resources = (typeof kingdom.resources === 'string' ? JSON.parse(kingdom.resources) : (kingdom.resources ?? {})) as KingdomResources;
    const currentGold = resources.gold ?? 0;
    if (currentGold < 500) {
      return { success: false, error: `Insufficient gold: need 500, have ${currentGold}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Check and deduct turns from turnsBalance (server-side pool), falling back to resources.turns
    const currentTurns = kingdom.turnsBalance ?? resources.turns ?? 72;
    const turnCost = 1;
    if (currentTurns < turnCost) {
      return { success: false, error: `Not enough turns. Need ${turnCost}, have ${currentTurns}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Check for duplicate territory at same coordinates
    const coordStr = JSON.stringify(coordObj);
    const kingdomTerritories = await dbQuery<TerritoryType>(
      'Territory', 'kingdomId', { field: 'kingdomId', value: kingdomId }
    );
    const duplicate = kingdomTerritories.find(
      (t: TerritoryType) => t.coordinates === coordStr
    );
    if (duplicate) {
      return { success: false, error: 'Territory already claimed at these coordinates', errorCode: ErrorCode.INVALID_PARAM };
    }

    // Slot-count validation: cap at 5 territories per region
    if (regionId) {
      const regionTerritories = kingdomTerritories.filter(
        t => t.regionId === regionId
      );
      if (regionTerritories.length >= 5) {
        return { success: false, error: 'Region is full', errorCode: 'REGION_FULL' };
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
