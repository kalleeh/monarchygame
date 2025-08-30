/**
 * Game balance configuration for Monarchy game
 * Core formulas and constants that define game mechanics
 */

// Combat calculation constants
export const COMBAT_BALANCE = {
  // Base combat effectiveness
  baseOffenseMultiplier: 1.0,
  baseDefenseMultiplier: 1.2,  // 20% defensive advantage
  
  // Racial stat impact (per point above 1)
  racialOffenseBonus: 0.2,     // 20% per war offense point
  racialDefenseBonus: 0.2,     // 20% per war defense point
  
  // Fortification bonuses
  fortificationBonus: {
    1: 0.1,   // 10% defense bonus
    2: 0.2,   // 20% defense bonus
    3: 0.35,  // 35% defense bonus
    4: 0.5,   // 50% defense bonus
    5: 0.7    // 70% defense bonus
  },
  
  // Unit type effectiveness
  unitTypeBonus: {
    cavalry_vs_archers: 1.5,
    cavalry_vs_siege: 1.5,
    archers_vs_infantry: 1.3,
    infantry_vs_cavalry: 1.2,
    siege_vs_fortifications: 2.0
  },
  
  // Terrain modifiers
  terrainModifiers: {
    plains: { offense: 1.0, defense: 1.0 },
    forest: { offense: 0.9, defense: 1.1 },
    mountains: { offense: 0.8, defense: 1.3 },
    swamp: { offense: 0.7, defense: 1.2 },
    desert: { offense: 0.9, defense: 0.9 }
  },
  
  // Casualty rates
  casualtyRates: {
    winner: { min: 0.1, max: 0.3 },    // 10-30% casualties for winner
    loser: { min: 0.4, max: 0.8 }      // 40-80% casualties for loser
  },
  
  // Special attack types
  attackTypes: {
    raid: {
      offenseBonus: 1.2,
      defenseBonus: 0.8,
      goldCapture: 0.3,    // 30% of enemy gold
      landCapture: 0
    },
    siege: {
      offenseBonus: 0.9,
      defenseBonus: 1.0,
      goldCapture: 0.1,
      landCapture: 0.2     // 20% of enemy land
    },
    controlledStrike: {
      offenseBonus: 1.0,
      defenseBonus: 1.0,
      goldCapture: 0.15,
      landCapture: 0.1,
      fortDestruction: true // Can destroy forts
    }
  }
}

// Economic balance
export const ECONOMIC_BALANCE = {
  // Base resource generation
  baseGoldIncome: 100,           // Base gold per turn
  basePopulationGrowth: 50,      // Base population growth per turn
  baseLandIncome: 5,             // Base land acquisition per turn
  
  // Racial economic bonuses (per point above 1)
  economyBonus: 0.15,            // 15% resource bonus per economy point
  titheBonus: 0.15,              // 15% gold bonus per tithe point
  
  // Population mechanics
  populationSupport: {
    goldPerPop: 0.1,             // Gold income per population
    landPerPop: 0.02,            // Land needed per population
    maxGrowthRate: 0.05          // 5% max population growth per turn
  },
  
  // Building efficiency
  buildingEfficiency: {
    baseEfficiency: 1.0,
    racialBonus: 0.1,            // 10% per building point above 1
    overcrowdingPenalty: 0.05    // 5% penalty per 100 population over land capacity
  },
  
  // Trade and caravans
  tradeBalance: {
    baseCaravanValue: 500,       // Base gold value of caravan
    caravanFrequency: 12,        // Hours between caravans
    humanBonus: 0.5,             // Humans can send twice as often
    maxDistance: 1000,           // Maximum caravan distance
    riskFactor: 0.1              // 10% chance of caravan loss
  }
}

// Magic system balance
export const MAGIC_BALANCE = {
  // Mana generation
  baseManaGeneration: 10,        // Base mana per turn
  sorceryBonus: 0.2,            // 20% bonus per sorcery point above 1
  templeBonus: 5,               // Mana per temple
  mageBonus: 10,                // Mana per mage unit
  
  // Spell effectiveness
  spellDamageMultiplier: 0.25,   // 25% damage bonus per sorcery point
  spellResistance: 0.1,          // 10% magic resistance per fort point
  
  // Backlash mechanics
  baseBacklashChance: 0.1,       // 10% base backlash chance
  sorceryReduction: 0.1,         // 10% reduction per sorcery point
  elementalPenalty: 0.05,        // +5% backlash for Elementals
  
  // Special racial bonuses
  racialMagicBonuses: {
    Sidhe: { sorceryBonus: 1.0, spellSlots: 1 },
    Vampire: { elanGeneration: 1.2 },
    Elemental: { sorceryBonus: 0.2, backlashPenalty: 0.05 },
    Droben: { summonBonus: 2.0 }  // Calculate summons with max sorcery
  }
}

// Unit training and costs
export const TRAINING_BALANCE = {
  // Base training costs (modified by racial stats)
  baseCosts: {
    tier1: { gold: 10, turns: 1, population: 1 },
    tier2: { gold: 25, turns: 2, population: 1 },
    tier3: { gold: 75, turns: 4, population: 1 },
    tier4: { gold: 150, turns: 6, population: 1 }
  },
  
  // Training speed modifiers
  trainingSpeedBonus: 0.1,       // 10% faster per training point above 1
  barracksBonus: 0.2,           // 20% faster with barracks
  
  // Unit upkeep costs
  upkeepMultiplier: 1.0,
  economyReduction: 0.05,        // 5% upkeep reduction per economy point
  
  // Unit effectiveness scaling
  veteranBonus: {
    battles1to5: 0.05,           // 5% bonus per battle (max 25%)
    battles6to10: 0.03,          // 3% bonus per battle (max 15% more)
    maxBonus: 0.4                // 40% maximum veteran bonus
  }
}

