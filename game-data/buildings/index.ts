/**
 * Building definitions for Monarchy game
 * Based on original Monarchy/Canon game mechanics
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
  }
  capacity?: number     // Maximum number that can be built
  requirements?: {
    buildings?: string[]
    technologies?: string[]
    population?: number
    land?: number
  }
}

export interface BuildingType {
  id: string
  name: string
  description: string
  category: 'economic' | 'military' | 'magical' | 'defensive' | 'special'
  stats: BuildingStats
  maxLevel?: number     // If building can be upgraded
}

export const BUILDING_TYPES: Record<string, BuildingType> = {
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
        goldIncome: 3
      }
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
        goldIncome: 15
      }
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
        goldIncome: 25
      },
      requirements: {
        technologies: ['mining']
      }
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
        goldIncome: 50
      },
      capacity: 5,
      requirements: {
        buildings: ['market'],
        technologies: ['economics']
      }
    }
  },

  // Military Buildings
  barracks: {
    id: 'barracks',
    name: 'Barracks',
    description: 'Trains and houses military units',
    category: 'military',
    stats: {
      cost: {
        gold: 150,
        turns: 4
      },
      upkeep: 10,
      effects: {
        trainingSpeed: 0.2, // 20% faster training
        militaryBonus: 0.1  // 10% combat bonus
      }
    }
  },

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
        militaryBonus: 0.15 // 15% combat bonus
      },
      requirements: {
        buildings: ['barracks']
      }
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
        trainingSpeed: 0.15 // Cavalry training bonus
      },
      requirements: {
        buildings: ['barracks']
      }
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
        trainingSpeed: 0.1
      }
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
        militaryBonus: 0.25 // Bonus vs fortifications
      },
      requirements: {
        buildings: ['armory'],
        technologies: ['siege_warfare']
      }
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
        defenseBonus: 0.2 // 20% per level
      }
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
        defenseBonus: 0.1
      }
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
        militaryBonus: 0.2
      },
      capacity: 1,
      requirements: {
        buildings: ['walls'],
        land: 200
      }
    }
  },

  // Magical Buildings
  temple: {
    id: 'temple',
    name: 'Temple',
    description: 'Provides spiritual guidance and magical energy',
    category: 'magical',
    stats: {
      cost: {
        gold: 200,
        turns: 5
      },
      upkeep: 10,
      effects: {
        magicBonus: 0.1,
        goldIncome: 8 // Tithe income
      }
    }
  },

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
        researchPoints: 5
      },
      requirements: {
        buildings: ['temple'],
        technologies: ['basic_magic']
      }
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
        magicBonus: 0.1
      }
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
        defenseBonus: 0.3
      },
      capacity: 1,
      requirements: {
        buildings: ['fortress', 'bank'],
        population: 1000,
        land: 500
      }
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
        populationGrowth: 10
      },
      requirements: {
        buildings: ['farm']
      }
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
        militaryBonus: 0.05
      }
    }
  }
}

// Building upgrade costs (for buildings with maxLevel)
export const UPGRADE_COST_MULTIPLIER = 1.5

// Helper functions
export const getBuildingType = (buildingId: string): BuildingType | undefined => {
  return BUILDING_TYPES[buildingId]
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
    turns: Math.ceil(baseCost.turns * levelMultiplier * buildingModifier)
  }
}

export const calculateBuildingEffects = (
  buildings: Record<string, number>,
  raceStats: { tithe: number, building: number }
): {
  goldIncome: number
  populationGrowth: number
  militaryBonus: number
  magicBonus: number
  defenseBonus: number
  trainingSpeed: number
  researchPoints: number
} => {
  let totalEffects = {
    goldIncome: 0,
    populationGrowth: 0,
    militaryBonus: 0,
    magicBonus: 0,
    defenseBonus: 0,
    trainingSpeed: 0,
    researchPoints: 0
  }

  Object.entries(buildings).forEach(([buildingId, count]) => {
    const buildingType = getBuildingType(buildingId)
    if (buildingType && count > 0) {
      const effects = buildingType.stats.effects
      
      totalEffects.goldIncome += (effects.goldIncome || 0) * count
      totalEffects.populationGrowth += (effects.populationGrowth || 0) * count
      totalEffects.militaryBonus += (effects.militaryBonus || 0) * count
      totalEffects.magicBonus += (effects.magicBonus || 0) * count
      totalEffects.defenseBonus += (effects.defenseBonus || 0) * count
      totalEffects.trainingSpeed += (effects.trainingSpeed || 0) * count
      totalEffects.researchPoints += (effects.researchPoints || 0) * count
    }
  })

  // Apply racial modifiers
  const titheModifier = 1 + (raceStats.tithe - 1) * 0.15 // 15% income bonus per tithe point above 1
  const buildingModifier = 1 + (raceStats.building - 1) * 0.1 // 10% building efficiency per point above 1

  totalEffects.goldIncome *= titheModifier
  totalEffects.populationGrowth *= buildingModifier
  totalEffects.researchPoints *= buildingModifier

  return totalEffects
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
