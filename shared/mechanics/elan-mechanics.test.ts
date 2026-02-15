import { describe, it, expect } from 'vitest';
import {
  calculateElanGeneration,
  calculateMaxElan,
  calculateElanStatus,
  canAffordSpell,
  hasRequiredTemples,
  calculateElanAfterCast,
  calculateBacklash,
  ELAN_MECHANICS,
} from './elan-mechanics';

describe('elan-mechanics', () => {
  describe('calculateElanGeneration', () => {
    it('should use Sidhe rate of 0.005 per temple', () => {
      expect(calculateElanGeneration(200, 'SIDHE')).toBe(Math.ceil(200 * 0.005));
    });

    it('should use Vampire rate of 0.005 per temple', () => {
      expect(calculateElanGeneration(200, 'VAMPIRE')).toBe(Math.ceil(200 * 0.005));
    });

    it('should use standard rate of 0.003 for Human', () => {
      expect(calculateElanGeneration(200, 'HUMAN')).toBe(Math.ceil(200 * 0.003));
    });

    it('should use standard rate of 0.003 for Goblin', () => {
      expect(calculateElanGeneration(200, 'GOBLIN')).toBe(Math.ceil(200 * 0.003));
    });

    it('should default to HUMAN rate when no race specified', () => {
      expect(calculateElanGeneration(200)).toBe(Math.ceil(200 * 0.003));
    });

    it('should return 0 for 0 temples', () => {
      expect(calculateElanGeneration(0, 'SIDHE')).toBe(0);
    });

    it('should ceil the result (e.g., 1 temple SIDHE = 0.005 -> 1)', () => {
      expect(calculateElanGeneration(1, 'SIDHE')).toBe(1);
    });

    it('should ceil the result (e.g., 1 temple HUMAN = 0.003 -> 1)', () => {
      expect(calculateElanGeneration(1, 'HUMAN')).toBe(1);
    });

    it('should be case-insensitive for race ID', () => {
      expect(calculateElanGeneration(200, 'sidhe')).toBe(Math.ceil(200 * 0.005));
      expect(calculateElanGeneration(200, 'Vampire')).toBe(Math.ceil(200 * 0.005));
    });

    it('should use others rate for Elven', () => {
      expect(calculateElanGeneration(200, 'ELVEN')).toBe(Math.ceil(200 * 0.003));
    });
  });

  describe('calculateMaxElan', () => {
    it('should calculate base elan as temples * 10', () => {
      expect(calculateMaxElan(100, 1000, 'HUMAN')).toBe(100 * 10 * 1.0);
    });

    it('should apply Sidhe multiplier of 1.5', () => {
      expect(calculateMaxElan(100, 1000, 'SIDHE')).toBe(Math.floor(100 * 10 * 1.5));
    });

    it('should apply Vampire multiplier of 1.3', () => {
      expect(calculateMaxElan(100, 1000, 'VAMPIRE')).toBe(Math.floor(100 * 10 * 1.3));
    });

    it('should apply Elemental multiplier of 1.2', () => {
      expect(calculateMaxElan(100, 1000, 'ELEMENTAL')).toBe(Math.floor(100 * 10 * 1.2));
    });

    it('should apply Elven multiplier of 1.2', () => {
      expect(calculateMaxElan(100, 1000, 'ELVEN')).toBe(Math.floor(100 * 10 * 1.2));
    });

    it('should apply Droben penalty multiplier of 0.9', () => {
      expect(calculateMaxElan(100, 1000, 'DROBEN')).toBe(Math.floor(100 * 10 * 0.9));
    });

    it('should apply Dwarven penalty multiplier of 0.9', () => {
      expect(calculateMaxElan(100, 1000, 'DWARVEN')).toBe(Math.floor(100 * 10 * 0.9));
    });

    it('should default to multiplier 1.0 for HUMAN', () => {
      expect(calculateMaxElan(100, 1000)).toBe(1000);
    });

    it('should return 0 for 0 temples', () => {
      expect(calculateMaxElan(0, 1000, 'SIDHE')).toBe(0);
    });

    it('should floor the result', () => {
      // 7 * 10 * 1.5 = 105
      expect(calculateMaxElan(7, 100, 'SIDHE')).toBe(Math.floor(7 * 10 * 1.5));
    });
  });

  describe('calculateElanStatus', () => {
    it('should calculate complete elan status', () => {
      const status = calculateElanStatus(50, 1000, 500, 'HUMAN', 100);
      expect(status.templeCount).toBe(50);
      expect(status.templePercentage).toBe(5); // (50/1000) * 100
      expect(status.maxElan).toBe(calculateMaxElan(50, 1000, 'HUMAN'));
      expect(status.elanGenerationRate).toBe(calculateElanGeneration(50, 'HUMAN'));
      expect(status.currentElan).toBe(100);
    });

    it('should cap currentElan at maxElan', () => {
      const status = calculateElanStatus(5, 1000, 500, 'HUMAN', 9999);
      expect(status.currentElan).toBe(status.maxElan);
    });

    it('should default currentElan to 0 when not provided', () => {
      const status = calculateElanStatus(50, 1000, 500, 'HUMAN');
      expect(status.currentElan).toBe(0);
    });

    it('should handle 0 land count', () => {
      const status = calculateElanStatus(50, 0, 500, 'HUMAN');
      expect(status.templePercentage).toBe(0);
    });

    it('should calculate temple percentage correctly', () => {
      const status = calculateElanStatus(100, 500, 300, 'HUMAN');
      expect(status.templePercentage).toBe(20); // (100/500) * 100
    });

    it('should use racial multiplier for max elan', () => {
      const sidhe = calculateElanStatus(50, 1000, 500, 'SIDHE');
      const human = calculateElanStatus(50, 1000, 500, 'HUMAN');
      expect(sidhe.maxElan).toBeGreaterThan(human.maxElan);
    });
  });

  describe('canAffordSpell', () => {
    it('should return true when elan exceeds cost', () => {
      expect(canAffordSpell(100, 20)).toBe(true);
    });

    it('should return true when elan equals cost', () => {
      expect(canAffordSpell(20, 20)).toBe(true);
    });

    it('should return false when elan is below cost', () => {
      expect(canAffordSpell(10, 20)).toBe(false);
    });

    it('should return true for free spells (Calming Chant cost 0)', () => {
      expect(canAffordSpell(0, 0)).toBe(true);
    });

    it('should handle large values', () => {
      expect(canAffordSpell(10000, 80)).toBe(true);
    });
  });

  describe('hasRequiredTemples', () => {
    it('should return true when temple percentage meets requirement', () => {
      expect(hasRequiredTemples(5, 4)).toBe(true);
    });

    it('should return true when exactly at requirement', () => {
      expect(hasRequiredTemples(4, 4)).toBe(true);
    });

    it('should return false when below requirement', () => {
      expect(hasRequiredTemples(3, 4)).toBe(false);
    });

    it('should work with tier 1 requirement (2%)', () => {
      expect(hasRequiredTemples(2, ELAN_MECHANICS.TEMPLE_REQUIREMENTS.TIER_1 * 100)).toBe(true);
      expect(hasRequiredTemples(1, ELAN_MECHANICS.TEMPLE_REQUIREMENTS.TIER_1 * 100)).toBe(false);
    });

    it('should work with tier 4 requirement (12%)', () => {
      expect(hasRequiredTemples(12, ELAN_MECHANICS.TEMPLE_REQUIREMENTS.TIER_4 * 100)).toBe(true);
      expect(hasRequiredTemples(11, ELAN_MECHANICS.TEMPLE_REQUIREMENTS.TIER_4 * 100)).toBe(false);
    });
  });

  describe('calculateElanAfterCast', () => {
    it('should subtract spell cost from current elan', () => {
      expect(calculateElanAfterCast(100, 20, 200)).toBe(80);
    });

    it('should not go below 0', () => {
      expect(calculateElanAfterCast(10, 20, 200)).toBe(0);
    });

    it('should not exceed max elan', () => {
      expect(calculateElanAfterCast(100, -50, 120)).toBe(120);
    });

    it('should handle exact subtraction to 0', () => {
      expect(calculateElanAfterCast(20, 20, 100)).toBe(0);
    });

    it('should handle cost of 0 (Calming Chant)', () => {
      expect(calculateElanAfterCast(50, 0, 100)).toBe(50);
    });
  });

  describe('calculateBacklash', () => {
    it('should use Sidhe backlash rate of 9%', () => {
      const result = calculateBacklash(100, 'SIDHE');
      expect(result.templesDestroyed).toBe(Math.floor(100 * 0.09));
    });

    it('should use Elven backlash rate of 10%', () => {
      const result = calculateBacklash(100, 'ELVEN');
      expect(result.templesDestroyed).toBe(Math.floor(100 * 0.10));
    });

    it('should use Vampire backlash rate of 13%', () => {
      const result = calculateBacklash(100, 'VAMPIRE');
      expect(result.templesDestroyed).toBe(Math.floor(100 * 0.13));
    });

    it('should use Droben backlash rate of 15% (warriors)', () => {
      const result = calculateBacklash(100, 'DROBEN');
      expect(result.templesDestroyed).toBe(Math.floor(100 * 0.15));
    });

    it('should use Dwarven backlash rate of 15% (warriors)', () => {
      const result = calculateBacklash(100, 'DWARVEN');
      expect(result.templesDestroyed).toBe(Math.floor(100 * 0.15));
    });

    it('should use Human backlash rate of 12%', () => {
      const result = calculateBacklash(100, 'HUMAN');
      expect(result.templesDestroyed).toBe(Math.floor(100 * 0.12));
    });

    it('should use Elemental backlash rate of 11%', () => {
      const result = calculateBacklash(100, 'ELEMENTAL');
      expect(result.templesDestroyed).toBe(Math.floor(100 * 0.11));
    });

    it('should use FAE backlash rate of 10%', () => {
      const result = calculateBacklash(100, 'FAE');
      expect(result.templesDestroyed).toBe(Math.floor(100 * 0.10));
    });

    it('should default to 12% for unknown race', () => {
      const result = calculateBacklash(100, 'UNKNOWN');
      expect(result.templesDestroyed).toBe(Math.floor(100 * 0.12));
    });

    it('should calculate elan lost as 2x temples destroyed', () => {
      const result = calculateBacklash(100, 'SIDHE');
      expect(result.elanLost).toBe(Math.ceil(result.templesDestroyed * 2));
    });

    it('should always cost 2 turns', () => {
      const result = calculateBacklash(100, 'SIDHE');
      expect(result.turnsCost).toBe(2);
    });

    it('should floor temples destroyed', () => {
      // 7 * 0.09 = 0.63, floor = 0
      const result = calculateBacklash(7, 'SIDHE');
      expect(result.templesDestroyed).toBe(0);
    });

    it('should handle large temple counts', () => {
      const result = calculateBacklash(10000, 'SIDHE');
      expect(result.templesDestroyed).toBe(Math.floor(10000 * 0.09));
      expect(result.elanLost).toBe(Math.ceil(result.templesDestroyed * 2));
    });
  });
});
