import { describe, it, expect } from 'vitest';
import {
  calculateBountyValue,
  calculateSharedKillBenefit,
  calculateTithingExhaustionThreshold,
  assessBountyEnvironment,
  calculateBountyEfficiency,
  BOUNTY_MECHANICS,
} from './bounty-mechanics';

describe('bounty-mechanics', () => {
  describe('calculateBountyValue', () => {
    it('should calculate land gained at 30% rate', () => {
      const result = calculateBountyValue(10000, 5000, 80);
      expect(result.landGained).toBe(Math.floor(10000 * 0.30));
    });

    it('should calculate structures gained with build ratio', () => {
      const result = calculateBountyValue(10000, 5000, 80);
      const expectedLand = Math.floor(10000 * 0.30);
      const baseStructures = Math.floor(expectedLand * (80 / 100));
      const bonusStructures = Math.floor(baseStructures * 0.20);
      expect(result.structuresGained).toBe(baseStructures + bonusStructures);
    });

    it('should include structure bonus at 20%', () => {
      const result = calculateBountyValue(10000, 5000, 50);
      const expectedLand = Math.floor(10000 * 0.30);
      const baseStructures = Math.floor(expectedLand * (50 / 100));
      const bonusStructures = Math.floor(baseStructures * 0.20);
      expect(result.structuresGained).toBe(baseStructures + bonusStructures);
    });

    it('should calculate turn savings based on hunter build rate', () => {
      const result18 = calculateBountyValue(10000, 5000, 80, 18);
      const result20 = calculateBountyValue(10000, 5000, 80, 20);
      expect(result20.turnsSaved).toBeGreaterThan(result18.turnsSaved);
    });

    it('should compute total value as sum of land, structures, and turns saved', () => {
      const result = calculateBountyValue(10000, 5000, 80);
      expect(result.totalValue).toBe(
        result.landGained + result.structuresGained + result.turnsSaved
      );
    });

    it('should handle low build ratio', () => {
      const result = calculateBountyValue(10000, 5000, 10);
      expect(result.structuresGained).toBeGreaterThanOrEqual(0);
    });

    it('should default hunter build rate to 18', () => {
      const result = calculateBountyValue(10000, 5000, 80);
      const resultExplicit = calculateBountyValue(10000, 5000, 80, 18);
      expect(result.turnsSaved).toBe(resultExplicit.turnsSaved);
    });

    it('should use BR multiplier of 90 for buildrate 16', () => {
      const result = calculateBountyValue(10000, 5000, 80, 16);
      const baseTurnSavings = 100 * (90 / 100);
      expect(result.turnsSaved).toBeGreaterThanOrEqual(Math.floor(baseTurnSavings));
    });

    it('should use BR multiplier of 110 for buildrate 20', () => {
      const result = calculateBountyValue(10000, 5000, 80, 20);
      const baseTurnSavings = 100 * (110 / 100);
      expect(result.turnsSaved).toBeGreaterThanOrEqual(Math.floor(baseTurnSavings));
    });
  });

  describe('calculateSharedKillBenefit', () => {
    it('should provide benefit to both sorcerer and warrior', () => {
      const result = calculateSharedKillBenefit(10000, 5000, 50, 10);
      expect(result.sorcererBenefit.landGained).toBeGreaterThan(0);
      expect(result.warriorBenefit.landGained).toBeGreaterThan(0);
    });

    it('should give warrior 15% of target land', () => {
      const result = calculateSharedKillBenefit(10000, 5000, 50, 10);
      expect(result.warriorBenefit.landGained).toBe(Math.floor(10000 * 0.15));
    });

    it('should calculate total efficiency as total benefit / total turns', () => {
      const result = calculateSharedKillBenefit(10000, 5000, 50, 10);
      const expectedTotal = result.sorcererBenefit.totalValue + result.warriorBenefit.totalValue;
      expect(result.totalEfficiency).toBe(expectedTotal / 60);
    });

    it('should give sorcerer a larger share than warrior', () => {
      const result = calculateSharedKillBenefit(10000, 5000, 50, 10);
      expect(result.sorcererBenefit.landGained).toBeGreaterThan(result.warriorBenefit.landGained);
    });

    it('should sorcerer benefit use 95% reduction factor', () => {
      const result = calculateSharedKillBenefit(10000, 5000, 50, 10);
      // Sorcerer gets bounty on 95% of target land
      const sorcererLand = calculateBountyValue(10000 * 0.95, 5000, 20);
      expect(result.sorcererBenefit.landGained).toBe(sorcererLand.landGained);
    });
  });

  describe('calculateTithingExhaustionThreshold', () => {
    it('should not be exhausted below 11k acres with good tithing', () => {
      const result = calculateTithingExhaustionThreshold('human', 10000, 0.5);
      expect(result.isExhausted).toBe(false);
    });

    it('should be exhausted when tithing bonus is near 0', () => {
      const result = calculateTithingExhaustionThreshold('human', 10000, 0.05);
      expect(result.isExhausted).toBe(true);
    });

    it('should consider human racial tithing efficiency (1.2)', () => {
      const human = calculateTithingExhaustionThreshold('human', 17000, 0.5);
      // Human threshold: 15000 * 1.2 = 18000, 17000 < 18000 so not exhausted
      expect(human.isExhausted).toBe(false);
    });

    it('should consider vampire racial tithing efficiency (0.8)', () => {
      const vampire = calculateTithingExhaustionThreshold('vampire', 12000, 0.5);
      // Vampire threshold: 15000 * 0.8 = 12000, 12000 >= 12000 so exhausted
      expect(vampire.isExhausted).toBe(true);
    });

    it('should flag optimal bounty timing when exhausted and above 11k', () => {
      const result = calculateTithingExhaustionThreshold('vampire', 12000, 0.5);
      expect(result.optimalBountyTiming).toBe(true);
    });

    it('should not flag optimal bounty timing when not exhausted', () => {
      const result = calculateTithingExhaustionThreshold('human', 8000, 0.5);
      expect(result.optimalBountyTiming).toBe(false);
    });

    it('should use default efficiency of 1.0 for unknown race', () => {
      const result = calculateTithingExhaustionThreshold('sidhe', 15000, 0.5);
      // Default: 15000 * 1.0 = 15000, 15000 >= 15000 so exhausted
      expect(result.isExhausted).toBe(true);
    });

    it('should consider dwarven efficiency (1.1)', () => {
      const result = calculateTithingExhaustionThreshold('dwarven', 16000, 0.5);
      // Dwarven threshold: 15000 * 1.1 = 16500, 16000 < 16500 so not exhausted
      expect(result.isExhausted).toBe(false);
    });
  });

  describe('assessBountyEnvironment', () => {
    it('should return safe when 2+ of 3 major guilds are at war', () => {
      const result = assessBountyEnvironment(2, 1, 'minor');
      expect(result.safetyLevel).toBe('safe');
      expect(result.recommendBountyHunting).toBe(true);
    });

    it('should return dangerous when no major guilds at war', () => {
      const result = assessBountyEnvironment(0, 0, 'minor');
      expect(result.safetyLevel).toBe('dangerous');
      expect(result.recommendBountyHunting).toBe(false);
    });

    it('should return moderate when 1 of 3 major guilds at war', () => {
      const result = assessBountyEnvironment(1, 1, 'minor');
      expect(result.safetyLevel).toBe('moderate');
    });

    it('should recommend bounty hunting for non-major guilds at moderate safety', () => {
      const result = assessBountyEnvironment(1, 1, 'minor');
      expect(result.recommendBountyHunting).toBe(true);
    });

    it('should not recommend bounty hunting for major guilds at moderate safety', () => {
      const result = assessBountyEnvironment(1, 1, 'major');
      expect(result.recommendBountyHunting).toBe(false);
    });

    it('should not recommend bounty hunting for anyone at dangerous level', () => {
      const result = assessBountyEnvironment(0, 0, 'independent');
      expect(result.recommendBountyHunting).toBe(false);
    });

    it('should recommend bounty hunting for all at safe level', () => {
      const major = assessBountyEnvironment(3, 3, 'major');
      expect(major.safetyLevel).toBe('safe');
      expect(major.recommendBountyHunting).toBe(true);
    });
  });

  describe('calculateBountyEfficiency', () => {
    it('should return better when bounty efficiency exceeds war by more than 5', () => {
      const reward = { landGained: 3000, structuresGained: 2000, turnsSaved: 100, totalValue: 5100 };
      const result = calculateBountyEfficiency(reward, 10, 100);
      // bountyEfficiency = 5100/10 = 510, warEfficiency = 100/10 = 10, advantage = 500
      expect(result.comparison).toBe('better');
      expect(result.advantage).toBeGreaterThan(5);
    });

    it('should return worse when war efficiency exceeds bounty by more than 5', () => {
      const reward = { landGained: 10, structuresGained: 5, turnsSaved: 5, totalValue: 20 };
      const result = calculateBountyEfficiency(reward, 10, 5000);
      // bountyEfficiency = 20/10 = 2, warEfficiency = 5000/10 = 500, advantage = -498
      expect(result.comparison).toBe('worse');
    });

    it('should return equal when efficiencies are within 5 points', () => {
      const reward = { landGained: 100, structuresGained: 50, turnsSaved: 50, totalValue: 200 };
      // bountyEfficiency = 200/100 = 2, warEfficiency = 2000/100 * ... need to tune
      const result = calculateBountyEfficiency(reward, 100, 200);
      // bountyEff = 200/100 = 2, warEff = 200/100 = 2, advantage = 0
      expect(result.comparison).toBe('equal');
    });

    it('should calculate efficiency as totalValue / turnsInvested', () => {
      const reward = { landGained: 3000, structuresGained: 2000, turnsSaved: 100, totalValue: 5100 };
      const result = calculateBountyEfficiency(reward, 50);
      expect(result.efficiency).toBe(5100 / 50);
    });

    it('should use default alternative war gains of 2000', () => {
      const reward = { landGained: 3000, structuresGained: 2000, turnsSaved: 100, totalValue: 5100 };
      const result = calculateBountyEfficiency(reward, 50);
      const resultExplicit = calculateBountyEfficiency(reward, 50, 2000);
      expect(result.advantage).toBe(resultExplicit.advantage);
    });
  });
});
