import { describe, it, expect } from 'vitest';
import { calculateTroopCapGold, TROOP_CAP } from './troop-cap-mechanics';

describe('calculateTroopCapGold', () => {
  it('floors small/new kingdoms at MIN_CAP_GOLD', () => {
    expect(calculateTroopCapGold({ land: 100, barracks: 0 })).toBe(TROOP_CAP.MIN_CAP_GOLD);
    expect(calculateTroopCapGold({ land: 0, barracks: 0 })).toBe(TROOP_CAP.MIN_CAP_GOLD);
  });

  it('scales with land and barracks above the floor', () => {
    // 5000 land × 1000 + 1500 barracks × 2000 = 5,000,000 + 3,000,000 = 8,000,000
    expect(calculateTroopCapGold({ land: 5000, barracks: 1500 })).toBe(8_000_000);
    // 30k-acre war kingdom, ~10k barracks: 30M + 20M = 50M
    expect(calculateTroopCapGold({ land: 30000, barracks: 10000 })).toBe(50_000_000);
  });

  it('a bigger/more-militarised kingdom always has a higher cap', () => {
    const small = calculateTroopCapGold({ land: 5000, barracks: 1000 });
    const big = calculateTroopCapGold({ land: 20000, barracks: 6000 });
    expect(big).toBeGreaterThan(small);
  });

  it('clamps negative inputs to the floor (never below MIN)', () => {
    expect(calculateTroopCapGold({ land: -100, barracks: -50 })).toBe(TROOP_CAP.MIN_CAP_GOLD);
  });
});
