import type { Schema } from '../../data/resource';
import type { KingdomResources, KingdomUnits } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbUpdate, dbQuery, dbAtomicAdd, parseJsonField, ensureTurnsBalance } from '../data-client';
import { verifyOwnership } from '../verify-ownership';
import { THIEVERY_MECHANICS } from '../../../shared/mechanics/thievery-mechanics';
import { checkRateLimit } from '../rate-limiter';

const VALID_OPERATIONS = ['scout', 'steal', 'sabotage', 'burn', 'desecrate', 'spread_dissention', 'intercept_caravans', 'scum_kill'] as const;
const MIN_SCOUTS = 100;

type KingdomType = Record<string, unknown> & { turnsBalance?: number | null };

export const handler: Schema["executeThievery"]["functionHandler"] = async (event) => {
  const { kingdomId, operation, targetKingdomId } = event.arguments;

  try {
    if (!kingdomId || !targetKingdomId) {
      return { success: false, error: 'Missing required parameters: kingdomId, targetKingdomId', errorCode: ErrorCode.MISSING_PARAMS };
    }
    if (kingdomId === targetKingdomId) {
      return { success: false, error: 'Cannot target your own kingdom', errorCode: ErrorCode.INVALID_PARAM };
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
    const denied = verifyOwnership(identity, attackerKingdom.owner as string | null);
    if (denied) return denied;

    // Rate limit check
    const rateLimited = await checkRateLimit(identity.sub, 'thievery');
    if (rateLimited) return rateLimited;

    // Check restoration status
    const restorations = await dbQuery<{ kingdomId: string; endTime: string; prohibitedActions?: string }>('RestorationStatus', 'restorationStatusesByKingdomIdAndEndTime', { field: 'kingdomId', value: kingdomId });
    const activeRestoration = restorations.find(r => new Date(r.endTime) > new Date());
    if (activeRestoration) {
      const prohibited: string[] = parseJsonField<string[]>(activeRestoration.prohibitedActions, []);
      if (prohibited.some(a => ['espionage'].includes(a))) {
        return { success: false, error: 'Kingdom is in restoration and cannot perform this action', errorCode: ErrorCode.RESTORATION_BLOCKED };
      }
    }

    const attackerUnits = parseJsonField<Record<string, number>>(attackerKingdom.totalUnits, {});
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
          const aStats = parseJsonField<Record<string, unknown>>(allianceData.stats, {});
          espionageBonus = (aStats?.compositionBonus as Record<string, number> | undefined)?.espionage ?? 1.0;
          const now = new Date().toISOString();
          const activeUpgrades = (aStats?.activeUpgrades ?? []) as Array<{ type: string; expiresAt: string; effect: Record<string, number> }>;
          for (const u of activeUpgrades.filter(x => x.expiresAt > now)) {
            if (u.effect.espionageBonus) espionageBonus *= u.effect.espionageBonus;
          }
        }
      }
    } catch { /* non-fatal */ }

    // Check turns from turnsBalance (server-side pool), falling back to resources.turns
    const attackerResources = parseJsonField<KingdomResources>(attackerKingdom.resources, {} as KingdomResources);
    await ensureTurnsBalance(attackerKingdom as Record<string, unknown>);
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

    const targetUnits = parseJsonField<Record<string, number>>(targetKingdom.totalUnits, {});
    const targetResources = parseJsonField<KingdomResources>(targetKingdom.resources, {} as KingdomResources);

    // Calculate detection rate
    let detectionRate = Math.min(0.95, ((targetUnits.scouts ?? 0) / Math.max(1, attackerScouts)) * 0.85);

    // Fae Glamour: 30% reduction in detection rate
    const attackerRace = (attackerKingdom.race as string | undefined) ?? '';
    if (attackerRace.toLowerCase() === 'fae') {
      detectionRate = detectionRate * 0.70;
    }

    // Apply espionage bonus (reduces detection rate)
    const adjustedDetectionRate = espionageBonus > 0
      ? Math.max(0, detectionRate / espionageBonus)
      : detectionRate; // no bonus, use base rate

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
        const targetBuildings = parseJsonField<Record<string, number>>(targetKingdom.buildings, {});
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
        if (attackerRace.toLowerCase() !== 'centaur') {
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

    // Update attacker scout count: apply casualties and promotions
    // In the original Monarchy, scum gain experience through operations and
    // promote from Green → Elite. Elite scum have 2.5x better survival rates.
    // Promotion rate: ~3% of surviving green scouts promote on a successful op.
    const currentEliteScouts = attackerUnits.elite_scouts ?? 0;
    let greenAfterCasualties = Math.max(0, attackerScouts - casualties);
    let eliteAfterCasualties = currentEliteScouts;

    // Elite scouts take fewer casualties (2.5x survival advantage)
    // Split casualties: elite absorb proportionally fewer
    if (currentEliteScouts > 0 && casualties > 0) {
      const totalScum = attackerScouts + currentEliteScouts;
      const eliteFraction = currentEliteScouts / totalScum;
      const eliteCasualties = Math.floor(casualties * eliteFraction * 0.4); // 2.5x survival
      const greenCasualties = casualties - eliteCasualties;
      greenAfterCasualties = Math.max(0, attackerScouts - greenCasualties);
      eliteAfterCasualties = Math.max(0, currentEliteScouts - eliteCasualties);
    }

    // Promote green → elite on successful operations (3% promotion rate)
    let promoted = 0;
    if (succeeded && greenAfterCasualties > 0) {
      promoted = Math.floor(greenAfterCasualties * 0.03);
      greenAfterCasualties -= promoted;
      eliteAfterCasualties += promoted;
    }

    const updatedAttackerUnits: KingdomUnits = {
      ...(attackerUnits as KingdomUnits),
      scouts: greenAfterCasualties,
      elite_scouts: eliteAfterCasualties,
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

    // BL-6: If operation was detected (spy caught), record detection on the target kingdom
    if (!succeeded) {
      const targetStats = parseJsonField<Record<string, unknown>>(targetKingdom.stats, {});
      const updatedTargetStats = {
        ...targetStats,
        lastDetectedThievery: new Date().toISOString(),
      };
      await dbUpdate('Kingdom', targetKingdomId, { stats: updatedTargetStats });
      log.info('thievery-processor', 'thieveryDetected', { targetKingdomId, operation, attackerKingdomId: kingdomId });
    }

    log.info('thievery-processor', 'executeThievery', { kingdomId, operation, targetKingdomId });
    return {
      success: true,
      result: JSON.stringify({ operation, succeeded, casualties, goldStolen, intelligence, promoted }),
    };
  } catch (error) {
    log.error('thievery-processor', error, { kingdomId, operation, targetKingdomId });
    return { success: false, error: error instanceof Error ? error.message : 'Thievery operation failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
