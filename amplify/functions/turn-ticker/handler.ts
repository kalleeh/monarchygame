/**
 * Turn ticker — scheduled Lambda invoked by EventBridge every 20 minutes.
 *
 * Generates +1 turn for every active kingdom, capped at MAX_STORED_TURNS (72).
 * This is the server-side equivalent of the client-side useTurnGeneration hook,
 * ensuring turns accumulate even when players are offline.
 *
 * Turn rate: 3/hour (1 per 20 min), matching the game's TURNS_PER_HOUR constant.
 */
import { dbList, dbAtomicAdd, dbUpdate, dbCreate, dbGet, dbQuery, parseJsonField } from '../data-client';
import { log } from '../logger';
import { FOCUS_MECHANICS } from '../../../shared/mechanics/faith-focus-mechanics';
import { TURN_MECHANICS } from '../../../shared/mechanics/turn-mechanics';
import { calculateCombatResult } from '../../../shared/mechanics/combat-mechanics';
import type { AttackForce, DefenseForce } from '../../../shared/mechanics/combat-mechanics';
import { calculateFortDefense } from '../../../shared/mechanics/combat-mechanics';
import {
  decideAIActions,
  assignPersonality,
  type AIKingdomState,
  type AIPersonality,
  type SeasonAge,
} from '../../../shared/mechanics/ai-behavior';

