import type { Schema } from '../../data/resource';
import type { KingdomResources, KingdomUnits } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbUpdate, dbList, dbAtomicAdd } from '../data-client';
import { THIEVERY_MECHANICS } from '../../../shared/mechanics/thievery-mechanics';

const VALID_OPERATIONS = ['scout', 'steal', 'sabotage', 'burn', 'desecrate', 'spread_dissention', 'intercept_caravans', 'scum_kill'] as const;
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

    // Alliance composition and upgrade espionage bonus
    let espionageBonus = 1.0;
    try {
      const attackerGuildId = (attackerKingdom as Record<string, unknown>).guildId as string | undefined;
      if (attackerGuildId) {
        const allianceData = await dbGet<{ stats?: string }>('Alliance', attackerGuildId);
        if (allianceData?.stats) {
          const aStats = typeof allianceData.stats === 'string' ? JSON.parse(allianceData.stats) : allianceData.stats;
          espionageBonus = aStats?.compositionBonus?.espionage ?? 1.0;
          const now = new Date().toISOString();
          const activeUpgrades = (aStats?.activeUpgrades ?? []) as Array<{ type: string; expiresAt: string; effect: Record<string, number> }>;
          for (const u of activeUpgrades.filter(x => x.expiresAt > now)) {
            if (u.effect.espionageBonus) espionageBonus *= u.effect.espionageBonus;
          }
        }
      }
    } catch { /* non-fatal */ }

    // Check turns from turnsBalance (server-side pool), falling back to resources.turns
    const attackerResources = (attackerKingdom.resources ?? {}) as KingdomResources;
    const currentTurns = attackerKingdom.turnsBalance ?? attackerResources.turns ?? 72;
    const OPERATION_TURN_COSTS: Record<string, number> = {
      scout:              THIEVERY_MECHANICS.OPERATION_COSTS.SCOUT,
      steal:              THIEVERY_MECHANICS.OPERATION_COSTS.STEAL,
      sabotage:           THIEVERY_MECHANICS.OPERATION_COSTS.SABOTAGE,
      burn:               THIEVERY_MECHANICS.OPERATION_COSTS.BURN,
      desecrate:          THIEVERY_MECHANICS.OPERATION_COSTS.DESECRATE,
      intercept_caravans: THIEVERY_MECHANICS.OPERATION_COSTS.INTERCEPT,
      spread_dissention:  THIEVERY_MECHANICS.OPERATION_COSTS.SABOTAGE,
      scum_kill:          THIEVERY_MECHANICS.OPERATION_COSTS.SABOTAGE,
    };
    const turnCost = OPERATION_TURN_COSTS[operation ?? ''] ?? THIEVERY_MECHANICS.OPERATION_COSTS.SCOUT;
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

    // Apply espionage bonus (reduces detection rate)
    const adjustedDetectionRate = Math.max(0, detectionRate / espionageBonus);

    // Determine success
    const succeeded = Math.random() > adjustedDetectionRate;

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
      } else if (operation === 'desecrate') {
        // Desecrate Temples: destroy ~10% of target's temples, reducing their elan generation.
        // This is the primary counter to sorcery-focused kingdoms (Sidhe, Vampire).
        const targetBuildings = (targetKingdom.buildings ?? {}) as Record<string, number>;
        const currentTemples = targetBuildings.temple ?? 0;
        const templesDestroyed = Math.floor(currentTemples * 0.10);
        if (templesDestroyed > 0) {
          await dbUpdate('Kingdom', targetKingdomId, {
            buildings: { ...targetBuildings, temple: Math.max(0, currentTemples - templesDestroyed) },
          });
        }
        (intelligence as Record<string, unknown>).templesDestroyed = templesDestroyed;
      } else if (operation === 'spread_dissention') {
        // Spread Dissention: kill ~3% of target's population.
        // Primary counter to population-rich kingdoms.
        const populationKilled = Math.floor((targetResources.population ?? 0) * 0.03);
        if (populationKilled > 0) {
          await dbUpdate('Kingdom', targetKingdomId, {
            resources: { ...targetResources, population: Math.max(0, (targetResources.population ?? 0) - populationKilled) },
          });
        }
        (intelligence as Record<string, unknown>).populationKilled = populationKilled;
      } else if (operation === 'intercept_caravans') {
        // Intercept Caravans: steal 2% of target's gold (capped at 200k).
        // Cheaper than Steal but targets income-in-transit.
        const goldIntercepted = Math.min(200000, Math.floor((targetResources.gold ?? 0) * 0.02));
        if (goldIntercepted > 0) {
          attackerGoldDelta = goldIntercepted;
          await dbUpdate('Kingdom', targetKingdomId, {
            resources: { ...targetResources, gold: (targetResources.gold ?? 0) - goldIntercepted },
          });
        }
        (intelligence as Record<string, unknown>).goldIntercepted = goldIntercepted;
      } else if (operation === 'scum_kill') {
        // Centaur-exclusive: directly execute enemy scouts at 7% kill rate.
        const attackerKingdom = await dbGet<{ race?: string }>('Kingdom', kingdomId);
        if (!attackerKingdom || (attackerKingdom.race ?? '').toLowerCase() !== 'centaur') {
          return { success: false, error: 'Scum Kill is a Centaur-exclusive ability', errorCode: ErrorCode.FORBIDDEN };
        }
        const scoutsKilled = Math.floor((targetUnits.scouts ?? 0) * 0.07);
        const updatedTargetUnits: KingdomUnits = {
          ...(targetUnits as KingdomUnits),
          scouts: Math.max(0, (targetUnits.scouts ?? 0) - scoutsKilled),
        };
        await dbUpdate('Kingdom', targetKingdomId, { totalUnits: updatedTargetUnits });
        (intelligence as Record<string, unknown>).scoutsKilled = scoutsKilled;
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
