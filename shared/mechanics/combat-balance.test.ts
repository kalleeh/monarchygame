/**
 * Balance proof for the combat rebalance (counter system + flattened curve +
 * land cap). Verifies the design goals the rebalance set out to achieve:
 *  1. No single tier is a strictly dominant gold buy (flattened curve).
 *  2. Mono-spamming one unit class is exploitable by its counter.
 *  3. A balanced army is never hard-countered (composition beats spam).
 *  4. The land cap stops the small-land mega-wall.
 */
import { describe, it, expect } from 'vitest';
import { TIER_STATS } from './tier-stats';
import { compositionAdjustedOffense } from './unit-classes';
import { getUnitOffense, getUnitDefense } from '../combat/combatCache';
import { calculateUnitCountCap } from './troop-cap-mechanics';

describe('flattened curve: no dominant tier', () => {
  it('every tier buys roughly equal offense-per-gold (±15%)', () => {
    const r = TIER_STATS.OFFENSE.map((o, t) => o / TIER_STATS.GOLD[t]);
    expect((Math.max(...r) - Math.min(...r)) / Math.min(...r)).toBeLessThanOrEqual(0.15);
  });
});

describe('counter system: mono-spam is exploitable, balance is safe', () => {
  // Equal-gold armies (~same total power), different compositions.
  const monoInfantry = { 'dwarven-militia': 400 };           // all infantry
  const monoCavalry = { 'centaur-warriors': 400 };           // all cavalry (infantry counters this)
  const balanced = {
    'dwarven-militia': 100,   // infantry
    'centaur-warriors': 100,  // cavalry
    'fae-warriors': 100,      // ranged
    'sidhe-mages': 100,       // mystic
  };

  const mult = (atk: Record<string, number>, def: Record<string, number>) =>
    compositionAdjustedOffense(atk, def, getUnitOffense, getUnitDefense).multiplier;

  it('a hard counter beats the mono army it counters (infantry vs cavalry)', () => {
    expect(mult(monoInfantry, monoCavalry)).toBeGreaterThan(1.0);
  });

  it('the countered mono army is itself penalised attacking into its counter', () => {
    expect(mult(monoCavalry, monoInfantry)).toBeLessThan(1.0);
  });

  it("a balanced army's worst matchup is far milder than a mono army's", () => {
    // Balance is exactly neutral vs balance, and its worst case across all
    // defenders stays close to neutral — never the full hard-counter penalty a
    // mono army eats (0.80). This is the "mix, don't spam" pressure.
    expect(mult(balanced, balanced)).toBeCloseTo(1.0, 1); // effectively neutral
    const balancedWorst = Math.min(
      mult(balanced, monoInfantry), mult(balanced, monoCavalry), mult(balanced, balanced),
    );
    const monoWorst = Math.min(
      mult(monoCavalry, monoInfantry), mult(monoInfantry, monoCavalry),
    );
    expect(balancedWorst).toBeGreaterThan(monoWorst);
    expect(balancedWorst).toBeGreaterThanOrEqual(0.9); // balance never gets hard-countered
  });

  it('a balanced defender cannot be hard-countered by any mono attacker', () => {
    // No single-class attacker gets more than the soft +25% vs a balanced defender.
    for (const atk of [monoInfantry, monoCavalry]) {
      expect(mult(atk, balanced)).toBeLessThanOrEqual(1.1);
    }
  });
});

describe('land cap: small-land mega-wall is impossible', () => {
  it('100-land kingdom is capped far below the old 40k wall', () => {
    expect(calculateUnitCountCap({ land: 100 })).toBeLessThan(40_000);
  });
  it('army size scales with land', () => {
    expect(calculateUnitCountCap({ land: 1000 })).toBeGreaterThan(calculateUnitCountCap({ land: 200 }));
  });
});
