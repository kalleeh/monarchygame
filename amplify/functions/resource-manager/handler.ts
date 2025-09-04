import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';

export const handler = async (event: any) => {
  try {
    const config = await getAmplifyDataClientConfig(process.env);
    const client = generateClient({ config });

    const kingdom = await client.models.Kingdom.get({ id: event.kingdomId });
    if (!kingdom.data) throw new Error('Kingdom not found');

    let updatedResources = { ...kingdom.data.resources };

    if (event.operation === 'generate') {
      // Generate turns (3 per hour)
      if (event.resourceType === 'generate_turns') {
        updatedResources.turns = (updatedResources.turns || 0) + 3;
      }
      // Generate income
      if (event.resourceType === 'generate_income') {
        const income = 1000; // Game-data formula
        updatedResources.gold = (updatedResources.gold || 0) + income;
      }
    }

    await client.models.Kingdom.update({
      id: event.kingdomId,
      resources: updatedResources
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, resourcesUpdated: true })
    };
  } catch (error) {
    console.error('Resource update failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Resource update failed' })
    };
  }
};
