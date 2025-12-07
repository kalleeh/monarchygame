import type { Schema } from '../../data/resource';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';
import { calculateCombat, type AttackForce, type DefenseForce } from '@shared/mechanics/combat-mechanics';

export const handler: Schema["processCombat"]["functionHandler"] = async (event) => {
  const { attackerId, defenderId, attackType, units } = event.arguments;

  try {
    // Validate input
    if (!attackerId || !defenderId || !attackType || !units) {
      return { success: false, error: 'Missing required parameters' };
    }

    // Get Amplify Data Client
    const config = await getAmplifyDataClientConfig(process.env);
    const client = generateClient<Schema>({ config });

    // Fetch attacker and defender kingdoms
    const [attackerResult, defenderResult] = await Promise.all([
      client.models.Kingdom.get({ id: attackerId }),
      client.models.Kingdom.get({ id: defenderId })
    ]);

    if (!attackerResult.data || !defenderResult.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    const attacker = attackerResult.data;
    const defender = defenderResult.data;

    // Prepare combat forces
    const attackForce: AttackForce = {
      units: units as Record<string, number>,
      totalOffense: 0,
      totalDefense: 0
    };

    const defenseForce: DefenseForce = {
      units: (defender.totalUnits as Record<string, number>) || {},
      forts: ((defender.buildings as any)?.forts || 0),
      totalDefense: 0,
      ambushActive: false
    };

    // Calculate combat result
    const result = calculateCombat({ attacker: attackForce, defender: defenseForce });

    // Create battle report
    await client.models.BattleReport.create({
      attackerId,
      defenderId,
      attackType,
      result: JSON.stringify(result),
      casualties: JSON.stringify({ attacker: result.attackerLosses, defender: result.defenderLosses }),
      landGained: result.landGained,
      timestamp: new Date().toISOString()
    });

    return { success: true, result: JSON.stringify(result) };
  } catch (error) {
    console.error('Combat processing error:', error);
    return { success: false, error: 'Combat processing failed' };
  }
};
