import { describe, it, expect } from 'vitest';
import {
  buildingGoldCostPerAcre,
  buildingGoldCost,
  kingdomBRT,
} from './building-cost';

describe('building-cost', () => {
  describe('buildingGoldCostPerAcre', () => {
    it('is ~309 gold/acre at 500 land', () => {
      expect(buildingGoldCostPerAcre(500)).toBe(309);
    });

    it('is ~319 gold/acre at 1100 land', () => {
      expect(buildingGoldCostPerAcre(1100)).toBe(319);
    });

    it('is ~326 gold/acre at 1500 land', () => {
      expect(buildingGoldCostPerAcre(1500)).toBe(326);
    });

    it('floors at the base cost for 0 (and negative) land', () => {
      expect(buildingGoldCostPerAcre(0)).toBe(300);
      expect(buildingGoldCostPerAcre(-100)).toBe(300);
    });

    it('rises monotonically with land', () => {
      expect(buildingGoldCostPerAcre(1500)).toBeGreaterThan(buildingGoldCostPerAcre(500));
    });
  });

  describe('buildingGoldCost', () => {
    it('multiplies per-acre cost by quantity', () => {
      expect(buildingGoldCost(10, 500)).toBe(10 * 309);
      expect(buildingGoldCost(3, 1500)).toBe(3 * 326);
    });

    it('clamps negative quantity to 0', () => {
      expect(buildingGoldCost(-5, 1000)).toBe(0);
    });
  });

  describe('kingdomBRT', () => {
    it('returns base BRT 4 with no quarries', () => {
      expect(kingdomBRT({ mine: 0 }, 1000)).toBe(4);
    });

    it('maps 50% quarry coverage to BRT 21', () => {
      expect(kingdomBRT({ mine: 500 }, 1000)).toBe(21);
    });

    it('returns base BRT 4 when land is 0', () => {
      expect(kingdomBRT({ mine: 10 }, 0)).toBe(4);
    });

    it('treats a missing mine count as 0 quarries', () => {
      expect(kingdomBRT({}, 1000)).toBe(4);
    });
  });
});
