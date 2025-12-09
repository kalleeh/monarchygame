import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';

export const handler: Schema["processCombat"]["functionHandler"] = async (event) => {
  const { attackerId, defenderId } = event.arguments;

  try {
    if (!attackerId || !defenderId) {
      return { success: false, error: 'Missing parameters' };
    }

    const client = generateClient<Schema>();
    
    const [attacker, defender] = await Promise.all([
      client.models.Kingdom.get({ id: attackerId }),
      client.models.Kingdom.get({ id: defenderId })
    ]);

    if (!attacker.data || !defender.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    // Minimal combat calculation
    const landGained = Math.floor(Math.random() * 100);

    await client.models.BattleReport.create({
      attackerId,
      defenderId,
      attackType: 'standard',
      result: JSON.stringify({ landGained }),
      casualties: JSON.stringify({ attacker: 0, defender: 0 }),
      landGained,
      timestamp: new Date().toISOString()
    });

    return { success: true, result: JSON.stringify({ landGained }) };
  } catch (error) {
    console.error('Combat error:', error);
    return { success: false, error: 'Combat failed' };
  }
};
