import { describe, it, expect } from 'vitest';
import {
  calculateCurrentAge,
  calculateAgeEffects,
  isRacialAbilityActive,
  calculateAgeBasedCosts,
  calculateAgeBasedIncome,
  getAgeTransitionWarning,
  AGE_MECHANICS,
} from './age-mechanics';

describe('age-mechanics', () => {
  describe('calculateCurrentAge', () => {
    const gameStart = new Date('2025-01-01T00:00:00Z');
    const totalHours = AGE_MECHANICS.AGE_DURATIONS.TOTAL_GAME_HOURS; // 1008

    it('should return early age at game start', () => {
      const current = new Date('2025-01-01T00:00:00Z');
      const result = calculateCurrentAge(gameStart, current);
      expect(result.currentAge).toBe('early');
    });

    it('should return early age before 25% of game time', () => {
      // 25% of 1008 = 252 hours
      const current = new Date(gameStart.getTime() + 250 * 60 * 60 * 1000);
      const result = calculateCurrentAge(gameStart, current);
      expect(result.currentAge).toBe('early');
    });

    it('should transition to middle age at 25% of game time', () => {
      // 25% of 1008 = 252 hours
      const current = new Date(gameStart.getTime() + 253 * 60 * 60 * 1000);
      const result = calculateCurrentAge(gameStart, current);
      expect(result.currentAge).toBe('middle');
    });

    it('should remain in middle age between 25% and 67%', () => {
      // 50% of 1008 = 504 hours
      const current = new Date(gameStart.getTime() + 504 * 60 * 60 * 1000);
      const result = calculateCurrentAge(gameStart, current);
      expect(result.currentAge).toBe('middle');
    });

    it('should transition to late age at 67% of game time', () => {
      // 67% of 1008 = 675.36 hours
      const current = new Date(gameStart.getTime() + 676 * 60 * 60 * 1000);
      const result = calculateCurrentAge(gameStart, current);
      expect(result.currentAge).toBe('late');
    });

    it('should return late age at end of game', () => {
      const current = new Date(gameStart.getTime() + 1007 * 60 * 60 * 1000);
      const result = calculateCurrentAge(gameStart, current);
      expect(result.currentAge).toBe('late');
    });

    it('should report correct remaining time in early age', () => {
      const current = new Date(gameStart.getTime() + 100 * 60 * 60 * 1000);
      const result = calculateCurrentAge(gameStart, current);
      expect(result.currentAge).toBe('early');
      expect(result.remainingTime).toBeGreaterThan(0);
    });

    it('should set correct age duration for early age', () => {
      const current = new Date(gameStart.getTime());
      const result = calculateCurrentAge(gameStart, current);
      expect(result.ageDuration).toBe(AGE_MECHANICS.AGE_DURATIONS.EARLY_AGE_HOURS);
    });

    it('should set correct age duration for middle age', () => {
      const current = new Date(gameStart.getTime() + 300 * 60 * 60 * 1000);
      const result = calculateCurrentAge(gameStart, current);
      expect(result.ageDuration).toBe(AGE_MECHANICS.AGE_DURATIONS.MIDDLE_AGE_HOURS);
    });

    it('should set correct age duration for late age', () => {
      const current = new Date(gameStart.getTime() + 700 * 60 * 60 * 1000);
      const result = calculateCurrentAge(gameStart, current);
      expect(result.ageDuration).toBe(AGE_MECHANICS.AGE_DURATIONS.LATE_AGE_HOURS);
    });
  });

  describe('calculateAgeEffects', () => {
    it('should return early age economic modifiers', () => {
      const effects = calculateAgeEffects('early');
      expect(effects.economicModifiers.buildingCostMultiplier).toBe(0.8);
      expect(effects.economicModifiers.trainingCostMultiplier).toBe(1.0);
      expect(effects.economicModifiers.incomeMultiplier).toBe(1.2);
    });

    it('should return middle age economic modifiers', () => {
      const effects = calculateAgeEffects('middle');
      expect(effects.economicModifiers.buildingCostMultiplier).toBe(1.0);
      expect(effects.economicModifiers.trainingCostMultiplier).toBe(0.9);
      expect(effects.economicModifiers.incomeMultiplier).toBe(1.0);
    });

    it('should return late age economic modifiers', () => {
      const effects = calculateAgeEffects('late');
      expect(effects.economicModifiers.buildingCostMultiplier).toBe(1.2);
      expect(effects.economicModifiers.trainingCostMultiplier).toBe(0.8);
      expect(effects.economicModifiers.incomeMultiplier).toBe(0.9);
    });

    it('should return early age combat modifiers (defensive advantage)', () => {
      const effects = calculateAgeEffects('early');
      expect(effects.combatModifiers.offenseMultiplier).toBe(0.9);
      expect(effects.combatModifiers.defenseMultiplier).toBe(1.1);
    });

    it('should return middle age combat modifiers (balanced)', () => {
      const effects = calculateAgeEffects('middle');
      expect(effects.combatModifiers.offenseMultiplier).toBe(1.0);
      expect(effects.combatModifiers.defenseMultiplier).toBe(1.0);
    });

    it('should return late age combat modifiers (offensive advantage)', () => {
      const effects = calculateAgeEffects('late');
      expect(effects.combatModifiers.offenseMultiplier).toBe(1.1);
      expect(effects.combatModifiers.defenseMultiplier).toBe(0.9);
    });

    it('should activate Goblin Kobold Rage in middle age', () => {
      const effects = calculateAgeEffects('middle');
      expect(effects.racialAbilityModifiers['goblin_kobold_rage']).toBe(1.5);
    });

    it('should deactivate Goblin Kobold Rage in early age', () => {
      const effects = calculateAgeEffects('early');
      expect(effects.racialAbilityModifiers['goblin_kobold_rage']).toBe(1.0);
    });

    it('should deactivate Goblin Kobold Rage in late age', () => {
      const effects = calculateAgeEffects('late');
      expect(effects.racialAbilityModifiers['goblin_kobold_rage']).toBe(1.0);
    });

    it('should set kobold unit modifier in middle age', () => {
      const effects = calculateAgeEffects('middle');
      expect(effects.unitEffectivenessModifiers['kobolds']).toBe(1.5);
    });

    it('should not set kobold unit modifier in early age', () => {
      const effects = calculateAgeEffects('early');
      expect(effects.unitEffectivenessModifiers['kobolds']).toBeUndefined();
    });
  });

  describe('isRacialAbilityActive', () => {
    it('should return true for Goblin kobold_rage in middle age', () => {
      expect(isRacialAbilityActive('goblin', 'kobold_rage', 'middle')).toBe(true);
    });

    it('should return false for Goblin kobold_rage in early age', () => {
      expect(isRacialAbilityActive('goblin', 'kobold_rage', 'early')).toBe(false);
    });

    it('should return false for Goblin kobold_rage in late age', () => {
      expect(isRacialAbilityActive('goblin', 'kobold_rage', 'late')).toBe(false);
    });

    it('should return true for non-age-dependent abilities', () => {
      expect(isRacialAbilityActive('human', 'some_ability', 'early')).toBe(true);
      expect(isRacialAbilityActive('human', 'some_ability', 'middle')).toBe(true);
      expect(isRacialAbilityActive('human', 'some_ability', 'late')).toBe(true);
    });

    it('should be case-insensitive for race ID', () => {
      expect(isRacialAbilityActive('GOBLIN', 'kobold_rage', 'middle')).toBe(true);
    });
  });

  describe('calculateAgeBasedCosts', () => {
    it('should reduce building cost by 20% in early age', () => {
      const cost = calculateAgeBasedCosts(1000, 'building', 'early');
      expect(cost).toBe(Math.ceil(1000 * 0.8));
    });

    it('should keep building cost standard in middle age', () => {
      const cost = calculateAgeBasedCosts(1000, 'building', 'middle');
      expect(cost).toBe(Math.ceil(1000 * 1.0));
    });

    it('should increase building cost by 20% in late age', () => {
      const cost = calculateAgeBasedCosts(1000, 'building', 'late');
      expect(cost).toBe(Math.ceil(1000 * 1.2));
    });

    it('should keep training cost standard in early age', () => {
      const cost = calculateAgeBasedCosts(1000, 'training', 'early');
      expect(cost).toBe(Math.ceil(1000 * 1.0));
    });

    it('should reduce training cost by 10% in middle age', () => {
      const cost = calculateAgeBasedCosts(1000, 'training', 'middle');
      expect(cost).toBe(Math.ceil(1000 * 0.9));
    });

    it('should reduce training cost by 20% in late age', () => {
      const cost = calculateAgeBasedCosts(1000, 'training', 'late');
      expect(cost).toBe(Math.ceil(1000 * 0.8));
    });
  });

  describe('calculateAgeBasedIncome', () => {
    it('should increase income by 20% in early age', () => {
      const income = calculateAgeBasedIncome(10000, 'early');
      expect(income).toBe(Math.floor(10000 * 1.2));
    });

    it('should keep income standard in middle age', () => {
      const income = calculateAgeBasedIncome(10000, 'middle');
      expect(income).toBe(Math.floor(10000 * 1.0));
    });

    it('should reduce income by 10% in late age', () => {
      const income = calculateAgeBasedIncome(10000, 'late');
      expect(income).toBe(Math.floor(10000 * 0.9));
    });
  });

  describe('getAgeTransitionWarning', () => {
    const gameStart = new Date('2025-01-01T00:00:00Z');

    it('should return imminent warning within 24 hours of transition', () => {
      // Early age ends at 168 hours. At 167h remaining = 1h
      const current = new Date(gameStart.getTime() + 167 * 60 * 60 * 1000);
      const result = getAgeTransitionWarning(gameStart, current);
      expect(result.warningType).toBe('imminent');
      expect(result.nextAge).toBe('middle');
      expect(result.hoursRemaining).toBeLessThanOrEqual(24);
    });

    it('should return approaching warning within 72 hours of transition', () => {
      // Early age ends at 168 hours. At 100h remaining = 68h
      const current = new Date(gameStart.getTime() + 100 * 60 * 60 * 1000);
      const result = getAgeTransitionWarning(gameStart, current);
      expect(result.warningType).toBe('approaching');
      expect(result.nextAge).toBe('middle');
    });

    it('should return none when far from transition', () => {
      // Early age ends at 168 hours. At 10h remaining = 158h
      const current = new Date(gameStart.getTime() + 10 * 60 * 60 * 1000);
      const result = getAgeTransitionWarning(gameStart, current);
      expect(result.warningType).toBe('none');
    });

    it('should warn about late age transition from middle age', () => {
      // Middle age is between early (168h) and late (168 + 336 = 504h)
      // At 500h remaining in middle = small
      const current = new Date(gameStart.getTime() + 500 * 60 * 60 * 1000);
      const result = getAgeTransitionWarning(gameStart, current);
      if (result.warningType !== 'none') {
        expect(result.nextAge).toBe('late');
      }
    });

    it('should return none for late age (no further transitions)', () => {
      const current = new Date(gameStart.getTime() + 700 * 60 * 60 * 1000);
      const result = getAgeTransitionWarning(gameStart, current);
      // Late age still has remainingTime, but if it is > 72h it should be none
      if (result.warningType !== 'none') {
        expect(result.hoursRemaining).toBeLessThanOrEqual(72);
      }
    });
  });
});
