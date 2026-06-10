/**
 * Turn ticker — scheduled Lambda invoked by EventBridge every 20 minutes.
 *
 * Generates +1 turn for every active kingdom, capped at MAX_STORED_TURNS (72).
 * This is the server-side equivalent of the client-side useTurnGeneration hook,
 * ensuring turns accumulate even when players are offline.
 *
 * Turn rate: 3/hour (1 per 20 min), matching the game's TURNS_PER_HOUR constant.
 */
import { dbList, dbAtomicAdd, dbUpdate, dbCreate, dbGet, dbQueryRange, parseJsonField } from '../data-client';
import { log } from '../logger';
import { FOCUS_MECHANICS } from '../../../shared/mechanics/faith-focus-mechanics';
import { TURN_MECHANICS } from '../../../shared/mechanics/turn-mechanics';
import { resolveCombat } from '../combat-processor/handler';
import {
  decide,
  assignPersona,
  assignDifficulty,
  emptyMemory,
  makeRng,
  type PublicKingdomView,
  type PublicBattleEvent,
  type AIMemory,
  type SelfState,
  type SeasonAge,
} from '../../../shared/mechanics/ai-strategist';
import { calculateGenerationRates } from '../../../shared/mechanics/economy-mechanics';

const MAX_STORED_TURNS = TURN_MECHANICS.BASE_GENERATION.MAX_STORED_TURNS; // 72
const FOCUS_REGEN_PER_TICK = 1 / 3; // 20-min tick = 1/3 hour

// Resource caps — same ceilings the resource-manager enforces for players.
const RESOURCE_LIMITS = {
  gold: { min: 0, max: 1_000_000 },
  population: { min: 0, max: 100_000 },
} as const;

// Power tiers for World Feed milestones (networth thresholds). When a kingdom's
// networth crosses one of these upward, we emit one feed event.
const POWER_TIERS: Array<{ min: number; label: string }> = [
  { min: 50_000_000, label: 'Empire' },
  { min: 20_000_000, label: 'Great Power' },
  { min: 5_000_000,  label: 'Power' },
  { min: 1_000_000,  label: 'Rising Power' },
];

/** Returns the tier label if `next` crosses a tier boundary above `prev`, else null. */
function crossedPowerTier(prev: number, next: number): string | null {
  for (const tier of POWER_TIERS) {
    if (next >= tier.min && prev < tier.min) return tier.label;
  }
  return null;
}

interface AIMilestone {
  seasonId: string;
  kingdomId: string;
  kingdomName?: string;
  tierLabel: string;
}

interface KingdomRow {
  id: string;
  isActive?: boolean;
  isAI?: boolean;
  turnsBalance?: number;
  encampEndTime?: string | null;
  encampBonusTurns?: number | null;
  resources?: string | Record<string, number>;
  totalUnits?: string | Record<string, number>;
  buildings?: string | Record<string, number>;
  race?: string | null;
  stats?: string | Record<string, unknown> | null;
  networth?: number;
  guildId?: string | null;
  currentAge?: string | null;
  createdAt?: string | null;
  aiPersonality?: string | null;
  seasonId?: string;
  name?: string | null;
}

