/**
 * Building definitions for Monarchy game
 * Combines authentic Monarchy building names with comprehensive building system
 */

export interface BuildingStats {
  cost: {
    gold: number
    turns: number
    population?: number
  }
  upkeep: number        // Gold per turn maintenance
  effects: {
    goldIncome?: number      // Gold generated per turn
    populationGrowth?: number // Population growth per turn
    landIncome?: number      // Land acquired per turn
    militaryBonus?: number   // Combat bonus percentage
    magicBonus?: number      // Sorcery bonus
    defenseBonus?: number    // Defensive bonus
    trainingSpeed?: number   // Unit training speed bonus
    researchPoints?: number  // Technology research points
    buildRateContribution?: number // Contribution to Build Rate (BR)
  }
  capacity?: number     // Maximum number that can be built
  requirements?: {
    buildings?: string[]
    technologies?: string[]
    population?: number
    land?: number
  }
  vulnerability: 'permanent' | 'perishable' // Survives attacks or vulnerable to destruction
}

export interface BuildingType {
  id: string
  name: string
  description: string
  category: 'economic' | 'military' | 'magical' | 'defensive' | 'special'
  stats: BuildingStats
  maxLevel?: number     // If building can be upgraded
  isAuthentic?: boolean // True for original Monarchy building names
}

