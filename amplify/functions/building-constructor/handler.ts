import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';

export const handler: Schema["constructBuilding"]["functionHandler"] = async (event) => {
  const { kingdomId, buildingType } = event.arguments;

  try {
    if (!kingdomId || !buildingType) {
      return { success: false, error: 'Missing parameters' };
    }

    const client = generateClient<Schema>();
    const result = await client.models.Kingdom.get({ id: kingdomId });

    if (!result.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    const kingdom = result.data;
    const buildings = kingdom.buildings as any || {};
    buildings[buildingType] = (buildings[buildingType] || 0) + 1;

    await client.models.Kingdom.update({
      id: kingdomId,
      buildings
    });

    return { success: true, buildings: JSON.stringify(buildings) };
  } catch (error) {
    console.error('Building error:', error);
    return { success: false, error: 'Construction failed' };
  }
};
