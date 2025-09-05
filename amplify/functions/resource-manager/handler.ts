import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';

export const handler = async (event: any) => {
  try {
    // Validate input
    if (!event.kingdomId) {
      return { success: false, error: 'Kingdom ID required' };
    }

    const config = await getAmplifyDataClientConfig(process.env);
    const client = generateClient({ config });

    const kingdom = await client.models.Kingdom.get({ id: event.kingdomId });
    if (!kingdom?.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    let updatedResources = { ...kingdom.data.resources } || {};

    if (event.operation === 'generate') {
      if (event.resourceType === 'generate_turns') {
        updatedResources.turns = (updatedResources.turns || 0) + 3;
      }
      if (event.resourceType === 'generate_income') {
        const income = 1000;
        updatedResources.gold = (updatedResources.gold || 0) + income;
      }
    }

    await client.models.Kingdom.update({
      id: event.kingdomId,
      resources: updatedResources
    });

    return {
      success: true,
      message: 'Resources updated successfully',
      resources: updatedResources
    };
  } catch (error) {
    console.error('Resource update failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Resource update failed'
    };
  }
};
