import { describe, it, expect } from 'vitest';
import {
  calculateDetectionRate,
  calculateOptimalScumCount,
  calculateScumCasualties,
  calculateProtectionLevels,
  calculateLayeredDefense,
  THIEVERY_MECHANICS,
  RACIAL_SCUM_EFFECTIVENESS,
} from './thievery-mechanics';

describe('thievery-mechanics', () => {
  describe('calculateDetectionRate', () => {
    it('should return 0 when scum count below minimum (100)', () => {
      expect(calculateDetectionRate(99, 'HUMAN', 500, 'HUMAN')).toBe(0);
    });

    it('should return 0 when scum count is 0', () => {
      expect(calculateDetectionRate(0, 'HUMAN', 500, 'HUMAN')).toBe(0);
    });

    it('should return 50% when both sides have equal scum and same race', () => {
      const rate = calculateDetectionRate(500, 'HUMAN', 500, 'HUMAN');
      expect(rate).toBe(0.5);
    });

    it('should cap detection at 95%', () => {
      const rate = calculateDetectionRate(100000, 'HUMAN', 100, 'HUMAN');
      expect(rate).toBe(0.95);
    });

    it('should increase detection with more scum', () => {
      const rateLow = calculateDetectionRate(200, 'HUMAN', 500, 'HUMAN');
      const rateHigh = calculateDetectionRate(800, 'HUMAN', 500, 'HUMAN');
      expect(rateHigh).toBeGreaterThan(rateLow);
    });

    it('should account for Centaur effectiveness advantage (1.005)', () => {
      const centaurRate = calculateDetectionRate(500, 'CENTAUR', 500, 'HUMAN');
      const humanRate = calculateDetectionRate(500, 'HUMAN', 500, 'HUMAN');
      expect(centaurRate).toBeGreaterThan(humanRate);
    });

    it('should account for Goblin effectiveness disadvantage (0.8)', () => {
      const goblinRate = calculateDetectionRate(500, 'GOBLIN', 500, 'HUMAN');
      const humanRate = calculateDetectionRate(500, 'HUMAN', 500, 'HUMAN');
      expect(goblinRate).toBeLessThan(humanRate);
    });

    it('should return valid rate at exactly minimum scum threshold', () => {
      const rate = calculateDetectionRate(100, 'HUMAN', 500, 'HUMAN');
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(0.95);
    });

    it('should default to 1.0 effectiveness for unknown race', () => {
      const unknownRate = calculateDetectionRate(500, 'UNKNOWN', 500, 'HUMAN');
      const humanRate = calculateDetectionRate(500, 'HUMAN', 500, 'HUMAN');
      expect(unknownRate).toBe(humanRate);
    });
  });

  describe('calculateOptimalScumCount', () => {
    it('should return minimum 100 scum regardless of calculation', () => {
      const count = calculateOptimalScumCount(10, 'HUMAN', 'HUMAN');
      expect(count).toBeGreaterThanOrEqual(100);
    });

    it('should calculate required scum for target detection rate', () => {
      const count = calculateOptimalScumCount(500, 'HUMAN', 'HUMAN', 0.85);
      // For 85% detection: required = (500 * 1.0 * 0.85) / (1.0 * 0.15)
      const expected = Math.ceil((500 * 1.0 * 0.85) / (1.0 * 0.15));
      expect(count).toBe(expected);
    });

    it('should require fewer scum when your race has higher effectiveness', () => {
      const centaurCount = calculateOptimalScumCount(500, 'HUMAN', 'CENTAUR', 0.85);
      const humanCount = calculateOptimalScumCount(500, 'HUMAN', 'HUMAN', 0.85);
      expect(centaurCount).toBeLessThanOrEqual(humanCount);
    });

    it('should require more scum against higher effectiveness enemy', () => {
      const vsGoblin = calculateOptimalScumCount(500, 'GOBLIN', 'HUMAN', 0.85);
      const vsCentaur = calculateOptimalScumCount(500, 'CENTAUR', 'HUMAN', 0.85);
      expect(vsCentaur).toBeGreaterThanOrEqual(vsGoblin);
    });

    it('should use default 85% target detection rate', () => {
      const defaultResult = calculateOptimalScumCount(500, 'HUMAN', 'HUMAN');
      const explicitResult = calculateOptimalScumCount(500, 'HUMAN', 'HUMAN', 0.85);
      expect(defaultResult).toBe(explicitResult);
    });

    it('should increase with enemy scum count', () => {
      const low = calculateOptimalScumCount(200, 'HUMAN', 'HUMAN');
      const high = calculateOptimalScumCount(1000, 'HUMAN', 'HUMAN');
      expect(high).toBeGreaterThan(low);
    });
  });

  describe('calculateScumCasualties', () => {
    it('should have lower casualties for elite than green scum', () => {
      const greenCasualties = calculateScumCasualties(1000, 'green', 'STEAL', 'HUMAN');
      const eliteCasualties = calculateScumCasualties(1000, 'elite', 'STEAL', 'HUMAN');
      expect(eliteCasualties).toBeLessThan(greenCasualties);
    });

    it('should use green scum average death rate of ~1.75%', () => {
      const casualties = calculateScumCasualties(1000, 'green', 'STEAL', 'HUMAN');
      // Average rate: (0.01 + 0.025) / 2 = 0.0175, * operation multiplier 1.0
      const expectedAvgRate = (THIEVERY_MECHANICS.DEATH_RATES.GREEN_SCUM.min +
        THIEVERY_MECHANICS.DEATH_RATES.GREEN_SCUM.max) / 2;
      expect(casualties).toBe(Math.floor(1000 * expectedAvgRate));
    });

    it('should use elite scum average death rate of ~0.91%', () => {
      const casualties = calculateScumCasualties(1000, 'elite', 'STEAL', 'HUMAN');
      const expectedAvgRate = (THIEVERY_MECHANICS.DEATH_RATES.ELITE_SCUM.min +
        THIEVERY_MECHANICS.DEATH_RATES.ELITE_SCUM.max) / 2;
      expect(casualties).toBe(Math.floor(1000 * expectedAvgRate));
    });

    it('should apply lower risk for scout operations (0.5x)', () => {
      const scoutCasualties = calculateScumCasualties(1000, 'green', 'SCOUT', 'HUMAN');
      const stealCasualties = calculateScumCasualties(1000, 'green', 'STEAL', 'HUMAN');
      expect(scoutCasualties).toBeLessThan(stealCasualties);
    });

    it('should apply higher risk for burn operations (1.5x)', () => {
      const burnCasualties = calculateScumCasualties(1000, 'green', 'BURN', 'HUMAN');
      const stealCasualties = calculateScumCasualties(1000, 'green', 'STEAL', 'HUMAN');
      expect(burnCasualties).toBeGreaterThan(stealCasualties);
    });

    it('should apply sabotage risk multiplier (1.2x)', () => {
      const sabCasualties = calculateScumCasualties(1000, 'green', 'SABOTAGE', 'HUMAN');
      const stealCasualties = calculateScumCasualties(1000, 'green', 'STEAL', 'HUMAN');
      expect(sabCasualties).toBeGreaterThan(stealCasualties);
    });

    it('should account for racial survival rate (Vampire 1.1)', () => {
      const vampireCasualties = calculateScumCasualties(1000, 'green', 'STEAL', 'VAMPIRE');
      const humanCasualties = calculateScumCasualties(1000, 'green', 'STEAL', 'HUMAN');
      expect(vampireCasualties).toBeLessThanOrEqual(humanCasualties);
    });

    it('should account for racial survival rate (Goblin 0.9)', () => {
      const goblinCasualties = calculateScumCasualties(1000, 'green', 'STEAL', 'GOBLIN');
      const humanCasualties = calculateScumCasualties(1000, 'green', 'STEAL', 'HUMAN');
      expect(goblinCasualties).toBeGreaterThan(humanCasualties);
    });
  });

  describe('calculateProtectionLevels', () => {
    it('should recommend more scum for higher threat levels', () => {
      const low = calculateProtectionLevels(10000, 'low', 'HUMAN');
      const high = calculateProtectionLevels(10000, 'high', 'HUMAN');
      expect(high.recommended).toBeGreaterThan(low.recommended);
    });

    it('should ensure minimum is at least 100 scum', () => {
      const result = calculateProtectionLevels(500, 'low', 'HUMAN');
      expect(result.minimum).toBeGreaterThanOrEqual(THIEVERY_MECHANICS.DETECTION.MINIMUM_SCUM);
    });

    it('should set minimum to 10% of land when larger than 100', () => {
      const result = calculateProtectionLevels(5000, 'low', 'HUMAN');
      expect(result.minimum).toBe(Math.floor(5000 * 0.1));
    });

    it('should calculate optimal as 20% above recommended', () => {
      const result = calculateProtectionLevels(10000, 'medium', 'HUMAN');
      expect(result.optimal).toBe(Math.floor(result.recommended * 1.2));
    });

    it('should adjust for racial efficiency (Centaur needs fewer)', () => {
      const centaur = calculateProtectionLevels(10000, 'medium', 'CENTAUR');
      const human = calculateProtectionLevels(10000, 'medium', 'HUMAN');
      expect(centaur.recommended).toBeLessThanOrEqual(human.recommended);
    });

    it('should scale with land size', () => {
      const small = calculateProtectionLevels(5000, 'medium', 'HUMAN');
      const large = calculateProtectionLevels(50000, 'medium', 'HUMAN');
      expect(large.recommended).toBeGreaterThan(small.recommended);
    });

    it('should use low ratio of 0.1 per acre', () => {
      const result = calculateProtectionLevels(10000, 'low', 'HUMAN');
      expect(result.recommended).toBe(Math.floor(10000 * 0.1));
    });

    it('should use medium ratio of 0.4 per acre', () => {
      const result = calculateProtectionLevels(10000, 'medium', 'HUMAN');
      expect(result.recommended).toBe(Math.floor(10000 * 0.4));
    });

    it('should use high ratio of 0.8 per acre', () => {
      const result = calculateProtectionLevels(10000, 'high', 'HUMAN');
      expect(result.recommended).toBe(Math.floor(10000 * 0.8));
    });
  });

  describe('calculateLayeredDefense', () => {
    it('should calculate scum percentage correctly', () => {
      const result = calculateLayeredDefense(10000, 1000, 500);
      expect(result.scumPercentage).toBeCloseTo(500 / 1500);
      expect(result.militaryPercentage).toBeCloseTo(1000 / 1500);
    });

    it('should have higher effectiveness at 50/50 for small kingdoms (< 20k)', () => {
      const balanced = calculateLayeredDefense(15000, 500, 500);
      const unbalanced = calculateLayeredDefense(15000, 900, 100);
      expect(balanced.effectiveness).toBeGreaterThan(unbalanced.effectiveness);
    });

    it('should have higher effectiveness at 40/60 for large kingdoms (>= 20k)', () => {
      const optimal = calculateLayeredDefense(25000, 600, 400);
      const unbalanced = calculateLayeredDefense(25000, 100, 900);
      expect(optimal.effectiveness).toBeGreaterThan(unbalanced.effectiveness);
    });

    it('should have effectiveness between 0.5 and 1.0 for small kingdoms', () => {
      const result = calculateLayeredDefense(15000, 500, 500);
      expect(result.effectiveness).toBeGreaterThanOrEqual(0.5);
      expect(result.effectiveness).toBeLessThanOrEqual(1.0);
    });

    it('should have effectiveness between 0.6 and 1.0 for large kingdoms', () => {
      const result = calculateLayeredDefense(25000, 600, 400);
      expect(result.effectiveness).toBeGreaterThanOrEqual(0.6);
      expect(result.effectiveness).toBeLessThanOrEqual(1.0);
    });

    it('should sum scum and military percentages to 1', () => {
      const result = calculateLayeredDefense(10000, 1000, 500);
      expect(result.scumPercentage + result.militaryPercentage).toBeCloseTo(1.0);
    });
  });
});
