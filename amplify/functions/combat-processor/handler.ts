import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import { calculateCombatResult } from '../../../shared/combat/combatCache';
import type { KingdomResources, CombatResultData } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';

const client = generateClient<Schema>();

// Formation bonuses — applied as an offense multiplier
const FORMATION_BONUSES: Record<string, number> = {
  'aggressive': 1.15,    // +15% offense
  'defensive': 0.9,      // -10% offense (tradeoff: less vulnerable)
  'flanking': 1.10,      // +10% offense
  'siege': 1.20,         // +20% offense vs fortified targets
  'standard': 1.0,       // no bonus
};

export const handler: Schema["processCombat"]["functionHandler"] = async (event) => {
  const { attackerId, defenderId, attackType, units, formationId } = event.arguments;

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

    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
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

    // Verify kingdom ownership (attacker only)
    const attackerOwnerField = (attacker.data as any).owner as string | null;
    if (!attackerOwnerField || (!attackerOwnerField.includes(identity.sub) && !attackerOwnerField.includes(identity.username ?? ''))) {
      return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
    }

    const attackerUnits: Record<string, number> = typeof units === 'string' ? JSON.parse(units) : units;
    const ownedUnits = (attacker.data.totalUnits ?? {}) as Record<string, number>;

    // Validate that attacker has enough units
    for (const [unitType, count] of Object.entries(attackerUnits)) {
      if (count > (ownedUnits[unitType] ?? 0)) {
        return { success: false, error: `Insufficient ${unitType}: sending ${count}, but only have ${ownedUnits[unitType] ?? 0}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
      }
    }

    // Check and deduct turns
    const attackerResources = (attacker.data.resources ?? {}) as KingdomResources;
    const currentTurns = attackerResources.turns ?? 72;
    const turnCost = 4;
    if (currentTurns < turnCost) {
      return { success: false, error: `Not enough turns. Need ${turnCost}, have ${currentTurns}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Enforce war declaration requirement for repeated attacks
    // After 3 attacks against the same defender in a season, a formal WarDeclaration is required
    const seasonId = attacker.data?.seasonId;

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

    // Apply formation bonus by scaling effective attacker unit counts
    const formationMultiplier = formationId ? (FORMATION_BONUSES[formationId] ?? 1.0) : 1.0;
    let effectiveAttackerUnits: Record<string, number> = {};
    for (const [unitType, count] of Object.entries(attackerUnits)) {
      effectiveAttackerUnits[unitType] = count * formationMultiplier;
    }

    // Age combat bonus — more experienced kingdoms fight better in later ages
    const AGE_COMBAT_BONUSES: Record<string, number> = {
      'early': 1.0,
      'middle': 1.05,   // 5% combat bonus
      'late': 1.10,     // 10% combat bonus
    };
    const attackerAge = (attacker.data.currentAge as string) ?? 'early';
    const ageCombatBonus = AGE_COMBAT_BONUSES[attackerAge] ?? 1.0;
    effectiveAttackerUnits = Object.fromEntries(
      Object.entries(effectiveAttackerUnits).map(([k, v]) => [k, Math.floor(v * ageCombatBonus)])
    );

    const combatResult = calculateCombatResult(
      effectiveAttackerUnits,
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
    const casualties: CombatResultData['casualties'] = combatResult.casualties || { attacker: {}, defender: {} };
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
            gold: (attackerResources.gold ?? 0) + combatResult.goldLooted,
            turns: Math.max(0, currentTurns - turnCost)
          },
          totalUnits: updatedAttackerUnits
        })
      ]);
    } else {
      // Even if combat was not successful, still deduct casualties and turns
      await Promise.all([
        client.models.Kingdom.update({
          id: attackerId,
          resources: {
            ...attackerResources,
            turns: Math.max(0, currentTurns - turnCost)
          },
          totalUnits: updatedAttackerUnits
        }),
        client.models.Kingdom.update({
          id: defenderId,
          totalUnits: updatedDefenderUnits
        })
      ]);
    }

    log.info('combat-processor', 'processCombat', { attackerId, defenderId, attackType, result: combatResult.result });
    return {
      success: true,
      result: JSON.stringify({
        ...combatResult,
        message: `Combat ${combatResult.result}: ${combatResult.landGained} land gained, ${combatResult.goldLooted} gold looted`
      })
    };
  } catch (error) {
    log.error('combat-processor', error, { attackerId, defenderId });
    return { success: false, error: 'Combat processing failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
