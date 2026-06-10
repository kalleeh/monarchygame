import { describe, it, expect } from 'vitest';
import {
  assignPersona,
  assignDifficulty,
  makeRng,
  PERSONAS,
  DIFFICULTY_PARAMS,
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
