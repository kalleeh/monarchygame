import type { Schema } from '../../data/resource';
import type { KingdomResources } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbCreate, dbUpdate, dbList } from '../data-client';

const TERRITORY_NAME_LIMITS = { min: 2, max: 50 } as const;
const COORDINATE_LIMITS = { min: -10000, max: 10000 } as const;

type KingdomType = Record<string, unknown>;
type TerritoryType = { id: string; kingdomId?: string; regionId?: string; coordinates?: string };

export const handler: Schema["claimTerritory"]["functionHandler"] = async (event) => {
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
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }

    // Verify the kingdom exists
    const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
    if (!kingdom) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    // Verify kingdom ownership
    const ownerField = kingdom.owner as string | null;
    if (!ownerField || (!ownerField.includes(identity.sub) && !ownerField.includes(identity.username ?? ''))) {
      return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
    }

    // Check kingdom has enough gold
    const resources = (kingdom.resources ?? {}) as KingdomResources;
    const currentGold = resources.gold ?? 0;
    if (currentGold < 500) {
      return { success: false, error: `Insufficient gold: need 500, have ${currentGold}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Check and deduct turns
    const currentTurns = resources.turns ?? 72;
    const turnCost = 1;
    if (currentTurns < turnCost) {
      return { success: false, error: `Not enough turns. Need ${turnCost}, have ${currentTurns}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Check for duplicate territory at same coordinates
    const coordStr = JSON.stringify(coordObj);
    const allTerritories = await dbList<TerritoryType>('Territory');
    const kingdomTerritories = allTerritories.filter(t => t.kingdomId === kingdomId);
    const duplicate = kingdomTerritories.find(
      (t: TerritoryType) => t.coordinates === coordStr
    );
    if (duplicate) {
      return { success: false, error: 'Territory already claimed at these coordinates', errorCode: ErrorCode.INVALID_PARAM };
    }

    // Slot-count validation: cap at 5 territories per region
    if (regionId) {
      const regionTerritories = allTerritories.filter(
        t => t.regionId === regionId && t.kingdomId === kingdomId
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
        turns: Math.max(0, currentTurns - turnCost)
      }
    });

    await dbCreate<Record<string, unknown>>('Territory', {
      name: territoryName,
      type: territoryType || 'settlement',
      coordinates: JSON.stringify(coordObj),
      terrainType: terrainType || 'plains',
      resources: JSON.stringify({ gold: 0, land: 100 }),
      buildings: JSON.stringify({}),
      defenseLevel: 0,
      kingdomId,
      ...(regionId ? { regionId } : {}),
      ...(category ? { category } : {})
    });

    log.info('territory-claimer', 'claimTerritory', { kingdomId, territoryName, regionId, category });
    return { success: true, territory: territoryName, regionId: regionId ?? null, category: category ?? null };
  } catch (error) {
    log.error('territory-claimer', error, { kingdomId, territoryName });
    return { success: false, error: 'Territory claim failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
