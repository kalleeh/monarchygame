import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import { calculateCombatResult } from '../../../shared/combat/combatCache';
import type { KingdomResources, CombatResultData } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';

const client = generateClient<Schema>();

export const handler: Schema["processCombat"]["functionHandler"] = async (event) => {
  const { attackerId, defenderId, attackType, units } = event.arguments;

  try {
    if (!attackerId || !defenderId) {
      return { success: false, error: 'Missing attacker or defender ID', errorCode: ErrorCode.MISSING_PARAMS };
    }

    if (!units) {
      return { success: false, error: 'No units specified for attack', errorCode: ErrorCode.MISSING_PARAMS };
    }

    const [attacker, defender] = await Promise.all([
      client.models.Kingdom.get({ id: attackerId }),
      client.models.Kingdom.get({ id: defenderId })
    ]);

    if (!attacker.data) {
      return { success: false, error: 'Attacker kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }
    if (!defender.data) {
      return { success: false, error: 'Defender kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    const attackerUnits: Record<string, number> = typeof units === 'string' ? JSON.parse(units) : units;
    const defenderResources = (defender.data.resources ?? {}) as KingdomResources;
    const defenderUnits = (defender.data.totalUnits ?? {}) as Record<string, number>;
    const defenderLand = defenderResources.land ?? 1000;

    const combatResult = calculateCombatResult(
      attackerUnits,
      defenderUnits,
      defenderLand
    ) as CombatResultData;

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

    if (combatResult.success && combatResult.landGained > 0) {
      const attackerResources = (attacker.data.resources ?? {}) as KingdomResources;

      await Promise.all([
        client.models.Kingdom.update({
          id: defenderId,
          resources: {
            ...defenderResources,
            land: Math.max(1000, (defenderResources.land ?? 1000) - combatResult.landGained),
            gold: Math.max(0, (defenderResources.gold ?? 0) - combatResult.goldLooted)
          }
        }),
        client.models.Kingdom.update({
          id: attackerId,
          resources: {
            ...attackerResources,
            land: (attackerResources.land ?? 1000) + combatResult.landGained,
            gold: (attackerResources.gold ?? 0) + combatResult.goldLooted
          }
        })
      ]);
    }

    return {
      success: true,
      result: JSON.stringify({
        ...combatResult,
        message: `Combat ${combatResult.result}: ${combatResult.landGained} land gained, ${combatResult.goldLooted} gold looted`
      })
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Combat processing error:', { attackerId, defenderId, error: message });
    return { success: false, error: 'Combat processing failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
