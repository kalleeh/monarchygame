/**
 * Combat Calculation Cache — shared between Lambda and frontend.
 * Moved from frontend/src/utils/combatCache.ts to shared location.
 */

// ---------------------------------------------------------------------------
// Terrain modifier table — shared between Lambda and frontend
// Keyed by the lowercase terrain type string used in the schema enum.
// Each entry carries fractional modifiers (e.g. 0.2 = +20%).
// Modifier keys used in combat:
//   defense  — scales defender's effective unit power
//   offense  — scales both sides' offensive power (swamp)
//   cavalry  — scales units whose type includes "cavalry"
//   infantry — scales units whose type includes "infantry" / foot units
//   siege    — scales units whose type includes "siege"
// ---------------------------------------------------------------------------
export interface TerrainModifiers {
  defense?: number;
  offense?: number;
  cavalry?: number;
  infantry?: number;
  siege?: number;
}

export const TERRAIN_MODIFIERS: Record<string, TerrainModifiers> = {
  plains:    {},                                                 // no modifier
  forest:    { defense: 0.2, cavalry: -0.1 },                  // +20% def, -10% cav
  mountains: { defense: 0.3, siege: -0.2 },                    // +30% def, -20% siege
  swamp:     { defense: -0.15, offense: -0.15, cavalry: -0.15, infantry: -0.15 },
  desert:    { cavalry: 0.15, infantry: -0.1 },                 // +15% cav, -10% inf
  coastal:   {},                                                 // no modifier (treat as plains)
  // TerrainType enum uppercased variants (from frontend TerrainType const)
  PLAINS:    {},
  FOREST:    { defense: 0.2, cavalry: -0.1 },
  MOUNTAINS: { defense: 0.3, siege: -0.2 },
  SWAMP:     { defense: -0.15, offense: -0.15, cavalry: -0.15, infantry: -0.15 },
  DESERT:    { cavalry: 0.15, infantry: -0.1 },
};

// ---------------------------------------------------------------------------
// Formation modifier table — shared between Lambda and frontend
// Keyed by the formation ID strings used in combatStore / BattleFormations.
// offense modifier scales attacker's power, defense modifier scales the
// attacker's effective defence (reducing their casualty exposure).
// ---------------------------------------------------------------------------
export interface FormationModifiers {
  offense: number;  // multiplier delta, e.g. 0.3 = +30%
  defense: number;  // multiplier delta, e.g. 0.25 = +25%
}

export const FORMATION_MODIFIERS: Record<string, FormationModifiers> = {
  // IDs from initializeCombatData and FORMATIONS data file
  'defensive-wall':       { offense: -0.1,  defense: 0.25 },
  'cavalry-charge':       { offense: 0.3,   defense: -0.15 },
  'balanced':             { offense: 0.1,   defense: 0.1 },
  // FormationType enum values (uppercase)
  'DEFENSIVE_WALL':       { offense: -0.1,  defense: 0.25 },
  'CAVALRY_CHARGE':       { offense: 0.3,   defense: -0.15 },
  'BALANCED':             { offense: 0.1,   defense: 0.1 },
  // Legacy keys that were used by the old FORMATION_BONUSES table in handler.ts
  'aggressive':           { offense: 0.15,  defense: 0.0 },
  'defensive':            { offense: -0.1,  defense: 0.25 },
  'flanking':             { offense: 0.1,   defense: 0.0 },
  'siege':                { offense: 0.2,   defense: 0.0 },
  'standard':             { offense: 0.0,   defense: 0.0 },
  // Name-based keys (from saved formation .name field)
  'Defensive Wall':       { offense: -0.1,  defense: 0.25 },
  'Cavalry Charge':       { offense: 0.3,   defense: -0.15 },
  'Balanced Formation':   { offense: 0.1,   defense: 0.1 },
};

// ---------------------------------------------------------------------------
// Unit stats table — used by power calculations in this module and by
// applyTerrainToUnitPower below. Declared early so all functions can access it.
// ---------------------------------------------------------------------------
const UNIT_STATS = {
  peasant:  { attack: 1, defense: 1 },
  infantry: { attack: 3, defense: 2 },
  cavalry:  { attack: 5, defense: 3 },
  archer:   { attack: 4, defense: 2 },
  knight:   { attack: 6, defense: 4 },
  mage:     { attack: 3, defense: 1 },
  scout:    { attack: 2, defense: 1 },
  militia:  { attack: 2, defense: 3 },
  tier1:    { attack: 1, defense: 1 },
  tier2:    { attack: 3, defense: 2 },
  tier3:    { attack: 5, defense: 3 },
  tier4:    { attack: 7, defense: 4 },
} as const;

