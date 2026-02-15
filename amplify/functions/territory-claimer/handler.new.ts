import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import { ErrorCode } from '../../../shared/types/kingdom';

const TERRITORY_NAME_LIMITS = { min: 2, max: 50 } as const;
const COORDINATE_LIMITS = { min: -10000, max: 10000 } as const;

const client = generateClient<Schema>();

export const handler: Schema["claimTerritory"]["functionHandler"] = async (event) => {
  const { kingdomId, territoryName, territoryType, terrainType, coordinates } = event.arguments;

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

    // Verify the kingdom exists
    const kingdomResult = await client.models.Kingdom.get({ id: kingdomId });
    if (!kingdomResult.data) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    // Check kingdom has enough gold
    const resources = (kingdomResult.data.resources ?? {}) as { gold?: number; population?: number; mana?: number; land?: number };
    const currentGold = resources.gold ?? 0;
    if (currentGold < 500) {
      return { success: false, error: `Insufficient gold: need 500, have ${currentGold}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Check for duplicate territory at same coordinates
    const coordStr = JSON.stringify(coordObj);
    const existingTerritories = await client.models.Territory.list({
      filter: { kingdomId: { eq: kingdomId } }
    });
    const duplicate = existingTerritories.data?.find(
      (t: any) => t.coordinates === coordStr
    );
    if (duplicate) {
      return { success: false, error: 'Territory already claimed at these coordinates', errorCode: ErrorCode.INVALID_PARAM };
    }

    // Deduct gold cost
    await client.models.Kingdom.update({
      id: kingdomId,
      resources: {
        ...resources,
        gold: currentGold - 500
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
      kingdomId
    });

    return { success: true, territory: territoryName };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Territory claiming error:', { kingdomId, territoryName, error: message });
    return { success: false, error: 'Territory claim failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