// Building construction balance
export const BUILDING_BALANCE = {
  // Construction speed modifiers
  buildingSpeedBonus: 0.1,       // 10% faster per building point above 1
  economyBonus: 0.05,           // 5% cost reduction per economy point
  
  // Upgrade cost scaling
  upgradeCostMultiplier: 1.5,    // Each level costs 50% more
  maxBuildingLevel: 5,
  
  // Building effectiveness
  buildingEfficiencyBonus: 0.1,  // 10% more effective per building point
  
  // Capacity limits
  buildingCapacity: {
    palace: 1,
    fortress: 1,
    bank: 5,
    market: 10
  }
}

// Espionage and scum mechanics
export const ESPIONAGE_BALANCE = {
  // Base scum effectiveness
  baseScumPower: 1.0,
  scumBonus: 0.2,               // 20% bonus per scum point above 1
  
  // Espionage actions
  espionageActions: {
    reconnaissance: { cost: 10, successRate: 0.8 },
    sabotage: { cost: 25, successRate: 0.6 },
    assassination: { cost: 50, successRate: 0.4 },
    theft: { cost: 20, successRate: 0.7 }
  },
  
  // Counter-espionage
  counterEspionageBonus: 0.15,   // 15% detection bonus per scum point
  
  // Special racial abilities
  centaurKillScum: {
    cost: 25,
    effectiveness: 1.5           // 50% more effective than normal
  }
}

// Technology research balance
export const RESEARCH_BALANCE = {
  // Base research generation
  baseResearchPoints: 5,         // Base research per turn
  libraryBonus: 10,             // Research points per library
  mageBonus: 2,                 // Research points per mage
  
  // Technology costs
  technologyCosts: {
    tier1: 100,   // Basic technologies
    tier2: 250,   // Advanced technologies
    tier3: 500,   // Master technologies
    tier4: 1000   // Legendary technologies
  },
  
  // Research efficiency
  buildingBonus: 0.1,           // 10% faster research per building point
  
  // Technology prerequisites
  prerequisiteSystem: true       // Technologies require previous techs
}

// Victory conditions and scoring
export const VICTORY_BALANCE = {
  // Victory thresholds
  dominationThreshold: 0.6,      // Control 60% of world
  economicThreshold: 1000000,    // Accumulate 1M gold
  territorialThreshold: 0.4,     // Control 40% of territories
  
  // Scoring weights
  scoreWeights: {
    gold: 0.001,                 // 1 point per 1000 gold
    population: 0.01,            // 1 point per 100 population
    land: 0.1,                   // 1 point per 10 land
    military: 0.05,              // 1 point per 20 military power
    buildings: 1.0,              // 1 point per building
    technologies: 10.0           // 10 points per technology
  },
  
  // Age length and turn mechanics
  standardAgeLength: 60,         // 60 days
  turnsPerDay: 24,              // 24 turns per day (1 per hour)
  maxStoredTurns: 72            // Can store up to 3 days of turns
}

// Random events and special mechanics
export const SPECIAL_BALANCE = {
  // Random events
  eventFrequency: 0.05,          // 5% chance per turn
  eventImpactRange: { min: 0.1, max: 0.3 }, // 10-30% impact
  
  // Special racial abilities cooldowns
  specialAbilityCooldowns: {
    koboldRage: 10,              // 10 turns between uses
    remotefog: 15,              // 15 turns between uses
    summonCircles: 20,           // 20 turns between uses
    killScum: 5                 // 5 turns between uses
  },
  
  // Elan generation (for Vampire/Sidhe)
  elanGeneration: {
    baseRate: 0.02,              // 2% per turn
    vampireSidheBonus: 1.5,      // 50% faster generation
    combatBonus: 0.1,            // 10% bonus per combat
    maxElan: 100                 // Maximum elan points
  }
}

// Helper functions for balance calculations
export const calculateRacialModifier = (statValue: number, bonusPerPoint: number): number => {
  return 1 + (statValue - 1) * bonusPerPoint
}

export const calculateCombatEffectiveness = (
  baseValue: number,
  racialStat: number,
  bonusPerPoint: number,
  additionalModifiers: number = 1
): number => {
  const racialModifier = calculateRacialModifier(racialStat, bonusPerPoint)
  return baseValue * racialModifier * additionalModifiers
}

export const calculateBuildingCost = (
  baseCost: number,
  level: number,
  buildingStat: number,
  economyStat: number
): number => {
  const levelMultiplier = Math.pow(BUILDING_BALANCE.upgradeCostMultiplier, level - 1)
  const buildingModifier = calculateRacialModifier(buildingStat, -BUILDING_BALANCE.buildingSpeedBonus)
  const economyModifier = calculateRacialModifier(economyStat, -BUILDING_BALANCE.economyBonus)
  
  return Math.ceil(baseCost * levelMultiplier * buildingModifier * economyModifier)
}

export const calculateResourceGeneration = (
  baseGeneration: number,
  relevantStat: number,
  bonusPerPoint: number,
  buildingBonuses: number = 0
): number => {
  const racialModifier = calculateRacialModifier(relevantStat, bonusPerPoint)
  return Math.floor((baseGeneration * racialModifier) + buildingBonuses)
}

// Export all balance configurations
export const GAME_BALANCE = {
  COMBAT_BALANCE,
  ECONOMIC_BALANCE,
  MAGIC_BALANCE,
  TRAINING_BALANCE,
  BUILDING_BALANCE,
  ESPIONAGE_BALANCE,
  RESEARCH_BALANCE,
  VICTORY_BALANCE,
  SPECIAL_BALANCE
}
