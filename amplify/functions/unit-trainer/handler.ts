import type { Schema } from '../../data/resource';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';

export const handler: Schema["trainUnits"]["functionHandler"] = async (event) => {
  const { kingdomId, unitType, quantity } = event.arguments;

  try {
    if (!kingdomId || !unitType || !quantity) {
      return { success: false, error: 'Missing required parameters' };
    }

    const config = await getAmplifyDataClientConfig(process.env);
    const client = generateClient<Schema>({ config });

    const kingdomResult = await client.models.Kingdom.get({ id: kingdomId });
    if (!kingdomResult.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    const kingdom = kingdomResult.data;
    const units = (kingdom.totalUnits as Record<string, number>) || {};
    units[unitType] = (units[unitType] || 0) + quantity;

    await client.models.Kingdom.update({
      id: kingdomId,
      totalUnits: units
    });

    return { success: true, result: JSON.stringify({ trained: quantity }) };
  } catch (error) {
    console.error('Unit training error:', error);
    return { success: false, error: 'Unit training failed' };
  }
};
