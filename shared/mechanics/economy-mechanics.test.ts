import { describe, it, expect } from 'vitest';
import { calculateGenerationRates } from './economy-mechanics';

describe('calculateGenerationRates', () => {
  it('matches resource-manager base income math (Human, early age)', () => {
    // 2 mines=40, 3 farms=24, 1 tower=50, +100 base = 214
    // tithe 0 -> floored to 0.5 -> floor(1*5*0.5)=2 ; caravan(Human)=floor(214*0.4)=85
    // age early 1.2 -> floor((214+2+85)*1.2)=floor(361.2)=361
    const r = calculateGenerationRates({
      race: 'Human', age: 'early',
      buildings: { mine: 2, farm: 3, tower: 1, temple: 1 },
      tithe: 0,
    });
    expect(r.goldPerTurn).toBe(361);
    expect(r.populationPerTurn).toBe(30); // 3 farms * 10
    expect(r.elanPerTurn).toBe(1);        // ceil(1 * 0.003)
  });

  it('applies late-age multiplier (1.30)', () => {
    // base 214, tithe 2, caravan 85 -> floor(301*1.30)=391
    const r = calculateGenerationRates({
      race: 'Human', age: 'late',
      buildings: { mine: 2, farm: 3, tower: 1, temple: 1 },
      tithe: 0,
    });
    expect(r.goldPerTurn).toBe(391);
  });

  it('scales tithe with the tithe stat', () => {
    // 2 temples, tithe 8 -> mult 0.8 -> floor(2*5*0.8)=8
    // base = 100 (no mine/farm/tower); caravan(Human)=floor(100*0.4)=40
    // early 1.2 -> floor((100+8+40)*1.2)=floor(177.6)=177
    const r = calculateGenerationRates({
      race: 'Human', age: 'early',
      buildings: { temple: 2 },
      tithe: 8,
    });
    expect(r.goldPerTurn).toBe(177);
  });

  it('gives Sidhe/Vampire a higher elan rate', () => {
    expect(calculateGenerationRates({ race: 'Sidhe', age: 'early', buildings: { temple: 100 } }).elanPerTurn)
      .toBe(Math.ceil(100 * 0.005)); // 1
    expect(calculateGenerationRates({ race: 'Human', age: 'early', buildings: { temple: 100 } }).elanPerTurn)
      .toBe(Math.ceil(100 * 0.003)); // 1
  });

  it('adds territory production with terrain + race bonuses', () => {
    // Goblin mine territory on mountains: base gold 60 * terrain 1.5 * dlvl(1.0) * raceBonus 1.20 = 108
    const r = calculateGenerationRates({
      race: 'Goblin', age: 'early',
      buildings: {},
      territories: [{ category: 'mine', terrainType: 'mountains', defenseLevel: 0 }],
    });
    // base gold (no buildings) = max(50,100)=100; no caravan (Goblin); early 1.2 -> floor(100*1.2)=120
    // + territory gold floor(60*1.5*1*1.2)=108
    expect(r.goldPerTurn).toBe(120 + 108);
    expect(r.breakdown.territoryGold).toBe(108);
  });

  it('returns a labeled breakdown for the economy panel', () => {
    const r = calculateGenerationRates({
      race: 'Human', age: 'early',
      buildings: { mine: 2, farm: 3, tower: 1, temple: 1 },
      tithe: 5,
    });
    const labels = r.breakdown.goldBase.map(s => s.label);
    expect(labels).toContain('Base');
    expect(labels.some(l => l.startsWith('Mines'))).toBe(true);
    expect(r.breakdown.ageMultiplier).toBe(1.2);
    // Subtotal is the sum of all base components, and after-multiplier total is consistent.
    expect(r.breakdown.goldSubtotal).toBe(r.breakdown.goldBase.reduce((s, x) => s + x.amount, 0));
    expect(r.breakdown.goldAfterMultipliers).toBe(r.goldPerTurn - r.breakdown.territoryGold);
  });

  it('compounds age, alliance and faith multipliers in the breakdown', () => {
    // subtotal: base 100 + caravan(Human) 40 = 140; (no mine/farm/tower/temple)
    // ×1.2 age ×1.10 comp ×1.05 upgrade = floor(140*1.2*1.1*1.05)=floor(194.04)=194; ×1.2 faith=232
    const r = calculateGenerationRates({
      race: 'Human', age: 'early', buildings: {},
      compositionIncomeBonus: 1.10, upgradeIncomeBonus: 1.05, hasEconomicFocus: true,
    });
    expect(r.breakdown.goldSubtotal).toBe(140);
    expect(r.breakdown.economicFocusMultiplier).toBe(1.2);
    expect(r.goldPerTurn).toBe(232);
  });
});
