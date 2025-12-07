import type { Schema } from '../../data/resource';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';

export const handler: Schema["claimTerritory"]["functionHandler"] = async (event) => {
  const { kingdomId, territoryName, coordinates } = event.arguments;

  try {
    if (!kingdomId || !territoryName || !coordinates) {
      return { success: false, error: 'Missing required parameters' };
    }

    const config = await getAmplifyDataClientConfig(process.env);
    const client = generateClient<Schema>({ config });

    const kingdomResult = await client.models.Kingdom.get({ id: kingdomId });
    if (!kingdomResult.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    // Create new territory
    await client.models.Territory.create({
      name: territoryName,
      type: 'settlement',
      coordinates: coordinates,
      terrainType: 'plains',
      resources: JSON.stringify({}),
      buildings: JSON.stringify({}),
      defenseLevel: 0,
      kingdomId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return { success: true, result: JSON.stringify({ claimed: true }) };
  } catch (error) {
    console.error('Territory claim error:', error);
    return { success: false, error: 'Territory claim failed' };
  }
};
