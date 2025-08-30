/**
 * Main game data exports for Monarchy game
 * Centralized access to all game configuration data
 */

// Core game data exports
export * from './races'
export * from './units'
export * from './buildings'
export * from './spells'
export * from './balance'

// Re-export key types for convenience
export type {
  Race,
  RaceStats,
  RaceId
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

// Game constants
export const GAME_CONSTANTS = {
  // Turn and time mechanics
  TURNS_PER_DAY: 24,
  MAX_STORED_TURNS: 72,
  TURN_GENERATION_MINUTES: 60,
  
  // Resource limits
  MAX_GOLD: 10000000,
  MAX_POPULATION: 100000,
  MAX_LAND: 10000,
  MAX_MANA: 1000,
  
  // Combat limits
  MAX_ARMY_SIZE: 50000,
  MIN_ATTACK_SIZE: 1,
  MAX_FORTIFICATION_LEVEL: 5,
  
  // Building limits
  MAX_BUILDINGS_PER_TYPE: 100,
  MAX_BUILDING_LEVEL: 5,
  
  // Magic limits
  MAX_ACTIVE_SPELLS: 10,
  MAX_SPELL_LEVEL: 5,
  
  // Social limits
  MAX_ALLIANCE_SIZE: 20,
  MAX_ALLIANCE_NAME_LENGTH: 50,
  MAX_KINGDOM_NAME_LENGTH: 30,
  MAX_CHAT_MESSAGE_LENGTH: 500,
  
  // World size
  WORLD_WIDTH: 100,
  WORLD_HEIGHT: 100,
  MAX_TERRITORIES_PER_KINGDOM: 50,
  
  // Victory conditions
  DOMINATION_THRESHOLD: 0.6,
  ECONOMIC_VICTORY_THRESHOLD: 1000000,
  TERRITORIAL_VICTORY_THRESHOLD: 0.4
}

// Game formulas - commonly used calculations
export const GAME_FORMULAS = {
  // Combat power calculation
  calculateCombatPower: (
    units: Record<string, number>,
    raceStats: { warOffense: number; warDefense: number },
    isDefending: boolean = false
  ): { offense: number; defense: number } => {
    // Implementation would use unit stats and racial bonuses
    // This is a simplified version for the type system
    return { offense: 0, defense: 0 }
  },
  
  // Resource generation calculation
  calculateResourceGeneration: (
    baseAmount: number,
    racialBonus: number,
    buildingBonuses: number
  ): number => {
    return Math.floor(baseAmount * (1 + racialBonus) + buildingBonuses)
  },
  
  // Experience and leveling
  calculateExperienceGain: (
    actionType: 'combat' | 'building' | 'magic' | 'trade',
    magnitude: number
  ): number => {
    const multipliers = {
      combat: 2.0,
      building: 1.0,
      magic: 1.5,
      trade: 0.5
    }
    return Math.floor(magnitude * multipliers[actionType])
  },
  
  // Distance calculation for map-based features
  calculateDistance: (
    pos1: { x: number; y: number },
    pos2: { x: number; y: number }
  ): number => {
    return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2))
  }
}

// Validation functions
export const GAME_VALIDATORS = {
  // Validate kingdom name
  isValidKingdomName: (name: string): boolean => {
    return name.length >= 3 && 
           name.length <= GAME_CONSTANTS.MAX_KINGDOM_NAME_LENGTH &&
           /^[a-zA-Z0-9\s\-_']+$/.test(name)
  },
  
  // Validate alliance name
  isValidAllianceName: (name: string): boolean => {
    return name.length >= 3 && 
           name.length <= GAME_CONSTANTS.MAX_ALLIANCE_NAME_LENGTH &&
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
  isValidResourceAmount: (amount: number, type: 'gold' | 'population' | 'land' | 'mana'): boolean => {
    const limits = {
      gold: GAME_CONSTANTS.MAX_GOLD,
      population: GAME_CONSTANTS.MAX_POPULATION,
      land: GAME_CONSTANTS.MAX_LAND,
      mana: GAME_CONSTANTS.MAX_MANA
    }
    return amount >= 0 && amount <= limits[type]
  }
}

// Game state interfaces
export interface GameState {
  currentTurn: number
  gameStartTime: Date
  ageEndTime: Date
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
  alliancesJoined: number
  totalPlayTime: number
}

export interface WorldState {
  totalKingdoms: number
  activeKingdoms: number
  totalTerritories: number
  occupiedTerritories: number
  totalGold: number
  totalPopulation: number
  averageKingdomSize: number
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

// Utility functions
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
  }
}

// Export everything as a single game data object for convenience
export const GAME_DATA = {
  RACES,
  UNIT_TYPES,
  BUILDING_TYPES,
  SPELLS,
  GAME_BALANCE,
  GAME_CONSTANTS,
  GAME_FORMULAS,
  GAME_VALIDATORS,
  GAME_UTILS
}
