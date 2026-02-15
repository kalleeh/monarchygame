import { describe, it, expect } from 'vitest';
import {
  calculateBRT,
  calculateBuildTurns,
  getBuildEfficiencyWarning,
  getBuildingName,
  BRT_TABLE,
  RACE_BUILDING_NAMES,
} from './building-mechanics';

describe('building-mechanics', () => {
  describe('calculateBRT', () => {
    it('should return 4 for 0% quarries', () => {
      expect(calculateBRT(0)).toBe(4);
    });

    it('should return 4 for 4.999% quarries', () => {
      expect(calculateBRT(4.999)).toBe(4);
    });

    it('should return 6 for 5% quarries', () => {
      expect(calculateBRT(5)).toBe(6);
    });

    it('should return 6 for 9.999% quarries', () => {
      expect(calculateBRT(9.999)).toBe(6);
    });

    it('should return 8 for 10% quarries', () => {
      expect(calculateBRT(10)).toBe(8);
    });

    it('should return 10 for 15% quarries', () => {
      expect(calculateBRT(15)).toBe(10);
    });

    it('should return 12 for 20% quarries', () => {
      expect(calculateBRT(20)).toBe(12);
    });

    it('should return 14 for 25% quarries', () => {
      expect(calculateBRT(25)).toBe(14);
    });

    it('should return 16 for 30% quarries', () => {
      expect(calculateBRT(30)).toBe(16);
    });

    it('should return 18 for 35% quarries', () => {
      expect(calculateBRT(35)).toBe(18);
    });

    it('should return 19 for 40% quarries', () => {
      expect(calculateBRT(40)).toBe(19);
    });

    it('should return 20 for 45% quarries', () => {
      expect(calculateBRT(45)).toBe(20);
    });

    it('should return 21 for 50% quarries', () => {
      expect(calculateBRT(50)).toBe(21);
    });

    it('should return 22 for 55% quarries', () => {
      expect(calculateBRT(55)).toBe(22);
    });

    it('should return 23 for 60% quarries', () => {
      expect(calculateBRT(60)).toBe(23);
    });

    it('should return 24 for 65% quarries', () => {
      expect(calculateBRT(65)).toBe(24);
    });

    it('should return 25 for 70% quarries', () => {
      expect(calculateBRT(70)).toBe(25);
    });

    it('should return 26 for 75% quarries', () => {
      expect(calculateBRT(75)).toBe(26);
    });

    it('should return 27 for 80% quarries', () => {
      expect(calculateBRT(80)).toBe(27);
    });

    it('should return 28 for 85% quarries', () => {
      expect(calculateBRT(85)).toBe(28);
    });

    it('should return 29 for 90% quarries', () => {
      expect(calculateBRT(90)).toBe(29);
    });

    it('should return 30 for 95% quarries', () => {
      expect(calculateBRT(95)).toBe(30);
    });

    it('should return 31 for 100% quarries (impossible)', () => {
      expect(calculateBRT(100)).toBe(31);
    });
  });

  describe('calculateBuildTurns', () => {
    it('should return 1 turn when building count equals BRT', () => {
      expect(calculateBuildTurns(10, 10)).toBe(1);
    });

    it('should return 1 turn when building count is less than BRT', () => {
      expect(calculateBuildTurns(5, 10)).toBe(1);
    });

    it('should ceil to 2 turns when building slightly more than BRT', () => {
      expect(calculateBuildTurns(11, 10)).toBe(2);
    });

    it('should return correct turns for large building counts', () => {
      expect(calculateBuildTurns(100, 10)).toBe(10);
    });

    it('should handle building count of 1', () => {
      expect(calculateBuildTurns(1, 4)).toBe(1);
    });

    it('should handle exact multiples', () => {
      expect(calculateBuildTurns(20, 10)).toBe(2);
    });
  });

  describe('getBuildEfficiencyWarning', () => {
    it('should return warning when wasting build potential', () => {
      // BRT 10, building 11 -> 2 turns, could build 20, wasted 9
      const warning = getBuildEfficiencyWarning(11, 10);
      expect(warning).not.toBeNull();
      expect(warning).toContain('could build');
    });

    it('should return null when perfectly efficient (exact multiple)', () => {
      const warning = getBuildEfficiencyWarning(10, 10);
      expect(warning).toBeNull();
    });

    it('should return null when perfectly efficient (exact multiple of 2)', () => {
      const warning = getBuildEfficiencyWarning(20, 10);
      expect(warning).toBeNull();
    });

    it('should return warning with correct wasted potential count', () => {
      // BRT 10, building 15 -> 2 turns, could build 20, wasted 5
      const warning = getBuildEfficiencyWarning(15, 10);
      expect(warning).toContain('5 more structures');
    });

    it('should handle single building with high BRT', () => {
      // BRT 20, building 1 -> 1 turn, could build 20, wasted 19
      const warning = getBuildEfficiencyWarning(1, 20);
      expect(warning).toContain('19 more structures');
    });
  });

  describe('getBuildingName', () => {
    it('should return Human building names', () => {
      expect(getBuildingName('HUMAN', 'income')).toBe('Guildhalls');
      expect(getBuildingName('HUMAN', 'peasant')).toBe('Hovels');
      expect(getBuildingName('HUMAN', 'troop')).toBe('Barracks');
      expect(getBuildingName('HUMAN', 'buildrate')).toBe('Quarries');
      expect(getBuildingName('HUMAN', 'magic')).toBe('Temples');
      expect(getBuildingName('HUMAN', 'fortress')).toBe('Fortresses');
    });

    it('should return Goblin building names', () => {
      expect(getBuildingName('GOBLIN', 'income')).toBe('Smithies');
      expect(getBuildingName('GOBLIN', 'troop')).toBe('Barrak');
      expect(getBuildingName('GOBLIN', 'buildrate')).toBe('Mines');
    });

    it('should return Droben building names', () => {
      expect(getBuildingName('DROBEN', 'income')).toBe('TimoTon');
      expect(getBuildingName('DROBEN', 'peasant')).toBe('Baklavs');
    });

    it('should return Vampire building names', () => {
      expect(getBuildingName('VAMPIRE', 'buildrate')).toBe('Bloodbaths');
      expect(getBuildingName('VAMPIRE', 'magic')).toBe('Focus Points');
    });

    it('should return Sidhe building names', () => {
      expect(getBuildingName('SIDHE', 'magic')).toBe('Magick Circles');
      expect(getBuildingName('SIDHE', 'fortress')).toBe('Spires');
    });

    it('should return Dwarven building names', () => {
      expect(getBuildingName('DWARVEN', 'income')).toBe('Gem Mines');
      expect(getBuildingName('DWARVEN', 'fortress')).toBe('Strongholds');
    });

    it('should be case-insensitive for race name', () => {
      expect(getBuildingName('human', 'income')).toBe('Guildhalls');
    });

    it('should return buildingType as fallback for unknown race', () => {
      expect(getBuildingName('UNKNOWN', 'income')).toBe('income');
    });

    it('should return buildingType as fallback for unknown building type', () => {
      expect(getBuildingName('HUMAN', 'nonexistent')).toBe('nonexistent');
    });

    it('should return Elven building names', () => {
      expect(getBuildingName('ELVEN', 'income')).toBe('Markets');
      expect(getBuildingName('ELVEN', 'magic')).toBe('Groves');
    });

    it('should return Elemental building names', () => {
      expect(getBuildingName('ELEMENTAL', 'peasant')).toBe('Charging Cells');
      expect(getBuildingName('ELEMENTAL', 'magic')).toBe('Casting Pits');
    });

    it('should return FAE building names', () => {
      expect(getBuildingName('FAE', 'fortress')).toBe('Ringforts');
      expect(getBuildingName('FAE', 'buildrate')).toBe('Wishing Wells');
    });

    it('should return Centaur building names', () => {
      expect(getBuildingName('CENTAUR', 'income')).toBe('Trinket Shops');
      expect(getBuildingName('CENTAUR', 'troop')).toBe('Thickets');
    });
  });
});
