/**
 * Combat Calculation Cache
 * Simplified cache to avoid TypeScript issues
 */

import { COMBAT } from '../constants/gameConfig';

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

// Tier-based offense/defense for race-specific units
const TIER_OFFENSE = [1, 3, 6, 10];
const TIER_DEFENSE = [1, 2, 4, 7];
const UNIT_TIER: Record<string, number> = {
  peasant: 0, peasants: 0, militia: 1, knight: 2, knights: 2, cavalry: 3,
  infantry: 1, archer: 2, mage: 2, scout: 0,
  tier1: 0, tier2: 1, tier3: 2, tier4: 3,
  'elven-scouts': 0, 'elven-warriors': 1, 'elven-archers': 2, 'elven-lords': 3,
  goblins: 0, hobgoblins: 1, kobolds: 2, 'goblin-riders': 3,
  'droben-warriors': 0, 'droben-berserkers': 1, 'droben-bunar': 2, 'droben-champions': 3,
  thralls: 0, 'vampire-spawn': 1, 'vampire-lords': 2, 'ancient-vampires': 3,
  'earth-elementals': 0, 'fire-elementals': 1, 'water-elementals': 2, 'air-elementals': 3,
  'centaur-scouts': 0, 'centaur-warriors': 1, 'centaur-archers': 2, 'centaur-chiefs': 3,
  'sidhe-nobles': 0, 'sidhe-elders': 1, 'sidhe-mages': 2, 'sidhe-lords': 3,
  'dwarven-militia': 0, 'dwarven-guards': 1, 'dwarven-warriors': 2, 'dwarven-lords': 3,
  'fae-sprites': 0, 'fae-warriors': 1, 'fae-nobles': 2, 'fae-lords': 3,
};
const getUnitOffense = (type: string): number => TIER_OFFENSE[UNIT_TIER[type] ?? 0] ?? 1;
const getUnitDefense = (type: string): number => TIER_DEFENSE[UNIT_TIER[type] ?? 0] ?? 1;

/**
 * Calculate unit power with caching
 */
export const calculateUnitPower = combatCache.wrap(
  (units: Record<string, number>, type: 'attack' | 'defense') => {
    let totalPower = 0;
    
    for (const [unitType, count] of Object.entries(units)) {
      const unitStats = UNIT_STATS[unitType as keyof typeof UNIT_STATS];
      const power = unitStats
        ? (type === 'attack' ? unitStats.attack : unitStats.defense)
        : (type === 'attack' ? getUnitOffense(unitType) : getUnitDefense(unitType));
      totalPower += power * count;
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
      // Attacker barely takes losses; defender suffers heavily
      case 'with_ease': return { attacker: COMBAT.CASUALTY_RATES.FAILED_ATTACK, defender: COMBAT.CASUALTY_RATES.DEFENDER_EASY_WIN };
      // Balanced fight — both sides take the base casualty rate
      case 'good_fight': return { attacker: COMBAT.CASUALTY_RATES.ATTACKER_HARD_WIN, defender: COMBAT.CASUALTY_RATES.BASE };
      // Attack repelled — attacker takes heavy losses, defender takes minimal
      case 'failed': return { attacker: COMBAT.CASUALTY_RATES.ATTACKER_FAILED, defender: COMBAT.CASUALTY_RATES.DEFENDER_FAILED };
      default: return { attacker: COMBAT.CASUALTY_RATES.BASE, defender: COMBAT.CASUALTY_RATES.BASE };
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
