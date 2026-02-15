/**
 * Combat Calculation Cache
 * Simplified cache to avoid TypeScript issues
 */

// Disable caching for now to fix build issues
const combatCache = {
  wrap: <T extends (...args: any[]) => any>(fn: T, options?: any): T => fn,
  clear: () => {},
  size: 0
};

// Basic unit stats for combat calculations
const UNIT_STATS = {
  peasant: { attack: 1, defense: 1 },
  infantry: { attack: 3, defense: 2 },
  cavalry: { attack: 5, defense: 3 },
  archer: { attack: 4, defense: 2 },
  knight: { attack: 6, defense: 4 },
  mage: { attack: 3, defense: 1 },
  scout: { attack: 2, defense: 1 },
  // Tier-based units
  tier1: { attack: 1, defense: 1 },
  tier2: { attack: 3, defense: 2 },
  tier3: { attack: 5, defense: 3 },
  tier4: { attack: 7, defense: 4 }
} as const;

/**
 * Calculate unit power with caching
 */
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

/**
 * Calculate power ratio with caching
 */
export const calculatePowerRatio = combatCache.wrap(
  (attackerUnits: Record<string, number>, defenderUnits: Record<string, number>) => {
    const attackerPower = calculateUnitPower(attackerUnits, 'attack') as number;
    const defenderPower = calculateUnitPower(defenderUnits, 'defense') as number;
    
    return defenderPower > 0 ? attackerPower / defenderPower : attackerPower;
  },
  { ttl: '1h', keyPrefix: 'powerRatio' }
);

/**
 * Get battle result based on power ratio
 */
export const getBattleResult = combatCache.wrap(
  (powerRatio: number) => {
    if (powerRatio >= 2.0) return 'with_ease';
    if (powerRatio >= 1.2) return 'good_fight';
    return 'failed';
  },
  { ttl: '1h', keyPrefix: 'battleResult' }
);

/**
 * Get casualty rates based on battle result
 */
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

/**
 * Calculate land gained with caching
 */
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
    const powerRatio = calculatePowerRatio(attackerUnits, defenderUnits) as number;
    
    // Determine battle result
    const battleResult = getBattleResult(powerRatio) as string;
    
    // Get casualty rates
    const casualtyRates = getCasualtyRates(battleResult) as { attacker: number; defender: number };
    
    // Calculate casualties
    const attackerCasualties = calculateCasualties(attackerUnits, casualtyRates.attacker);
    const defenderCasualties = calculateCasualties(defenderUnits, casualtyRates.defender);
    
    // Calculate land gained
    const landGained = calculateLandGained(battleResult, defenderLand, seed) as number;
    
    // Gold looted per acre: 1000 (must match gameConfig.ts COMBAT.GOLD_LOOTED_PER_ACRE)
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
 * Clear all cached combat calculations
 */
export const clearCombatCache = () => {
  combatCache.clear();
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  return {
    size: combatCache.size,
    entries: []
  };
};
