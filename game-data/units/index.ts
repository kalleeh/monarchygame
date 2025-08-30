/**
 * Unit definitions for Monarchy game
 * Based on original Monarchy/Canon game mechanics
 */

export interface UnitStats {
  offense: number      // Base offensive power
  defense: number      // Base defensive power
  cost: {
    gold: number      // Gold cost to train
    turns: number     // Turns required to train
    population: number // Population required
  }
  upkeep: number      // Gold per turn maintenance
  hitPoints: number   // Unit health/durability
  speed: number       // Movement/initiative
  special?: string    // Special abilities
}

export interface UnitType {
  id: string
  name: string
  description: string
  tier: number        // 1-4, T1 = cheapest/fastest, T4 = strongest/slowest
  category: 'infantry' | 'cavalry' | 'ranged' | 'siege' | 'special'
  stats: UnitStats
  requirements?: {
    buildings?: string[]
    technologies?: string[]
    race?: string[]
  }
}

// Base unit templates - modified by racial bonuses
export const UNIT_TYPES: Record<string, UnitType> = {
  // Tier 1 - Basic Infantry (Best offensive value)
  peasants: {
    id: 'peasants',
    name: 'Peasants',
    description: 'Basic infantry units, cheap and numerous',
    tier: 1,
    category: 'infantry',
    stats: {
      offense: 1.0,
      defense: 0.8,
      cost: {
        gold: 10,
        turns: 1,
        population: 1
      },
      upkeep: 1,
      hitPoints: 10,
      speed: 3
    }
  },

  // Tier 2 - Defensive Infantry (Best defensive value)
  militia: {
    id: 'militia',
    name: 'Militia',
    description: 'Trained defensive troops, excellent for holding territory',
    tier: 2,
    category: 'infantry',
    stats: {
      offense: 0.9,
      defense: 1.4,
      cost: {
        gold: 25,
        turns: 2,
        population: 1
      },
      upkeep: 2,
      hitPoints: 15,
      speed: 2
    },
    requirements: {
      buildings: ['barracks']
    }
  },

  // Tier 3 - Elite Infantry (Second best defensive)
  knights: {
    id: 'knights',
    name: 'Knights',
    description: 'Elite heavy infantry with strong defensive capabilities',
    tier: 3,
    category: 'infantry',
    stats: {
      offense: 1.8,
      defense: 2.2,
      cost: {
        gold: 75,
        turns: 4,
        population: 1
      },
      upkeep: 5,
      hitPoints: 25,
      speed: 2
    },
    requirements: {
      buildings: ['barracks', 'armory']
    }
  },

  // Tier 4 - Elite Cavalry (Second best offensive)
  cavalry: {
    id: 'cavalry',
    name: 'Cavalry',
    description: 'Fast-moving elite units with high offensive power',
    tier: 4,
    category: 'cavalry',
    stats: {
      offense: 2.5,
      defense: 1.5,
      cost: {
        gold: 150,
        turns: 6,
        population: 1
      },
      upkeep: 8,
      hitPoints: 20,
      speed: 5,
      special: 'First strike in combat'
    },
    requirements: {
      buildings: ['stables', 'barracks']
    }
  },

  // Ranged Units
  archers: {
    id: 'archers',
    name: 'Archers',
    description: 'Ranged units effective against infantry',
    tier: 2,
    category: 'ranged',
    stats: {
      offense: 1.2,
      defense: 0.6,
      cost: {
        gold: 35,
        turns: 2,
        population: 1
      },
      upkeep: 3,
      hitPoints: 12,
      speed: 3,
      special: 'Ranged attack, bonus vs infantry'
    },
    requirements: {
      buildings: ['archery_range']
    }
  },

  // Siege Units
  catapults: {
    id: 'catapults',
    name: 'Catapults',
    description: 'Siege engines for destroying fortifications',
    tier: 3,
    category: 'siege',
    stats: {
      offense: 0.5,
      defense: 0.3,
      cost: {
        gold: 200,
        turns: 8,
        population: 3
      },
      upkeep: 10,
      hitPoints: 30,
      speed: 1,
      special: 'Destroys fortifications, bonus vs buildings'
    },
    requirements: {
      buildings: ['siege_workshop'],
      technologies: ['siege_warfare']
    }
  },

  // Special Units (vary by race)
  mages: {
    id: 'mages',
    name: 'Mages',
    description: 'Magical units with spell-casting abilities',
    tier: 3,
    category: 'special',
    stats: {
      offense: 1.0,
      defense: 0.8,
      cost: {
        gold: 100,
        turns: 5,
        population: 1
      },
      upkeep: 6,
      hitPoints: 15,
      speed: 2,
      special: 'Can cast spells in combat'
    },
    requirements: {
      buildings: ['mage_tower'],
      technologies: ['basic_magic']
    }
  },

  scouts: {
    id: 'scouts',
    name: 'Scouts',
    description: 'Fast reconnaissance units for espionage',
    tier: 1,
    category: 'special',
    stats: {
      offense: 0.5,
      defense: 0.5,
      cost: {
        gold: 20,
        turns: 1,
        population: 1
      },
      upkeep: 2,
      hitPoints: 8,
      speed: 6,
      special: 'Reconnaissance, stealth missions'
    }
  }
}