const MAX_STORED_TURNS = TURN_MECHANICS.BASE_GENERATION.MAX_STORED_TURNS; // 72
const FOCUS_REGEN_PER_TICK = 1 / 3; // 20-min tick = 1/3 hour
const AI_GOLD_PER_TICK = 5000;
const AI_POPULATION_PER_TICK = 500;
const AI_GOLD_CAP = 500000;
const AI_POPULATION_CAP = 100000;

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

    // Build AIKingdomState for all active kingdoms (needed for target selection)
    const allKingdomStates: AIKingdomState[] = active.map(k => {
      const res = parseJsonField<Record<string, number>>(k.resources, {});
      const units = parseJsonField<Record<string, number>>(k.totalUnits, {});
      const bldgs = parseJsonField<Record<string, number>>((k as KingdomRow).buildings, {});
      const stats = parseJsonField<Record<string, unknown>>((k as KingdomRow).stats, {});
      return {
        id: k.id,
        race: (k.race as string) ?? 'Human',
        land: res.land ?? 800,
        gold: res.gold ?? 0,
        turnsAvailable: k.turnsBalance ?? 0,
        networth: (k as KingdomRow).networth ?? 0,
        buildings: bldgs,
        totalUnits: units,
        guildId: (k as KingdomRow).guildId ?? null,
        isAI: k.isAI ?? false,
        isActive: k.isActive ?? true,
        currentAge: (k as KingdomRow).currentAge ?? 'early',
        createdAt: (k as KingdomRow).createdAt ?? undefined,
        stats,
      };
    });

    for (const kingdom of aiKingdoms) {
      try {
        const resources = parseJsonField<Record<string, number>>(kingdom.resources, {});
        const totalUnitsMap = parseJsonField<Record<string, number>>((kingdom as unknown as Record<string, unknown>).totalUnits, {});
        const buildingsMap = parseJsonField<Record<string, number>>((kingdom as KingdomRow).buildings, {});

        // Apply passive income first (same as before)
        const newGold = Math.min(AI_GOLD_CAP, (resources.gold ?? 0) + AI_GOLD_PER_TICK);
        const newPopulation = Math.min(AI_POPULATION_CAP, (resources.population ?? 0) + AI_POPULATION_PER_TICK);

        // Determine personality (assign on first tick if missing)
        const personality: AIPersonality = ((kingdom as KingdomRow).aiPersonality as AIPersonality) ?? assignPersonality(kingdom.id);
        const seasonAge: SeasonAge = ((kingdom as KingdomRow).currentAge as SeasonAge) ?? 'early';

        // Build AI state for decision
        const aiState: AIKingdomState = {
          id: kingdom.id,
          race: (kingdom.race as string) ?? 'Human',
          land: resources.land ?? 800,
          gold: newGold,
          turnsAvailable: kingdom.turnsBalance ?? 0,
          networth: (kingdom as KingdomRow).networth ?? 0,
          buildings: { ...buildingsMap },
          totalUnits: { ...totalUnitsMap },
          guildId: (kingdom as KingdomRow).guildId ?? null,
          isAI: true,
          isActive: true,
          currentAge: seasonAge,
        };

        const decision = decideAIActions(aiState, personality, seasonAge, allKingdomStates);

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

        // Execute combat if target selected
        let combatLandGained = 0;
        if (decision.attackTarget) {
          try {
            const targetKingdom = await dbGet<KingdomRow>('Kingdom', decision.attackTarget);
            if (targetKingdom && targetKingdom.isActive) {
              const targetRes = parseJsonField<Record<string, number>>(targetKingdom.resources, {});
              const targetUnits = parseJsonField<Record<string, number>>(targetKingdom.totalUnits, {});
              const targetBuildings = parseJsonField<Record<string, number>>(targetKingdom.buildings, {});
              const targetLand = targetRes.land ?? 800;

              // AI sends 70% of army
              const attackUnits: Record<string, number> = {};
              let totalOffense = 0;
              for (const [uType, count] of Object.entries(updatedUnits)) {
                const sent = Math.floor((count ?? 0) * 0.7);
                if (sent > 0) {
                  attackUnits[uType] = sent;
                  totalOffense += sent * 10; // simplified offense value per unit
                }
              }

              const defenseUnits: Record<string, number> = {};
              let totalDefense = 0;
              for (const [uType, count] of Object.entries(targetUnits)) {
                if ((count ?? 0) > 0) {
                  defenseUnits[uType] = count;
                  totalDefense += count * 10;
                }
              }
              totalDefense += calculateFortDefense(
                (targetKingdom.race as string) ?? 'Human',
                targetBuildings.fortress ?? 0
              );

              const attackForce: AttackForce = { units: attackUnits, totalOffense, totalDefense: 0 };
              const defenseForce: DefenseForce = { units: defenseUnits, forts: targetBuildings.fortress ?? 0, totalDefense, ambushActive: false };

              const combatResult = calculateCombatResult(attackForce, defenseForce, targetLand);

              // Apply casualties to attacker (from sent units)
              if (combatResult.attackerLosses > 0) {
                const totalSent = Object.values(attackUnits).reduce((s, n) => s + n, 0);
                const lossRatio = totalSent > 0 ? combatResult.attackerLosses / totalSent : 0;
                for (const [uType, sent] of Object.entries(attackUnits)) {
                  const losses = Math.floor(sent * lossRatio);
                  updatedUnits[uType] = Math.max(0, (updatedUnits[uType] ?? 0) - losses);
                }
              }

              // Apply casualties to defender
              if (combatResult.defenderLosses > 0) {
                const totalDef = Object.values(defenseUnits).reduce((s, n) => s + n, 0);
                const lossRatio = totalDef > 0 ? combatResult.defenderLosses / totalDef : 0;
                const defUpdatedUnits = { ...targetUnits };
                for (const [uType, count] of Object.entries(defenseUnits)) {
                  const losses = Math.floor(count * lossRatio);
                  defUpdatedUnits[uType] = Math.max(0, (defUpdatedUnits[uType] ?? 0) - losses);
                }

                // Transfer land and gold
                const defLand = Math.max(100, targetLand - combatResult.landGained);
                const defGold = Math.max(0, (targetRes.gold ?? 0) - combatResult.goldLooted);
                combatLandGained = combatResult.landGained;
                finalGold += combatResult.goldLooted;

                await dbUpdate('Kingdom', decision.attackTarget, {
                  resources: JSON.stringify({ ...targetRes, land: defLand, gold: defGold }),
                  totalUnits: JSON.stringify(defUpdatedUnits),
                });
              }

              // Create battle report
              await dbCreate('BattleReport', {
                attackerId: kingdom.id,
                defenderId: decision.attackTarget,
                attackType: 'standard',
                result: JSON.stringify(combatResult),
                casualties: JSON.stringify({
                  attacker: combatResult.attackerLosses,
                  defender: combatResult.defenderLosses,
                }),
                landGained: combatResult.landGained,
                timestamp: new Date().toISOString(),
                owner: 'AI_SYSTEM',
              });

              // Create notification for defender
              await dbCreate('CombatNotification', {
                recipientId: decision.attackTarget,
                type: combatResult.success ? 'attack' : 'defense',
                message: `AI kingdom attacked you! ${combatResult.success ? `Lost ${combatResult.landGained} land.` : 'Attack repelled!'}`,
                data: JSON.stringify({ attackerId: kingdom.id, result: combatResult.resultType }),
                isRead: false,
                createdAt: new Date().toISOString(),
                owner: decision.attackTarget,
              });

              log.info('turn-ticker', 'ai-combat', {
                kingdomId: kingdom.id,
                targetId: decision.attackTarget,
                result: combatResult.resultType,
                landGained: combatResult.landGained,
              });
            }
          } catch (combatErr) {
            log.error('turn-ticker', combatErr, { kingdomId: kingdom.id, context: 'ai-combat' });
          }
        }

        // Calculate final land and networth
        const finalLand = (resources.land ?? 800) + combatLandGained;
        const totalUnitCount = Object.values(updatedUnits).reduce((sum, n) => sum + (n ?? 0), 0);
        const networth = finalLand * 1000 + finalGold + totalUnitCount * 100;

        // Write back all changes
        const updateFields: Record<string, unknown> = {
          resources: JSON.stringify({ ...resources, gold: finalGold, population: newPopulation, land: finalLand }),
          buildings: JSON.stringify(updatedBuildings),
          totalUnits: JSON.stringify(updatedUnits),
          networth,
        };

        // Persist personality on first tick
        if (!(kingdom as KingdomRow).aiPersonality) {
          updateFields.aiPersonality = personality;
        }

        await dbUpdate('Kingdom', kingdom.id, updateFields);

        // Deduct turns spent
        if (decision.turnsSpent > 0) {
          await dbAtomicAdd('Kingdom', kingdom.id, 'turnsBalance', -decision.turnsSpent);
        }

        if (decision.builds.length > 0 || decision.trains.length > 0 || decision.attackTarget) {
          log.info('turn-ticker', 'ai-decision', {
            kingdomId: kingdom.id,
            personality,
            seasonAge,
            builds: decision.builds.length,
            trains: decision.trains.length,
            attacked: !!decision.attackTarget,
            turnsSpent: decision.turnsSpent,
            goldSpent: decision.goldSpent,
          });
        }

        aiTicked++;
      } catch (err) {
        log.error('turn-ticker', err, { kingdomId: kingdom.id, context: 'ai-tick' });
      }
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
