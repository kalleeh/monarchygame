/**
 * Shared balance constants and formulas for the monarchy game.
 * Used by balance-testing test files and simulation modules.
 */

// ---------------------------------------------------------------------------
// Combat Balance
// ---------------------------------------------------------------------------

export interface LandGainResult {
  min: number
  max: number
  expected: number
  resultType: 'with_ease' | 'good_fight' | 'failed'
}

/**
 * Calculate the land gain range for an attack.
 *
 * @param offense  - attacker's offensive power
 * @param defense  - defender's defensive power
 * @param targetLand - defender's current land (acres)
 */
export function calculateLandGainRange(
  offense: number,
  defense: number,
  targetLand: number,
): LandGainResult {
  const ratio = offense / defense

  if (ratio >= 2) {
    const min = Math.floor(targetLand * 0.07)
    const max = Math.floor(targetLand * 0.0735)
    return { min, max, expected: (min + max) / 2, resultType: 'with_ease' }
  }

  if (ratio >= 1.2) {
    const min = Math.floor(targetLand * 0.0679)
    const max = Math.floor(targetLand * 0.07)
    return { min, max, expected: (min + max) / 2, resultType: 'good_fight' }
  }

  // Below 1.2:1 – attack fails
  return { min: 0, max: 0, expected: 0, resultType: 'failed' }
}

// Summon rates as a fraction of networth (per race)
const SUMMON_RATES: Record<string, number> = {
  DROBEN: 0.0304,
  FAE: 0.020,
  HUMAN: 0.025,
  ELVEN: 0.023,
  GOBLIN: 0.024,
  VAMPIRE: 0.026,
  ELEMENTAL: 0.027,
  CENTAUR: 0.028,
  SIDHE: 0.022,
  DWARVEN: 0.029,
}

const DEFAULT_SUMMON_RATE = 0.025

/**
 * Calculate the number of troops a race can summon from a given networth.
 *
 * @param race     - race identifier (e.g. 'DROBEN', 'FAE')
 * @param networth - kingdom networth
 */
export function calculateSummonTroops(race: string, networth: number): number {
  const rate = SUMMON_RATES[race] ?? DEFAULT_SUMMON_RATE
  return Math.floor(networth * rate)
}

// ---------------------------------------------------------------------------
// Economic Balance
// ---------------------------------------------------------------------------

export const BUILDING_BALANCE = {
  OPTIMAL_RATIOS: {
    QUARRIES: { min: 0.30, max: 0.35 },
    BARRACKS: { min: 0.30, max: 0.35 },
    GUILDHALLS: 0.10,
  },
  BUILD_RATE: {
    OPTIMAL_MIN: 16,
    OPTIMAL_MAX: 20,
    MAX_SUSTAINABLE: 28,
    DEVELOPMENT_COST: 317.5, // average of 310–325 gold per acre
  },
}

export const ECONOMIC_BALANCE = {
  TURNS_PER_HOUR: 3,
  ENCAMP_BONUS: {
    HOURS_24: 10,
    HOURS_16: 7,
  },
  SAFE_CASH_MULTIPLIER: {
    min: 1.0,
    max: 1.5,
  },
  WAR_ALLOCATION: {
    min: 0.33,
    max: 0.50,
  },
}

/**
 * Calculate the build rate (buildings as a percentage of total land).
 *
 * @param buildings  - number of built structures
 * @param totalLand  - total acres owned
 */
export function calculateOptimalBuildRate(buildings: number, totalLand: number): number {
  return Math.round((buildings / totalLand) * 100)
}

/**
 * Determine whether a given build rate is within the optimal range (16–20%).
 */
export function isOptimalBR(rate: number): boolean {
  return rate >= BUILDING_BALANCE.BUILD_RATE.OPTIMAL_MIN &&
         rate <= BUILDING_BALANCE.BUILD_RATE.OPTIMAL_MAX
}

// ---------------------------------------------------------------------------
// Sorcery Balance
// ---------------------------------------------------------------------------

export const SORCERY_BALANCE = {
  TEMPLE_THRESHOLDS: {
    TIER_1_SPELLS: 0.02,
    TIER_2_SPELLS: 0.04,
    TIER_3_SPELLS: 0.08,
    TIER_4_SPELLS: 0.12,
    OPTIMAL_DEFENSE: 0.16,
  },
  RACIAL_SPELL_DAMAGE: {
    SIDHE: {
      HURRICANE_STRUCTURES: 0.0563,
      HURRICANE_FORTS: 0.075,
      HURRICANE_BACKLASH: 0.09,
      LIGHTNING_LANCE_FORTS: 0.10,
      BANSHEE_DELUGE_STRUCTURES: 0.0625,
      FOUL_LIGHT_KILL_RATE: 0.08,
    },
    HUMAN: {
      HURRICANE_STRUCTURES: 0.0313,
      HURRICANE_FORTS: 0.05,
      HURRICANE_BACKLASH: 0.11,
      LIGHTNING_LANCE_FORTS: 0.075,
      BANSHEE_DELUGE_STRUCTURES: 0.0375,
    },
    TIER_2_RACES: {
      HURRICANE_STRUCTURES: 0.0438,
      HURRICANE_FORTS: 0.0625,
      LIGHTNING_LANCE_FORTS: 0.0875,
      BANSHEE_DELUGE_STRUCTURES: 0.05,
    },
  },
  ELAN_GENERATION: {
    SIDHE_VAMPIRE_RATE: 0.005,
    STANDARD_RATE: 0.003,
  },
  ATTACKER_ADVANTAGE: 1.15,
}

const TEMPLE_TIER_MAP: Record<number, number> = {
  1: SORCERY_BALANCE.TEMPLE_THRESHOLDS.TIER_1_SPELLS,
  2: SORCERY_BALANCE.TEMPLE_THRESHOLDS.TIER_2_SPELLS,
  3: SORCERY_BALANCE.TEMPLE_THRESHOLDS.TIER_3_SPELLS,
  4: SORCERY_BALANCE.TEMPLE_THRESHOLDS.TIER_4_SPELLS,
}

/**
 * Calculate the number of temples required to cast spells of the given tier.
 *
 * @param tier            - spell tier (1–4)
 * @param totalStructures - total structures in the kingdom
 */
export function calculateTempleRequirement(tier: number, totalStructures: number): number {
  const threshold = TEMPLE_TIER_MAP[tier]
  if (threshold === undefined) {
    throw new Error(`Unknown spell tier: ${tier}`)
  }
  return Math.floor(totalStructures * threshold)
}
