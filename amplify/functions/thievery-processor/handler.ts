import type { Schema } from '../../data/resource';
import type { KingdomResources, KingdomUnits } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbCreate, dbUpdate, dbConditionalUpdate, dbQuery, dbAtomicAdd, parseJsonField, ensureTurnsBalance, persistErrorLog } from '../data-client';
import { verifyOwnership } from '../verify-ownership';
import { THIEVERY_MECHANICS, calculateDetectionRate } from '../../../shared/mechanics/thievery-mechanics';
import { checkRateLimit } from '../rate-limiter';
import { isConditionalCheckFailed } from '../conditional-helpers';
import { TIER_STATS } from '../../../shared/mechanics/tier-stats';
import { RACE_DEFENSE_BONUSES } from '../../../shared/mechanics/combat-mechanics';
import { scumRatingForRace, scoutIntelExpiryMs, scoutIntelDetail, coarsenSnapshot, type DefenderSnapshot } from '../../../shared/mechanics/scout-mechanics';

const VALID_OPERATIONS = ['scout', 'steal', 'sabotage', 'burn', 'desecrate', 'spread_dissention', 'intercept_caravans', 'scum_kill'] as const;
const MIN_SCOUTS = 100;

type KingdomType = Record<string, unknown> & { turnsBalance?: number | null };

// Unit-type → defensive tier, mirroring combat-processor's previewCombat map so a
// scouted snapshot's totalDefense matches the number the battle preview computes.
const UNIT_TIER: Record<string, number> = {
  peasant: 0, peasants: 0, militia: 1, knight: 2, knights: 2, cavalry: 3,
  infantry: 1, archer: 2, mage: 2, scout: 0, scouts: 0,
  tier1: 0, tier2: 1, tier3: 2, tier4: 3,
  'elven-scouts': 0, 'elven-warriors': 1, 'elven-archers': 2, 'elven-lords': 3,
  goblins: 0, hobgoblins: 1, kobolds: 2, 'goblin-riders': 3,
  'droben-warriors': 0, 'droben-berserkers': 1, 'droben-bunar': 2, 'droben-champions': 3,
  thralls: 0, 'vampire-spawn': 1, 'vampire-lords': 2, 'ancient-vampires': 3,
  'earth-elementals': 0, 'fire-elementals': 1, 'water-elementals': 2, 'air-elementals': 3,
  'centaur-scouts': 0, 'centaur-warriors': 1, 'centaur-archers': 2, 'centaur-chiefs': 3,
  'sidhe-nobles': 0, 'sidhe-elders': 1, 'sidhe-mages': 2, 'sidhe-lords': 3,
  'dwarven-militia': 0, 'dwarven-guards': 1, 'dwarven-warriors': 2, 'dwarven-lords': 3,
  'fae-sprites': 0, 'fae-warriors': 1, 'fae-nobles': 2, 'fae-lords': 3,
};

// The revealed defender numbers captured at scout time. A snapshot, not live —
// guildmates run their own battle preview against this defense without re-scouting.
// The `DefenderSnapshot` shape lives in shared/mechanics/scout-mechanics so the
// Lambda and the (pure) scout-mechanics module reference one type. buildDefenderSnapshot
// always produces a FULL snapshot; the scout branch then coarsens it by the
// scouter's scum rating (Workstream B) before persisting.

// Maps a unit type to its defensive tier index, used both to build the snapshot
// and to bucket the army when coarsening low-scum intel.
const tierOf = (unitType: string): number => UNIT_TIER[unitType] ?? 0;

function buildDefenderSnapshot(targetKingdom: KingdomType): DefenderSnapshot {
  const TIER_DEFENSE = TIER_STATS.DEFENSE;
  const getDefense = (t: string) => TIER_DEFENSE[UNIT_TIER[t] ?? 0] ?? 1;
  const units = parseJsonField<Record<string, number>>(targetKingdom.totalUnits, {});
  const resources = parseJsonField<KingdomResources>(targetKingdom.resources, {} as KingdomResources);
  const buildings = parseJsonField<Record<string, number>>(targetKingdom.buildings, {});
  // Combat army only — espionage scouts never defend.
  const armyByTier: Record<string, number> = {};
  for (const [t, c] of Object.entries(units)) {
    if (t !== 'scouts' && t !== 'elite_scouts' && (c ?? 0) > 0) armyByTier[t] = c;
  }
  const raceDefenseBonus = RACE_DEFENSE_BONUSES[(targetKingdom.race as string) ?? 'Human'] ?? 1.0;
  const rawDefense = Object.entries(armyByTier).reduce((s, [t, c]) => s + getDefense(t) * (c ?? 0), 0);
  return {
    detail: 'full',
    totalDefense: Math.round(rawDefense * raceDefenseBonus),
    armyByTier,
    fortLevel: buildings.fortress ?? 0,
    land: resources.land ?? 0,
    goldEstimate: resources.gold ?? 0,
    defenderName: (targetKingdom.name as string | undefined) ?? 'Unknown kingdom',
  };
}

