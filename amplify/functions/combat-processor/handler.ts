import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import { calculateCombatResult } from '../../../frontend/src/utils/combatCache';

// Initialize client outside handler for connection reuse
const client = generateClient<Schema>();

export const handler: Schema["processCombat"]["functionHandler"] = async (event) => {
  const { attackerId, defenderId, attackType, units } = event.arguments;

  try {
    if (!attackerId || !defenderId) {
      return { success: false, error: 'Missing parameters' };
    }
    
    const [attacker, defender] = await Promise.all([
      client.models.Kingdom.get({ id: attackerId }),
      client.models.Kingdom.get({ id: defenderId })
    ]);

    if (!attacker.data || !defender.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    // Parse units from input
    const attackerUnits = typeof units === 'string' ? JSON.parse(units) : units;
    const defenderUnits = defender.data.totalUnits as any || {};
    const defenderLand = (defender.data.resources as any)?.land || 1000;

    // Use cached combat calculation
    const combatResult = calculateCombatResult(
      attackerUnits,
      defenderUnits,
      defenderLand
    );

    // Create battle report with detailed results
    await client.models.BattleReport.create({
      attackerId,
      defenderId,
      attackType: attackType || 'standard',
      result: JSON.stringify({
        result: combatResult.result,
        powerRatio: combatResult.powerRatio,
        landGained: combatResult.landGained,
        goldLooted: combatResult.goldLooted
      }),
      casualties: JSON.stringify(combatResult.casualties),
      landGained: combatResult.landGained,
      timestamp: new Date().toISOString()
    });

    // Update defender's land and resources if successful
    if (combatResult.success && combatResult.landGained > 0) {
      const defenderResources = defender.data.resources as any || {};
      const updatedResources = {
        ...defenderResources,
        land: Math.max(1000, (defenderResources.land || 1000) - combatResult.landGained),
        gold: Math.max(0, (defenderResources.gold || 0) - combatResult.goldLooted)
      };

      await client.models.Kingdom.update({
        id: defenderId,
        resources: updatedResources
      });

      // Update attacker's resources with gains
      const attackerResources = attacker.data.resources as any || {};
      const updatedAttackerResources = {
        ...attackerResources,
        land: (attackerResources.land || 1000) + combatResult.landGained,
        gold: (attackerResources.gold || 0) + combatResult.goldLooted
      };

      await client.models.Kingdom.update({
        id: attackerId,
        resources: updatedAttackerResources
      });
    }

    return { 
      success: true, 
      result: JSON.stringify({
        ...combatResult,
        message: `Combat ${combatResult.result}: ${combatResult.landGained} land gained, ${combatResult.goldLooted} gold looted`
      })
    };
  } catch (error) {
    console.error('Combat error:', error);
    return { success: false, error: 'Combat failed' };
  }
};
