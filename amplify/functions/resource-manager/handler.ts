import type { Schema } from '../../data/resource';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';

export const handler: Schema["updateResources"]["functionHandler"] = async (event) => {
  const { kingdomId, resources } = event.arguments;

  try {
    if (!kingdomId || !resources) {
      return { success: false, error: 'Missing required parameters' };
    }

    const config = await getAmplifyDataClientConfig(process.env);
    const client = generateClient<Schema>({ config });

    // Fetch kingdom
    const kingdomResult = await client.models.Kingdom.get({ id: kingdomId });
    if (!kingdomResult.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    // Update resources
    await client.models.Kingdom.update({
      id: kingdomId,
      resources: resources
    });

    return { success: true, result: JSON.stringify({ updated: true }) };
  } catch (error) {
    console.error('Resource update error:', error);
    return { success: false, error: 'Resource update failed' };
  }
};
