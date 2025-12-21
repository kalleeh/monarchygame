import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';

// Initialize client outside handler for connection reuse
const client = generateClient<Schema>();

export const handler: Schema["claimTerritory"]["functionHandler"] = async (event) => {
  const { kingdomId, territoryName, territoryType, terrainType, coordinates } = event.arguments;

  try {
    if (!kingdomId || !territoryName) {
      return { success: false, error: 'Missing parameters' };
    }
    
    await client.models.Territory.create({
      name: territoryName,
      type: territoryType || 'settlement',
      coordinates: JSON.stringify(coordinates || { x: 0, y: 0 }),
      terrainType: terrainType || 'plains',
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
