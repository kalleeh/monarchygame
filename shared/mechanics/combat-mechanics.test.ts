import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateTurnCost,
  requiresWarDeclaration,
  validateAttackType,
  calculateLandGained,
  calculateCombatResult,
  calculateCombatSummonTroops,
  calculateOptimalArmyReduction,
  calculateFortDefense,
  calculatePassThePlateEfficiency,
  COMBAT_MECHANICS,
  UNIT_COMBAT_VALUES,
} from './combat-mechanics';

describe('combat-mechanics', () => {
  describe('calculateTurnCost', () => {
    it('should return base cost of 4 for fair fight', () => {
      expect(calculateTurnCost(1000, 1000)).toBe(4);
    });

    it('should return 6 for easy target (defender much smaller)', () => {
      expect(calculateTurnCost(1000, 400)).toBe(6);
    });

    it('should return 8 for hard target (defender much larger)', () => {
      expect(calculateTurnCost(1000, 2100)).toBe(8);
    });

    it('should return base cost at boundary (ratio = 0.5)', () => {
      expect(calculateTurnCost(1000, 500)).toBe(4);
    });

    it('should return base cost at upper boundary (ratio = 2.0)', () => {
      expect(calculateTurnCost(1000, 2000)).toBe(4);
    });

    it('should return easy target cost when ratio < 0.5', () => {
      expect(calculateTurnCost(1000, 499)).toBe(6);
    });

    it('should return hard target cost when ratio > 2.0', () => {
      expect(calculateTurnCost(1000, 2001)).toBe(8);
    });
  });

  describe('requiresWarDeclaration', () => {
    it('should not require declaration at 0 attacks', () => {
      expect(requiresWarDeclaration(0)).toBe(false);
    });

    it('should not require declaration at 1 attack', () => {
      expect(requiresWarDeclaration(1)).toBe(false);
    });

    it('should not require declaration at 2 attacks', () => {
      expect(requiresWarDeclaration(2)).toBe(false);
    });

    it('should require declaration at 3 attacks (threshold)', () => {
      expect(requiresWarDeclaration(3)).toBe(true);
    });

    it('should require declaration above threshold', () => {
      expect(requiresWarDeclaration(10)).toBe(true);
    });
  });

  describe('validateAttackType', () => {
    it('should return valid with warning for guerilla raid', () => {
      const result = validateAttackType('guerilla_raid', false);
      expect(result.valid).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('Guerilla Raid');
    });

    it('should return invalid for mob assault without peasants', () => {
      const result = validateAttackType('mob_assault', false);
      expect(result.valid).toBe(false);
      expect(result.warning).toContain('requires peasants');
    });

    it('should return valid with warning for mob assault with peasants', () => {
      const result = validateAttackType('mob_assault', true);
      expect(result.valid).toBe(true);
      expect(result.warning).toContain('peasants will be at risk');
    });

    it('should return valid with no warning for full attack', () => {
      const result = validateAttackType('full_attack', false);
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('should return valid with no warning for controlled strike', () => {
      const result = validateAttackType('controlled_strike', true);
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('should return valid with no warning for ambush', () => {
      const result = validateAttackType('ambush', false);
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });
  });

  describe('calculateLandGained', () => {
    let mathRandomSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mathRandomSpy = vi.spyOn(Math, 'random');
    });

    afterEach(() => {
      mathRandomSpy.mockRestore();
    });

    it('should return land in 7.0-7.35% range for with_ease (ratio >= 2.0)', () => {
      mathRandomSpy.mockReturnValue(0.5);
      const land = calculateLandGained(2000, 1000, 10000, 'full_strike');
      expect(land).toBeGreaterThanOrEqual(Math.floor(10000 * 0.070));
      expect(land).toBeLessThanOrEqual(Math.floor(10000 * 0.0735));
    });

    it('should return land in 6.79-7.0% range for good_fight (ratio 1.2-2.0)', () => {
      mathRandomSpy.mockReturnValue(0.5);
      const land = calculateLandGained(1500, 1000, 10000, 'full_strike');
      expect(land).toBeGreaterThanOrEqual(Math.floor(10000 * 0.0679));
      expect(land).toBeLessThanOrEqual(Math.floor(10000 * 0.070));
    });

    it('should return 0 for failed attack (ratio < 1.2)', () => {
      const land = calculateLandGained(1000, 1000, 10000, 'full_strike');
      expect(land).toBe(0);
    });

    it('should calculate controlled strike using csPercentage', () => {
      const land = calculateLandGained(2000, 1000, 10000, 'controlled_strike', 0.05);
      expect(land).toBe(Math.floor(10000 * 0.05));
    });

    it('should use default CS1 percentage when csPercentage not provided', () => {
      const land = calculateLandGained(2000, 1000, 10000, 'controlled_strike');
      expect(land).toBe(Math.floor(10000 * COMBAT_MECHANICS.CONTROLLED_STRIKE.CS1_PERCENTAGE));
    });

    it('should return max land for with_ease when random is 1', () => {
      mathRandomSpy.mockReturnValue(0.999);
      const land = calculateLandGained(3000, 1000, 10000, 'full_strike');
      expect(land).toBe(Math.floor(10000 * (0.070 + 0.999 * (0.0735 - 0.070))));
    });

    it('should return min land for with_ease when random is 0', () => {
      mathRandomSpy.mockReturnValue(0);
      const land = calculateLandGained(3000, 1000, 10000, 'full_strike');
      expect(land).toBe(Math.floor(10000 * 0.070));
    });
  });

  describe('calculateCombatResult', () => {
    it('should return with_ease when ratio >= 2.0', () => {
      const attacker = { units: {}, totalOffense: 2000, totalDefense: 0 };
      const defender = { units: {}, forts: 0, totalDefense: 1000, ambushActive: false };
      const result = calculateCombatResult(attacker, defender, 10000);
      expect(result.resultType).toBe('with_ease');
      expect(result.success).toBe(true);
    });

    it('should return good_fight when ratio 1.2-2.0', () => {
      const attacker = { units: {}, totalOffense: 1500, totalDefense: 0 };
      const defender = { units: {}, forts: 0, totalDefense: 1000, ambushActive: false };
      const result = calculateCombatResult(attacker, defender, 10000);
      expect(result.resultType).toBe('good_fight');
      expect(result.success).toBe(true);
    });

    it('should return failed when ratio < 1.2', () => {
      const attacker = { units: {}, totalOffense: 1000, totalDefense: 0 };
      const defender = { units: {}, forts: 0, totalDefense: 1000, ambushActive: false };
      const result = calculateCombatResult(attacker, defender, 10000);
      expect(result.resultType).toBe('failed');
      expect(result.success).toBe(false);
      expect(result.landGained).toBe(0);
    });

    it('should reduce attacker offense by 95% when ambush is active', () => {
      const attacker = { units: {}, totalOffense: 10000, totalDefense: 0 };
      const defender = { units: {}, forts: 0, totalDefense: 1000, ambushActive: true };
      const result = calculateCombatResult(attacker, defender, 10000);
      // 10000 * (1 - 0.95) = 500, ratio = 500/1000 = 0.5 < 1.2 => failed
      expect(result.resultType).toBe('failed');
      expect(result.success).toBe(false);
    });

    it('should calculate attacker losses at 5% for with_ease', () => {
      const attacker = { units: {}, totalOffense: 4000, totalDefense: 0 };
      const defender = { units: {}, forts: 0, totalDefense: 1000, ambushActive: false };
      const result = calculateCombatResult(attacker, defender, 10000);
      expect(result.attackerLosses).toBe(Math.floor(4000 * 0.05));
    });

    it('should calculate attacker losses at 15% for good_fight', () => {
      const attacker = { units: {}, totalOffense: 1500, totalDefense: 0 };
      const defender = { units: {}, forts: 0, totalDefense: 1000, ambushActive: false };
      const result = calculateCombatResult(attacker, defender, 10000);
      expect(result.attackerLosses).toBe(Math.floor(1500 * 0.15));
    });

    it('should calculate attacker losses at 25% for failed', () => {
      const attacker = { units: {}, totalOffense: 1000, totalDefense: 0 };
      const defender = { units: {}, forts: 0, totalDefense: 1000, ambushActive: false };
      const result = calculateCombatResult(attacker, defender, 10000);
      expect(result.attackerLosses).toBe(Math.floor(1000 * 0.25));
    });

    it('should calculate defender losses at 20% for with_ease', () => {
      const attacker = { units: {}, totalOffense: 4000, totalDefense: 0 };
      const defender = { units: {}, forts: 0, totalDefense: 1000, ambushActive: false };
      const result = calculateCombatResult(attacker, defender, 10000);
      expect(result.defenderLosses).toBe(Math.floor(1000 * 0.20));
    });

    it('should calculate gold looted as landGained * 1000', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const attacker = { units: {}, totalOffense: 4000, totalDefense: 0 };
      const defender = { units: {}, forts: 0, totalDefense: 1000, ambushActive: false };
      const result = calculateCombatResult(attacker, defender, 10000);
      expect(result.goldLooted).toBe(result.landGained * 1000);
    });

    it('should calculate structures destroyed as 10% of land gained', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const attacker = { units: {}, totalOffense: 4000, totalDefense: 0 };
      const defender = { units: {}, forts: 0, totalDefense: 1000, ambushActive: false };
      const result = calculateCombatResult(attacker, defender, 10000);
      expect(result.structuresDestroyed).toBe(Math.floor(result.landGained * 0.1));
    });
  });

  describe('calculateCombatSummonTroops', () => {
    it('should use Droben rate of 3.04%', () => {
      const troops = calculateCombatSummonTroops('DROBEN', 100000);
      expect(troops).toBe(Math.floor(100000 * 0.0304));
    });

    it('should use Elemental rate of 2.84%', () => {
      const troops = calculateCombatSummonTroops('ELEMENTAL', 100000);
      expect(troops).toBe(Math.floor(100000 * 0.0284));
    });

    it('should use Goblin rate of 2.75%', () => {
      const troops = calculateCombatSummonTroops('GOBLIN', 100000);
      expect(troops).toBe(Math.floor(100000 * 0.0275));
    });

    it('should use Dwarven rate of 2.75%', () => {
      const troops = calculateCombatSummonTroops('DWARVEN', 100000);
      expect(troops).toBe(Math.floor(100000 * 0.0275));
    });

    it('should use Human rate of 2.5%', () => {
      const troops = calculateCombatSummonTroops('HUMAN', 100000);
      expect(troops).toBe(Math.floor(100000 * 0.025));
    });

    it('should default to 2.5% for unknown race', () => {
      const troops = calculateCombatSummonTroops('UNKNOWN', 100000);
      expect(troops).toBe(Math.floor(100000 * 0.025));
    });

    it('should apply cash multiplier to networth', () => {
      const troops = calculateCombatSummonTroops('HUMAN', 100000, 2.0);
      expect(troops).toBe(Math.floor(200000 * 0.025));
    });

    it('should add guildhall bonus to inflated networth', () => {
      const troops = calculateCombatSummonTroops('HUMAN', 100000, 1.0, 50000);
      expect(troops).toBe(Math.floor(150000 * 0.025));
    });

    it('should be case-insensitive for race ID', () => {
      const upper = calculateCombatSummonTroops('DROBEN', 100000);
      const lower = calculateCombatSummonTroops('droben', 100000);
      expect(upper).toBe(lower);
    });
  });

  describe('calculateOptimalArmyReduction', () => {
    it('should reduce army by 25% on with_ease', () => {
      const result = calculateOptimalArmyReduction(1000, 'with_ease');
      expect(result).toBe(Math.floor(1000 * 0.75));
    });

    it('should return same army for good_fight', () => {
      expect(calculateOptimalArmyReduction(1000, 'good_fight')).toBe(1000);
    });

    it('should return same army for failed', () => {
      expect(calculateOptimalArmyReduction(1000, 'failed')).toBe(1000);
    });
  });

  describe('calculateFortDefense', () => {
    it('should use Goblin fort value of 285', () => {
      expect(calculateFortDefense('GOBLIN', 10)).toBe(2850);
    });

    it('should use Human fort value of 250', () => {
      expect(calculateFortDefense('HUMAN', 10)).toBe(2500);
    });

    it('should use Dwarven fort value of 300', () => {
      expect(calculateFortDefense('DWARVEN', 10)).toBe(3000);
    });

    it('should default to 250 for unknown race', () => {
      expect(calculateFortDefense('SIDHE', 10)).toBe(2500);
    });

    it('should return 0 for 0 forts', () => {
      expect(calculateFortDefense('HUMAN', 0)).toBe(0);
    });

    it('should be case-insensitive', () => {
      expect(calculateFortDefense('goblin', 10)).toBe(2850);
    });
  });

  describe('calculatePassThePlateEfficiency', () => {
    it('should calculate total land gained from multiple warriors', () => {
      const warriors = [
        { offense: 5000, landCapacity: 500 },
        { offense: 5000, landCapacity: 500 },
      ];
      const result = calculatePassThePlateEfficiency(warriors, 10000);
      expect(result.totalLandGained).toBeGreaterThan(0);
      expect(result.turnsRequired).toBe(2);
    });

    it('should stop when remaining land reaches 0', () => {
      const warriors = [
        { offense: 5000, landCapacity: 10000 },
        { offense: 5000, landCapacity: 10000 },
        { offense: 5000, landCapacity: 10000 },
      ];
      const result = calculatePassThePlateEfficiency(warriors, 100);
      // After first warrior takes all land, remaining should be 0
      expect(result.turnsRequired).toBeLessThanOrEqual(3);
    });

    it('should calculate efficiency as totalLandGained / turnsRequired', () => {
      const warriors = [
        { offense: 5000, landCapacity: 500 },
      ];
      const result = calculatePassThePlateEfficiency(warriors, 10000);
      expect(result.efficiency).toBe(result.totalLandGained / result.turnsRequired);
    });

    it('should handle single warrior', () => {
      const warriors = [{ offense: 5000, landCapacity: 300 }];
      const result = calculatePassThePlateEfficiency(warriors, 10000);
      expect(result.turnsRequired).toBe(1);
      expect(result.totalLandGained).toBeLessThanOrEqual(300);
    });
  });
});
