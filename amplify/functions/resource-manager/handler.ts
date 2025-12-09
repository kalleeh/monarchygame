import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';

export const handler: Schema["updateResources"]["functionHandler"] = async (event) => {
  const { kingdomId } = event.arguments;

  try {
    if (!kingdomId) {
      return { success: false, error: 'Missing kingdomId' };
    }

    const client = generateClient<Schema>();
    const result = await client.models.Kingdom.get({ id: kingdomId });

    if (!result.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    const kingdom = result.data;
    const resources = kingdom.resources as any || {};

    // Simple resource generation
    const updated = {
      gold: (resources.gold || 0) + 100,
      land: resources.land || 0,
      population: (resources.population || 0) + 10,
      mana: (resources.mana || 0) + 50
    };

    await client.models.Kingdom.update({
      id: kingdomId,
      resources: updated
    });

    return { success: true, resources: JSON.stringify(updated) };
  } catch (error) {
    console.error('Resource update error:', error);
    return { success: false, error: 'Update failed' };
  }
};
