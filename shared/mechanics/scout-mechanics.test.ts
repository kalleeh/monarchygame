import { describe, it, expect } from 'vitest';
import {
  RACE_SCUM_RATING,
  scumRatingForRace,
  scoutIntelExpiryMs,
  scoutIntelDetail,
  coarsenSnapshot,
  bandNumber,
  type DefenderSnapshot,
} from './scout-mechanics';

const HOUR_MS = 60 * 60 * 1000;

// A defensive tier map matching how the snapshot army is built: peasants=0,
// militia=1, knights=2, cavalry=3.
const tierOf = (t: string): number =>
  ({ peasants: 0, militia: 1, knights: 2, cavalry: 3 } as Record<string, number>)[t] ?? 0;

describe('scout-mechanics', () => {
  describe('scumRatingForRace', () => {
    it('returns the canonical rating per race', () => {
      expect(scumRatingForRace('Centaur')).toBe(5);
      expect(scumRatingForRace('Human')).toBe(4);
      expect(scumRatingForRace('Vampire')).toBe(4);
      expect(scumRatingForRace('Sidhe')).toBe(4);
      expect(scumRatingForRace('Elven')).toBe(3);
      expect(scumRatingForRace('Goblin')).toBe(2);
      expect(scumRatingForRace('Dwarven')).toBe(2);
    });

    it('falls back to a mid-tier rating for unknown/missing race', () => {
      expect(scumRatingForRace('Orc')).toBe(3);
      expect(scumRatingForRace(undefined)).toBe(3);
      expect(scumRatingForRace(null)).toBe(3);
      expect(scumRatingForRace('')).toBe(3);
    });

    it('mirrors the canonical 1-5 race scum table', () => {
      expect(RACE_SCUM_RATING.Centaur).toBe(5);
      for (const v of Object.values(RACE_SCUM_RATING)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('scoutIntelExpiryMs', () => {
    it('maps scum tiers to the documented windows (12h → 48h)', () => {
      expect(scoutIntelExpiryMs(1)).toBe(12 * HOUR_MS);
      expect(scoutIntelExpiryMs(2)).toBe(21 * HOUR_MS);
      expect(scoutIntelExpiryMs(3)).toBe(30 * HOUR_MS);
      expect(scoutIntelExpiryMs(4)).toBe(39 * HOUR_MS);
      expect(scoutIntelExpiryMs(5)).toBe(48 * HOUR_MS);
    });

    it('is strictly monotonic in scum', () => {
      for (let s = 1; s < 5; s++) {
        expect(scoutIntelExpiryMs(s + 1)).toBeGreaterThan(scoutIntelExpiryMs(s));
      }
    });

    it('clamps out-of-range scum to the [1,5] boundary windows', () => {
      expect(scoutIntelExpiryMs(0)).toBe(scoutIntelExpiryMs(1));
      expect(scoutIntelExpiryMs(-3)).toBe(scoutIntelExpiryMs(1));
      expect(scoutIntelExpiryMs(9)).toBe(scoutIntelExpiryMs(5));
    });
  });

  describe('scoutIntelDetail', () => {
    it('reveals full intel only at scum >= 4', () => {
      expect(scoutIntelDetail(5)).toBe('full');
      expect(scoutIntelDetail(4)).toBe('full');
      expect(scoutIntelDetail(3)).toBe('coarse');
      expect(scoutIntelDetail(2)).toBe('coarse');
      expect(scoutIntelDetail(1)).toBe('coarse');
    });

    it('puts the 4/5-scum races in the full tier', () => {
      for (const race of ['Centaur', 'Human', 'Vampire', 'Sidhe']) {
        expect(scoutIntelDetail(scumRatingForRace(race))).toBe('full');
      }
      for (const race of ['Elven', 'Goblin', 'Dwarven']) {
        expect(scoutIntelDetail(scumRatingForRace(race))).toBe('coarse');
      }
    });
  });

  describe('bandNumber', () => {
    it('bands by magnitude and never returns the exact value', () => {
      expect(bandNumber(0)).toBe(0);
      expect(bandNumber(-50)).toBe(0);
      expect(bandNumber(3400)).toBe(3000);   // nearest 1k under 10k
      expect(bandNumber(32500)).toBe(35000); // nearest 5k under 100k (round-half-up)
      expect(bandNumber(247000)).toBe(250000); // nearest 10k above 100k
    });
  });

  describe('coarsenSnapshot', () => {
    const base: DefenderSnapshot = {
      detail: 'full',
      totalDefense: 32450,
      armyByTier: { knights: 1000, cavalry: 503, militia: 240, peasants: 50 },
      fortLevel: 3,
      land: 1830,
      goldEstimate: 247000,
      defenderName: 'Targetania',
    };

    it('returns full intel unchanged (precise values preserved)', () => {
      const out = coarsenSnapshot(base, 'full', tierOf);
      expect(out.detail).toBe('full');
      expect(out.totalDefense).toBe(32450);
      expect(out.fortLevel).toBe(3);
      expect(out.goldEstimate).toBe(247000);
      expect(out.armyByTier).toEqual(base.armyByTier);
    });

    it('bands numbers and buckets the army for coarse intel, preserving the shape', () => {
      const out = coarsenSnapshot(base, 'coarse', tierOf);

      // Same field set / TS shape so existing readers don't break.
      expect(Object.keys(out).sort()).toEqual(Object.keys(base).sort());
      expect(out.detail).toBe('coarse');
      expect(typeof out.totalDefense).toBe('number');
      expect(typeof out.armyByTier).toBe('object');
      expect(out.defenderName).toBe('Targetania');

      // Numbers are banded (less precise), not exact.
      expect(out.totalDefense).toBe(30000);
      expect(out.totalDefense).not.toBe(base.totalDefense);
      expect(out.goldEstimate).toBe(250000);
      expect(out.land).toBe(2000);

      // Fort level hidden at coarse detail.
      expect(out.fortLevel).toBe(-1);

      // Army re-keyed into coarse buckets, exact unit types hidden.
      expect(out.armyByTier.knights).toBeUndefined();
      expect(out.armyByTier.heavy).toBe(bandNumber(1000));  // knights (tier 2)
      expect(out.armyByTier.elite).toBe(bandNumber(503));   // cavalry (tier 3)
      expect(out.armyByTier.medium).toBe(bandNumber(240));  // militia (tier 1)
      expect(out.armyByTier.light).toBe(bandNumber(50));    // peasants (tier 0)
    });

    it('does not mutate the input snapshot', () => {
      const snapshotCopy = JSON.parse(JSON.stringify(base));
      coarsenSnapshot(base, 'coarse', tierOf);
      expect(base).toEqual(snapshotCopy);
    });
  });
});