export const BUILDING_TYPES: Record<string, BuildingType> = {
  // === AUTHENTIC MONARCHY BUILDINGS (from NPAC Elite documentation) ===
  
  // Core Infrastructure Buildings (Permanent - 60-70% allocation)
  quarries: {
    id: 'quarries',
    name: 'Quarries',
    description: 'Primary income generation structures (30-35% of total)',
    category: 'economic',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 100,
        turns: 1
      },
      upkeep: 5,
      effects: {
        goldIncome: 20,
        buildRateContribution: 1
      },
      vulnerability: 'permanent'
    }
  },

  barracks: {
    id: 'barracks',
    name: 'Barracks',
    description: 'Military training and housing facilities (30-35% of total)',
    category: 'military',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 120,
        turns: 1
      },
      upkeep: 8,
      effects: {
        trainingSpeed: 0.15,
        militaryBonus: 0.1,
        buildRateContribution: 1
      },
      vulnerability: 'permanent'
    }
  },

  hovels: {
    id: 'hovels',
    name: 'Hovels',
    description: 'Population housing and basic economic structures (10% of total)',
    category: 'economic',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 80,
        turns: 1
      },
      upkeep: 3,
      effects: {
        populationGrowth: 10,
        goldIncome: 8,
        buildRateContribution: 1
      },
      vulnerability: 'permanent'
    }
  },

  guildhalls: {
    id: 'guildhalls',
    name: 'Guildhalls',
    description: 'Administrative centers providing income bonuses (10% of total)',
    category: 'economic',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 200,
        turns: 1
      },
      upkeep: 15,
      effects: {
        goldIncome: 35,
        buildRateContribution: 1
      },
      vulnerability: 'perishable'
    }
  },

  temples: {
    id: 'temples',
    name: 'Temples',
    description: 'Religious structures providing magical protection (12% of total)',
    category: 'magical',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 150,
        turns: 1
      },
      upkeep: 10,
      effects: {
        goldIncome: 12,
        magicBonus: 0.2,
        buildRateContribution: 1
      },
      vulnerability: 'perishable'
    }
  },

  forts: {
    id: 'forts',
    name: 'Forts',
    description: 'Defensive fortifications protecting the realm (5-6% of total)',
    category: 'defensive',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 300,
        turns: 1
      },
      upkeep: 25,
      effects: {
        defenseBonus: 0.3,
        buildRateContribution: 1
      },
      vulnerability: 'perishable'
    }
  },

  // Race-specific authentic building names from documentation
  waterfalls: {
    id: 'waterfalls',
    name: 'Waterfalls',
    description: 'Droben-specific income structures (equivalent to Quarries)',
    category: 'economic',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 100,
        turns: 1
      },
      upkeep: 5,
      effects: {
        goldIncome: 20,
        buildRateContribution: 1
      },
      vulnerability: 'permanent'
    }
  },

  timoton: {
    id: 'timoton',
    name: 'TimoTon',
    description: 'Specialized economic structures',
    category: 'economic',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 180,
        turns: 1
      },
      upkeep: 12,
      effects: {
        goldIncome: 28,
        buildRateContribution: 1
      },
      vulnerability: 'permanent'
    }
  },

  baklavs: {
    id: 'baklavs',
    name: 'Baklavs',
    description: 'Advanced economic structures',
    category: 'economic',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 220,
        turns: 1
      },
      upkeep: 18,
      effects: {
        goldIncome: 32,
        buildRateContribution: 1
      },
      vulnerability: 'permanent'
    }
  },

  rumana: {
    id: 'rumana',
    name: 'RumaNa',
    description: 'High-value economic structures',
    category: 'economic',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 250,
        turns: 1
      },
      upkeep: 20,
      effects: {
        goldIncome: 38,
        buildRateContribution: 1
      },
      vulnerability: 'permanent'
    }
  },

  arches: {
    id: 'arches',
    name: 'Arches',
    description: 'Architectural structures with mixed benefits',
    category: 'economic',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 160,
        turns: 1
      },
      upkeep: 10,
      effects: {
        goldIncome: 22,
        populationGrowth: 5,
        buildRateContribution: 1
      },
      vulnerability: 'permanent'
    }
  },

  enclaves: {
    id: 'enclaves',
    name: 'Enclaves',
    description: 'Specialized community structures',
    category: 'economic',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 190,
        turns: 1
      },
      upkeep: 14,
      effects: {
        goldIncome: 26,
        militaryBonus: 0.05,
        buildRateContribution: 1
      },
      vulnerability: 'permanent'
    }
  },

  // === VAMPIRE-SPECIFIC BUILDINGS ===
  underwoods: {
    id: 'underwoods',
    name: 'Underwoods',
    description: 'Vampire-specific income structures (equivalent to Quarries)',
    category: 'economic',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 100,
        turns: 1
      },
      upkeep: 5,
      effects: {
        goldIncome: 20,
        buildRateContribution: 1
      },
      requirements: {
        race: ['vampire']
      },
      vulnerability: 'permanent'
    }
  },

  tombs: {
    id: 'tombs',
    name: 'Tombs',
    description: 'Vampire-specific military structures (equivalent to Barracks)',
    category: 'military',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 120,
        turns: 1
      },
      upkeep: 8,
      effects: {
        trainingSpeed: 0.15,
        militaryBonus: 0.1,
        buildRateContribution: 1
      },
      requirements: {
        race: ['vampire']
      },
      vulnerability: 'permanent'
    }
  },

  great_halls: {
    id: 'great_halls',
    name: 'Great Halls',
    description: 'Vampire-specific administrative centers (equivalent to Guildhalls)',
    category: 'economic',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 200,
        turns: 1
      },
      upkeep: 15,
      effects: {
        goldIncome: 35,
        buildRateContribution: 1
      },
      requirements: {
        race: ['vampire']
      },
      vulnerability: 'perishable'
    }
  },

  bloodbaths: {
    id: 'bloodbaths',
    name: 'Bloodbaths',
    description: 'Vampire-specific training facilities (enhanced Barracks)',
    category: 'military',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 150,
        turns: 1
      },
      upkeep: 12,
      effects: {
        trainingSpeed: 0.20,
        militaryBonus: 0.15,
        buildRateContribution: 1
      },
      requirements: {
        race: ['vampire']
      },
      vulnerability: 'permanent'
    }
  },

  // === GOBLIN-SPECIFIC BUILDINGS ===
  smithies: {
    id: 'smithies',
    name: 'Smithies',
    description: 'Goblin-specific crafting structures',
    category: 'economic',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 140,
        turns: 1
      },
      upkeep: 8,
      effects: {
        goldIncome: 22,
        militaryBonus: 0.05,
        buildRateContribution: 1
      },
      requirements: {
        race: ['goblin']
      },
      vulnerability: 'permanent'
    }
  },

  warrens: {
    id: 'warrens',
    name: 'Warrens',
    description: 'Goblin-specific population and military structures',
    category: 'military',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 110,
        turns: 1
      },
      upkeep: 6,
      effects: {
        populationGrowth: 8,
        trainingSpeed: 0.12,
        buildRateContribution: 1
      },
      requirements: {
        race: ['goblin']
      },
      vulnerability: 'permanent'
    }
  },

  shrines: {
    id: 'shrines',
    name: 'Shrines',
    description: 'Goblin-specific religious structures (equivalent to Temples)',
    category: 'magical',
    isAuthentic: true,
    stats: {
      cost: {
        gold: 150,
        turns: 1
      },
      upkeep: 10,
      effects: {
        goldIncome: 12,
        magicBonus: 0.2,
        buildRateContribution: 1
      },
      requirements: {
        race: ['goblin']
      },
      vulnerability: 'perishable'
    }
  },

  // === ADDITIONAL COMPREHENSIVE BUILDINGS ===

  // Economic Buildings
  farm: {
    id: 'farm',
    name: 'Farm',
    description: 'Provides food and supports population growth',
    category: 'economic',
    stats: {
      cost: {
        gold: 50,
        turns: 2
      },
      upkeep: 2,
      effects: {
        populationGrowth: 5,
        goldIncome: 3,
        buildRateContribution: 1
      },
      vulnerability: 'permanent'
    }
  },

  market: {
    id: 'market',
    name: 'Market',
    description: 'Generates gold through trade and commerce',
    category: 'economic',
    stats: {
      cost: {
        gold: 100,
        turns: 3
      },
      upkeep: 5,
      effects: {
        goldIncome: 15,
        buildRateContribution: 1
      },
      vulnerability: 'permanent'
    }
  },

  mine: {
    id: 'mine',
    name: 'Mine',
    description: 'Extracts precious metals and gems for wealth',
    category: 'economic',
    stats: {
      cost: {
        gold: 200,
        turns: 5
      },
      upkeep: 8,
      effects: {
        goldIncome: 25,
        buildRateContribution: 1
      },
      requirements: {
        technologies: ['mining']
      },
      vulnerability: 'permanent'
    }
  },

  bank: {
    id: 'bank',
    name: 'Bank',
    description: 'Manages finances and provides investment income',
    category: 'economic',
    stats: {
      cost: {
        gold: 500,
        turns: 8
      },
      upkeep: 15,
      effects: {
        goldIncome: 50,
        buildRateContribution: 1
      },
      capacity: 5,
      requirements: {
        buildings: ['market'],
        technologies: ['economics']
      },
      vulnerability: 'perishable'
    }
  },

  // Military Buildings
  armory: {
    id: 'armory',
    name: 'Armory',
    description: 'Provides weapons and armor for military units',
    category: 'military',
    stats: {
      cost: {
        gold: 300,
        turns: 6
      },
      upkeep: 15,
      effects: {
        militaryBonus: 0.15,
        buildRateContribution: 1
      },
      requirements: {
        buildings: ['barracks']
      },
      vulnerability: 'permanent'
    }
  },

  stables: {
    id: 'stables',
    name: 'Stables',
    description: 'Houses and trains cavalry units',
    category: 'military',
    stats: {
      cost: {
        gold: 250,
        turns: 5
      },
      upkeep: 12,
      effects: {
        trainingSpeed: 0.15,
        buildRateContribution: 1
      },
      requirements: {
        buildings: ['barracks']
      },
      vulnerability: 'permanent'
    }
  },

  archery_range: {
    id: 'archery_range',
    name: 'Archery Range',
    description: 'Trains archers and ranged units',
    category: 'military',
    stats: {
      cost: {
        gold: 200,
        turns: 4
      },
      upkeep: 8,
      effects: {
        trainingSpeed: 0.1,
        buildRateContribution: 1
      },
      vulnerability: 'permanent'
    }
  },

  siege_workshop: {
    id: 'siege_workshop',
    name: 'Siege Workshop',
    description: 'Constructs siege engines and war machines',
    category: 'military',
    stats: {
      cost: {
        gold: 400,
        turns: 8
      },
      upkeep: 20,
      effects: {
        militaryBonus: 0.25,
        buildRateContribution: 1
      },
      requirements: {
        buildings: ['armory'],
        technologies: ['siege_warfare']
      },
      vulnerability: 'permanent'
    }
  },

  // Defensive Buildings
  walls: {
    id: 'walls',
    name: 'Walls',
    description: 'Stone walls that protect the territory',
    category: 'defensive',
    maxLevel: 5,
    stats: {
      cost: {
        gold: 100,
        turns: 3
      },
      upkeep: 5,
      effects: {
        defenseBonus: 0.2,
        buildRateContribution: 1
      },
      vulnerability: 'permanent'
    }
  },

  watchtower: {
    id: 'watchtower',
    name: 'Watchtower',
    description: 'Provides early warning of enemy attacks',
    category: 'defensive',
    stats: {
      cost: {
        gold: 150,
        turns: 4
      },
      upkeep: 8,
      effects: {
        defenseBonus: 0.1,
        buildRateContribution: 1
      },
      vulnerability: 'permanent'
    }
  },

  fortress: {
    id: 'fortress',
    name: 'Fortress',
    description: 'Massive defensive structure providing strong protection',
    category: 'defensive',
    stats: {
      cost: {
        gold: 1000,
        turns: 15
      },
      upkeep: 50,
      effects: {
        defenseBonus: 0.5,
        militaryBonus: 0.2,
        buildRateContribution: 1
      },
      capacity: 1,
      requirements: {
        buildings: ['walls'],
        land: 200
      },
      vulnerability: 'perishable'
    }
  },

  // Magical Buildings
  mage_tower: {
    id: 'mage_tower',
    name: 'Mage Tower',
    description: 'Center of magical learning and spell research',
    category: 'magical',
    stats: {
      cost: {
        gold: 500,
        turns: 10
      },
      upkeep: 25,
      effects: {
        magicBonus: 0.25,
        researchPoints: 5,
        buildRateContribution: 1
      },
      requirements: {
        buildings: ['temples'],
        technologies: ['basic_magic']
      },
      vulnerability: 'perishable'
    }
  },

  library: {
    id: 'library',
    name: 'Library',
    description: 'Repository of knowledge and magical research',
    category: 'magical',
    stats: {
      cost: {
        gold: 300,
        turns: 6
      },
      upkeep: 15,
      effects: {
        researchPoints: 10,
        magicBonus: 0.1,
        buildRateContribution: 1
      },
      vulnerability: 'perishable'
    }
  },

  // Special Buildings
  palace: {
    id: 'palace',
    name: 'Palace',
    description: 'Seat of power providing various bonuses',
    category: 'special',
    stats: {
      cost: {
        gold: 2000,
        turns: 20
      },
      upkeep: 100,
      effects: {
        goldIncome: 100,
        populationGrowth: 20,
        militaryBonus: 0.15,
        defenseBonus: 0.3,
        buildRateContribution: 1
      },
      capacity: 1,
      requirements: {
        buildings: ['fortress', 'bank'],
        population: 1000,
        land: 500
      },
      vulnerability: 'perishable'
    }
  },

  granary: {
    id: 'granary',
    name: 'Granary',
    description: 'Stores food and supports larger populations',
    category: 'economic',
    stats: {
      cost: {
        gold: 100,
        turns: 3
      },
      upkeep: 5,
      effects: {
        populationGrowth: 10,
        buildRateContribution: 1
      },
      requirements: {
        buildings: ['farm']
      },
      vulnerability: 'permanent'
    }
  },

  tavern: {
    id: 'tavern',
    name: 'Tavern',
    description: 'Gathering place that boosts morale and income',
    category: 'special',
    stats: {
      cost: {
        gold: 150,
        turns: 4
      },
      upkeep: 8,
      effects: {
        goldIncome: 12,
        militaryBonus: 0.05,
        buildRateContribution: 1
      },
      vulnerability: 'permanent'
    }
  }
}

