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

    // Check kingdom exists and has enough gold
    const kingdomResult = await client.models.Kingdom.get({ id: kingdomId });
    if (!kingdomResult.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    const resources = (kingdomResult.data.resources as any) || {};
    if ((resources.gold || 0) < 500) {
      return { success: false, error: `Insufficient gold: need 500, have ${resources.gold || 0}` };
    }

    // Check for duplicate territory at same coordinates
    const parsedCoords = coordinates || { x: 0, y: 0 };
    const coordStr = JSON.stringify(parsedCoords);
    const existingTerritories = await client.models.Territory.list({
      filter: { kingdomId: { eq: kingdomId } }
    });
    const duplicate = existingTerritories.data?.find(
      (t: any) => t.coordinates === coordStr
    );
    if (duplicate) {
      return { success: false, error: 'Territory already claimed at these coordinates' };
    }

    // Deduct gold cost
    const updatedResources = {
      ...resources,
      gold: (resources.gold || 0) - 500
    };
    await client.models.Kingdom.update({
      id: kingdomId,
      resources: updatedResources
    });

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
