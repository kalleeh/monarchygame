import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';

// Input validation constants
const VALIDATION_RULES = {
  BUILDING_QUANTITY: { min: 1, max: 100 },
  KINGDOM_NAME: { minLength: 3, maxLength: 30 },
  BUILDING_TYPES: ['castle', 'barracks', 'farm', 'mine', 'temple', 'tower', 'wall']
} as const;

// Initialize client outside handler for connection reuse
const client = generateClient<Schema>();

export const handler: Schema["constructBuildings"]["functionHandler"] = async (event) => {
  const { kingdomId, buildingType, quantity } = event.arguments;

  try {
    // Input validation
    if (!kingdomId || !buildingType || !quantity) {
      return { success: false, error: 'Missing required parameters' };
    }

    // Validate building type
    if (!(VALIDATION_RULES.BUILDING_TYPES as ReadonlyArray<string>).includes(buildingType)) {
      return { success: false, error: `Invalid building type. Must be one of: ${VALIDATION_RULES.BUILDING_TYPES.join(', ')}` };
    }

    // Validate quantity range
    if (quantity < VALIDATION_RULES.BUILDING_QUANTITY.min || quantity > VALIDATION_RULES.BUILDING_QUANTITY.max) {
      return { 
        success: false, 
        error: `Quantity must be between ${VALIDATION_RULES.BUILDING_QUANTITY.min} and ${VALIDATION_RULES.BUILDING_QUANTITY.max}` 
      };
    }

    const result = await client.models.Kingdom.get({ id: kingdomId });

    if (!result.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    const kingdom = result.data;
    const buildings: Record<string, number> = (kingdom.buildings as Record<string, number>) || {};
    buildings[buildingType] = (buildings[buildingType] || 0) + quantity;

    await client.models.Kingdom.update({
      id: kingdomId,
      buildings
    });

    return { success: true, buildings: JSON.stringify(buildings) };
  } catch (error) {
    console.error('Building construction error:', error);
    return { success: false, error: 'Construction failed' };
  }
};
