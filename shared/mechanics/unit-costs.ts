/**
 * Server-authoritative unit gold cost lookup.
 * Used by unit-trainer Lambda to compute costs server-side.
 * Must stay in sync with frontend TIER_TEMPLATES in frontend/src/utils/units.ts.
 */

import { RACES } from '../../frontend/src/shared-races';

// Base gold costs per tier — mirrors TIER_TEMPLATES in frontend/src/utils/units.ts
const TIER_BASE_GOLD = [50, 350, 900, 2000];
const SCOUT_BASE_GOLD = 200;

function toId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Look up the per-unit gold cost for a given race + unitType.
 * Returns null if the race or unit type is unknown.
 */
export function getUnitGoldCost(race: string, unitType: string): number | null {
  const raceData = RACES[race];
  if (!raceData) return null;

  const econMultiplier = raceData.economicMultiplier;

  if (unitType === 'scouts') {
    return Math.round(SCOUT_BASE_GOLD * econMultiplier);
  }

  const tierIndex = raceData.unitTypes.findIndex(
    name => toId(name) === unitType
  );

  if (tierIndex === -1 || tierIndex >= TIER_BASE_GOLD.length) return null;

  return Math.round(TIER_BASE_GOLD[tierIndex] * econMultiplier);
}
