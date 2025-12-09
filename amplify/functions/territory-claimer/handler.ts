import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';

export const handler: Schema["claimTerritory"]["functionHandler"] = async (event) => {
  const { kingdomId, territoryName, coordinates } = event.arguments;

  try {
    if (!kingdomId || !territoryName) {
      return { success: false, error: 'Missing parameters' };
    }

    const client = generateClient<Schema>();
    
    await client.models.Territory.create({
      name: territoryName,
      type: 'settlement',
      coordinates: JSON.stringify(coordinates || { x: 0, y: 0 }),
      terrainType: 'plains',
      resources: JSON.stringify({ gold: 0, land: 100 }),
      buildings: JSON.stringify({}),
      defenseLevel: 0,
      kingdomId
    });

    return { success: true, territory: territoryName };
  } catch (error) {
    console.error('Territory error:', error);
    return { success: false, error: 'Claim failed' };
  }
};
