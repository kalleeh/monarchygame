/**
 * Combat Calculation Cache
 * Memoizes expensive combat formulas and pre-computes lookup tables
 */

// Simple Map-based cache with TTL
class SimpleCache {
  private cache = new Map<string, { value: any; expires: number }>();
  
  set(key: string, value: any, ttlMs = 3600000) { // 1 hour default
    this.cache.set(key, { value, expires: Date.now() + ttlMs });
  }
  
  get(key: string) {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return item.value;
  }
  
  has(key: string) {
    return this.get(key) !== undefined;
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }

  wrap<T extends (...args: any[]) => any>(fn: T, options?: { ttl?: string; keyPrefix?: string }): T {
    const ttlMs = options?.ttl ? this.parseTTL(options.ttl) : 3600000; // 1 hour default
    const keyPrefix = options?.keyPrefix || '';
    
    return ((...args: any[]) => {
      const key = keyPrefix + JSON.stringify(args);
      if (this.has(key)) {
        return this.get(key);
      }
      const result = fn(...args);
      this.set(key, result, ttlMs);
      return result;
    }) as T;
  }

  private parseTTL(ttl: string): number {
    if (ttl.endsWith('h')) {
      return parseInt(ttl) * 60 * 60 * 1000;
    }
    if (ttl.endsWith('m')) {
      return parseInt(ttl) * 60 * 1000;
    }
    if (ttl.endsWith('s')) {
      return parseInt(ttl) * 1000;
    }
    return parseInt(ttl);
  }
}

const combatCache = new SimpleCache();

// Pre-computed lookup tables for performance
const POWER_RATIO_CACHE = new Map<string, number>();
const CASUALTY_RATE_CACHE = new Map<string, { attacker: number; defender: number }>();
const LAND_GAIN_CACHE = new Map<string, number>();

// Combat constants from reference documentation
const COMBAT_CONSTANTS = {
  CASUALTY_RATES: {
    WITH_EASE: { attacker: 0.05, defender: 0.20 },
    GOOD_FIGHT: { attacker: 0.15, defender: 0.15 },
    FAILED: { attacker: 0.25, defender: 0.05 }
  },
  LAND_GAIN_RANGES: {
    WITH_EASE: { min: 0.070, max: 0.0735 }, // 7.0-7.35%
    GOOD_FIGHT: { min: 0.0679, max: 0.070 }, // 6.79-7.0%
    FAILED: { min: 0, max: 0 }
  },
  POWER_THRESHOLDS: {
    WITH_EASE: 2.0,
    GOOD_FIGHT: 1.2
  }
} as const;

// Unit power values (from reference data)
const UNIT_POWER = {
  peasants: { attack: 1, defense: 1 },
  militia: { attack: 2, defense: 3 },
  knights: { attack: 4, defense: 4 },
  cavalry: { attack: 5, defense: 2 }
} as const;

/**
 * Calculate total army power with caching
 */
export const calculateArmyPower = combatCache.wrap(
  (units: Record<string, number>, type: 'attack' | 'defense') => {
    let totalPower = 0;
    
    for (const [unitType, count] of Object.entries(units)) {
      const unitStats = UNIT_POWER[unitType as keyof typeof UNIT_POWER];
      if (unitStats) {
        totalPower += count * unitStats[type];
      }
    }
    
    return totalPower;
  },
  { ttl: '1h', keyPrefix: 'armyPower' }
);

/**
 * Calculate power ratio with caching
 */
export const calculatePowerRatio = combatCache.wrap(
  (attackerUnits: Record<string, number>, defenderUnits: Record<string, number>) => {
    const attackerPower = calculateArmyPower(attackerUnits, 'attack');
    const defenderPower = calculateArmyPower(defenderUnits, 'defense');
    
    return defenderPower > 0 ? attackerPower / defenderPower : attackerPower;
  },
  { ttl: '1h', keyPrefix: 'powerRatio' }
);

/**
 * Determine battle result based on power ratio
 */
