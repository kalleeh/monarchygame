/**
 * Intelligence proof via COMBAT WIN RATE: hard AI judges targets better than easy AI.
 *
 * Design:
 * - EASY cohort (12 warlord kingdoms, difficulty 'easy') vs
 *   HARD cohort (12 warlord kingdoms, difficulty 'hard') vs
 *   PREY pool (16 passive kingdoms: 8 weak + 8 tough decoys).
 * - All cohort kingdoms start IDENTICAL in land/gold/units/buildings — only DIFFICULTY differs.
 * - Run 100 ticks, age 'middle' (combat enabled).
 * - Measure ATTEMPTS and WINS per cohort. WIN RATE = wins / attempts.
 * - Expectation: hard AI's lower estNoise (0.12 vs 0.60) → better target selection
 *   → higher win rate (attacking beatable prey, avoiding tough decoys).
 */
import { describe, it, expect } from 'vitest';
import {
  decide, makeRng, emptyMemory, armyCombatPower,
  type SelfState, type PublicKingdomView, type AIMemory, type Difficulty, type Persona,
} from './ai-strategist';

function hashString(s: string, salt: number): number {
  let h = salt | 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
import { calculateGenerationRates } from './economy-mechanics';
import { calculateCombatResult, calculateFortDefense, RACE_OFFENSE_BONUSES, RACE_DEFENSE_BONUSES } from './combat-mechanics';
import type { AttackForce, DefenseForce } from './combat-mechanics';

interface SimKingdom extends SelfState {
  memory: AIMemory;
  difficulty: Difficulty;
  persona: Persona;
  isPrey: boolean;
}

interface BattleEvent {
  attackerId: string;
  defenderId: string;
  landGained: number;
  timestamp: number;
}

function mkCohortKingdom(id: string, difficulty: Difficulty): SimKingdom {
  // IDENTICAL starting state for easy and hard cohorts — only difficulty differs.
  // Strong enough to beat weak prey but NOT tough decoys.
  return {
    id,
    race: 'Human',
    land: 1500,
    gold: 200_000,
    turnsAvailable: 60,
    networth: 1500 * 1000 + 200_000 + (3000 + 1500 + 400) * 100,
    buildings: { barracks: 300, wall: 50 },
    totalUnits: { peasants: 3000, militia: 1500, knights: 400 },
    memory: emptyMemory(),
    difficulty,
    persona: 'warlord',
    isPrey: false,
  };
}

function mkPreyKingdom(id: string, weak: boolean): SimKingdom {
  // Prey do NOT act — they're static targets for cohorts to evaluate.
  // Weak prey are clearly beatable (low army); tough decoys are NOT (large army).
  const config = weak
    ? { land: 400, gold: 5_000, units: { peasants: 300, militia: 50 }, wall: 0 }
    : { land: 2500, gold: 50_000, units: { peasants: 6000, militia: 3000, knights: 1500 }, wall: 200 };

  const totalUnits = Object.values(config.units).reduce((s, n) => s + n, 0);
  return {
    id,
    race: 'Human',
    land: config.land,
    gold: config.gold,
    turnsAvailable: 0,
    networth: config.land * 1000 + config.gold + totalUnits * 100,
    buildings: { wall: config.wall },
    totalUnits: config.units,
    memory: emptyMemory(),
    difficulty: 'medium', // not used for prey
    persona: 'turtle',
    isPrey: true,
  };
}

function networthOf(k: SimKingdom): number {
  const units = Object.values(k.totalUnits).reduce((s, n) => s + (n ?? 0), 0);
  return k.land * 1000 + k.gold + units * 100;
}

describe('AI intelligence proof: combat win rate', () => {
  it('hard AI achieves a higher win rate than easy AI by judging targets more accurately', () => {
    // THREE groups sharing one world:
    const easyCohort: SimKingdom[] = Array.from({ length: 12 }, (_, i) =>
      mkCohortKingdom(`easy-${i}`, 'easy')
    );
    const hardCohort: SimKingdom[] = Array.from({ length: 12 }, (_, i) =>
      mkCohortKingdom(`hard-${i}`, 'hard')
    );
    const preyPool: SimKingdom[] = [
      ...Array.from({ length: 8 }, (_, i) => mkPreyKingdom(`weak-${i}`, true)),
      ...Array.from({ length: 8 }, (_, i) => mkPreyKingdom(`tough-${i}`, false)),
    ];

    const kingdoms: SimKingdom[] = [...easyCohort, ...hardCohort, ...preyPool];

    const nowBase = Date.now();
    const createdAt = nowBase - 100 * 3600_000; // 100 hours ago (no newbie protection)
    const battles: BattleEvent[] = [];

    let easyAttempts = 0, easyWins = 0, hardAttempts = 0, hardWins = 0;

    // Run 100 ticks, age 'middle' throughout (combat enabled).
    for (let tick = 0; tick < 100; tick++) {
      const age = 'middle';
      const nowMs = nowBase + tick * 20 * 60_000; // 20 min per tick

      // Build world view (all 40 kingdoms visible).
      const views: PublicKingdomView[] = kingdoms.map(k => ({
        id: k.id,
        race: k.race,
        networth: k.networth,
        isActive: true,
        isAI: true,
        createdAt: new Date(createdAt).toISOString(),
      }));

      // Recent battles (last 21 minutes).
      const recent = battles.filter(b => nowMs - b.timestamp < 21 * 60_000);

      // Process each COHORT kingdom (stable order); prey do NOT act.
      for (const k of kingdoms) {
        if (k.isPrey) {
          // Prey: recompute networth only (static defense).
          k.networth = networthOf(k);
          continue;
        }

        // Apply real income.
        const rates = calculateGenerationRates({ race: k.race, age, buildings: k.buildings });
        k.gold = Math.min(1_000_000, k.gold + rates.goldPerTurn);
        k.turnsAvailable = Math.min(72, k.turnsAvailable + 1);

        // AI decide.
        const d = decide(k, views, {
          age,
          persona: k.persona,
          difficulty: k.difficulty,
          memory: k.memory,
          recentBattles: recent.map(b => ({
            attackerId: b.attackerId,
            defenderId: b.defenderId,
            landGained: b.landGained,
            timestamp: new Date(b.timestamp).toISOString(),
          })),
          rng: makeRng(hashString(k.id, tick)),
          nowMs,
        });

        // Apply builds & trains.
        for (const b of d.builds) k.buildings[b.type] = (k.buildings[b.type] ?? 0) + b.qty;
        for (const t of d.trains) k.totalUnits[t.unitType] = (k.totalUnits[t.unitType] ?? 0) + t.qty;
        k.gold -= d.goldSpent;
        k.turnsAvailable -= d.turnsSpent;
        k.memory = d.memory;
        expect(k.gold).toBeGreaterThanOrEqual(0); // never overspends

        // Resolve combat if attackTarget declared.
        if (d.attackTarget) {
          const isEasy = k.difficulty === 'easy';
          if (isEasy) easyAttempts++; else hardAttempts++;

          const target = kingdoms.find(x => x.id === d.attackTarget);
          if (!target) continue;

          const atk = armyCombatPower(k.race, k.totalUnits);
          const def = armyCombatPower(target.race, target.totalUnits);

          const attackForce: AttackForce = {
            units: k.totalUnits,
            totalOffense: Math.floor(atk.offense * 0.7 * (RACE_OFFENSE_BONUSES[k.race] ?? 1)),
            totalDefense: 0,
          };
          const defenseForce: DefenseForce = {
            units: target.totalUnits,
            forts: target.buildings.wall ?? 0,
            totalDefense: Math.floor(def.defense * (RACE_DEFENSE_BONUSES[target.race] ?? 1))
              + calculateFortDefense(target.race, target.buildings.wall ?? 0),
            ambushActive: false,
          };

          const result = calculateCombatResult(attackForce, defenseForce, target.land);

          if (result.landGained > 0) {
            // Count a WIN.
            if (isEasy) easyWins++; else hardWins++;

            // Transfer land (defender floor 100).
            target.land = Math.max(100, target.land - result.landGained);
            k.land += result.landGained;

            // Loot gold.
            const loot = Math.min(target.gold, result.goldLooted ?? 0);
            target.gold -= loot;
            k.gold += loot;

            // For prey: keep units STATIC (fixed defense). For cohort: apply casualties.
            if (!target.isPrey) {
              // Apply proportional casualties to cohort defenders.
              for (const unitType in target.totalUnits) {
                if (unitType === 'scouts' || unitType === 'elite_scouts') continue;
                const ratio = 1 - result.defenderLosses / (def.offense + def.defense + 1);
                target.totalUnits[unitType] = Math.max(0, Math.floor(target.totalUnits[unitType]! * ratio));
              }
            }

            // Record battle.
            battles.push({
              attackerId: k.id,
              defenderId: target.id,
              landGained: result.landGained,
              timestamp: nowMs,
            });
          }

          // Apply attacker casualties.
          for (const unitType in k.totalUnits) {
            if (unitType === 'scouts' || unitType === 'elite_scouts') continue;
            const ratio = 1 - result.attackerLosses / (atk.offense + atk.defense + 1);
            k.totalUnits[unitType] = Math.max(0, Math.floor(k.totalUnits[unitType]! * ratio));
          }
        }

        // Recompute networth.
        k.networth = networthOf(k);
      }
    }

    // Compute win rates.
    const easyWinRate = easyAttempts > 0 ? easyWins / easyAttempts : 0;
    const hardWinRate = hardAttempts > 0 ? hardWins / hardAttempts : 0;

    // REPORT the six numbers.
    console.log('\n=== COMBAT WIN RATE (100 ticks, 12 easy / 12 hard / 16 prey) ===');
    console.log(`Easy cohort:  attempts=${easyAttempts}, wins=${easyWins}, winRate=${(easyWinRate * 100).toFixed(1)}%`);
    console.log(`Hard cohort:  attempts=${hardAttempts}, wins=${hardWins}, winRate=${(hardWinRate * 100).toFixed(1)}%`);
    console.log(`===============================================================\n`);

    // ASSERTIONS: both cohorts must attack, and hard must demonstrate higher win rate.
    expect(easyAttempts).toBeGreaterThan(0); // easy cohort must attempt attacks
    expect(hardAttempts).toBeGreaterThan(0); // hard cohort must attempt attacks
    expect(hardWinRate).toBeGreaterThan(easyWinRate); // core claim: better target selection
  });
});
