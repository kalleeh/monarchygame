import type { Schema } from '../../data/resource';
import type { KingdomResources, KingdomUnits } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbUpdate, dbList, dbAtomicAdd } from '../data-client';

const VALID_OPERATIONS = ['scout', 'steal', 'sabotage', 'burn'] as const;
const MIN_SCOUTS = 100;

type KingdomType = Record<string, unknown> & { turnsBalance?: number | null };

export const handler: Schema["executeThievery"]["functionHandler"] = async (event) => {
  const { kingdomId, operation, targetKingdomId } = event.arguments;

  try {
    if (!kingdomId || !targetKingdomId) {
      return { success: false, error: 'Missing required parameters: kingdomId, targetKingdomId', errorCode: ErrorCode.MISSING_PARAMS };
    }

    if (!operation || !(VALID_OPERATIONS as readonly string[]).includes(operation)) {
      return { success: false, error: `Invalid operation. Must be one of: ${VALID_OPERATIONS.join(', ')}`, errorCode: ErrorCode.INVALID_PARAM };
    }

    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }

    // Fetch attacker kingdom
    const attackerKingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
    if (!attackerKingdom) {
      return { success: false, error: 'Attacker kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    // Verify kingdom ownership
    const ownerField = attackerKingdom.owner as string | null;
    if (!ownerField || (!ownerField.includes(identity.sub) && !ownerField.includes(identity.username ?? ''))) {
      return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
    }

    // Check restoration status
    const allRestoration = await dbList<{ kingdomId: string; endTime: string; prohibitedActions?: string }>('RestorationStatus');
    const activeRestoration = allRestoration.find(r => r.kingdomId === kingdomId && new Date(r.endTime) > new Date());
    if (activeRestoration) {
      const prohibited: string[] = typeof activeRestoration.prohibitedActions === 'string'
        ? JSON.parse(activeRestoration.prohibitedActions)
        : (activeRestoration.prohibitedActions ?? []);
      if (prohibited.some(a => ['espionage'].includes(a))) {
        return { success: false, error: 'Kingdom is in restoration and cannot perform this action', errorCode: ErrorCode.RESTORATION_BLOCKED };
      }
    }

    const attackerUnits = (attackerKingdom.totalUnits ?? {}) as Record<string, number>;
    const attackerScouts = attackerUnits.scouts ?? 0;

    if (attackerScouts < MIN_SCOUTS) {
      return { success: false, error: `Insufficient scouts: need ${MIN_SCOUTS}, have ${attackerScouts}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Check turns from turnsBalance (server-side pool), falling back to resources.turns
    const attackerResources = (attackerKingdom.resources ?? {}) as KingdomResources;
    const currentTurns = attackerKingdom.turnsBalance ?? attackerResources.turns ?? 72;
    const turnCost = 2;
    if (currentTurns < turnCost) {
      return { success: false, error: `Not enough turns. Need ${turnCost}, have ${currentTurns}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Fetch target kingdom
    const targetKingdom = await dbGet<KingdomType>('Kingdom', targetKingdomId);
    if (!targetKingdom) {
      return { success: false, error: 'Target kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    const targetUnits = (targetKingdom.totalUnits ?? {}) as Record<string, number>;
    const targetResources = (targetKingdom.resources ?? {}) as KingdomResources;

    // Calculate detection rate
    const detectionRate = Math.min(0.95, ((targetUnits.scouts ?? 0) / Math.max(1, attackerScouts)) * 0.85);

    // Determine success
    const succeeded = Math.random() > detectionRate;

    // Calculate scout casualties (1–2.5%)
    const casualties = Math.floor(attackerScouts * (0.01 + Math.random() * 0.015));

    // Apply operation outcome
    let goldStolen = 0;
    let intelligence: Record<string, unknown> = {};
    // Track extra gold gained by attacker (used in final resource update)
    let attackerGoldDelta = 0;

    if (succeeded) {
      if (operation === 'scout') {
        intelligence = {
          targetGold: targetResources.gold ?? 0,
          targetScouts: targetUnits.scouts ?? 0,
          defenseRating: (targetUnits.scouts ?? 0) * 10,
        };
      } else if (operation === 'steal') {
        goldStolen = Math.min(3500000, Math.floor((targetResources.gold ?? 0) * 0.05));
        attackerGoldDelta = goldStolen;

        const updatedTargetResources: KingdomResources = {
          ...targetResources,
          gold: (targetResources.gold ?? 0) - goldStolen,
        };
        await dbUpdate('Kingdom', targetKingdomId, {
          resources: updatedTargetResources,
        });
      } else if (operation === 'sabotage') {
        const scoutsDestroyed = Math.floor((targetUnits.scouts ?? 0) * 0.03);
        const updatedTargetUnits: KingdomUnits = {
          ...(targetUnits as KingdomUnits),
          scouts: Math.max(0, (targetUnits.scouts ?? 0) - scoutsDestroyed),
        };
        await dbUpdate('Kingdom', targetKingdomId, {
          totalUnits: updatedTargetUnits,
        });
      } else if (operation === 'burn') {
        const scoutsDestroyed = Math.floor((targetUnits.scouts ?? 0) * 0.05);
        const updatedTargetUnits: KingdomUnits = {
          ...(targetUnits as KingdomUnits),
          scouts: Math.max(0, (targetUnits.scouts ?? 0) - scoutsDestroyed),
        };
        await dbUpdate('Kingdom', targetKingdomId, {
          totalUnits: updatedTargetUnits,
        });
      }
    }

    // Update attacker scout count and apply any gold gain; deduct turns atomically
    const updatedAttackerUnits: KingdomUnits = {
      ...(attackerUnits as KingdomUnits),
      scouts: Math.max(0, attackerScouts - casualties),
    };
    const updatedAttackerResources: KingdomResources = {
      ...attackerResources,
      gold: (attackerResources.gold ?? 0) + attackerGoldDelta,
    };
    await dbUpdate('Kingdom', kingdomId, {
      totalUnits: updatedAttackerUnits,
      resources: updatedAttackerResources,
    });
    await dbAtomicAdd('Kingdom', kingdomId, 'turnsBalance', -turnCost);

    log.info('thievery-processor', 'executeThievery', { kingdomId, operation, targetKingdomId });
    return {
      success: true,
      result: JSON.stringify({ operation, succeeded, casualties, goldStolen, intelligence }),
    };
  } catch (error) {
    log.error('thievery-processor', error, { kingdomId, operation, targetKingdomId });
    return { success: false, error: 'Thievery operation failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
