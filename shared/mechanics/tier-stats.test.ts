import { describe, it, expect } from 'vitest';
import { TIER_STATS, TIER_COUNT } from './tier-stats';

describe('TIER_STATS — flattened cost curve', () => {
  it('has consistent array lengths across all stat tracks', () => {
    expect(TIER_STATS.OFFENSE).toHaveLength(TIER_COUNT);
    expect(TIER_STATS.DEFENSE).toHaveLength(TIER_COUNT);
    expect(TIER_STATS.GOLD).toHaveLength(TIER_COUNT);
    expect(TIER_STATS.POP).toHaveLength(TIER_COUNT);
    expect(TIER_STATS.HIT_POINTS).toHaveLength(TIER_COUNT);
    expect(TIER_STATS.UPKEEP).toHaveLength(TIER_COUNT);
  });

  it('keeps offense-per-gold roughly constant across tiers (no dominant tier)', () => {
    const ratios = TIER_STATS.OFFENSE.map((off, t) => off / TIER_STATS.GOLD[t]);
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);
    // Within ±15% — no tier is a strictly better gold buy than another.
    expect((max - min) / min).toBeLessThanOrEqual(0.15);
  });

  it('has monotonically increasing power and cost by tier', () => {
    for (let t = 1; t < TIER_COUNT; t++) {
      expect(TIER_STATS.OFFENSE[t]).toBeGreaterThan(TIER_STATS.OFFENSE[t - 1]);
      expect(TIER_STATS.DEFENSE[t]).toBeGreaterThan(TIER_STATS.DEFENSE[t - 1]);
      expect(TIER_STATS.GOLD[t]).toBeGreaterThan(TIER_STATS.GOLD[t - 1]);
    }
  });

  it('defense is lower than offense at each tier (offense-leaning units)', () => {
    for (let t = 0; t < TIER_COUNT; t++) {
      expect(TIER_STATS.DEFENSE[t]).toBeLessThanOrEqual(TIER_STATS.OFFENSE[t]);
    }
  });
});
