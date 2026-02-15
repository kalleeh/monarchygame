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

    if (attackerId === defenderId) {
      return { success: false, error: 'Cannot attack your own kingdom', errorCode: ErrorCode.INVALID_PARAM };
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
    const ownedUnits = (attacker.data.totalUnits ?? {}) as Record<string, number>;

    // Validate that attacker has enough units
    for (const [unitType, count] of Object.entries(attackerUnits)) {
      if (count > (ownedUnits[unitType] ?? 0)) {
        return { success: false, error: `Insufficient ${unitType}: sending ${count}, but only have ${ownedUnits[unitType] ?? 0}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
      }
    }

    // Enforce war declaration requirement for repeated attacks
    // After 3 attacks against the same defender in a season, a formal WarDeclaration is required
    const seasonId = (attacker.data as any)?.seasonId;

    if (seasonId) {
      // Count recent battle reports between attacker and defender this season
      const { data: recentBattles } = await client.models.BattleReport.list({
        filter: {
          attackerId: { eq: attackerId },
          defenderId: { eq: defenderId }
        }
      });

      const attackCount = recentBattles?.length ?? 0;

      if (attackCount >= 3) {
        // Check for active war declaration
        const { data: warDeclarations } = await client.models.WarDeclaration.list({
          filter: {
            attackerId: { eq: attackerId },
            defenderId: { eq: defenderId },
            status: { eq: 'active' }
          }
        });

        if (!warDeclarations || warDeclarations.length === 0) {
          return { success: false, error: 'War declaration required after 3 attacks', errorCode: ErrorCode.WAR_REQUIRED };
        }

        // Increment attack count on the war declaration
        const warDecl = warDeclarations[0];
        await client.models.WarDeclaration.update({
          id: warDecl.id,
          attackCount: (warDecl.attackCount ?? 0) + 1
        });
      }
    }

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

    // Check if defender should enter restoration after severe damage
    const defenderPostLand = Math.max(1000, (defenderResources.land ?? 1000) - combatResult.landGained);
    const landLossPercent = combatResult.landGained / (defenderResources.land ?? 1000);

    if (landLossPercent >= 0.5 || defenderPostLand <= 1000) {
      // Trigger restoration for severely damaged defender
      const restorationType = defenderPostLand <= 1000 ? 'death_based' : 'damage_based';
      const durationHours = restorationType === 'death_based' ? 72 : 48;
      const endTime = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

      await client.models.RestorationStatus.create({
        kingdomId: defenderId,
        type: restorationType,
        startTime: new Date().toISOString(),
        endTime,
        allowedActions: JSON.stringify(['view', 'message', 'diplomacy']),
        prohibitedActions: JSON.stringify(['attack', 'trade', 'build', 'train'])
      });
    }

    // Deduct casualties from both sides' units
    const casualties = combatResult.casualties || {} as any;
    const attackerCasualties = casualties.attacker || {};
    const defenderCasualties = casualties.defender || {};

    const updatedAttackerUnits: Record<string, number> = { ...ownedUnits };
    for (const [unitType, lost] of Object.entries(attackerCasualties as Record<string, number>)) {
      updatedAttackerUnits[unitType] = Math.max(0, (updatedAttackerUnits[unitType] ?? 0) - lost);
    }

    const updatedDefenderUnits: Record<string, number> = { ...defenderUnits };
    for (const [unitType, lost] of Object.entries(defenderCasualties as Record<string, number>)) {
      updatedDefenderUnits[unitType] = Math.max(0, (updatedDefenderUnits[unitType] ?? 0) - lost);
    }

    if (combatResult.success && combatResult.landGained > 0) {
      const attackerResources = (attacker.data.resources ?? {}) as KingdomResources;

      await Promise.all([
        client.models.Kingdom.update({
          id: defenderId,
          resources: {
            ...defenderResources,
            land: Math.max(1000, (defenderResources.land ?? 1000) - combatResult.landGained),
            gold: Math.max(0, (defenderResources.gold ?? 0) - combatResult.goldLooted)
          },
          totalUnits: updatedDefenderUnits
        }),
        client.models.Kingdom.update({
          id: attackerId,
          resources: {
            ...attackerResources,
            land: (attackerResources.land ?? 1000) + combatResult.landGained,
            gold: (attackerResources.gold ?? 0) + combatResult.goldLooted
          },
          totalUnits: updatedAttackerUnits
        })
      ]);
    } else {
      // Even if combat was not successful, still deduct casualties
      await Promise.all([
        client.models.Kingdom.update({
          id: attackerId,
          totalUnits: updatedAttackerUnits
        }),
        client.models.Kingdom.update({
          id: defenderId,
          totalUnits: updatedDefenderUnits
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
