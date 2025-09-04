import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';

export const handler = async (event: any) => {
  try {
    const config = await getAmplifyDataClientConfig(process.env);
    const client = generateClient({ config });

    const kingdom = await client.models.Kingdom.get({ id: event.kingdomId });
    if (!kingdom.data) throw new Error('Kingdom not found');

    const cost = event.quantity * 50; // Game-data formula
    if (kingdom.data.resources.gold < cost) {
      throw new Error('Insufficient gold');
    }

    const currentUnits = kingdom.data.totalUnits[event.unitType] || 0;
    
    await client.models.Kingdom.update({
      id: event.kingdomId,
      resources: {
        ...kingdom.data.resources,
        gold: kingdom.data.resources.gold - cost
      },
      totalUnits: {
        ...kingdom.data.totalUnits,
        [event.unitType]: currentUnits + event.quantity
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, unitsTrained: event.quantity })
    };
  } catch (error) {
    console.error('Unit training failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unit training failed' })
    };
  }
};
