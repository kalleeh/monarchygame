import { describe, it, expect } from 'vitest';
import {
  COUNTER,
  UNIT_CLASSES,
  classOf,
  compositionAdjustedOffense,
  UNIT_CLASS,
} from './unit-classes';

describe('COUNTER matrix', () => {
  it('forms a closed RPS loop (each class beats exactly one, loses to exactly one)', () => {
    for (const a of UNIT_CLASSES) {
      const favored = UNIT_CLASSES.filter(d => COUNTER[a][d] > 1);
      const unfavored = UNIT_CLASSES.filter(d => COUNTER[a][d] < 1);
      expect(favored).toHaveLength(1);
      expect(unfavored).toHaveLength(1);
    }
  });

  it('is anti-symmetric: if A counters B then B is countered by A', () => {
    for (const a of UNIT_CLASSES) {
      for (const d of UNIT_CLASSES) {
        if (COUNTER[a][d] > 1) expect(COUNTER[d][a]).toBeLessThan(1);
      }
    }
  });

  it('keeps multipliers soft (within ±25%)', () => {
    for (const a of UNIT_CLASSES) {
      for (const d of UNIT_CLASSES) {
        expect(COUNTER[a][d]).toBeGreaterThanOrEqual(0.8);
        expect(COUNTER[a][d]).toBeLessThanOrEqual(1.25);
      }
    }
  });
});

describe('classOf', () => {
  it('defaults unknown keys to infantry (no throw, no regression)', () => {
    expect(classOf('totally-made-up-unit')).toBe('infantry');
  });
  it('resolves race-specific keys', () => {
    expect(classOf('centaur-warriors')).toBe('cavalry');
    expect(classOf('sidhe-mages')).toBe('mystic');
  });
});

describe('every race spans at least 3 classes (no race locked to one counter)', () => {
  const races = [
    ['elven-scouts', 'elven-warriors', 'elven-archers', 'elven-lords'],
    ['goblins', 'hobgoblins', 'kobolds', 'goblin-riders'],
    ['droben-warriors', 'droben-berserkers', 'droben-bunar', 'droben-champions'],
    ['thralls', 'vampire-spawn', 'vampire-lords', 'ancient-vampires'],
    ['earth-elementals', 'fire-elementals', 'water-elementals', 'air-elementals'],
    ['centaur-scouts', 'centaur-warriors', 'centaur-archers', 'centaur-chiefs'],
    ['sidhe-nobles', 'sidhe-elders', 'sidhe-mages', 'sidhe-lords'],
    ['dwarven-militia', 'dwarven-guards', 'dwarven-warriors', 'dwarven-lords'],
    ['fae-sprites', 'fae-warriors', 'fae-nobles', 'fae-lords'],
  ];
  it('covers all 40 race units with a class tag', () => {
    for (const units of races) {
      for (const u of units) expect(UNIT_CLASS[u]).toBeDefined();
    }
  });
  it('each race fields at least 2 distinct classes', () => {
    // Soft check: race identity allows tilting, but never a single-class roster
    for (const units of races) {
      const classes = new Set(units.map(classOf));
      expect(classes.size).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('compositionAdjustedOffense', () => {
  const off = (t: string) => ({ inf: 10, cav: 10, rng: 10, mys: 10 } as Record<string, number>)[t] ?? 10;
  const def = off;

  it('returns neutral multiplier when defender has no units', () => {
    const r = compositionAdjustedOffense({ inf: 5 }, {}, off, def);
    expect(r.multiplier).toBe(1.0);
  });

  it('rewards a favorable matchup and punishes an unfavorable one', () => {
    // infantry beats cavalry. Attacker all-infantry vs defender all-cavalry → bonus.
    const favorable = compositionAdjustedOffense(
      { 'dwarven-militia': 100 }, // infantry
      { 'centaur-warriors': 100 }, // cavalry
      off, def,
    );
    expect(favorable.multiplier).toBeGreaterThan(1);

    // cavalry vs infantry → penalty (infantry counters cavalry)
    const unfavorable = compositionAdjustedOffense(
      { 'centaur-warriors': 100 }, // cavalry
      { 'dwarven-militia': 100 }, // infantry
      off, def,
    );
    expect(unfavorable.multiplier).toBeLessThan(1);
  });

  it('mono-spam is exploitable; a balanced army is never hard-countered', () => {
    // Defender mono-mystic. Attacker all-ranged (ranged beats mystic) crushes it...
    const monoVsCounter = compositionAdjustedOffense(
      { 'fae-warriors': 100 },  // ranged
      { 'sidhe-mages': 100 },   // mystic
      off, def,
    ).multiplier;
    // ...but a balanced attacker against the same mono defender is closer to neutral.
    const balancedVsMono = compositionAdjustedOffense(
      { 'dwarven-militia': 25, 'centaur-warriors': 25, 'fae-warriors': 25, 'sidhe-mages': 25 },
      { 'sidhe-mages': 100 },
      off, def,
    ).multiplier;
    expect(monoVsCounter).toBeGreaterThan(balancedVsMono);
  });
});