const executeThievery: Schema["executeThievery"]["functionHandler"] = async (event) => {
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

    // Calculate detection rate using the canonical shared formula. Detection is
    // the DEFENDER catching the intruder, so the defender's scum are "your scum"
    // and the attacker's are the "enemy". This applies both races' effectiveness
    // (RACIAL_SCUM_EFFECTIVENESS) and counts both green + elite scum on each side
    // (elite are the trained operatives and must contribute to the comparison).
    const attackerRace = (attackerKingdom.race as string | undefined) ?? '';
    const defenderRace = (targetKingdom.race as string | undefined) ?? '';
    const attackerScum = attackerScouts + (attackerUnits.elite_scouts ?? 0);
    const defenderScum = (targetUnits.scouts ?? 0) + (targetUnits.elite_scouts ?? 0);
    const detectionRate = calculateDetectionRate(defenderScum, defenderRace, attackerScum, attackerRace);

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
        // Record server-side intel so the battle preview can reveal a prediction
        // for this target. Intel QUALITY scales with the scouter's race scum
        // rating (Workstream B): higher scum → longer-lasting + more detailed
        // intel, making a high-scum "designated scout" a real guild role.
        // Non-fatal on failure.
        try {
          const nowMs = Date.now();
          const scum = scumRatingForRace(attackerRace);
          const detail = scoutIntelDetail(scum);
          const snapshot = coarsenSnapshot(buildDefenderSnapshot(targetKingdom), detail, tierOf);
          await dbCreate('ScoutIntel', {
            scouterId: kingdomId,
            targetId: targetKingdomId,
            seasonId: (targetKingdom.seasonId as string | undefined) ?? (attackerKingdom.seasonId as string | undefined),
            scoutedAt: new Date(nowMs).toISOString(),
            // Expiry scales with scum: scum 1 → 12h … scum 5 → 48h.
            expiresAt: new Date(nowMs + scoutIntelExpiryMs(scum)).toISOString(),
            // Revealed defender numbers, captured now (snapshot, not live), at a
            // precision set by the scout's scum. Lets a guildmate's battle preview
            // run without re-scouting once it's shared.
            defenderSnapshot: JSON.stringify(snapshot),
            owner: identity.sub,
          });
        } catch (err) {
          log.warn('thievery-processor', 'scout-intel-write-failed', { kingdomId, targetKingdomId, error: err instanceof Error ? err.message : String(err) });
        }
      } else if (operation === 'steal') {
        goldStolen = Math.min(3500000, Math.floor((targetResources.gold ?? 0) * 0.05));
        attackerGoldDelta = goldStolen;

        const updatedTargetResources: KingdomResources = {
          ...targetResources,
          gold: Math.max(0, (targetResources.gold ?? 0) - goldStolen),
        };
        try {
          await dbConditionalUpdate('Kingdom', targetKingdomId, {
            resources: updatedTargetResources,
          },
            '#res = :expectedRes',
            { ':expectedRes': targetKingdom.resources },
            { '#res': 'resources' }
          );
        } catch (err: unknown) {
          if (isConditionalCheckFailed(err)) {
            return { success: false, error: 'Target kingdom state changed, please retry', errorCode: ErrorCode.CONFLICT };
          }
          throw err;
        }
      } else if (operation === 'sabotage') {
        const scoutsDestroyed = Math.floor((targetUnits.scouts ?? 0) * 0.03);
        const updatedTargetUnits: KingdomUnits = {
          ...(targetUnits as KingdomUnits),
          scouts: Math.max(0, (targetUnits.scouts ?? 0) - scoutsDestroyed),
        };
        await dbUpdate('Kingdom', targetKingdomId, {
          totalUnits: updatedTargetUnits,
        });
        (intelligence as Record<string, unknown>).scoutsDestroyed = scoutsDestroyed;
      } else if (operation === 'burn') {
        const scoutsDestroyed = Math.floor((targetUnits.scouts ?? 0) * 0.05);
        const updatedTargetUnits: KingdomUnits = {
          ...(targetUnits as KingdomUnits),
          scouts: Math.max(0, (targetUnits.scouts ?? 0) - scoutsDestroyed),
        };
        await dbUpdate('Kingdom', targetKingdomId, {
          totalUnits: updatedTargetUnits,
        });
        (intelligence as Record<string, unknown>).scoutsDestroyed = scoutsDestroyed;
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
          try {
            await dbConditionalUpdate('Kingdom', targetKingdomId, {
              resources: { ...targetResources, gold: Math.max(0, (targetResources.gold ?? 0) - goldIntercepted) },
            },
              '#res = :expectedRes',
              { ':expectedRes': targetKingdom.resources },
              { '#res': 'resources' }
            );
          } catch (err: unknown) {
            if (isConditionalCheckFailed(err)) {
              return { success: false, error: 'Target kingdom state changed, please retry', errorCode: ErrorCode.CONFLICT };
            }
            throw err;
          }
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
    try {
      await dbConditionalUpdate('Kingdom', kingdomId, {
        totalUnits: updatedAttackerUnits,
        resources: updatedAttackerResources,
      },
        '#res = :expectedRes',
        { ':expectedRes': attackerKingdom.resources },
        { '#res': 'resources' }
      );
    } catch (err: unknown) {
      if (isConditionalCheckFailed(err)) {
        return { success: false, error: 'Kingdom state changed, please retry', errorCode: ErrorCode.CONFLICT };
      }
      throw err;
    }
    await dbAtomicAdd('Kingdom', kingdomId, 'turnsBalance', -turnCost);

    // Register the operation on the DEFENDER's side. `recipientId` is the target
    // kingdom id (NotificationCenter filters by recipientId) and `owner` must be
    // the target's owner string so the defender — not the attacker — can read it
    // under owner-based auth.
    const targetOwner = targetKingdom.owner as string | undefined;
    const intel = intelligence as Record<string, unknown>;
    const nowIso = new Date().toISOString();
    try {
      if (!succeeded) {
        // Detected (spy caught): record the timestamp and alert the defender,
        // naming both the operation and the attacking kingdom.
        const targetStats = parseJsonField<Record<string, unknown>>(targetKingdom.stats, {});
        await dbUpdate('Kingdom', targetKingdomId, {
          stats: { ...targetStats, lastDetectedThievery: nowIso },
        });
        log.info('thievery-processor', 'thieveryDetected', { targetKingdomId, operation, attackerKingdomId: kingdomId });

        if (targetOwner) {
          const attackerName = (attackerKingdom.name as string | undefined) ?? 'an unknown kingdom';
          await dbCreate('CombatNotification', {
            recipientId: targetKingdomId,
            type: 'defense',
            message: `Your guards caught a ${operation.replace(/_/g, ' ')} attempt by ${attackerName}!`,
            data: JSON.stringify({ operation, attackerKingdomId: kingdomId, detected: true }),
            isRead: false,
            createdAt: nowIso,
            owner: targetOwner,
          });
        }
      } else if (targetOwner && operation !== 'scout') {
        // Undetected operation with a real effect: the defender's staff notices the
        // damage but never learns who did it (the reward for espionage superiority).
        let flavor: string | null = null;
        if (operation === 'steal') {
          flavor = `Your treasurer reports ${goldStolen.toLocaleString()} gold missing from the vaults.`;
        } else if (operation === 'intercept_caravans') {
          const amt = (intel.goldIntercepted as number | undefined) ?? 0;
          flavor = `Your merchants report a caravan ambushed — ${amt.toLocaleString()} gold never arrived.`;
        } else if (operation === 'sabotage' || operation === 'burn' || operation === 'scum_kill') {
          const n = (intel.scoutsDestroyed as number | undefined) ?? (intel.scoutsKilled as number | undefined) ?? 0;
          flavor = `Your spymaster found ${n.toLocaleString()} scouts dead — sabotage is suspected.`;
        } else if (operation === 'desecrate') {
          const n = (intel.templesDestroyed as number | undefined) ?? 0;
          flavor = `Your temple keepers discovered ${n.toLocaleString()} temples desecrated overnight.`;
        } else if (operation === 'spread_dissention') {
          const n = (intel.populationKilled as number | undefined) ?? 0;
          flavor = `Unrest spreads — ${n.toLocaleString()} of your people were turned against the crown.`;
        }

        if (flavor) {
          await dbCreate('CombatNotification', {
            recipientId: targetKingdomId,
            type: 'defense',
            message: flavor,
            data: JSON.stringify({ operation, detected: false }),
            isRead: false,
            createdAt: nowIso,
            owner: targetOwner,
          });
        }
      }
    } catch (err) {
      // Defender notification is non-fatal: the operation already succeeded.
      log.warn('thievery-processor', 'defender-notification-failed', { targetKingdomId, operation, error: err instanceof Error ? err.message : String(err) });
    }

    log.info('thievery-processor', 'executeThievery', { kingdomId, operation, targetKingdomId });
    return {
      success: true,
      result: JSON.stringify({ operation, succeeded, casualties, goldStolen, intelligence, promoted, detectionLevel: adjustedDetectionRate }),
    };
  } catch (error) {
    await persistErrorLog('thievery-processor', error, { kingdomId, operation, targetKingdomId });
    log.error('thievery-processor', error, { kingdomId, operation, targetKingdomId });
    return { success: false, error: 'Thievery operation failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};

interface ScoutIntelRecord {
  id: string;
  scouterId: string;
  targetId: string;
  expiresAt: string;
  sharedWithGuildId?: string | null;
  defenderSnapshot?: unknown;
}

/**
 * shareScoutIntel — stamp the caller's fresh ScoutIntel on a target with their
 * guildId so guildmates' battle previews can use the same defender snapshot, and
 * drop an intel AllianceMessage into guild chat summarising the revealed numbers.
 * The prediction stays per-attacker — only the defender intel is shared.
 */
const shareScoutIntel: Schema["shareScoutIntel"]["functionHandler"] = async (event) => {
  const { kingdomId, targetKingdomId } = event.arguments;
  try {
    if (!kingdomId || !targetKingdomId) {
      return { success: false, error: 'Missing required parameters: kingdomId, targetKingdomId', errorCode: ErrorCode.MISSING_PARAMS };
    }

    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }

    const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
    if (!kingdom) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }
    const denied = verifyOwnership(identity, kingdom.owner as string | null);
    if (denied) return denied;

    const guildId = (kingdom as Record<string, unknown>).guildId as string | undefined;
    if (!guildId) {
      return { success: false, error: 'You must be in a guild to share intel', errorCode: ErrorCode.VALIDATION_FAILED };
    }

    // Find the caller's freshest non-expired intel on this target.
    const nowIso = new Date().toISOString();
    const intel = await dbQuery<ScoutIntelRecord>(
      'ScoutIntel', 'scoutIntelsByScouterIdAndExpiresAt', { field: 'scouterId', value: kingdomId },
    );
    const fresh = intel
      .filter(i => i.targetId === targetKingdomId && (i.expiresAt ?? '') > nowIso)
      .sort((a, b) => (b.expiresAt ?? '').localeCompare(a.expiresAt ?? ''))[0];
    if (!fresh) {
      return { success: false, error: 'No fresh scout intel on this target to share. Scout it first.', errorCode: ErrorCode.NOT_FOUND };
    }

    await dbUpdate('ScoutIntel', fresh.id, { sharedWithGuildId: guildId });

    // Drop an intel message into guild chat summarising the revealed numbers.
    const snapshot = parseJsonField<Partial<DefenderSnapshot>>(fresh.defenderSnapshot, {});
    const defenderName = snapshot.defenderName ?? 'an enemy kingdom';
    const defense = snapshot.totalDefense ?? 0;
    const fort = snapshot.fortLevel ?? 0;
    const gold = snapshot.goldEstimate ?? 0;
    const scouterName = (kingdom.name as string | undefined) ?? 'A guildmate';
    const content = `🔍 Scout report on ${defenderName}: ~${Math.round(defense / 1000)}k defense, fort lv ${fort}, ~${Math.round(gold / 1000)}k gold. Shared by ${scouterName}.`;
    try {
      await dbCreate('AllianceMessage', {
        guildId,
        senderId: kingdomId,
        content,
        type: 'intel',
        createdAt: nowIso,
      });
    } catch (err) {
      // Chat post is best-effort: the intel is already shared.
      log.warn('thievery-processor', 'share-intel-message-failed', { kingdomId, targetKingdomId, error: err instanceof Error ? err.message : String(err) });
    }

    log.info('thievery-processor', 'shareScoutIntel', { kingdomId, targetKingdomId, guildId });
    return { success: true, result: JSON.stringify({ scoutIntelId: fresh.id, guildId, targetKingdomId }) };
  } catch (error) {
    await persistErrorLog('thievery-processor', error, { kingdomId, targetKingdomId, action: 'shareScoutIntel' });
    log.error('thievery-processor', error, { kingdomId, targetKingdomId });
    return { success: false, error: 'Share intel operation failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};

// Single handler export — dispatch based on which mutation was called. Both
// executeThievery and shareScoutIntel route to this espionage Lambda. AppSync
// invokes with a single event argument; the functionHandler types declare the
// 3-arg Lambda signature, so call the sub-handlers as single-arg callables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any) => {
  const fieldName = event.info?.fieldName as string | undefined;
  if (fieldName === 'shareScoutIntel') {
    return (shareScoutIntel as unknown as (e: unknown) => Promise<unknown>)(event);
  }
  return (executeThievery as unknown as (e: unknown) => Promise<unknown>)(event);
};
