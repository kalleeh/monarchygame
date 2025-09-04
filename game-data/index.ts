/**
 * Main game data exports for Monarchy game
 * Centralized access to all game configuration data with exact mechanics from pro player documentation
 */

// Core game data exports
export * from './races'
export * from './units'
export * from './buildings'
export * from './spells'
export * from './balance'

// Mechanics systems exports
export * from './mechanics/combat-mechanics'
export * from './mechanics/sorcery-mechanics'
export * from './mechanics/thievery-mechanics'
export * from './mechanics/bounty-mechanics'
export * from './mechanics/restoration-mechanics'
export * from './mechanics/age-mechanics'
export * from './mechanics/turn-mechanics'
export * from './mechanics/faith-focus-mechanics'

// Re-export key types for convenience
export type {
  Race,
  RaceStats,
  RaceId,
  SpecialAbility
} from './races'

export type {
  UnitType,
  UnitStats,
  UnitId
} from './units'

export type {
  BuildingType,
  BuildingStats,
  BuildingId
} from './buildings'

export type {
  Spell,
  SpellEffect,
  SpellCost,
  SpellId
} from './spells'

export type {
  CombatResult,
  AttackForce,
  DefenseForce
} from './mechanics/combat-mechanics'

export type {
  SorceryResult,
  MagicalDefense
} from './mechanics/sorcery-mechanics'

export type {
  ThieveryResult,
  ScumForce
} from './mechanics/thievery-mechanics'

export type {
  BountyReward,
  BountyTarget
} from './mechanics/bounty-mechanics'

export type {
  RestorationStatus,
  KingdomDamageAssessment
} from './mechanics/restoration-mechanics'

export type {
  AgeStatus,
  AgeEffects
} from './mechanics/age-mechanics'

export type {
  TurnStatus,
  EncampStatus
} from './mechanics/turn-mechanics'

export type {
  FaithStatus,
  FocusPointsStatus,
  FaithAlignment
} from './mechanics/faith-focus-mechanics'

// Game constants (exact values from pro player documentation)
export const GAME_CONSTANTS = {
  // Turn and time mechanics (exact rates from documentation)
  TURNS_PER_HOUR: 3,            // 3 turns per hour (not 24 per day)
  MINUTES_PER_TURN: 20,         // 20 minutes per turn
  MAX_STORED_TURNS: 72,         // 72 turns maximum storage
  ENCAMP_24_BONUS: 10,          // +10 turns for 24h encamp
  ENCAMP_16_BONUS: 7,           // +7 turns for 16h encamp
  
  // Resource limits (from balance analysis)
  MAX_GOLD: 100000000,          // 100M gold limit
  MAX_POPULATION: 1000000,      // 1M population limit
  MAX_LAND: 100000,             // 100k land limit
  MAX_ELAN: 10000,              // 10k elan limit (not mana)
  
  // Combat limits (from documentation)
  MAX_ARMY_SIZE: 500000,        // 500k army size
  MIN_ATTACK_SIZE: 1,           // 1 unit minimum
  MAX_FORTIFICATION_LEVEL: 5,   // 5 fort levels
  
  // Building limits (from BR system)
  MAX_BUILDINGS_PER_ACRE: 1,    // 1 building per acre
  MAX_BUILD_RATE: 100,          // 100% BR theoretical max
  OPTIMAL_BUILD_RATE_MIN: 16,   // 16 BR minimum optimal
  OPTIMAL_BUILD_RATE_MAX: 20,   // 20 BR maximum optimal
  
  // Sorcery limits (from temple thresholds)
  MAX_ACTIVE_SPELLS: 10,        // 10 active spells
  MAX_SPELL_TIER: 4,            // 4 spell tiers
  MAX_TEMPLE_PERCENTAGE: 0.20,  // 20% temples maximum practical
  
  // Social limits
  MAX_GUILD_SIZE: 20,           // 20 realms per guild
  MAX_GUILD_NAME_LENGTH: 50,    // 50 characters
  MAX_KINGDOM_NAME_LENGTH: 30,  // 30 characters
  MAX_CHAT_MESSAGE_LENGTH: 500, // 500 characters
  
  // World size
  WORLD_WIDTH: 100,             // 100 coordinate width
  WORLD_HEIGHT: 100,            // 100 coordinate height
  MAX_TERRITORIES_PER_KINGDOM: 50, // 50 territories max
  
  // Victory conditions (from strategic analysis)
  DOMINATION_THRESHOLD: 0.6,    // 60% control for domination
  ECONOMIC_VICTORY_THRESHOLD: 10000000, // 10M gold for economic victory
  TERRITORIAL_VICTORY_THRESHOLD: 0.4,   // 40% land for territorial victory
  
  // Age system (from age mechanics)
  EARLY_AGE_HOURS: 168,         // 7 days early age
  MIDDLE_AGE_HOURS: 336,        // 14 days middle age  
  LATE_AGE_HOURS: 504,          // 21 days late age
  TOTAL_GAME_HOURS: 1008,       // 42 days total game
  
  // Cash management (from financial warfare documentation)
  SAFE_CASH_MULTIPLIER_MIN: 1.0, // 1.0x acreage in millions
  SAFE_CASH_MULTIPLIER_MAX: 1.5, // 1.5x acreage in millions
  WAR_ALLOCATION_MIN: 0.33,     // 33% for war preparation
  WAR_ALLOCATION_MAX: 0.50,     // 50% for war preparation
  
  // Restoration timing (exact hours from documentation)
  DAMAGE_RESTORATION_HOURS: 48, // 48 hours for damage-based
  DEATH_RESTORATION_HOURS: 72,  // 72 hours for death-based
  
  // Bounty system (exact percentages from documentation)
  BOUNTY_LAND_RATE: 0.30,      // 30% of target realm
  BOUNTY_STRUCTURE_BONUS: 0.20, // 20% structure bonus
  BOUNTY_TURN_SAVINGS: 100      // 100+ turns equivalent
}

