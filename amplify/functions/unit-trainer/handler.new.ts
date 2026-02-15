import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import type { KingdomUnits } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';

const VALID_UNIT_TYPES = ['infantry', 'archers', 'cavalry', 'siege', 'mages', 'scouts'] as const;
type UnitType = typeof VALID_UNIT_TYPES[number];

const UNIT_QUANTITY = { min: 1, max: 1000 } as const;

const client = generateClient<Schema>();

export const handler: Schema["trainUnits"]["functionHandler"] = async (event) => {
  const { kingdomId, unitType, quantity } = event.arguments;

  try {
    if (!kingdomId || !unitType || quantity === undefined || quantity === null) {
      return { success: false, error: 'Missing required parameters: kingdomId, unitType, quantity', errorCode: ErrorCode.MISSING_PARAMS };
    }

    if (!VALID_UNIT_TYPES.includes(unitType as UnitType)) {
      return { success: false, error: `Invalid unit type. Must be one of: ${VALID_UNIT_TYPES.join(', ')}`, errorCode: ErrorCode.INVALID_PARAM };
    }

    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < UNIT_QUANTITY.min || quantity > UNIT_QUANTITY.max) {
      return { success: false, error: `Quantity must be an integer between ${UNIT_QUANTITY.min} and ${UNIT_QUANTITY.max}`, errorCode: ErrorCode.INVALID_PARAM };
    }

    const result = await client.models.Kingdom.get({ id: kingdomId });

    if (!result.data) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    const units = (result.data.totalUnits ?? {}) as KingdomUnits;
    const currentCount = units[unitType as keyof KingdomUnits] ?? 0;
    const updatedUnits: KingdomUnits = {
      ...units,
      [unitType]: currentCount + quantity
    };

    await client.models.Kingdom.update({
      id: kingdomId,
      totalUnits: updatedUnits
    });

    return { success: true, units: JSON.stringify(updatedUnits) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unit training error:', { kingdomId, unitType, quantity, error: message });
    return { success: false, error: 'Training failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