// Build Rate (BR) System - Core Monarchy mechanic
export interface BuildRateSystem {
  calculateBR: (totalStructures: number, totalLand: number) => number
  getOptimalBRRange: () => { min: number, max: number }
  getMaxSustainableBR: () => number
  calculateDevelopmentCost: (acres: number) => number
}

export const BUILD_RATE_SYSTEM: BuildRateSystem = {
  calculateBR: (totalStructures: number, totalLand: number): number => {
    if (totalLand === 0) return 0
    return Math.floor((totalStructures / totalLand) * 100)
  },

  getOptimalBRRange: () => ({ min: 16, max: 20 }),
  
  getMaxSustainableBR: () => 28,
  
  calculateDevelopmentCost: (acres: number): number => {
    return acres * 317.5 // 310-325 gold per acre average
  }
}

// Optimal building ratios for 30k acre kingdoms (from NPAC Elite documentation)
export const OPTIMAL_BUILDING_RATIOS = {
  quarries: { min: 0.30, max: 0.35 },      // 30-35%
  barracks: { min: 0.30, max: 0.35 },      // 30-35%
  guildhalls: { min: 0.10, max: 0.10 },    // 10%
  hovels: { min: 0.10, max: 0.10 },        // 10%
  forts: { min: 0.05, max: 0.06 },         // 5-6%
  temples: { min: 0.12, max: 0.12 }        // 12%
}

