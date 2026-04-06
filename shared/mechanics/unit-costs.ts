/**
 * Server-authoritative unit gold cost lookup.
 * Used by unit-trainer Lambda to compute costs server-side.
 * Must stay in sync with frontend TIER_TEMPLATES in frontend/src/utils/units.ts
 * and RACES in frontend/src/shared-races/index.ts.
 */

// Base gold costs per tier — mirrors TIER_TEMPLATES in frontend/src/utils/units.ts
const TIER_BASE_GOLD = [50, 350, 900, 2000];
const SCOUT_BASE_GOLD = 200;

// Minimal race data needed for cost computation — sourced from shared-races
const RACE_UNIT_DATA: Record<string, { unitTypes: string[]; economicMultiplier: number }> = {
  Human:     { unitTypes: ['Peasants', 'Militia', 'Knights', 'Cavalry'], economicMultiplier: 1.0 },
  Elven:     { unitTypes: ['Elven Scouts', 'Elven Warriors', 'Elven Archers', 'Elven Lords'], economicMultiplier: 1.0 },
  Goblin:    { unitTypes: ['Goblins', 'Hobgoblins', 'Kobolds', 'Goblin Riders'], economicMultiplier: 1.0 },
  Droben:    { unitTypes: ['Droben Warriors', 'Droben Berserkers', 'Droben Bunar', 'Droben Champions'], economicMultiplier: 1.0 },
  Vampire:   { unitTypes: ['Thralls', 'Vampire Spawn', 'Vampire Lords', 'Ancient Vampires'], economicMultiplier: 2.0 },
  Elemental: { unitTypes: ['Earth Elementals', 'Fire Elementals', 'Water Elementals', 'Air Elementals'], economicMultiplier: 1.0 },
  Centaur:   { unitTypes: ['Centaur Scouts', 'Centaur Warriors', 'Centaur Archers', 'Centaur Chiefs'], economicMultiplier: 1.0 },
  Sidhe:     { unitTypes: ['Sidhe Nobles', 'Sidhe Elders', 'Sidhe Mages', 'Sidhe Lords'], economicMultiplier: 1.0 },
  Dwarven:   { unitTypes: ['Dwarven Militia', 'Dwarven Guards', 'Dwarven Warriors', 'Dwarven Lords'], economicMultiplier: 1.0 },
  Fae:       { unitTypes: ['Fae Sprites', 'Fae Warriors', 'Fae Nobles', 'Fae Lords'], economicMultiplier: 1.0 },
};

function toId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Look up the per-unit gold cost for a given race + unitType.
 * Returns null if the race or unit type is unknown.
 */
export function getUnitGoldCost(race: string, unitType: string): number | null {
  const raceData = RACE_UNIT_DATA[race];
  if (!raceData) return null;

  if (unitType === 'scouts') {
    return Math.round(SCOUT_BASE_GOLD * raceData.economicMultiplier);
  }

  const tierIndex = raceData.unitTypes.findIndex(
    name => toId(name) === unitType
  );

  if (tierIndex === -1 || tierIndex >= TIER_BASE_GOLD.length) return null;

  return Math.round(TIER_BASE_GOLD[tierIndex] * raceData.economicMultiplier);
}
