/**
 * Unit definitions for Monarchy game
 * Based on authentic racial unit names and exact attack values from pro player analysis
 */

export interface UnitStats {
  offense: number      // Exact offensive power from documentation
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
  raceSpecific?: string // Race this unit belongs to
  isAuthentic?: boolean // True for documented unit names
}

// Authentic racial units with exact attack values from pro player documentation
export const UNIT_TYPES: Record<string, UnitType> = {
  // === DROBEN UNITS (Best Warriors) ===
  droben_guerrilla: {
    id: 'droben_guerrilla',
    name: 'Droben Guerrilla',
    description: 'Elite T1 raiding units with exceptional attack power',
    tier: 1,
    category: 'infantry',
    raceSpecific: 'droben',
    isAuthentic: true,
    stats: {
      offense: 25.0,     // Exact value from documentation
      defense: 18.0,
      cost: {
        gold: 50,
        turns: 1,
        population: 1
      },
      upkeep: 2,
      hitPoints: 20,
      speed: 4,
      special: 'Excellent for raids and quick strikes'
    }
  },

  droben_bunar: {
    id: 'droben_bunar',
    name: 'Droben Bunar',
    description: 'Highest attack value units in the game',
    tier: 3,
    category: 'infantry',
    raceSpecific: 'droben',
    isAuthentic: true,
    stats: {
      offense: 27.50,    // Highest attack value in game
      defense: 20.0,
      cost: {
        gold: 200,
        turns: 4,
        population: 1
      },
      upkeep: 8,
      hitPoints: 35,
      speed: 2,
      special: 'Anchors major assaults, works with Elemental Demons'
    }
  },

  droben_warriors: {
    id: 'droben_warriors',
    name: 'Droben Warriors',
    description: 'Standard Droben military units',
    tier: 2,
    category: 'infantry',
    raceSpecific: 'droben',
    isAuthentic: true,
    stats: {
      offense: 22.0,
      defense: 16.0,
      cost: {
        gold: 100,
        turns: 2,
        population: 1
      },
      upkeep: 4,
      hitPoints: 25,
      speed: 3
    }
  },

  // === GOBLIN UNITS (Efficiency Focus) ===
  goblin_t4: {
    id: 'goblin_t4',
    name: 'Goblin T4',
    description: 'High-value units, more efficient than Dwarven T3',
    tier: 4,
    category: 'infantry',
    raceSpecific: 'goblin',
    isAuthentic: true,
    stats: {
      offense: 22.50,    // Same power as Dwarven T3, fewer turns
      defense: 18.0,
      cost: {
        gold: 300,
        turns: 6,        // More efficient than Dwarven T3
        population: 1
      },
      upkeep: 12,
      hitPoints: 40,
      speed: 2,
      special: 'More turn-efficient than equivalent Dwarven units'
    }
  },

  goblins: {
    id: 'goblins',
    name: 'Goblins',
    description: 'Basic Goblin infantry, cheap and numerous',
    tier: 1,
    category: 'infantry',
    raceSpecific: 'goblin',
    isAuthentic: true,
    stats: {
      offense: 12.0,
      defense: 10.0,
      cost: {
        gold: 30,
        turns: 1,
        population: 1
      },
      upkeep: 1,
      hitPoints: 15,
      speed: 3
    }
  },

  giants: {
    id: 'giants',
    name: 'Giants',
    description: 'Cheap, effective early-game Goblin units',
    tier: 2,
    category: 'infantry',
    raceSpecific: 'goblin',
    isAuthentic: true,
    stats: {
      offense: 18.0,
      defense: 15.0,
      cost: {
        gold: 80,
        turns: 2,
        population: 1
      },
      upkeep: 3,
      hitPoints: 25,
      speed: 2,
      special: 'Excellent early-game dominance units'
    }
  },

  trolls: {
    id: 'trolls',
    name: 'Trolls',
    description: 'Strong defensive Goblin units',
    tier: 3,
    category: 'infantry',
    raceSpecific: 'goblin',
    isAuthentic: true,
    stats: {
      offense: 16.0,
      defense: 24.0,     // Strong defensive capability
      cost: {
        gold: 150,
        turns: 3,
        population: 1
      },
      upkeep: 6,
      hitPoints: 30,
      speed: 1,
      special: 'Excellent defensive units'
    }
  },

  // === DWARVEN UNITS (Defensive Focus) ===
  dwarven_t3: {
    id: 'dwarven_t3',
    name: 'Dwarven T3',
    description: 'Same power as Goblin T4 but more turn-intensive',
    tier: 3,
    category: 'infantry',
    raceSpecific: 'dwarven',
    isAuthentic: true,
    stats: {
      offense: 22.50,    // Same as Goblin T4
      defense: 25.0,     // Better defense
      cost: {
        gold: 250,
        turns: 8,        // More turn-intensive than Goblin T4
        population: 1
      },
      upkeep: 10,
      hitPoints: 45,
      speed: 1,
      special: 'High power but turn-intensive training'
    }
  },

  dwarven_militia: {
    id: 'dwarven_militia',
    name: 'Dwarven Militia',
    description: 'Basic Dwarven defensive units',
    tier: 1,
    category: 'infantry',
    raceSpecific: 'dwarven',
    isAuthentic: true,
    stats: {
      offense: 10.0,
      defense: 18.0,
      cost: {
        gold: 40,
        turns: 2,
        population: 1
      },
      upkeep: 2,
      hitPoints: 25,
      speed: 1
    }
  },

  // === ELEMENTAL UNITS (Fighter-Mage) ===
  elemental_t4: {
    id: 'elemental_t4',
    name: 'Elemental T4',
    description: 'Easiest high-value unit training access',
    tier: 4,
    category: 'special',
    raceSpecific: 'elemental',
    isAuthentic: true,
    stats: {
      offense: 21.0,
      defense: 19.0,
      cost: {
        gold: 280,
        turns: 5,        // Easier training than other T4s
        population: 1
      },
      upkeep: 11,
      hitPoints: 38,
      speed: 3,
      special: 'Easiest T4 training access'
    }
  },

  cherufe: {
    id: 'cherufe',
    name: 'Cherufe',
    description: 'Effective early-middle age defensive units',
    tier: 2,
    category: 'special',
    raceSpecific: 'elemental',
    isAuthentic: true,
    stats: {
      offense: 15.0,
      defense: 22.0,
      cost: {
        gold: 90,
        turns: 2,
        population: 1
      },
      upkeep: 4,
      hitPoints: 28,
      speed: 2,
      special: 'Strong early-middle age defense'
    }
  },

  demons: {
    id: 'demons',
    name: 'Demons',
    description: 'Anchor units for Droben Bunar assaults',
    tier: 3,
    category: 'special',
    raceSpecific: 'elemental',
    isAuthentic: true,
    stats: {
      offense: 19.0,
      defense: 17.0,
      cost: {
        gold: 180,
        turns: 3,
        population: 1
      },
      upkeep: 7,
      hitPoints: 32,
      speed: 3,
      special: 'Synergizes with Droben Bunar attacks'
    }
  },

  // === VAMPIRE UNITS (High Quality) ===
  mullo: {
    id: 'mullo',
    name: 'Mullo',
    description: 'High-quality Vampire defensive units',
    tier: 3,
    category: 'special',
    raceSpecific: 'vampire',
    isAuthentic: true,
    stats: {
      offense: 17.0,
      defense: 26.0,     // Excellent defense
      cost: {
        gold: 300,       // Higher cost (2x resource requirement)
        turns: 4,
        population: 1
      },
      upkeep: 12,
      hitPoints: 35,
      speed: 2,
      special: 'High-quality defensive units'
    }
  },

  // === VAMPIRE UNITS (High Quality, Expensive) ===
  lamia: {
    id: 'lamia',
    name: 'Lamia',
    description: 'Vampire seductive units with special abilities',
    tier: 1,
    category: 'special',
    raceSpecific: 'vampire',
    isAuthentic: true,
    stats: {
      offense: 14.0,
      defense: 16.0,
      cost: {
        gold: 200,       // Higher cost (2x resource requirement)
        turns: 2,
        population: 1
      },
      upkeep: 8,
      hitPoints: 25,
      speed: 3,
      special: 'Seductive abilities, higher cost due to Vampire economics'
    }
  },

  raksasa: {
    id: 'raksasa',
    name: 'Raksasa',
    description: 'Vampire mid-tier demonic units',
    tier: 2,
    category: 'special',
    raceSpecific: 'vampire',
    isAuthentic: true,
    stats: {
      offense: 18.0,
      defense: 20.0,
      cost: {
        gold: 350,       // Higher cost (2x resource requirement)
        turns: 3,
        population: 1
      },
      upkeep: 14,
      hitPoints: 30,
      speed: 2,
      special: 'Demonic vampire units with enhanced combat ability'
    }
  },

  centrocs: {
    id: 'centrocs',
    name: 'Centrocs',
    description: 'Vampire defensive specialist units',
    tier: 2,
    category: 'infantry',
    raceSpecific: 'vampire',
    isAuthentic: true,
    stats: {
      offense: 15.0,
      defense: 28.0,     // Excellent defensive capability
      cost: {
        gold: 400,       // Higher cost (2x resource requirement)
        turns: 3,
        population: 1
      },
      upkeep: 16,
      hitPoints: 35,
      speed: 1,
      special: 'Specialized defensive units, very high defense rating'
    }
  },

  wampyr: {
    id: 'wampyr',
    name: 'Wampyr',
    description: 'Elite Vampire units, primary military force',
    tier: 3,
    category: 'special',
    raceSpecific: 'vampire',
    isAuthentic: true,
    stats: {
      offense: 24.0,
      defense: 26.0,     // High-quality elite units
      cost: {
        gold: 600,       // Higher cost (2x resource requirement)
        turns: 5,
        population: 1
      },
      upkeep: 24,
      hitPoints: 40,
      speed: 2,
      special: 'Elite vampire units, backbone of vampire armies'
    }
  },

  aswang: {
    id: 'aswang',
    name: 'Aswang',
    description: 'Rare/special Vampire units with unique abilities',
    tier: 4,
    category: 'special',
    raceSpecific: 'vampire',
    isAuthentic: true,
    stats: {
      offense: 26.0,
      defense: 24.0,
      cost: {
        gold: 800,       // Higher cost (2x resource requirement)
        turns: 6,
        population: 1
      },
      upkeep: 32,
      hitPoints: 45,
      speed: 4,
      special: 'Rare vampire units with unique supernatural abilities'
    }
  },

  // === HUMAN UNITS (Balanced) ===
  human_dragons: {
    id: 'human_dragons',
    name: 'Human Dragons',
    description: 'Balanced T4 units, used in Rule of 0.25% examples',
    tier: 4,
    category: 'cavalry',
    raceSpecific: 'human',
    isAuthentic: true,
    stats: {
      offense: 20.0,
      defense: 18.0,
      cost: {
        gold: 250,
        turns: 6,
        population: 1
      },
      upkeep: 10,
      hitPoints: 35,
      speed: 4,
      special: 'Featured in army reduction strategies'
    }
  },

  // === GENERIC UNITS (Multi-racial) ===
  peasants: {
    id: 'peasants',
    name: 'Peasants',
    description: 'Basic population units, target for sorcery kills',
    tier: 0,
    category: 'special',
    stats: {
      offense: 1.0,
      defense: 1.0,
      cost: {
        gold: 5,
        turns: 1,
        population: 1
      },
      upkeep: 0,
      hitPoints: 5,
      speed: 1,
      special: 'Target for Foul Light sorcery kills'
    }
  },

  scum_green: {
    id: 'scum_green',
    name: 'Green Scum',
    description: 'Basic espionage units with higher casualty rates',
    tier: 1,
    category: 'special',
    stats: {
      offense: 0,
      defense: 5.0,
      cost: {
        gold: 100,
        turns: 2,
        population: 1
      },
      upkeep: 3,
      hitPoints: 10,
      speed: 5,
      special: '1-2.5% casualty rate per operation'
    }
  },

  scum_elite: {
    id: 'scum_elite',
    name: 'Elite Scum',
    description: 'Advanced espionage units with better survival',
    tier: 2,
    category: 'special',
    stats: {
      offense: 0,
      defense: 8.0,
      cost: {
        gold: 300,
        turns: 4,
        population: 1
      },
      upkeep: 8,
      hitPoints: 15,
      speed: 5,
      special: '0.88-0.94% casualty rate, 2.5x more survivable'
    }
  }
}

