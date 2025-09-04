import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';

export const handler = async (event: any) => {
  try {
    const config = await getAmplifyDataClientConfig(process.env);
    const client = generateClient({ config });

    const kingdom = await client.models.Kingdom.get({ id: event.casterId });
    if (!kingdom.data) throw new Error('Kingdom not found');

    const elanCost = event.elanCost || 10; // Game-data formula
    if (kingdom.data.resources.elan < elanCost) {
      throw new Error('Insufficient elan');
    }

    await client.models.Kingdom.update({
      id: event.casterId,
      resources: {
        ...kingdom.data.resources,
        elan: kingdom.data.resources.elan - elanCost
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, spellEffect: 'Spell cast successfully' })
    };
  } catch (error) {
    console.error('Spell casting failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Spell casting failed' })
    };
  }
};