// ---------------------------------------------------------------------------
// Helper: compute a terrain-adjusted unit power sum.
// units   — e.g. { cavalry: 100, infantry: 200, siege: 50 }
// type    — 'attack' or 'defense' (which stat to read from UNIT_STATS)
// mods    — TerrainModifiers for the relevant side's terrain
// ---------------------------------------------------------------------------
export function applyTerrainToUnitPower(
  units: Record<string, number>,
  type: 'attack' | 'defense',
  mods: TerrainModifiers
): number {
  const globalOffenseMod = mods.offense ?? 0;   // swamp penalises both sides
  let totalPower = 0;

  for (const [unitType, count] of Object.entries(units)) {
    const unitStats = UNIT_STATS[unitType as keyof typeof UNIT_STATS];
    // Fall back to generic foot-soldier stats for unknown unit types
    const stats = unitStats ?? { attack: 2, defense: 2 };
    const basePower = (type === 'attack' ? stats.attack : stats.defense) * count;

    // Determine which per-unit-class modifier applies
    const lowerType = unitType.toLowerCase();
    let classMod = 0;

    if (lowerType.includes('cavalry') || lowerType === 'tier4') {
      classMod = mods.cavalry ?? 0;
    } else if (lowerType.includes('siege') || lowerType === 'catapult' || lowerType === 'ballista') {
      classMod = mods.siege ?? 0;
    } else if (
      lowerType.includes('infantry') ||
      lowerType.includes('soldier') ||
      lowerType === 'militia' ||
      lowerType === 'knight' ||
      lowerType === 'tier1' ||
      lowerType === 'tier2' ||
      lowerType === 'tier3'
    ) {
      classMod = mods.infantry ?? 0;
    }

    // Stack class modifier on top of global offense modifier
    const totalMod = globalOffenseMod + classMod;
    totalPower += basePower * (1 + totalMod);
  }

  return totalPower;
}

// Disable caching for now to fix build issues
const combatCache = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wrap: <T extends (...args: any[]) => any>(fn: T, _options?: unknown): T => fn,
  clear: () => {},
  size: 0
};

export const calculateUnitPower = combatCache.wrap(
  (units: Record<string, number>, type: 'attack' | 'defense') => {
    let totalPower = 0;
    for (const [unitType, count] of Object.entries(units)) {
      const unitStats = UNIT_STATS[unitType as keyof typeof UNIT_STATS];
      if (unitStats) {
        const power = type === 'attack' ? unitStats.attack : unitStats.defense;
        totalPower += power * count;
      }
    }
    return totalPower;
  },
  { ttl: '1h', keyPrefix: 'unitPower' }
);

export const calculatePowerRatio = combatCache.wrap(
  (attackerUnits: Record<string, number>, defenderUnits: Record<string, number>) => {
    const attackerPower = calculateUnitPower(attackerUnits, 'attack') as number;
    const defenderPower = calculateUnitPower(defenderUnits, 'defense') as number;
    return defenderPower > 0 ? attackerPower / defenderPower : attackerPower;
  },
  { ttl: '1h', keyPrefix: 'powerRatio' }
);

export const getBattleResult = combatCache.wrap(
  (powerRatio: number) => {
    if (powerRatio >= 2.0) return 'with_ease';
    if (powerRatio >= 1.2) return 'good_fight';
    return 'failed';
  },
  { ttl: '1h', keyPrefix: 'battleResult' }
);

export const getCasualtyRates = combatCache.wrap(
  (battleResult: string) => {
    switch (battleResult) {
      case 'with_ease': return { attacker: 0.05, defender: 0.2 };
      case 'good_fight': return { attacker: 0.15, defender: 0.15 };
      case 'failed': return { attacker: 0.25, defender: 0.05 };
      default: return { attacker: 0.15, defender: 0.15 };
    }
  },
  { ttl: '1h', keyPrefix: 'casualtyRates' }
);

export const calculateLandGained = combatCache.wrap(
  (battleResult: string, defenderLand: number, seed?: number) => {
    if (battleResult === 'failed') return 0;
    const baseGain = battleResult === 'with_ease' ? 0.0735 : 0.068;
    const randomFactor = seed ? Math.sin(seed) * 0.5 + 0.5 : Math.random();
    const variance = (0.0735 - 0.0679) / ((0.0735 + 0.0679) / 2);
    return Math.floor(defenderLand * baseGain * (1 + (randomFactor - 0.5) * variance));
  },
  { ttl: '1h', keyPrefix: 'landGained' }
);

export const calculateCasualties = combatCache.wrap(
  (units: Record<string, number>, casualtyRate: number) => {
    const casualties: Record<string, number> = {};
    for (const [unitType, count] of Object.entries(units)) {
      casualties[unitType] = Math.floor(count * casualtyRate);
    }
    return casualties;
  },
  { ttl: '1h', keyPrefix: 'casualties' }
);

export const calculateCombatResult = combatCache.wrap(
  (
    attackerUnits: Record<string, number>,
    defenderUnits: Record<string, number>,
    defenderLand: number,
    seed?: number
  ) => {
    const powerRatio = calculatePowerRatio(attackerUnits, defenderUnits) as number;
    const battleResult = getBattleResult(powerRatio) as string;
    const casualtyRates = getCasualtyRates(battleResult) as { attacker: number; defender: number };
    const attackerCasualties = calculateCasualties(attackerUnits, casualtyRates.attacker);
    const defenderCasualties = calculateCasualties(defenderUnits, casualtyRates.defender);
    const landGained = calculateLandGained(battleResult, defenderLand, seed) as number;
    // Gold looted per acre: 1000 (must match frontend gameConfig.ts COMBAT.GOLD_LOOTED_PER_ACRE)
    const goldLooted = landGained * 1000;

    return {
      result: battleResult,
      powerRatio,
      casualties: {
        attacker: attackerCasualties,
        defender: defenderCasualties
      },
      landGained,
      goldLooted,
      success: battleResult !== 'failed'
    };
  },
  { ttl: '1h', keyPrefix: 'combatResult' }
);

export const clearCombatCache = () => {
  combatCache.clear();
};

export const getCacheStats = () => {
  return { size: combatCache.size, entries: [] };
};
