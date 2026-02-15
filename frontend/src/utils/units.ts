/**
 * Unit utilities for Monarchy Game
 * Provides race-specific unit types derived from shared-races data
 */

import { RACES } from '../shared-races';

/** @deprecated Use UnitType instead — kept for backward compatibility */
export interface LegacyUnitType {
  name: string;
  cost: number;
  offense: number;
  defense: number;
}

export interface UnitType {
  id: string;
  name: string;
  description: string;
  tier: number;
  stats: {
    cost: {
      gold: number;
      population: number;
    };
    offense: number;
    defense: number;
    hitPoints: number;
    upkeep: number;
  };
}

// ── Tier templates ────────────────────────────────────────────────
// Base stats per tier (before race scaling).  Tiers 1-3 are military;
// tier 0 is the peasant / population unit every race gets.

interface TierTemplate {
  tier: number;
  baseGold: number;
  basePop: number;
  baseOffense: number;
  baseDefense: number;
  baseHitPoints: number;
  baseUpkeep: number;
}

const TIER_TEMPLATES: TierTemplate[] = [
  { tier: 0, baseGold: 50,   basePop: 1, baseOffense: 1,  baseDefense: 1,  baseHitPoints: 5,  baseUpkeep: 0  },
  { tier: 1, baseGold: 350,  basePop: 1, baseOffense: 3,  baseDefense: 2,  baseHitPoints: 10, baseUpkeep: 2  },
  { tier: 2, baseGold: 900,  basePop: 2, baseOffense: 6,  baseDefense: 4,  baseHitPoints: 20, baseUpkeep: 5  },
  { tier: 3, baseGold: 2000, basePop: 3, baseOffense: 10, baseDefense: 7,  baseHitPoints: 35, baseUpkeep: 10 },
];

// ── Helpers ───────────────────────────────────────────────────────

function toId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/** Scale a stat by a 1-5 race rating.  Rating 3 = 1.0x (baseline). */
function scale(base: number, rating: number): number {
  // rating 1 → 0.7x, 2 → 0.85x, 3 → 1.0x, 4 → 1.15x, 5 → 1.3x
  const multiplier = 1 + (rating - 3) * 0.15;
  return Math.round(base * multiplier);
}

// ── Generic fallback units ────────────────────────────────────────

const GENERIC_UNITS: UnitType[] = TIER_TEMPLATES.map((t, i) => {
  const names = ['Peasants', 'Infantry', 'Cavalry', 'Archers'];
  return {
    id: toId(names[i]),
    name: names[i],
    description: `Generic ${names[i].toLowerCase()} unit`,
    tier: t.tier,
    stats: {
      cost: { gold: t.baseGold, population: t.basePop },
      offense: t.baseOffense,
      defense: t.baseDefense,
      hitPoints: t.baseHitPoints,
      upkeep: t.baseUpkeep,
    },
  };
});

// ── Main export ───────────────────────────────────────────────────

/**
 * Get units available for a specific race.
 *
 * Uses the rich race data from shared-races/index.ts.  Each race has
 * exactly 4 unitTypes (tiers 0-3).  Stats are scaled by the race's
 * warOffense and warDefense ratings so that, e.g., Droben (warOffense 5)
 * gets stronger attackers than Centaur (warOffense 2).
 *
 * Falls back to generic units when the race key is not found.
 */
export const getUnitsForRace = (race: string): UnitType[] => {
  const raceData = RACES[race];
  if (!raceData) {
    return GENERIC_UNITS;
  }

  const { warOffense, warDefense } = raceData.stats;
  const econMultiplier = raceData.economicMultiplier;

  return raceData.unitTypes.map((unitName, index) => {
    const t = TIER_TEMPLATES[index];

    return {
      id: toId(unitName),
      name: unitName,
      description: `${raceData.name} tier ${t.tier} unit`,
      tier: t.tier,
      stats: {
        cost: {
          gold: Math.round(t.baseGold * econMultiplier),
          population: t.basePop,
        },
        offense: scale(t.baseOffense, warOffense),
        defense: scale(t.baseDefense, warDefense),
        hitPoints: scale(t.baseHitPoints, Math.round((warOffense + warDefense) / 2)),
        upkeep: Math.round(t.baseUpkeep * econMultiplier),
      },
    };
  });
};