// Helper functions
export const getUnitType = (unitId: string): UnitType | undefined => {
  return UNIT_TYPES[unitId]
}

export const getUnitsForRace = (raceId: string): UnitType[] => {
  return Object.values(UNIT_TYPES).filter(unit => 
    unit.raceSpecific === raceId.toLowerCase() || !unit.raceSpecific
  )
}

export const getAuthenticUnits = (): UnitType[] => {
  return Object.values(UNIT_TYPES).filter(unit => unit.isAuthentic)
}

export const calculateUnitEffectiveness = (
  unitId: string,
  raceStats: { warOffense: number, warDefense: number },
  quantity: number
): { totalOffense: number, totalDefense: number } => {
  const unit = getUnitType(unitId)
  if (!unit) return { totalOffense: 0, totalDefense: 0 }

  // Apply racial bonuses
  const offenseBonus = 1 + (raceStats.warOffense - 1) * 0.2 // 20% per point above 1
  const defenseBonus = 1 + (raceStats.warDefense - 1) * 0.2 // 20% per point above 1

  return {
    totalOffense: unit.stats.offense * offenseBonus * quantity,
    totalDefense: unit.stats.defense * defenseBonus * quantity
  }
}

export const getOptimalUnitForRole = (
  role: 'offense' | 'defense' | 'efficiency' | 'raids',
  raceId: string
): UnitType | undefined => {
  const raceUnits = getUnitsForRace(raceId)
  
  switch (role) {
    case 'offense':
      return raceUnits.reduce((best, unit) => 
        unit.stats.offense > (best?.stats.offense || 0) ? unit : best, undefined)
    case 'defense':
      return raceUnits.reduce((best, unit) => 
        unit.stats.defense > (best?.stats.defense || 0) ? unit : best, undefined)
    case 'efficiency':
      return raceUnits.reduce((best, unit) => {
        const efficiency = unit.stats.offense / unit.cost.turns
        const bestEfficiency = best ? best.stats.offense / best.cost.turns : 0
        return efficiency > bestEfficiency ? unit : best
      }, undefined)
    case 'raids':
      return raceUnits.find(unit => unit.tier === 1 && unit.stats.offense > 20) || 
             raceUnits.find(unit => unit.tier === 1)
    default:
      return undefined
  }
}

export type UnitId = keyof typeof UNIT_TYPES
export const UNIT_IDS = Object.keys(UNIT_TYPES) as UnitId[]
