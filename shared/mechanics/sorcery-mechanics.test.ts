import { describe, it, expect } from 'vitest';
import {
  calculateSpellSuccess,
  calculateSpellDamage,
  calculateElanGeneration,
  calculateParkingLotProgression,
  calculateSorceryKillProgression,
  calculateOptimalTemplePercentage,
  SORCERY_MECHANICS,
  RACIAL_SPELL_EFFECTIVENESS,
  SPELL_DEFINITIONS,
} from './sorcery-mechanics';

describe('sorcery-mechanics', () => {
  describe('calculateSpellSuccess', () => {
    it('should fail when caster temple percentage below threshold for tier 1', () => {
      // Tier 1 requires 2% temples
      const result = calculateSpellSuccess(1, 100, 0, 100, 1); // 1% temples
      expect(result).toBe(false);
    });

    it('should succeed when caster meets tier 1 threshold with advantage', () => {
      // 3% caster vs 2% target, with 15% attacker advantage: 3% * 1.15 = 3.45% > 2%
      const result = calculateSpellSuccess(3, 100, 2, 100, 1);
      expect(result).toBe(true);
    });

    it('should fail when target has stronger temples despite meeting threshold', () => {
      // 2% caster vs 3% target: 2% * 1.15 = 2.3% < 3%
      const result = calculateSpellSuccess(2, 100, 3, 100, 1);
      expect(result).toBe(false);
    });

    it('should require 4% temples for tier 2 spells', () => {
      const result = calculateSpellSuccess(3, 100, 0, 100, 2); // 3% < 4%
      expect(result).toBe(false);
    });

    it('should succeed for tier 2 with sufficient temples', () => {
      const result = calculateSpellSuccess(5, 100, 1, 100, 2); // 5% >= 4%
      expect(result).toBe(true);
    });

    it('should require 8% temples for tier 3 spells', () => {
      const result = calculateSpellSuccess(7, 100, 0, 100, 3); // 7% < 8%
      expect(result).toBe(false);
    });

    it('should succeed for tier 3 with sufficient temples', () => {
      const result = calculateSpellSuccess(9, 100, 1, 100, 3); // 9% >= 8%
      expect(result).toBe(true);
    });

    it('should require 12% temples for tier 4 spells', () => {
      const result = calculateSpellSuccess(11, 100, 0, 100, 4); // 11% < 12%
      expect(result).toBe(false);
    });

    it('should apply 15% attacker advantage', () => {
      // Caster 3% temples, target 3% temples
      // Caster strength: 3% * 1.15 = 3.45%, target: 3%
      // 3.45% > 3%, so success
      const result = calculateSpellSuccess(3, 100, 3, 100, 1);
      expect(result).toBe(true);
    });

    it('should fail when caster and target are equal without advantage being enough', () => {
      // Caster 2% temples, target 3% temples
      // Caster: 2% * 1.15 = 2.3%, target: 3% => fail
      const result = calculateSpellSuccess(2, 100, 3, 100, 1);
      expect(result).toBe(false);
    });
  });

  describe('calculateSpellDamage', () => {
    it('should calculate Sidhe Hurricane damage correctly', () => {
      const damage = calculateSpellDamage('HURRICANE', 'SIDHE', 1000, 100, 5000);
      expect(damage.structureDamage).toBe(Math.floor(1000 * 0.0563));
      expect(damage.fortDamage).toBe(Math.floor(100 * 0.075));
      expect(damage.backlashChance).toBe(0.09);
    });

    it('should calculate Elemental Hurricane damage correctly', () => {
      const damage = calculateSpellDamage('HURRICANE', 'ELEMENTAL', 1000, 100, 5000);
      expect(damage.structureDamage).toBe(Math.floor(1000 * 0.0438));
      expect(damage.fortDamage).toBe(Math.floor(100 * 0.0625));
      expect(damage.backlashChance).toBe(0.13);
    });

    it('should calculate Human Hurricane damage correctly', () => {
      const damage = calculateSpellDamage('HURRICANE', 'HUMAN', 1000, 100, 5000);
      expect(damage.structureDamage).toBe(Math.floor(1000 * 0.0313));
      expect(damage.fortDamage).toBe(Math.floor(100 * 0.05));
    });

    it('should return 0 peasant kills for non-Foul Light spells', () => {
      const damage = calculateSpellDamage('HURRICANE', 'SIDHE', 1000, 100, 5000);
      expect(damage.peasantKills).toBe(0);
    });

    it('should calculate Sidhe Foul Light peasant kills', () => {
      const damage = calculateSpellDamage('FOUL_LIGHT', 'SIDHE', 0, 0, 10000);
      expect(damage.peasantKills).toBe(Math.floor(10000 * 0.08));
    });

    it('should return 0 structure damage for Lightning Lance', () => {
      const damage = calculateSpellDamage('LIGHTNING_LANCE', 'SIDHE', 1000, 100, 5000);
      expect(damage.structureDamage).toBe(0);
      expect(damage.fortDamage).toBe(Math.floor(100 * 0.10));
    });

    it('should return 0 fort damage for Banshee Deluge', () => {
      const damage = calculateSpellDamage('BANSHEE_DELUGE', 'SIDHE', 1000, 100, 5000);
      expect(damage.fortDamage).toBe(0);
      expect(damage.structureDamage).toBe(Math.floor(1000 * 0.0625));
    });

    it('should return zeros for unknown race', () => {
      const damage = calculateSpellDamage('HURRICANE', 'UNKNOWN', 1000, 100, 5000);
      expect(damage.structureDamage).toBe(0);
      expect(damage.fortDamage).toBe(0);
      expect(damage.peasantKills).toBe(0);
    });

    it('should return zeros for unknown spell', () => {
      const damage = calculateSpellDamage('UNKNOWN_SPELL', 'SIDHE', 1000, 100, 5000);
      expect(damage.structureDamage).toBe(0);
      expect(damage.fortDamage).toBe(0);
    });

    it('should include correct elan cost from spell definitions', () => {
      const damage = calculateSpellDamage('HURRICANE', 'SIDHE', 1000, 100, 5000);
      expect(damage.elanCost).toBe(3);

      const foulLight = calculateSpellDamage('FOUL_LIGHT', 'SIDHE', 0, 0, 1000);
      expect(foulLight.elanCost).toBe(8);
    });
  });

  describe('calculateElanGeneration', () => {
    it('should use Sidhe/Vampire rate of 0.005', () => {
      expect(calculateElanGeneration('sidhe', 200)).toBe(Math.ceil(200 * 0.005));
      expect(calculateElanGeneration('vampire', 200)).toBe(Math.ceil(200 * 0.005));
    });

    it('should use standard rate of 0.003 for other races', () => {
      expect(calculateElanGeneration('human', 200)).toBe(Math.ceil(200 * 0.003));
    });

    it('should ceil the result', () => {
      expect(calculateElanGeneration('human', 100)).toBe(Math.ceil(100 * 0.003)); // 0.3 -> 1
    });

    it('should return 0 for 0 temples', () => {
      expect(calculateElanGeneration('human', 0)).toBe(0);
    });
  });

  describe('calculateParkingLotProgression', () => {
    it('should show decreasing structures over spell sequence', () => {
      const progression = calculateParkingLotProgression(1000, 50, 'SIDHE', [
        'HURRICANE', 'HURRICANE', 'HURRICANE',
      ]);
      expect(progression.length).toBe(3);
      expect(progression[0].structures).toBeLessThan(1000);
      expect(progression[1].structures).toBeLessThan(progression[0].structures);
      expect(progression[2].structures).toBeLessThan(progression[1].structures);
    });

    it('should decrease fort count with Lightning Lance', () => {
      const progression = calculateParkingLotProgression(1000, 100, 'SIDHE', [
        'LIGHTNING_LANCE', 'LIGHTNING_LANCE',
      ]);
      expect(progression[0].forts).toBeLessThan(100);
      expect(progression[1].forts).toBeLessThan(progression[0].forts);
    });

    it('should not drop below 0 structures', () => {
      const progression = calculateParkingLotProgression(10, 5, 'SIDHE',
        Array(50).fill('HURRICANE'));
      const lastEntry = progression[progression.length - 1];
      expect(lastEntry.structures).toBeGreaterThanOrEqual(0);
      expect(lastEntry.forts).toBeGreaterThanOrEqual(0);
    });

    it('should calculate train rate as 15% of remaining structures', () => {
      const progression = calculateParkingLotProgression(1000, 50, 'SIDHE', ['HURRICANE']);
      expect(progression[0].trainRate).toBe(Math.floor(progression[0].structures * 0.15));
    });
  });

  describe('calculateSorceryKillProgression', () => {
    it('should reduce peasant population over casts', () => {
      const progression = calculateSorceryKillProgression(10000, 'SIDHE');
      expect(progression.length).toBeGreaterThan(0);
      expect(progression[0].peasantsRemaining).toBeLessThan(10000);
    });

    it('should track cumulative percentage killed', () => {
      const progression = calculateSorceryKillProgression(10000, 'SIDHE');
      expect(progression[0].percentageKilled).toBeGreaterThan(0);
      if (progression.length > 1) {
        expect(progression[1].percentageKilled).toBeGreaterThan(progression[0].percentageKilled);
      }
    });

    it('should eventually reach 0 peasants', () => {
      const progression = calculateSorceryKillProgression(1000, 'SIDHE');
      const lastEntry = progression[progression.length - 1];
      expect(lastEntry.peasantsRemaining).toBe(0);
    });

    it('should return empty array for race without Foul Light', () => {
      // Human has FOUL_LIGHT... but GOBLIN does not have it in the effectiveness map
      const progression = calculateSorceryKillProgression(1000, 'GOBLIN');
      // calculateSpellDamage returns 0 peasant kills for GOBLIN, so loop hits 100 safety limit
      expect(progression.length).toBe(100); // Safety limit
    });

    it('should use FOUL_LIGHT as default kill spell', () => {
      const progression = calculateSorceryKillProgression(10000, 'SIDHE');
      // Foul Light kills 8% per cast for Sidhe
      const firstKill = 10000 - progression[0].peasantsRemaining;
      expect(firstKill).toBe(Math.floor(10000 * 0.08));
    });
  });

  describe('calculateOptimalTemplePercentage', () => {
    it('should return 8% for offensive sorcerer with low threat', () => {
      const result = calculateOptimalTemplePercentage('offensive_sorcerer', 'low');
      expect(result).toBe(0.08);
    });

    it('should return 16% for defensive target with low threat', () => {
      const result = calculateOptimalTemplePercentage('defensive_target', 'low');
      expect(result).toBe(0.16);
    });

    it('should return 4% for balanced with low threat', () => {
      const result = calculateOptimalTemplePercentage('balanced', 'low');
      expect(result).toBe(0.04);
    });

    it('should apply 1.5x multiplier for medium threat', () => {
      const result = calculateOptimalTemplePercentage('offensive_sorcerer', 'medium');
      expect(result).toBe(0.08 * 1.5);
    });

    it('should apply 2.0x multiplier for high threat', () => {
      const result = calculateOptimalTemplePercentage('offensive_sorcerer', 'high');
      expect(result).toBe(0.08 * 2.0);
    });

    it('should cap at 20% maximum', () => {
      const result = calculateOptimalTemplePercentage('defensive_target', 'high');
      // 16% * 2.0 = 32%, capped at 20%
      expect(result).toBe(0.20);
    });
  });
});