export const getBattleResult = combatCache.wrap(
  (powerRatio: number) => {
    if (powerRatio >= COMBAT_CONSTANTS.POWER_THRESHOLDS.WITH_EASE) {
      return 'with_ease';
    } else if (powerRatio >= COMBAT_CONSTANTS.POWER_THRESHOLDS.GOOD_FIGHT) {
      return 'good_fight';
    } else {
      return 'failed';
    }
  },
  { ttl: '1h', keyPrefix: 'battleResult' }
);

/**
 * Calculate casualty rates with caching
 */
export const getCasualtyRates = combatCache.wrap(
  (battleResult: string) => {
    return COMBAT_CONSTANTS.CASUALTY_RATES[battleResult as keyof typeof COMBAT_CONSTANTS.CASUALTY_RATES] || 
           COMBAT_CONSTANTS.CASUALTY_RATES.FAILED;
  },
  { ttl: '1h', keyPrefix: 'casualtyRates' }
);

/**
 * Calculate land gained with caching
 */
export const calculateLandGained = combatCache.wrap(
  (battleResult: string, defenderLand: number, seed?: number) => {
    const range = COMBAT_CONSTANTS.LAND_GAIN_RANGES[battleResult as keyof typeof COMBAT_CONSTANTS.LAND_GAIN_RANGES];
    if (!range || range.max === 0) return 0;
    
    // Use seed for deterministic results in testing
    const random = seed !== undefined ? (seed % 1000) / 1000 : Math.random();
    const percentage = range.min + (random * (range.max - range.min));
    
    return Math.floor(defenderLand * percentage);
  },
  { ttl: '1h', keyPrefix: 'landGained' }
);

/**
 * Calculate unit casualties with caching
 */
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

/**
 * Complete combat calculation with full caching
 */
export const calculateCombatResult = combatCache.wrap(
  (
    attackerUnits: Record<string, number>,
    defenderUnits: Record<string, number>,
    defenderLand: number,
    seed?: number
  ) => {
    // Calculate power ratio
    const powerRatio = calculatePowerRatio(attackerUnits, defenderUnits);
    
    // Determine battle result
    const battleResult = getBattleResult(powerRatio);
    
    // Get casualty rates
    const casualtyRates = getCasualtyRates(battleResult);
    
    // Calculate casualties
    const attackerCasualties = calculateCasualties(attackerUnits, casualtyRates.attacker);
    const defenderCasualties = calculateCasualties(defenderUnits, casualtyRates.defender);
    
    // Calculate land gained
    const landGained = calculateLandGained(battleResult, defenderLand, seed);
    
    // Calculate gold looted (1000 per land gained)
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

/**
 * Pre-compute common power ratios for faster lookups
 */
export const precomputePowerRatios = () => {
  const commonUnitCounts = [10, 25, 50, 100, 200, 500, 1000];
  const unitTypes = Object.keys(UNIT_POWER);
  
  for (const attackerCount of commonUnitCounts) {
    for (const defenderCount of commonUnitCounts) {
      for (const attackerType of unitTypes) {
        for (const defenderType of unitTypes) {
          const attackerUnits = { [attackerType]: attackerCount };
          const defenderUnits = { [defenderType]: defenderCount };
          
          // Pre-compute and cache
          calculatePowerRatio(attackerUnits, defenderUnits);
        }
      }
    }
  }
  
  console.log('Pre-computed power ratios for common scenarios');
};

/**
 * Clear combat cache
 */
export const clearCombatCache = () => {
  combatCache.clear();
  POWER_RATIO_CACHE.clear();
  CASUALTY_RATE_CACHE.clear();
  LAND_GAIN_CACHE.clear();
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  return {
    size: combatCache.size,
    powerRatioCache: POWER_RATIO_CACHE.size,
    casualtyRateCache: CASUALTY_RATE_CACHE.size,
    landGainCache: LAND_GAIN_CACHE.size
  };
};