// Racial unit variations
export const RACIAL_UNITS: Record<string, Record<string, Partial<UnitType>>> = {
  Human: {
    peasants: { name: 'Peasants' },
    militia: { name: 'Militia' },
    knights: { name: 'Knights' },
    cavalry: { name: 'Cavalry' }
  },
  
  Elven: {
    peasants: { 
      name: 'Elven Scouts',
      stats: { speed: 4, offense: 1.1 } // Slightly faster and stronger
    },
    militia: { name: 'Elven Warriors' },
    knights: { name: 'Elven Archers', category: 'ranged' as const },
    cavalry: { name: 'Elven Lords' }
  },

  Goblin: {
    peasants: { name: 'Goblins' },
    militia: { name: 'Hobgoblins' },
    knights: { 
      name: 'Kobolds',
      special: 'Kobold Rage: 1/25 chance to double offensive power'
    },
    cavalry: { name: 'Goblin Riders' }
  },

  Droben: {
    peasants: { name: 'Droben Warriors' },
    militia: { name: 'Droben Berserkers' },
    knights: { 
      name: 'Droben Bunar',
      stats: { offense: 2.2 } // Extra offensive power
    },
    cavalry: { name: 'Droben Champions' }
  },

  Vampire: {
    peasants: { name: 'Thralls' },
    militia: { name: 'Vampire Spawn' },
    knights: { name: 'Vampire Lords' },
    cavalry: { name: 'Ancient Vampires' }
  },

  Elemental: {
    peasants: { name: 'Earth Elementals' },
    militia: { name: 'Fire Elementals' },
    knights: { name: 'Water Elementals' },
    cavalry: { name: 'Air Elementals' }
  },

  Centaur: {
    peasants: { name: 'Centaur Scouts' },
    militia: { name: 'Centaur Warriors' },
    knights: { name: 'Centaur Archers', category: 'ranged' as const },
    cavalry: { name: 'Centaur Chiefs' }
  },

  Sidhe: {
    peasants: { name: 'Sidhe Nobles' },
    militia: { name: 'Sidhe Elders' },
    knights: { name: 'Sidhe Mages', category: 'special' as const },
    cavalry: { name: 'Sidhe Lords' }
  },

  Dwarven: {
    peasants: { name: 'Dwarven Militia' },
    militia: { 
      name: 'Dwarven Guards',
      stats: { defense: 1.6 } // Extra defensive power
    },
    knights: { name: 'Dwarven Warriors' },
    cavalry: { name: 'Dwarven Lords' }
  },

  Fae: {
    peasants: { name: 'Fae Sprites' },
    militia: { name: 'Fae Warriors' },
    knights: { name: 'Fae Nobles' },
    cavalry: { name: 'Fae Lords' }
  }
}

// Combat effectiveness modifiers
export const COMBAT_MODIFIERS = {
  // Terrain effects
  terrain: {
    plains: { offense: 1.0, defense: 1.0 },
    forest: { offense: 0.9, defense: 1.1 },
    mountains: { offense: 0.8, defense: 1.3 },
    swamp: { offense: 0.7, defense: 1.2 },
    desert: { offense: 0.9, defense: 0.9 }
  },

  // Unit type advantages
  typeAdvantages: {
    cavalry: { vs: ['archers', 'siege'], bonus: 1.5 },
    archers: { vs: ['infantry'], bonus: 1.3 },
    infantry: { vs: ['cavalry'], bonus: 1.2 },
    siege: { vs: ['fortifications'], bonus: 2.0 }
  },

  // Fortification bonuses
  fortifications: {
    1: { defenseBonus: 1.1 },
    2: { defenseBonus: 1.2 },
    3: { defenseBonus: 1.35 },
    4: { defenseBonus: 1.5 },
    5: { defenseBonus: 1.7 }
  }
}

// Helper functions
export const getUnitType = (unitId: string): UnitType | undefined => {
  return UNIT_TYPES[unitId]
}

export const getRacialUnit = (race: string, baseUnit: string): UnitType => {
  const baseUnitType = UNIT_TYPES[baseUnit]
  const racialVariation = RACIAL_UNITS[race]?.[baseUnit]
  
  if (!baseUnitType) {
    throw new Error(`Unknown unit type: ${baseUnit}`)
  }

  // Merge base unit with racial variations
  return {
    ...baseUnitType,
    ...racialVariation,
    stats: {
      ...baseUnitType.stats,
      ...racialVariation?.stats
    }
  }
}

export const calculateUnitCost = (
  unitType: UnitType,
  quantity: number,
  raceStats: { training: number, economy: number }
): { gold: number, turns: number, population: number } => {
  const trainingModifier = 1 - (raceStats.training - 1) * 0.1 // 10% reduction per training point above 1
  const economyModifier = 1 - (raceStats.economy - 1) * 0.05 // 5% cost reduction per economy point above 1

  return {
    gold: Math.ceil(unitType.stats.cost.gold * quantity * economyModifier),
    turns: Math.ceil(unitType.stats.cost.turns * quantity * trainingModifier),
    population: unitType.stats.cost.population * quantity
  }
}

export const calculateCombatPower = (
  units: Record<string, number>,
  raceStats: { warOffense: number, warDefense: number },
  isDefending: boolean = false
): { offense: number, defense: number } => {
  let totalOffense = 0
  let totalDefense = 0

  Object.entries(units).forEach(([unitId, count]) => {
    const unitType = getUnitType(unitId)
    if (unitType && count > 0) {
      totalOffense += unitType.stats.offense * count
      totalDefense += unitType.stats.defense * count
    }
  })

  // Apply racial modifiers
  const offenseModifier = 1 + (raceStats.warOffense - 1) * 0.2 // 20% per point above 1
  const defenseModifier = 1 + (raceStats.warDefense - 1) * 0.2

  return {
    offense: totalOffense * offenseModifier,
    defense: totalDefense * defenseModifier * (isDefending ? 1.2 : 1.0) // 20% defensive bonus
  }
}

export type UnitId = keyof typeof UNIT_TYPES
export const UNIT_IDS = Object.keys(UNIT_TYPES) as UnitId[]