export const handler = async (_event: unknown): Promise<{ success: boolean; ticked: number; skipped: number }> => {
  try {
    // Amplify Gen 2 does not support boolean GSI keys — full scan with filter
    const allKingdoms = await dbList<KingdomRow>('Kingdom');
    const active = allKingdoms.filter(k => k.isActive === true);

    let ticked = 0;
    let skipped = 0;

    for (const kingdom of active) {
      try {
        // Skip kingdoms that have already accumulated the cap in turnsBalance.
        // turnsBalance is a separate top-level Number attribute updated atomically,
        // so this ADD never races with the action lambdas that write the resources JSON.
        const currentBalance = kingdom.turnsBalance ?? 0;

        if (currentBalance >= MAX_STORED_TURNS) {
          skipped++;
          continue;
        }

        await dbAtomicAdd('Kingdom', kingdom.id, 'turnsBalance', 1);
        ticked++;

        // Encamp completion check: if the encamp window has closed, atomically
        // credit the stored bonus turns and clear the encamp fields.
        if (kingdom.encampEndTime) {
          const encampEnd = new Date(kingdom.encampEndTime).getTime();
          if (encampEnd <= Date.now() && kingdom.encampBonusTurns) {
            const bonus = kingdom.encampBonusTurns;
            try {
              // turnsBalance was already incremented by +1 (the normal tick above),
              // so the effective current balance is snapshot + 1.
              const currentTurns = (kingdom.turnsBalance ?? 0) + 1;
              const cappedBonus = Math.min(bonus, Math.max(0, MAX_STORED_TURNS - currentTurns));
              if (cappedBonus > 0) {
                await dbAtomicAdd('Kingdom', kingdom.id, 'turnsBalance', cappedBonus);
              }
              await dbUpdate('Kingdom', kingdom.id, {
                encampEndTime: null,
                encampBonusTurns: null,
              });
              log.info('turn-ticker', 'encamp-bonus-awarded', { kingdomId: kingdom.id, bonus: cappedBonus });
            } catch (encampErr) {
              log.error('turn-ticker', encampErr, { kingdomId: kingdom.id, context: 'encamp-bonus' });
            }
          }
        }
      } catch (err) {
        log.error('turn-ticker', err, { kingdomId: kingdom.id });
        skipped++;
      }
    }

    // Process AI kingdoms: AI decision loop (build, train, attack)
    const aiKingdoms = active.filter(k => k.isAI === true);
    let aiTicked = 0;
    // Accumulate notable non-combat milestones; written to WorldEventLog after the loop.
    const aiMilestones: AIMilestone[] = [];

    // Fetch all active restoration rows (one query for all kingdoms, not per-kingdom).
    // RestorationStatus is the authoritative source; nothing writes stats.restorationEndTime.
    let underRestorationIds = new Set<string>();
    try {
      const restorationRows = await dbList<{ kingdomId?: string; endTime?: string }>('RestorationStatus');
      const now = Date.now();
      underRestorationIds = new Set(
        restorationRows.filter(r => r.endTime && new Date(r.endTime).getTime() > now).map(r => r.kingdomId).filter(Boolean) as string[]
      );
    } catch (restErr) {
      // Degrade gracefully: AI may attack a restoring target (same as today's bug), but won't crash.
      log.error('turn-ticker', restErr, { context: 'fetch-restoration-status' });
    }

    // INFORMATION FAIRNESS: the strategist sees other kingdoms only through the
    // fields a player can read via AppSync (no units/gold/buildings). Defense is
    // ESTIMATED from public networth + race inside the engine.
    const publicViews: PublicKingdomView[] = active.map(k => {
      const kr = k as KingdomRow;
      return {
        id: k.id,
        name: kr.name ?? undefined,
        race: (k.race as string) ?? 'Human',
        networth: kr.networth ?? 0,
        isActive: k.isActive ?? true,
        isAI: k.isAI ?? false,
        createdAt: kr.createdAt ?? undefined,
        // Protective-only flag (can spare a target, never advantage the attacker).
        underRestoration: underRestorationIds.has(k.id),
      };
    });

    // One public battle-report query per tick (BattleReport is authenticated-read,
    // i.e. player-visible). Used for grudges + wounded-target detection.
    const seasonIdForTick = (aiKingdoms[0] as KingdomRow | undefined)?.seasonId;
    let recentBattles: PublicBattleEvent[] = [];
    if (seasonIdForTick) {
      try {
        const since = new Date(Date.now() - 25 * 60 * 1000).toISOString(); // last tick + margin
        recentBattles = await dbQueryRange<PublicBattleEvent>(
          'BattleReport', 'battleReportsBySeasonIdAndTimestamp',
          { field: 'seasonId', value: seasonIdForTick },
          { field: 'timestamp', gte: since },
        );
      } catch (brErr) {
        log.error('turn-ticker', brErr, { context: 'recent-battles' });
      }
    }

    for (const kingdom of aiKingdoms) {
      try {
        const resources = parseJsonField<Record<string, number>>(kingdom.resources, {});
        const totalUnitsMap = parseJsonField<Record<string, number>>((kingdom as unknown as Record<string, unknown>).totalUnits, {});
        const buildingsMap = parseJsonField<Record<string, number>>((kingdom as KingdomRow).buildings, {});
        const statsMap = parseJsonField<Record<string, unknown>>((kingdom as KingdomRow).stats, {});

        const persona = assignPersona(kingdom.id);
        const difficulty = assignDifficulty(kingdom.id);
        const seasonAge: SeasonAge = ((kingdom as KingdomRow).currentAge as SeasonAge) ?? 'early';

        // FAIRNESS: AI earns income from its OWN economy via the SAME formula
        // players use (calculateGenerationRates) — no flat handout. Income scales
        // with the AI's real buildings/land/age, so it must build to grow.
        const aiRace = (kingdom.race as string) ?? 'Human';
        const rates = calculateGenerationRates({
          race: aiRace,
          age: seasonAge,
          buildings: buildingsMap as Record<string, number>,
          tithe: (statsMap.tithe as number) ?? 0,
          // AI kingdoms don't hold territories or alliance/faith bonuses; building income only.
        });
        const newGold = Math.min(RESOURCE_LIMITS.gold.max, (resources.gold ?? 0) + rates.goldPerTurn);
        const newPopulation = Math.min(RESOURCE_LIMITS.population.max, (resources.population ?? 0) + rates.populationPerTurn);

        const selfState: SelfState = {
          id: kingdom.id,
          race: aiRace,
          land: resources.land ?? 800,
          gold: newGold,
          turnsAvailable: kingdom.turnsBalance ?? 0,
          networth: (kingdom as KingdomRow).networth ?? 0,
          buildings: { ...buildingsMap },
          totalUnits: { ...totalUnitsMap },
        };
        const memory: AIMemory = (statsMap.aiMemory as AIMemory | undefined) ?? emptyMemory();

        // Deterministic per kingdom + tick (no Math.random drift across retries).
        const tickBucket = Math.floor(Date.now() / (20 * 60 * 1000));
        let seed = tickBucket;
        for (let i = 0; i < kingdom.id.length; i++) seed = ((seed << 5) - seed + kingdom.id.charCodeAt(i)) | 0;

        const decision = decide(selfState, publicViews, {
          age: seasonAge,
          persona,
          difficulty,
          memory,
          recentBattles,
          rng: makeRng(seed >>> 0),
          nowMs: Date.now(),
        });

        // Apply builds
        const updatedBuildings = { ...buildingsMap };
        for (const b of decision.builds) {
          updatedBuildings[b.type] = (updatedBuildings[b.type] ?? 0) + b.qty;
        }

        // Apply training
        const updatedUnits = { ...totalUnitsMap };
        for (const t of decision.trains) {
          updatedUnits[t.unitType] = (updatedUnits[t.unitType] ?? 0) + t.qty;
        }

        // Apply gold spent
        let finalGold = newGold - decision.goldSpent;

        // SEQUENCING: Persist builds/trains/income BEFORE combat so resolveCombat sees the
        // updated army + resources. Combat resolution will update land/gold/units again.
        // This is a two-phase write: (1) build/train/income, (2) combat outcome.
        const preCombatLand = resources.land ?? 800;
        let combatLandGained = 0;
        let combatGoldGained = 0;

        const preCombatUpdateFields: Record<string, unknown> = {
          resources: { ...resources, gold: finalGold, population: newPopulation, land: preCombatLand },
          buildings: updatedBuildings,
          totalUnits: updatedUnits,
          // No networth update yet — will be recalculated after combat
          stats: { ...statsMap, aiMemory: decision.memory },
          aiPersonality: persona,
        };

        await dbUpdate('Kingdom', kingdom.id, preCombatUpdateFields);

        // Execute combat if target selected — now uses the SAME resolveCombat path as players
        // NOTE: resolveCombat handles ALL combat writes (land/gold/units/networth) AND turn deduction,
        // so the turn-ticker does NOT deduct attack turns separately (that would be a double-deduction).
        let attackExecuted = false;
        if (decision.attackTarget) {
          try {
            // Re-fetch attacker to get fresh totalUnits/turnsBalance after the build/train write
            const attackerKingdom = await dbGet<KingdomRow>('Kingdom', kingdom.id);
            const targetKingdom = await dbGet<KingdomRow>('Kingdom', decision.attackTarget);

            if (attackerKingdom && targetKingdom && targetKingdom.isActive) {
              // AI sends 70% of military (scouts are espionage-only, excluded).
              const attackUnits: Record<string, number> = {};
              for (const [uType, count] of Object.entries(updatedUnits)) {
                if (uType === 'scouts' || uType === 'elite_scouts') continue;
                const sent = Math.floor((count ?? 0) * 0.7);
                if (sent > 0) attackUnits[uType] = sent;
              }

              // Call resolveCombat — same path as player attacks (unit validation, newbie
              // protection, turn cost, war-declaration enforcement, restoration checks, etc.)
              const combatResult = await resolveCombat({
                attacker: attackerKingdom as unknown as Record<string, unknown>,
                defender: targetKingdom as unknown as Record<string, unknown>,
                attackerUnits: attackUnits,
                attackType: 'standard',
                ownerSub: 'AI_SYSTEM',
              });

              if (combatResult.success && combatResult.result) {
                const parsedResult = JSON.parse(combatResult.result);
                combatLandGained = parsedResult.landGained ?? 0;
                combatGoldGained = parsedResult.goldLooted ?? 0;
                attackExecuted = true; // resolveCombat succeeded and wrote the attacker's final state
                log.info('turn-ticker', 'ai-combat', {
                  kingdomId: kingdom.id,
                  targetId: decision.attackTarget,
                  result: parsedResult.result,
                  landGained: combatLandGained,
                  goldLooted: combatGoldGained,
                });
              } else {
                // Combat was rejected (e.g. newbie protection, war required, restoration active)
                // or failed — log and continue. The AI will adjust next tick.
                log.warn('turn-ticker', 'ai-combat-rejected', {
                  kingdomId: kingdom.id,
                  targetId: decision.attackTarget,
                  error: combatResult.error,
                  errorCode: combatResult.errorCode,
                });
              }
            }
          } catch (combatErr) {
            log.error('turn-ticker', combatErr, { kingdomId: kingdom.id, context: 'ai-combat' });
          }
        }

        // For non-attacking AIs, compute and write networth from the build/train state.
        // For attacking AIs, resolveCombat already wrote the correct post-combat networth,
        // so skip the redundant refetch + networth-only write.
        if (!attackExecuted) {
          const finalLand = preCombatLand;
          const totalUnitCount = Object.values(updatedUnits).reduce((sum, n) => sum + (n ?? 0), 0);
          const networth = finalLand * 1000 + finalGold + totalUnitCount * 100;
          await dbUpdate('Kingdom', kingdom.id, { networth });
        }

        // War rule: the AI hit this defender 3 times — it must declare war before
        // attacking again (same rule combat-processor enforces on players). Real
        // WarDeclaration row → shows in the World Feed.
        if (decision.declareWarOn && (kingdom as KingdomRow).seasonId) {
          try {
            await dbCreate('WarDeclaration', {
              attackerId: kingdom.id,
              defenderId: decision.declareWarOn,
              seasonId: (kingdom as KingdomRow).seasonId,
              status: 'active',
              attackCount: 0,
              declaredAt: new Date().toISOString(),
              reason: 'Sustained campaign — formal declaration of war',
              owner: 'AI_SYSTEM',
            });
            await dbCreate('CombatNotification', {
              recipientId: decision.declareWarOn,
              type: 'defense',
              message: `${(kingdom as KingdomRow).name ?? 'A kingdom'} has declared war on you!`,
              data: JSON.stringify({ attackerId: kingdom.id }),
              isRead: false,
              createdAt: new Date().toISOString(),
              owner: decision.declareWarOn,
            });
          } catch (warErr) {
            log.error('turn-ticker', warErr, { kingdomId: kingdom.id, context: 'ai-declare-war' });
          }
        }

        // Feed (B): emit a milestone when this AI crosses a power tier UPWARD.
        // Keeps the live feed alive during early age (no combat yet) without
        // spamming — at most one event per tier crossing per kingdom.
        // For attacking AIs: skip milestone detection this tick — the attack itself is
        // already surfaced as a BattleReport in the feed, and the AI's networth will be
        // re-evaluated next tick. This avoids an extra dbGet just for milestone checks.
        if (!attackExecuted) {
          const prevNetworth = (kingdom as KingdomRow).networth ?? 0;
          const finalLand = preCombatLand;
          const totalUnitCount = Object.values(updatedUnits).reduce((sum, n) => sum + (n ?? 0), 0);
          const currentNetworth = finalLand * 1000 + finalGold + totalUnitCount * 100;
          const crossed = crossedPowerTier(prevNetworth, currentNetworth);
          if (crossed && (kingdom as KingdomRow).seasonId) {
            aiMilestones.push({
              seasonId: (kingdom as KingdomRow).seasonId as string,
              kingdomId: kingdom.id,
              kingdomName: (kingdom as KingdomRow).name as string | undefined,
              tierLabel: crossed,
            });
          }
        }

        // Deduct turns spent (builds/trains/war-declaration).
        // IMPORTANT: if an attack was executed, resolveCombat already deducted the attack
        // turns (4), so we must NOT double-deduct them. The strategist's turnsSpent includes
        // attack turns when decision.attackTarget is set, so subtract 4 in that case.
        let turnsToDeduct = decision.turnsSpent;
        if (attackExecuted && decision.attackTarget) {
          turnsToDeduct -= 4; // ATTACK_TURN_COST (resolveCombat already deducted these)
        }
        if (turnsToDeduct > 0) {
          await dbAtomicAdd('Kingdom', kingdom.id, 'turnsBalance', -turnsToDeduct);
        }

        if (decision.builds.length > 0 || decision.trains.length > 0 || decision.attackTarget || decision.declareWarOn) {
          log.info('turn-ticker', 'ai-decision', {
            kingdomId: kingdom.id,
            persona,
            difficulty,
            seasonAge,
            builds: decision.builds.length,
            trains: decision.trains.length,
            attacked: !!decision.attackTarget,
            declaredWar: !!decision.declareWarOn,
            turnsSpent: decision.turnsSpent,
            goldSpent: decision.goldSpent,
          });
        }

        aiTicked++;
      } catch (err) {
        log.error('turn-ticker', err, { kingdomId: kingdom.id, context: 'ai-tick' });
      }
    }

    // Persist AI power-tier milestones to the World Feed. Capped so a single
    // tick can't flood the feed (e.g. right after season start). 30-day TTL.
    const MAX_MILESTONES_PER_TICK = 8;
    const eventTtl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    for (const m of aiMilestones.slice(0, MAX_MILESTONES_PER_TICK)) {
      try {
        const who = m.kingdomName ?? 'A kingdom';
        await dbCreate('WorldEventLog', {
          seasonId: m.seasonId,
          category: 'milestone',
          kingdomId: m.kingdomId,
          message: `${who} has risen to ${m.tierLabel} status`,
          timestamp: new Date().toISOString(),
          ttl: eventTtl,
          owner: 'AI_SYSTEM',
        });
      } catch (evErr) {
        log.error('turn-ticker', evErr, { kingdomId: m.kingdomId, context: 'world-event' });
      }
    }
    if (aiMilestones.length > 0) {
      log.info('turn-ticker', 'ai-milestones', { found: aiMilestones.length, written: Math.min(aiMilestones.length, MAX_MILESTONES_PER_TICK) });
    }

    // Complete pending settlements for real player kingdoms
    const realKingdoms = active.filter(k => !k.isAI);
    let settlementsCompleted = 0;
    for (const kingdom of realKingdoms) {
      try {
        const rawStats = (kingdom as unknown as Record<string, unknown>).stats;
        const stats = parseJsonField<Record<string, unknown>>(rawStats, {});
        const pending = (stats.pendingSettlements as Array<Record<string, unknown>>) ?? [];
        if (pending.length === 0) continue;

        const now = new Date().toISOString();
        const ready = pending.filter(ps => (ps.completesAt as string) <= now);
        if (ready.length === 0) continue;

        const remaining = pending.filter(ps => (ps.completesAt as string) > now);

        // Verify kingdom still exists before creating Territory records
        const stillExists = await dbGet('Kingdom', kingdom.id);
        if (!stillExists) {
          log.warn('turn-ticker', 'settlement-kingdom-gone', { kingdomId: kingdom.id });
          continue;
        }

        // Create Territory records for completed settlements
        for (const ps of ready) {
          try {
            await dbCreate('Territory', {
              name: ps.name as string,
              type: (ps.type as string) || 'settlement',
              coordinates: (ps.coordinates as string) || JSON.stringify({ x: 0, y: 0 }),
              terrainType: (ps.terrainType as string) || 'plains',
              resources: JSON.stringify({ gold: 0, land: 100 }),
              buildings: JSON.stringify({}),
              defenseLevel: 0,
              kingdomId: kingdom.id,
              owner: (ps.ownerSub as string) ?? kingdom.id,
              ...(ps.regionId ? { regionId: ps.regionId as string } : {}),
              ...(ps.category ? { category: ps.category as string } : {}),
            });
            settlementsCompleted++;
            log.info('turn-ticker', 'settlement-completed', { kingdomId: kingdom.id, name: ps.name });
          } catch (err) {
            log.error('turn-ticker', err, { kingdomId: kingdom.id, context: 'complete-settlement' });
          }
        }

        // Write back remaining pending settlements
        await dbUpdate('Kingdom', kingdom.id, {
          stats: JSON.stringify({ ...stats, pendingSettlements: remaining }),
        });
      } catch (err) {
        log.error('turn-ticker', err, { kingdomId: kingdom.id, context: 'pending-settlements' });
      }
    }

    // Focus point regeneration — one tick = 20 min = 1/3 hour
    let faithTicked = 0;
    for (const kingdom of realKingdoms) {
      try {
        const rawStats = (kingdom as unknown as Record<string, unknown>).stats;
        const stats = parseJsonField<Record<string, unknown>>(rawStats, {});

        const race = ((kingdom as unknown as Record<string, unknown>).race as string ?? 'human').toLowerCase();
        const modifiers = FOCUS_MECHANICS.BASE_GENERATION.RACIAL_MODIFIERS as Record<string, number>;
        const racialMod = modifiers[race] ?? 1.0;
        const regenRate = Math.floor(FOCUS_MECHANICS.BASE_GENERATION.POINTS_PER_HOUR * racialMod);
        const pointsToAdd = Math.round(regenRate * FOCUS_REGEN_PER_TICK);

        if (pointsToAdd === 0) { faithTicked++; continue; }

        const maxFP = Math.floor(FOCUS_MECHANICS.BASE_GENERATION.MAX_STORAGE_BASE * racialMod);
        const currentFP = typeof stats.focusPoints === 'number' ? stats.focusPoints : 0;
        const newFP = Math.min(maxFP, currentFP + pointsToAdd);

        if (newFP === currentFP) { faithTicked++; continue; }

        await dbUpdate('Kingdom', kingdom.id, {
          stats: JSON.stringify({ ...stats, focusPoints: newFP }),
        });
        faithTicked++;
      } catch (err) {
        // Non-fatal — log for observability
        log.warn('turn-ticker', 'faithRegenFailed', { kingdomId: kingdom.id, error: err instanceof Error ? err.message : String(err) });
      }
    }

    log.info('turn-ticker', 'tick', { ticked, skipped, total: active.length, aiTicked, settlementsCompleted, faithTicked });
    return { success: true, ticked, skipped };
  } catch (err) {
    log.error('turn-ticker', err);
    return { success: false, ticked: 0, skipped: 0 };
  }
};