// Building upgrade costs (for buildings with maxLevel)
export const UPGRADE_COST_MULTIPLIER = 1.5

// Helper functions
export const getBuildingType = (buildingId: string): BuildingType | undefined => {
  return BUILDING_TYPES[buildingId]
}

export const calculateBuildRate = (buildings: Record<string, number>, totalLand: number): number => {
  const totalStructures = Object.values(buildings).reduce((sum, count) => sum + count, 0)
  return BUILD_RATE_SYSTEM.calculateBR(totalStructures, totalLand)
}

export const calculateBuildingCost = (
  buildingType: BuildingType,
  level: number = 1,
  raceStats: { building: number, economy: number }
): { gold: number, turns: number } => {
  const baseCost = buildingType.stats.cost
  const levelMultiplier = Math.pow(UPGRADE_COST_MULTIPLIER, level - 1)
  
  const buildingModifier = 1 - (raceStats.building - 1) * 0.1 // 10% reduction per building point above 1
  const economyModifier = 1 - (raceStats.economy - 1) * 0.05 // 5% cost reduction per economy point above 1

  return {
    gold: Math.ceil(baseCost.gold * levelMultiplier * buildingModifier * economyModifier),
    turns: Math.ceil((baseCost.turns || 1) * levelMultiplier * buildingModifier)
  }
}

