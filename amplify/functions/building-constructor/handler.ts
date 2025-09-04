import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';

export const handler = async (event: any) => {
  try {
    const config = await getAmplifyDataClientConfig(process.env);
    const client = generateClient({ config });

    const kingdom = await client.models.Kingdom.get({ id: event.kingdomId });
    if (!kingdom.data) throw new Error('Kingdom not found');

    const cost = event.quantity * 100; // Game-data formula
    if (kingdom.data.resources.gold < cost) {
      throw new Error('Insufficient gold');
    }

    const currentBuildings = kingdom.data.buildings[event.buildingType] || 0;
    
    await client.models.Kingdom.update({
      id: event.kingdomId,
      resources: {
        ...kingdom.data.resources,
        gold: kingdom.data.resources.gold - cost
      },
      buildings: {
        ...kingdom.data.buildings,
        [event.buildingType]: currentBuildings + event.quantity
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, buildingsConstructed: event.quantity })
    };
  } catch (error) {
    console.error('Building construction failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Building construction failed' })
    };
  }
};
