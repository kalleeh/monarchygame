import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';

export const handler: Schema["trainUnits"]["functionHandler"] = async (event) => {
  const { kingdomId, unitType, quantity } = event.arguments;

  try {
    if (!kingdomId || !unitType || !quantity) {
      return { success: false, error: 'Missing parameters' };
    }

    const client = generateClient<Schema>();
    const result = await client.models.Kingdom.get({ id: kingdomId });

    if (!result.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    const kingdom = result.data;
    const units = kingdom.totalUnits as any || {};
    units[unitType] = (units[unitType] || 0) + quantity;

    await client.models.Kingdom.update({
      id: kingdomId,
      totalUnits: units
    });

    return { success: true, units: JSON.stringify(units) };
  } catch (error) {
    console.error('Training error:', error);
    return { success: false, error: 'Training failed' };
  }
};