// Game formulas (exact calculations from pro player documentation)
export const GAME_FORMULAS = {
  // Combat power calculation (exact land acquisition ranges)
  calculateLandGained: (
    attackerOffense: number,
    defenderDefense: number,
    targetLand: number
  ): { min: number, max: number, resultType: string } => {
    const ratio = attackerOffense / defenderDefense
    
    if (ratio >= 2.0) {
      return {
        min: Math.floor(targetLand * 0.070),  // 7.0% with ease min
        max: Math.floor(targetLand * 0.0735), // 7.35% with ease max
        resultType: 'with_ease'
      }
    } else if (ratio >= 1.2) {
      return {
        min: Math.floor(targetLand * 0.0679), // 6.79% good fight min
        max: Math.floor(targetLand * 0.070),  // 7.0% good fight max
        resultType: 'good_fight'
      }
    } else {
      return { min: 0, max: 0, resultType: 'failed' }
    }
  },
  
  // Build Rate calculation (exact BR formula)
  calculateBuildRate: (totalStructures: number, totalLand: number): number => {
    if (totalLand === 0) return 0
    return Math.floor((totalStructures / totalLand) * 100)
  },
  
  // Resource generation calculation (with racial bonuses)
  calculateResourceGeneration: (
    baseAmount: number,
    racialBonus: number,
    buildingBonuses: number
  ): number => {
    return Math.floor(baseAmount * (1 + racialBonus) + buildingBonuses)
  },
  
  // Summon troop calculation (exact percentages by race)
  calculateSummonTroops: (raceId: string, networth: number): number => {
    const summonRates: Record<string, number> = {
      droben: 0.0304,    // 3.04% (best)
      elemental: 0.0284, // 2.84% (second)
      goblin: 0.0275,    // 2.75% (tied third)
      dwarven: 0.0275,   // 2.75% (tied third)
      human: 0.025,      // 2.5%
      vampire: 0.024,    // 2.4%
      elven: 0.023,      // 2.3%
      centaur: 0.022,    // 2.2%
      sidhe: 0.021,      // 2.1%
      fae: 0.020         // 2.0% (lowest)
    }
    
    const rate = summonRates[raceId.toLowerCase()] || 0.02
    return Math.floor(networth * rate)
  },
  
  // Temple requirement calculation (exact thresholds)
  calculateTempleRequirement: (spellTier: number, totalStructures: number): number => {
    const thresholds = [0.02, 0.04, 0.08, 0.12] // 2%, 4%, 8%, 12%
    const threshold = thresholds[spellTier - 1] || 0.02
    return Math.ceil(totalStructures * threshold)
  },
  
  // Scum detection calculation (exact formula)
  calculateDetectionRate: (
    yourScum: number,
    yourRaceEffectiveness: number,
    enemyScum: number,
    enemyRaceEffectiveness: number
  ): number => {
    if (yourScum < 100) return 0 // Minimum 100 scum required
    
    const yourStrength = yourScum * yourRaceEffectiveness
    const enemyStrength = enemyScum * enemyRaceEffectiveness
    
    return Math.min(0.95, yourStrength / (yourStrength + enemyStrength))
  },
  
  // Distance calculation for map-based features
  calculateDistance: (
    pos1: { x: number; y: number },
    pos2: { x: number; y: number }
  ): number => {
    return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2))
  }
}