export const calculateOptimalDistribution = (totalStructures: number): Record<string, number> => {
  return {
    quarries: Math.floor(totalStructures * 0.325),      // 32.5% average
    barracks: Math.floor(totalStructures * 0.325),      // 32.5% average
    guildhalls: Math.floor(totalStructures * 0.10),     // 10%
    hovels: Math.floor(totalStructures * 0.10),         // 10%
    forts: Math.floor(totalStructures * 0.055),         // 5.5% average
    temples: Math.floor(totalStructures * 0.12)         // 12%
  }
}

export const isOptimalBuildRate = (br: number): boolean => {
  const optimal = BUILD_RATE_SYSTEM.getOptimalBRRange()
  return br >= optimal.min && br <= optimal.max
}

export const getAuthenticBuildings = (): BuildingType[] => {
  return Object.values(BUILDING_TYPES).filter(building => building.isAuthentic)
}

export const canBuildBuilding = (
  buildingId: string,
  currentBuildings: Record<string, number>,
  availableResources: { gold: number, population: number, land: number },
  technologies: string[] = []
): { canBuild: boolean, reason?: string } => {
  const buildingType = getBuildingType(buildingId)
  if (!buildingType) {
    return { canBuild: false, reason: 'Unknown building type' }
  }

  // Check capacity limits
  if (buildingType.capacity && currentBuildings[buildingId] >= buildingType.capacity) {
    return { canBuild: false, reason: 'Maximum capacity reached' }
  }

  // Check requirements
  if (buildingType.stats.requirements) {
    const req = buildingType.stats.requirements

    // Check building requirements
    if (req.buildings) {
      for (const requiredBuilding of req.buildings) {
        if (!currentBuildings[requiredBuilding] || currentBuildings[requiredBuilding] === 0) {
          return { canBuild: false, reason: `Requires ${requiredBuilding}` }
        }
      }
    }

    // Check technology requirements
    if (req.technologies) {
      for (const requiredTech of req.technologies) {
        if (!technologies.includes(requiredTech)) {
          return { canBuild: false, reason: `Requires ${requiredTech} technology` }
        }
      }
    }

    // Check resource requirements
    if (req.population && availableResources.population < req.population) {
      return { canBuild: false, reason: 'Insufficient population' }
    }

    if (req.land && availableResources.land < req.land) {
      return { canBuild: false, reason: 'Insufficient land' }
    }
  }

  return { canBuild: true }
}

export type BuildingId = keyof typeof BUILDING_TYPES
export const BUILDING_IDS = Object.keys(BUILDING_TYPES) as BuildingId[]
