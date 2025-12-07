import type { Schema } from '../../data/resource';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';
import { calculateTurnResources } from '@shared/mechanics/turn-mechanics';

export const handler: Schema["updateResources"]["functionHandler"] = async (event) => {
  const { kingdomId, resources } = event.arguments;

  try {
    if (!kingdomId || !resources) {
      return { success: false, error: 'Missing required parameters' };
    }

    const config = await getAmplifyDataClientConfig(process.env);
    const client = generateClient<Schema>({ config });

    const kingdomResult = await client.models.Kingdom.get({ id: kingdomId });
    if (!kingdomResult.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    const kingdom = kingdomResult.data;
    
    // Apply turn-based resource generation
    const currentResources = kingdom.resources as any;
    const buildings = kingdom.buildings as any;
    const stats = kingdom.stats as any;
    
    const generatedResources = calculateTurnResources({
      buildings: buildings || {},
      land: stats?.land || 1000,
      race: kingdom.race || 'Human'
    });

    // Merge generated resources with updates
    const updatedResources = {
      ...currentResources,
      ...resources,
      gold: (currentResources.gold || 0) + (generatedResources.gold || 0),
      population: (currentResources.population || 0) + (generatedResources.population || 0)
    };

    await client.models.Kingdom.update({
      id: kingdomId,
      resources: updatedResources
    });

    return { success: true, result: JSON.stringify({ updated: true, generated: generatedResources }) };
  } catch (error) {
    console.error('Resource update error:', error);
    return { success: false, error: 'Resource update failed' };
  }
};
