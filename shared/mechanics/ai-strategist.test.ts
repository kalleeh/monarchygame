import { describe, it, expect } from 'vitest';
import {
  assignPersona,
  assignDifficulty,
  makeRng,
  PERSONAS,
  DIFFICULTY_PARAMS,
  armyCombatPower,
  estimateDefense,
  type Persona,
  type Difficulty,
} from './ai-strategist';

describe('persona & difficulty assignment', () => {
  it('is deterministic per kingdom id', () => {
    expect(assignPersona('kingdom-abc')).toBe(assignPersona('kingdom-abc'));
    expect(assignDifficulty('kingdom-abc')).toBe(assignDifficulty('kingdom-abc'));
  });

  it('covers all six personas across many ids', () => {
    const seen = new Set<Persona>();
    for (let i = 0; i < 600; i++) seen.add(assignPersona(`k-${i}`));
    expect(seen.size).toBe(6);
  });

  it('difficulty distribution is roughly 25/50/25', () => {
    const counts: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    for (let i = 0; i < 2000; i++) counts[assignDifficulty(`k-${i}`)]++;
    expect(counts.easy).toBeGreaterThan(2000 * 0.15);
    expect(counts.easy).toBeLessThan(2000 * 0.35);
    expect(counts.medium).toBeGreaterThan(2000 * 0.40);
    expect(counts.medium).toBeLessThan(2000 * 0.60);
    expect(counts.hard).toBeGreaterThan(2000 * 0.15);
    expect(counts.hard).toBeLessThan(2000 * 0.35);
  });

  it('every persona has complete weights and every difficulty complete params', () => {
    for (const p of Object.values(PERSONAS)) {
      for (const k of ['econ', 'military', 'defense', 'aggression', 'lootFocus', 'vengeance', 'playerFocus'] as const) {
        expect(p[k]).toBeGreaterThan(0);
      }
    }
    for (const d of Object.values(DIFFICULTY_PARAMS)) {
      expect(d.estNoise).toBeGreaterThanOrEqual(0);
      expect(d.actChance).toBeGreaterThan(0);
      expect(d.turnBudgetFrac).toBeGreaterThan(0);
    }
  });
});

describe('makeRng', () => {
  it('same seed gives same sequence; different seeds differ', () => {
    const a = makeRng(42), b = makeRng(42), c = makeRng(43);
    const seqA = [a(), a(), a()], seqB = [b(), b(), b()], seqC = [c(), c(), c()];
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const v of seqA) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

describe('armyCombatPower', () => {
  it('uses real per-tier values and excludes scouts', () => {
    const { offense, defense } = armyCombatPower('Human', {
      peasants: 10, militia: 10, knights: 10, cavalry: 10, scouts: 100,
    });
    expect(offense).toBe(10 * 1 + 10 * 3 + 10 * 6 + 10 * 10); // 200
    expect(defense).toBe(10 * 1 + 10 * 2 + 10 * 4 + 10 * 7);  // 140
  });
});

describe('estimateDefense (information-fair)', () => {
  const view = (networth: number, race = 'Human') => ({
    id: 't1', race, networth, isActive: true, isAI: true,
  });

  it('scales with networth', () => {
    const rng = makeRng(1);
    const small = estimateDefense(view(100_000), 'hard', rng);
    const big = estimateDefense(view(1_000_000), 'hard', makeRng(1));
    expect(big).toBeGreaterThan(small * 5);
  });

  it('hard estimates are tighter than easy estimates', () => {
    // Sample many estimates; spread (max/min) must be wider for easy.
    const spread = (d: 'easy' | 'hard') => {
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < 200; i++) {
        const e = estimateDefense(view(500_000), d, makeRng(i));
        mn = Math.min(mn, e); mx = Math.max(mx, e);
      }
      return mx / mn;
    };
    expect(spread('easy')).toBeGreaterThan(spread('hard') * 1.5);
  });

  it('applies the public race defense bonus (Vampire > Human at equal networth)', () => {
    const h = estimateDefense(view(500_000, 'Human'), 'hard', makeRng(7));
    const v = estimateDefense(view(500_000, 'Vampire'), 'hard', makeRng(7));
    expect(v).toBeGreaterThan(h);
  });
});
