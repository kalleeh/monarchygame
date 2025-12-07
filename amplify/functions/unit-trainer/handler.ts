import type { Schema } from '../../data/resource';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';
import { UNITS } from '@shared/units';

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
    
    // Get unit cost from shared data
    const unitData = UNITS[unitType];
    if (!unitData) {
      return { success: false, error: 'Invalid unit type' };
    }

    const totalCost = unitData.stats.cost.gold * quantity;
    const currentGold = (kingdom.resources as any)?.gold || 0;

    // Validate resources
    if (currentGold < totalCost) {
      return { success: false, error: 'Insufficient gold' };
    }

    // Deduct cost and add units
    const units = (kingdom.totalUnits as Record<string, number>) || {};
    units[unitType] = (units[unitType] || 0) + quantity;

    const resources = kingdom.resources as any;
    resources.gold = currentGold - totalCost;

    await client.models.Kingdom.update({
      id: kingdomId,
      totalUnits: units,
      resources: resources
    });

    return { success: true, result: JSON.stringify({ trained: quantity, cost: totalCost }) };
  } catch (error) {
    console.error('Unit training error:', error);
    return { success: false, error: 'Unit training failed' };
  }
};
