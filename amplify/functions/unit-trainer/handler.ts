import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';

// Input validation constants
const VALIDATION_RULES = {
  UNIT_QUANTITY: { min: 1, max: 1000 },
  UNIT_TYPES: ['infantry', 'archers', 'cavalry', 'siege', 'mages', 'scouts']
} as const;

// Initialize client outside handler for connection reuse
const client = generateClient<Schema>();

export const handler: Schema["trainUnits"]["functionHandler"] = async (event) => {
  const { kingdomId, unitType, quantity } = event.arguments;

  try {
    // Input validation
    if (!kingdomId || !unitType || !quantity) {
      return { success: false, error: 'Missing required parameters' };
    }

    // Validate unit type
    if (!(VALIDATION_RULES.UNIT_TYPES as ReadonlyArray<string>).includes(unitType)) {
      return { success: false, error: `Invalid unit type. Must be one of: ${VALIDATION_RULES.UNIT_TYPES.join(', ')}` };
    }

    // Validate quantity range
    if (quantity < VALIDATION_RULES.UNIT_QUANTITY.min || quantity > VALIDATION_RULES.UNIT_QUANTITY.max) {
      return { 
        success: false, 
        error: `Quantity must be between ${VALIDATION_RULES.UNIT_QUANTITY.min} and ${VALIDATION_RULES.UNIT_QUANTITY.max}` 
      };
    }

    const result = await client.models.Kingdom.get({ id: kingdomId });

    if (!result.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    const kingdom = result.data;
    const resources = (kingdom.resources as any) || {};
    const goldCost = quantity * 100;

    if ((resources.gold || 0) < goldCost) {
      return { success: false, error: `Insufficient gold: need ${goldCost}, have ${resources.gold || 0}` };
    }

    const units: Record<string, number> = (kingdom.totalUnits as Record<string, number>) || {};
    units[unitType] = (units[unitType] || 0) + quantity;

    const updatedResources = {
      ...resources,
      gold: (resources.gold || 0) - goldCost
    };

    await client.models.Kingdom.update({
      id: kingdomId,
      totalUnits: units,
      resources: updatedResources
    });

    return { success: true, units: JSON.stringify(units) };
  } catch (error) {
    console.error('Unit training error:', error);
    return { success: false, error: 'Training failed' };
  }
};
