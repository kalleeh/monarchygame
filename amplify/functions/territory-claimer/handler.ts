import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import type { KingdomResources } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { configureAmplify } from '../amplify-configure';

const TERRITORY_NAME_LIMITS = { min: 2, max: 50 } as const;
const COORDINATE_LIMITS = { min: -10000, max: 10000 } as const;

configureAmplify();
const client = generateClient<Schema>({ authMode: 'iam' });

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
    const kingdomResult = await client.models.Kingdom.get({ id: kingdomId });
    if (!kingdomResult.data) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    // Verify kingdom ownership
    const ownerField = (kingdomResult.data as any).owner as string | null;
    if (!ownerField || (!ownerField.includes(identity.sub) && !ownerField.includes(identity.username ?? ''))) {
      return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
    }

    // Check kingdom has enough gold
    const resources = (kingdomResult.data.resources ?? {}) as KingdomResources;
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
    const existingTerritories = await client.models.Territory.list({
      filter: { kingdomId: { eq: kingdomId } }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const duplicate = existingTerritories.data?.find(
      (t: any) => t.coordinates === coordStr
    );
    if (duplicate) {
      return { success: false, error: 'Territory already claimed at these coordinates', errorCode: ErrorCode.INVALID_PARAM };
    }

    // Slot-count validation: cap at 5 territories per region
    if (regionId) {
      const regionTerritories = await client.models.Territory.list({
        filter: { regionId: { eq: regionId }, kingdomId: { eq: kingdomId } }
      });
      if ((regionTerritories.data?.length ?? 0) >= 5) {
        return { success: false, error: 'Region is full', errorCode: 'REGION_FULL' };
      }
    }

    // Deduct gold cost and turns
    await client.models.Kingdom.update({
      id: kingdomId,
      resources: {
        ...resources,
        gold: currentGold - 500,
        turns: Math.max(0, currentTurns - turnCost)
      }
    });

    await client.models.Territory.create({
      name: territoryName,
      type: territoryType || 'settlement',
      coordinates: JSON.stringify(coordObj),
      terrainType: terrainType || 'plains',
      resources: JSON.stringify({ gold: 0, land: 100 }),
      buildings: JSON.stringify({}),
      defenseLevel: 0,
      kingdomId,
      ...(regionId ? { regionId } : {}),
      ...(category ? { category: category as 'farmland' | 'mine' | 'forest' | 'port' | 'stronghold' | 'ruins' } : {})
    });

    log.info('territory-claimer', 'claimTerritory', { kingdomId, territoryName, regionId, category });
    return { success: true, territory: territoryName, regionId: regionId ?? null, category: category ?? null };
  } catch (error) {
    log.error('territory-claimer', error, { kingdomId, territoryName });
    return { success: false, error: 'Territory claim failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
