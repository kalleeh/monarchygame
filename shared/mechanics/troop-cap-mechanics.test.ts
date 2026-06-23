import { describe, it, expect } from 'vitest';
import { calculateTroopCapGold, calculateUnitCountCap, TROOP_CAP, UNIT_COUNT_CAP } from './troop-cap-mechanics';

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

describe('calculateUnitCountCap (land-based head-count cap)', () => {
  it('floors small kingdoms at MIN_UNITS so they can field a starter army', () => {
    expect(calculateUnitCountCap({ land: 0 })).toBe(UNIT_COUNT_CAP.MIN_UNITS);
    // 100 land × 50 = 5,000 which is above the 2,000 floor
    expect(calculateUnitCountCap({ land: 100 })).toBe(5_000);
  });

  it('kills the small-land mega-wall: 100 land can no longer hold 40k units', () => {
    expect(calculateUnitCountCap({ land: 100 })).toBeLessThan(40_000);
  });

  it('scales linearly with land between floor and ceiling', () => {
    expect(calculateUnitCountCap({ land: 500 })).toBe(25_000);
    expect(calculateUnitCountCap({ land: 1000 })).toBe(50_000);
  });

  it('caps at MAX_UNITS for very large kingdoms', () => {
    expect(calculateUnitCountCap({ land: 2000 })).toBe(UNIT_COUNT_CAP.MAX_UNITS);
    expect(calculateUnitCountCap({ land: 25000 })).toBe(UNIT_COUNT_CAP.MAX_UNITS);
  });
});
