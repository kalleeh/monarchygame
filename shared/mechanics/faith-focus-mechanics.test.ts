import { describe, it, expect } from 'vitest';
import {
  calculateFaithLevel,
  getFaithBonuses,
  canUseFaithAlignment,
  calculateFocusGeneration,
  canUseFocusAbility,
  applyFocusEffect,
  calculateMaxFocusPoints,
  FAITH_ALIGNMENTS,
  FOCUS_MECHANICS,
} from './faith-focus-mechanics';

describe('faith-focus-mechanics', () => {
  describe('calculateFaithLevel', () => {
    it('should return level 0 for less than 10 faith points', () => {
      expect(calculateFaithLevel(0)).toBe(0);
      expect(calculateFaithLevel(9)).toBe(0);
    });

    it('should return level 1 at 10 faith points', () => {
      expect(calculateFaithLevel(10)).toBe(1);
    });

    it('should return level 1 for 10-49 faith points', () => {
      expect(calculateFaithLevel(49)).toBe(1);
    });

    it('should return level 2 at 50 faith points', () => {
      expect(calculateFaithLevel(50)).toBe(2);
    });

    it('should return level 2 for 50-199 faith points', () => {
      expect(calculateFaithLevel(199)).toBe(2);
    });

    it('should return level 3 at 200 faith points', () => {
      expect(calculateFaithLevel(200)).toBe(3);
    });

    it('should return level 3 for 200-499 faith points', () => {
      expect(calculateFaithLevel(499)).toBe(3);
    });

    it('should return level 4 at 500 faith points', () => {
      expect(calculateFaithLevel(500)).toBe(4);
    });

    it('should return level 4 for 500-999 faith points', () => {
      expect(calculateFaithLevel(999)).toBe(4);
    });

    it('should return level 5 at 1000 faith points', () => {
      expect(calculateFaithLevel(1000)).toBe(5);
    });

    it('should return level 5 for more than 1000 faith points', () => {
      expect(calculateFaithLevel(5000)).toBe(5);
    });
  });

  describe('getFaithBonuses', () => {
    it('should return empty object for unknown alignment', () => {
      const bonuses = getFaithBonuses('unknown', 1);
      expect(Object.keys(bonuses)).toHaveLength(0);
    });

    it('should scale bonuses with faith level', () => {
      const level1 = getFaithBonuses('angelique', 1);
      const level5 = getFaithBonuses('angelique', 5);
      // Level 1: multiplier = 1.1, Level 5: multiplier = 1.5
      expect(level5.spellEffectiveness!).toBeGreaterThan(level1.spellEffectiveness!);
    });

    it('should apply 10% per level multiplier', () => {
      const bonuses = getFaithBonuses('angelique', 3);
      // Multiplier = 1 + (3 * 0.1) = 1.3
      expect(bonuses.spellEffectiveness).toBeCloseTo(0.1 * 1.3);
      expect(bonuses.combatBonus).toBeCloseTo(0.05 * 1.3);
    });

    it('should return elemental alignment bonuses', () => {
      const bonuses = getFaithBonuses('elemental', 2);
      // Multiplier = 1 + (2 * 0.1) = 1.2
      expect(bonuses.spellEffectiveness).toBeCloseTo(0.08 * 1.2);
      expect(bonuses.economicBonus).toBeCloseTo(0.05 * 1.2);
    });

    it('should return empty bonuses for neutral alignment', () => {
      const bonuses = getFaithBonuses('neutral', 5);
      expect(Object.keys(bonuses)).toHaveLength(0);
    });

    it('should scale at level 0 with multiplier 1.0', () => {
      const bonuses = getFaithBonuses('angelique', 0);
      expect(bonuses.spellEffectiveness).toBeCloseTo(0.1 * 1.0);
    });
  });

  describe('canUseFaithAlignment', () => {
    it('should allow vampire to use angelique', () => {
      expect(canUseFaithAlignment('vampire', 'angelique')).toBe(true);
    });

    it('should allow human to use angelique', () => {
      expect(canUseFaithAlignment('human', 'angelique')).toBe(true);
    });

    it('should allow elven to use angelique', () => {
      expect(canUseFaithAlignment('elven', 'angelique')).toBe(true);
    });

    it('should not allow goblin to use angelique', () => {
      expect(canUseFaithAlignment('goblin', 'angelique')).toBe(false);
    });

    it('should allow elemental to use elemental alignment', () => {
      expect(canUseFaithAlignment('elemental', 'elemental')).toBe(true);
    });

    it('should not allow vampire to use elemental alignment', () => {
      expect(canUseFaithAlignment('vampire', 'elemental')).toBe(false);
    });

    it('should allow human to use neutral alignment', () => {
      expect(canUseFaithAlignment('human', 'neutral')).toBe(true);
    });

    it('should allow goblin to use neutral alignment', () => {
      expect(canUseFaithAlignment('goblin', 'neutral')).toBe(true);
    });

    it('should return false for unknown alignment', () => {
      expect(canUseFaithAlignment('human', 'nonexistent')).toBe(false);
    });

    it('should be case-insensitive for race ID', () => {
      expect(canUseFaithAlignment('VAMPIRE', 'angelique')).toBe(true);
    });
  });

  describe('calculateFocusGeneration', () => {
    it('should return base rate of 2 for standard races', () => {
      expect(calculateFocusGeneration('human')).toBe(2);
    });

    it('should apply vampire modifier (1.2x) and floor', () => {
      expect(calculateFocusGeneration('vampire')).toBe(Math.floor(2 * 1.2));
    });

    it('should apply sidhe modifier (1.15x) and floor', () => {
      expect(calculateFocusGeneration('sidhe')).toBe(Math.floor(2 * 1.15));
    });

    it('should apply elemental modifier (1.1x) and floor', () => {
      expect(calculateFocusGeneration('elemental')).toBe(Math.floor(2 * 1.1));
    });

    it('should default to 1.0 for unknown race', () => {
      expect(calculateFocusGeneration('goblin')).toBe(Math.floor(2 * 1.0));
    });

    it('should accept custom base generation rate', () => {
      expect(calculateFocusGeneration('human', 5)).toBe(Math.floor(5 * 1.0));
    });
  });

  describe('calculateMaxFocusPoints', () => {
    it('should return 100 for standard races', () => {
      expect(calculateMaxFocusPoints('human')).toBe(100);
    });

    it('should apply vampire modifier (1.2x)', () => {
      expect(calculateMaxFocusPoints('vampire')).toBe(Math.floor(100 * 1.2));
    });

    it('should apply sidhe modifier (1.15x)', () => {
      expect(calculateMaxFocusPoints('sidhe')).toBe(Math.floor(100 * 1.15));
    });

    it('should accept custom base max', () => {
      expect(calculateMaxFocusPoints('human', 200)).toBe(200);
    });
  });

  describe('canUseFocusAbility', () => {
    it('should allow use when sufficient focus points', () => {
      const result = canUseFocusAbility('ENHANCED_RACIAL_ABILITY', 15);
      expect(result.canUse).toBe(true);
      expect(result.cost).toBe(10);
    });

    it('should deny use when insufficient focus points', () => {
      const result = canUseFocusAbility('ENHANCED_RACIAL_ABILITY', 5);
      expect(result.canUse).toBe(false);
      expect(result.cost).toBe(10);
      expect(result.reason).toContain('Insufficient focus points');
    });

    it('should check SPELL_POWER_BOOST cost of 15', () => {
      const result = canUseFocusAbility('SPELL_POWER_BOOST', 15);
      expect(result.canUse).toBe(true);
      expect(result.cost).toBe(15);
    });

    it('should check COMBAT_FOCUS cost of 8', () => {
      const result = canUseFocusAbility('COMBAT_FOCUS', 8);
      expect(result.canUse).toBe(true);
      expect(result.cost).toBe(8);
    });

    it('should check ECONOMIC_FOCUS cost of 6', () => {
      const result = canUseFocusAbility('ECONOMIC_FOCUS', 6);
      expect(result.canUse).toBe(true);
      expect(result.cost).toBe(6);
    });

    it('should check EMERGENCY_ACTION cost of 20', () => {
      const result = canUseFocusAbility('EMERGENCY_ACTION', 19);
      expect(result.canUse).toBe(false);
      expect(result.cost).toBe(20);
    });

    it('should allow exactly equal points', () => {
      const result = canUseFocusAbility('ENHANCED_RACIAL_ABILITY', 10);
      expect(result.canUse).toBe(true);
    });
  });

  describe('applyFocusEffect', () => {
    it('should apply 50% boost for RACIAL_ABILITY_BOOST', () => {
      const result = applyFocusEffect('RACIAL_ABILITY_BOOST', 100);
      expect(result.enhancedValue).toBe(150);
      expect(result.duration).toBe(5);
    });

    it('should apply 30% boost for SPELL_POWER_BOOST', () => {
      const result = applyFocusEffect('SPELL_POWER_BOOST', 100);
      expect(result.enhancedValue).toBe(130);
      expect(result.duration).toBe(5);
    });

    it('should apply 20% bonus for COMBAT_FOCUS_BONUS', () => {
      const result = applyFocusEffect('COMBAT_FOCUS_BONUS', 100);
      expect(result.enhancedValue).toBe(120);
      expect(result.duration).toBe(5);
    });

    it('should apply 15% bonus for ECONOMIC_FOCUS_BONUS', () => {
      const result = applyFocusEffect('ECONOMIC_FOCUS_BONUS', 100);
      expect(result.enhancedValue).toBe(115);
      expect(result.duration).toBe(5);
    });

    it('should always set duration to 5 turns', () => {
      const result = applyFocusEffect('RACIAL_ABILITY_BOOST', 50);
      expect(result.duration).toBe(FOCUS_MECHANICS.FOCUS_EFFECTS.EFFECT_DURATION);
    });

    it('should handle large base values', () => {
      const result = applyFocusEffect('RACIAL_ABILITY_BOOST', 10000);
      expect(result.enhancedValue).toBe(15000);
    });
  });
});
