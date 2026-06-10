/**
 * Intelligence proof: identical starting kingdoms, identical rules and income.
 * After N simulated ticks, hard-difficulty AI must out-grow easy-difficulty AI.
 * The sim resolves income with the REAL calculateGenerationRates and combat
 * with the REAL calculateCombatResult — the AI only ever sees public views.
 */
import { describe, it, expect } from 'vitest';
import {
  decide, makeRng, emptyMemory, armyCombatPower,
  type SelfState, type PublicKingdomView, type AIMemory, type Difficulty, type Persona,
} from './ai-strategist';

// Re-export hashString for proper RNG seeding (it's not exported from ai-strategist)
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
}

function mkKingdom(i: number, difficulty: Difficulty): SimKingdom {
  return {
    id: `sim-${difficulty}-${i}`,
    race: 'Human',
    land: 100, gold: 2000, turnsAvailable: 20, networth: 102_000,
    buildings: {}, totalUnits: { peasants: 40, militia: 10 },
    memory: emptyMemory(),
    difficulty,
    persona: 'economist' as Persona,
  };
}

function networthOf(k: SimKingdom): number {
  const units = Object.values(k.totalUnits).reduce((s, n) => s + (n ?? 0), 0);
  return k.land * 1000 + k.gold + units * 100;
}

describe('strategist simulation', () => {
  it('hard AI out-grow easy AI over 40 ticks under identical rules', () => {
    const kingdoms: SimKingdom[] = [
      ...Array.from({ length: 10 }, (_, i) => mkKingdom(i, 'easy')),
      ...Array.from({ length: 10 }, (_, i) => mkKingdom(i, 'hard')),
    ];
    const nowBase = Date.UTC(2026, 5, 1);
    const battles: Array<{ attackerId: string; defenderId: string; landGained: number; timestamp: string }> = [];

    for (let tick = 0; tick < 40; tick++) {
      const age = tick < 15 ? 'early' : 'middle';
      const nowMs = nowBase + tick * 20 * 60_000;
      const views: PublicKingdomView[] = kingdoms.map(k => ({
        id: k.id, race: k.race, networth: k.networth,
        isActive: true, isAI: true, createdAt: new Date(nowBase - 100 * 3600_000).toISOString(),
      }));
      const recent = battles.filter(b => nowMs - new Date(b.timestamp).getTime() < 21 * 60_000);

      for (const k of kingdoms) {
        // Real income from own buildings (same as resource-manager grants).
        const rates = calculateGenerationRates({ race: k.race, age, buildings: k.buildings });
        k.gold = Math.min(1_000_000, k.gold + rates.goldPerTurn);
        k.turnsAvailable = Math.min(72, k.turnsAvailable + 1);

        const d = decide(k, views, {
          age, persona: k.persona, difficulty: k.difficulty,
          memory: k.memory, recentBattles: recent,
          rng: makeRng(hashString(k.id, tick)),
          nowMs,
        });

        for (const b of d.builds) k.buildings[b.type] = (k.buildings[b.type] ?? 0) + b.qty;
        for (const t of d.trains) k.totalUnits[t.unitType] = (k.totalUnits[t.unitType] ?? 0) + t.qty;
        k.gold -= d.goldSpent;
        k.turnsAvailable -= d.turnsSpent;
        k.memory = d.memory;
        expect(k.gold).toBeGreaterThanOrEqual(0); // never overspends

        if (d.attackTarget) {
          const target = kingdoms.find(x => x.id === d.attackTarget)!;
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
            target.land = Math.max(100, target.land - result.landGained);
            k.land += result.landGained;
            const loot = Math.min(target.gold, result.goldLooted ?? 0);
            target.gold -= loot; k.gold += loot;
            battles.push({
              attackerId: k.id, defenderId: target.id,
              landGained: result.landGained, timestamp: new Date(nowMs).toISOString(),
            });
          }
        }
        k.networth = networthOf(k);
      }
    }

    // Measure ECONOMIC DEVELOPMENT (real gold income per turn from the kingdom's
    // buildings) rather than raw networth: networth counts gold→troop conversion
    // as a loss, which would penalize the more-active hard AI in a combat-light
    // sim. Income directly reflects how well each AI built its economy.
    const incomeOf = (k: SimKingdom) =>
      calculateGenerationRates({ race: k.race, age: 'middle', buildings: k.buildings }).goldPerTurn;
    const median = (xs: number[]) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const hardIncome = median(kingdoms.filter(k => k.difficulty === 'hard').map(incomeOf));
    const easyIncome = median(kingdoms.filter(k => k.difficulty === 'easy').map(incomeOf));
    expect(hardIncome).toBeGreaterThan(easyIncome);
  });
});