// Validation functions (updated with exact limits)
export const GAME_VALIDATORS = {
  // Validate kingdom name
  isValidKingdomName: (name: string): boolean => {
    return name.length >= 3 && 
           name.length <= GAME_CONSTANTS.MAX_KINGDOM_NAME_LENGTH &&
           /^[a-zA-Z0-9\s\-_']+$/.test(name)
  },
  
  // Validate guild name
  isValidGuildName: (name: string): boolean => {
    return name.length >= 3 && 
           name.length <= GAME_CONSTANTS.MAX_GUILD_NAME_LENGTH &&
           /^[a-zA-Z0-9\s\-_']+$/.test(name)
  },
  
  // Validate chat message
  isValidChatMessage: (message: string): boolean => {
    return message.length > 0 && 
           message.length <= GAME_CONSTANTS.MAX_CHAT_MESSAGE_LENGTH &&
           message.trim().length > 0
  },
  
  // Validate coordinates
  isValidCoordinate: (x: number, y: number): boolean => {
    return x >= 0 && x < GAME_CONSTANTS.WORLD_WIDTH &&
           y >= 0 && y < GAME_CONSTANTS.WORLD_HEIGHT
  },
  
  // Validate resource amounts
  isValidResourceAmount: (amount: number, type: 'gold' | 'population' | 'land' | 'elan'): boolean => {
    const limits = {
      gold: GAME_CONSTANTS.MAX_GOLD,
      population: GAME_CONSTANTS.MAX_POPULATION,
      land: GAME_CONSTANTS.MAX_LAND,
      elan: GAME_CONSTANTS.MAX_ELAN
    }
    return amount >= 0 && amount <= limits[type]
  },
  
  // Validate build rate
  isOptimalBuildRate: (br: number): boolean => {
    return br >= GAME_CONSTANTS.OPTIMAL_BUILD_RATE_MIN && 
           br <= GAME_CONSTANTS.OPTIMAL_BUILD_RATE_MAX
  }
}

// Game state interfaces (updated with exact mechanics)
export interface GameState {
  currentTurn: number
  gameStartTime: Date
  ageEndTime: Date
  currentAge: 'early' | 'middle' | 'late'
  isActive: boolean
  victoryConditions: {
    domination: boolean
    economic: boolean
    territorial: boolean
  }
}

export interface PlayerStats {
  kingdomsCreated: number
  battlesWon: number
  battlesLost: number
  goldEarned: number
  spellsCast: number
  buildingsConstructed: number
  guildsJoined: number
  totalPlayTime: number
  bountiesCollected: number
  restorationsTriggered: number
}

export interface WorldState {
  totalKingdoms: number
  activeKingdoms: number
  totalTerritories: number
  occupiedTerritories: number
  totalGold: number
  totalPopulation: number
  averageKingdomSize: number
  currentAge: 'early' | 'middle' | 'late'
  majorGuildsAtWar: number
}

// Error types for game operations
export class GameError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'GameError'
  }
}

export class InsufficientResourcesError extends GameError {
  constructor(resource: string, required: number, available: number) {
    super(
      `Insufficient ${resource}: need ${required}, have ${available}`,
      'INSUFFICIENT_RESOURCES',
      { resource, required, available }
    )
  }
}

export class InvalidActionError extends GameError {
  constructor(action: string, reason: string) {
    super(
      `Invalid action '${action}': ${reason}`,
      'INVALID_ACTION',
      { action, reason }
    )
  }
}

export class CooldownError extends GameError {
  constructor(action: string, remainingTime: number) {
    super(
      `Action '${action}' is on cooldown for ${remainingTime} more turns`,
      'ACTION_COOLDOWN',
      { action, remainingTime }
    )
  }
}

export class RestorationError extends GameError {
  constructor(action: string, restorationType: string, remainingHours: number) {
    super(
      `Cannot perform '${action}' during ${restorationType} restoration (${remainingHours.toFixed(1)}h remaining)`,
      'RESTORATION_ACTIVE',
      { action, restorationType, remainingHours }
    )
  }
}

// Utility functions (updated with exact mechanics)
export const GAME_UTILS = {
  // Format large numbers for display
  formatNumber: (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  },
  
  // Format time remaining
  formatTimeRemaining: (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  },
  
  // Generate random kingdom name
  generateKingdomName: (): string => {
    const prefixes = ['North', 'South', 'East', 'West', 'High', 'Low', 'Great', 'New', 'Old']
    const bases = ['haven', 'shire', 'land', 'realm', 'kingdom', 'empire', 'domain', 'territory']
    const suffixes = ['ia', 'burg', 'ton', 'ford', 'wick', 'ham', 'dale', 'moor']
    
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const base = bases[Math.floor(Math.random() * bases.length)]
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)]
    
    return Math.random() > 0.5 ? `${prefix}${base}` : `${prefix}${suffix}`
  },
  
  // Calculate percentage
  calculatePercentage: (value: number, total: number): number => {
    return total > 0 ? Math.round((value / total) * 100) : 0
  },
  
  // Calculate safe cash reserves (from financial warfare documentation)
  calculateSafeCashReserves: (totalLand: number): { min: number, max: number } => {
    return {
      min: totalLand * GAME_CONSTANTS.SAFE_CASH_MULTIPLIER_MIN * 1000000,
      max: totalLand * GAME_CONSTANTS.SAFE_CASH_MULTIPLIER_MAX * 1000000
    }
  }
}

// Export everything as a single game data object for convenience
export const GAME_DATA = {
  RACES,
  UNIT_TYPES,
  BUILDING_TYPES,
  SPELLS,
  COMBAT_BALANCE,
  SORCERY_BALANCE,
  THIEVERY_BALANCE,
  BUILDING_BALANCE,
  BOUNTY_BALANCE,
  RESTORATION_BALANCE,
  GAME_CONSTANTS,
  GAME_FORMULAS,
  GAME_VALIDATORS,
  GAME_UTILS
}
