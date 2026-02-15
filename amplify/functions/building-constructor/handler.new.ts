import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import type { KingdomBuildings } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';

const VALID_BUILDING_TYPES = ['castle', 'barracks', 'farm', 'mine', 'temple', 'tower', 'wall'] as const;
type BuildingType = typeof VALID_BUILDING_TYPES[number];

const BUILDING_QUANTITY = { min: 1, max: 100 } as const;

const client = generateClient<Schema>();

export const handler: Schema["constructBuildings"]["functionHandler"] = async (event) => {
  const { kingdomId, buildingType, quantity } = event.arguments;

  try {
    if (!kingdomId || !buildingType || quantity === undefined || quantity === null) {
      return { success: false, error: 'Missing required parameters: kingdomId, buildingType, quantity', errorCode: ErrorCode.MISSING_PARAMS };
    }

    if (!VALID_BUILDING_TYPES.includes(buildingType as BuildingType)) {
      return { success: false, error: `Invalid building type. Must be one of: ${VALID_BUILDING_TYPES.join(', ')}`, errorCode: ErrorCode.INVALID_PARAM };
    }

    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < BUILDING_QUANTITY.min || quantity > BUILDING_QUANTITY.max) {
      return { success: false, error: `Quantity must be an integer between ${BUILDING_QUANTITY.min} and ${BUILDING_QUANTITY.max}`, errorCode: ErrorCode.INVALID_PARAM };
    }

    const result = await client.models.Kingdom.get({ id: kingdomId });

    if (!result.data) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    const buildings = (result.data.buildings ?? {}) as KingdomBuildings;
    const currentCount = buildings[buildingType as keyof KingdomBuildings] ?? 0;
    const updatedBuildings: KingdomBuildings = {
      ...buildings,
      [buildingType]: currentCount + quantity
    };

    await client.models.Kingdom.update({
      id: kingdomId,
      buildings: updatedBuildings
    });

    return { success: true, buildings: JSON.stringify(updatedBuildings) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Building construction error:', { kingdomId, buildingType, quantity, error: message });
    return { success: false, error: 'Construction failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
