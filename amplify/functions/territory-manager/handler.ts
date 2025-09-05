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

    const resources = kingdom.data.resources || {};
    const territoryAmount = event.territoryAmount || 1;
    
    // Calculate cost using authentic Monarchy formula
    const cost = territoryAmount * 1000;
    
    if ((resources.gold || 0) < cost) {
      return { success: false, error: 'Insufficient gold' };
    }

    await client.models.Kingdom.update({
      id: event.kingdomId,
      resources: {
        ...resources,
        gold: (resources.gold || 0) - cost,
        land: (resources.land || 0) + territoryAmount
      }
    });

    return {
      success: true,
      message: 'Territory claimed successfully',
      territoryGained: territoryAmount,
      goldCost: cost
    };
  } catch (error) {
    console.error('Territory claim failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Territory claim failed'
    };
  }
};
