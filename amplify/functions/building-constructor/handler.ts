import type { Schema } from '../../data/resource';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';

export const handler: Schema["constructBuildings"]["functionHandler"] = async (event) => {
  const { kingdomId, buildingType, quantity } = event.arguments;

  try {
    if (!kingdomId || !buildingType || !quantity) {
      return { success: false, error: 'Missing required parameters' };
    }

    const config = await getAmplifyDataClientConfig(process.env);
    const client = generateClient<Schema>({ config });

    const kingdomResult = await client.models.Kingdom.get({ id: kingdomId });
    if (!kingdomResult.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    const kingdom = kingdomResult.data;
    const buildings = (kingdom.buildings as Record<string, number>) || {};
    buildings[buildingType] = (buildings[buildingType] || 0) + quantity;

    await client.models.Kingdom.update({
      id: kingdomId,
      buildings: buildings
    });

    return { success: true, result: JSON.stringify({ built: quantity }) };
  } catch (error) {
    console.error('Building construction error:', error);
    return { success: false, error: 'Building construction failed' };
  }
};
