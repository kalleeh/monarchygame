/**
 * Race definitions for Monarchy game
 * Based on original Monarchy/Canon game mechanics
 */

export interface RaceStats {
  warOffense: number    // 1-5, affects attack strength
  warDefense: number    // 1-5, affects defense strength  
  sorcery: number       // 1-5, affects magic power
  scum: number          // 1-5, affects espionage/sabotage
  forts: number         // 1-5, affects fortification strength
  tithe: number         // 1-5, affects income generation
  training: number      // 1-5, affects unit training speed
  siege: number         // 1-5, affects siege warfare
  economy: number       // 1-5, affects resource generation
  building: number      // 1-5, affects construction speed
}

export interface SpecialAbility {
  name: string
  description: string
  mechanics: {
    type: 'caravan_frequency' | 'remote_fog' | 'kobold_rage' | 'fort_destruction' | 'scum_killing' | 'circle_summoning' | 'none'
    cooldownReduction?: number  // For caravan frequency (hours)
    targetScope?: 'guild' | 'faith' | 'self'  // For fog casting
    ageActivation?: 'early' | 'middle' | 'late'  // For kobold rage
    combatBonus?: number  // Combat effectiveness multiplier
    additionalEffects?: string[]
  }
  strategicValue: string
  limitations?: string
}

export interface Race {
  id: string
  name: string
  description: string
  stats: RaceStats
  specialAbility: SpecialAbility
  unitTypes: string[]
  startingResources: {
    gold: number
    population: number
    land: number
    turns: number
  }
  economicMultiplier: number  // Resource requirement multiplier (1.0 = normal, 2.0 = double cost)
}

export const RACES: Record<string, Race> = {
  Human: {
    id: 'human',
    name: 'Human',
    description: 'Balanced race with strong economic focus and diplomatic advantages',
    stats: {
      warOffense: 3,
      warDefense: 3,
      sorcery: 3,
      scum: 4,       // Updated to match documentation
      forts: 3,
      tithe: 4,
      training: 3,
      siege: 3,
      economy: 5,    // Best at economy
      building: 3
    },
    specialAbility: {
      name: 'Caravan Frequency Bonus',
      description: 'Can send caravans twice as often as other races',
      mechanics: {
        type: 'caravan_frequency',
        cooldownReduction: 12  // 12 hours vs standard 24 hours
      },
      strategicValue: 'Bypasses sabotage attempts, enables rapid resource distribution during coordinated strikes',
      limitations: 'None'
    },
    unitTypes: ['Peasants', 'Militia', 'Knights', 'Cavalry'],
    startingResources: {
      gold: 2000,
      population: 500,
      land: 100,
      turns: 100
    },
    economicMultiplier: 1.0
  },

  Elven: {
    id: 'elven',
    name: 'Elven',
    description: 'Skilled warriors and mages with excellent training capabilities',
    stats: {
      warOffense: 2,  // Updated to match documentation
      warDefense: 4,  // Updated to match documentation
      sorcery: 4,
      scum: 3,
      forts: 3,
      tithe: 3,
      training: 5,   // Best at training
      siege: 3,
      economy: 3,
      building: 3
    },
    specialAbility: {
      name: 'Remote Fog Casting',
      description: 'Can cast fog on any guild member regardless of distance',
      mechanics: {
        type: 'remote_fog',
        targetScope: 'guild'
      },
      strategicValue: 'Protects land-fat realms (65k+ acres with <4% temples). Saves 170 turns at BR 16 vs building temples',
      limitations: 'Only affects fog spell, not other sorcery'
    },
    unitTypes: ['Elven Scouts', 'Elven Warriors', 'Elven Archers', 'Elven Lords'],
    startingResources: {
      gold: 1600,
      population: 400,
      land: 120,
      turns: 100
    },
    economicMultiplier: 1.0
  },

  Goblin: {
    id: 'goblin',
    name: 'Goblin',
    description: 'Cunning and numerous, excellent at siege warfare and sabotage',
    stats: {
      warOffense: 4,  // Updated to match documentation
      warDefense: 3,  // Updated to match documentation
      sorcery: 2,
      scum: 2,        // Updated to match documentation
      forts: 3,       // Updated to match documentation
      tithe: 3,
      training: 4,
      siege: 5,      // Best at siege
      economy: 3,
      building: 4
    },
    specialAbility: {
      name: 'Kobold Rage',
      description: 'T2 units gain combat bonus during middle age',
      mechanics: {
        type: 'kobold_rage',
        ageActivation: 'middle',
        combatBonus: 1.5  // Significant attack value increase
      },
      strategicValue: 'Coordinate wars during kobold rage window for maximum effectiveness',
      limitations: 'Only affects T2 Kobold units, only active during middle age'
    },
    unitTypes: ['Goblins', 'Hobgoblins', 'Kobolds', 'Goblin Riders'],
    startingResources: {
      gold: 1200,
      population: 800,
      land: 80,
      turns: 100
    },
    economicMultiplier: 1.0
  },

  Droben: {
    id: 'droben',
    name: 'Droben',
    description: 'Fierce warriors focused on pure offensive might',
    stats: {
      warOffense: 5,  // Best at war offense
      warDefense: 3,  // Updated to match documentation
      sorcery: 2,
      scum: 3,
      forts: 3,
      tithe: 3,
      training: 3,
      siege: 4,
      economy: 2,
      building: 3
    },
    specialAbility: {
      name: 'Boosted Summons',
      description: 'Summons calculated with max sorcery score regardless of actual sorcery',
      mechanics: {
        type: 'none',  // Special summon calculation
        additionalEffects: ['3.04% of networth in summoned troops', 'Bunar units: 27.50 attack value', 'T1 Guerrilla: 25.0 attack value']
      },
      strategicValue: 'Highest combat effectiveness in game, primary realm breaker role',
      limitations: 'Poor economy and sorcery for non-combat activities'
    },
    unitTypes: ['Droben Warriors', 'Droben Berserkers', 'Droben Bunar', 'Droben Champions'],
    startingResources: {
      gold: 1400,
      population: 600,
      land: 90,
      turns: 100
    },
    economicMultiplier: 1.0
  },

  Vampire: {
    id: 'vampire',
    name: 'Vampire',
    description: 'Dark masters of fortification and sorcery with powerful defenses',
    stats: {
      warOffense: 3,
      warDefense: 4,
      sorcery: 4,
      scum: 4,
      forts: 5,      // Best at fortifications
      tithe: 2,
      training: 3,
      siege: 3,
      economy: 2,
      building: 3
    },
    specialAbility: {
      name: 'None',
      description: 'No special ability (compensated by strong defensive stats)',
      mechanics: {
        type: 'none'
      },
      strategicValue: 'Potentially untouchable if properly developed, excellent fort quality',
      limitations: 'Requires 2x the resources of other races'
    },
    unitTypes: ['Thralls', 'Vampire Spawn', 'Vampire Lords', 'Ancient Vampires'],
    startingResources: {
      gold: 1800,
      population: 300,
      land: 110,
      turns: 100
    },
    economicMultiplier: 2.0  // Requires double resources
  },

  Elemental: {
    id: 'elemental',
    name: 'Elemental',
    description: 'Masters of construction and magical forces of nature',
    stats: {
      warOffense: 4,  // Updated to match documentation
      warDefense: 3,
      sorcery: 4,
      scum: 2,
      forts: 4,
      tithe: 3,
      training: 3,
      siege: 3,
      economy: 3,
      building: 5     // Best at building
    },
    specialAbility: {
      name: 'Fort Destruction on Controlled Strike',
      description: 'Controlled strikes destroy enemy fortifications',
      mechanics: {
        type: 'fort_destruction',
        additionalEffects: ['Weakens defensive positions before full assault', 'Synergizes with Droben ground attacks']
      },
      strategicValue: 'Unique controlled strike capability, fighter-mage versatility',
      limitations: 'Only affects controlled strikes, not full strikes'
    },
    unitTypes: ['Earth Elementals', 'Fire Elementals', 'Water Elementals', 'Air Elementals'],
    startingResources: {
      gold: 1600,
      population: 400,
      land: 100,
      turns: 100
    },
    economicMultiplier: 1.0
  },

  Centaur: {
    id: 'centaur',
    name: 'Centaur',
    description: 'Swift and cunning, masters of espionage and sabotage',
    stats: {
      warOffense: 2,  // Updated to match documentation
      warDefense: 2,  // Updated to match documentation
      sorcery: 2,
      scum: 5,       // Best at scum/espionage
      forts: 3,
      tithe: 3,
      training: 4,
      siege: 3,
      economy: 2,    // Updated to match documentation
      building: 2
    },
    specialAbility: {
      name: 'Scum Killing Ability',
      description: 'Can eliminate enemy scum through special operations',
      mechanics: {
        type: 'scum_killing'
      },
      strategicValue: 'Remove enemy intelligence and theft protection',
      limitations: 'Still inferior overall due to poor war/sorcery stats, predictable role'
    },
    unitTypes: ['Centaur Scouts', 'Centaur Warriors', 'Centaur Archers', 'Centaur Chiefs'],
    startingResources: {
      gold: 1500,
      population: 500,
      land: 95,
      turns: 100
    },
    economicMultiplier: 1.0
  },

  Sidhe: {
    id: 'sidhe',
    name: 'Sidhe',
    description: 'Ancient magical beings with unparalleled sorcerous power',
    stats: {
      warOffense: 2,  // Updated to match documentation
      warDefense: 3,  // Updated to match documentation
      sorcery: 5,    // Best at sorcery
      scum: 4,       // Updated to match documentation
      forts: 4,
      tithe: 3,
      training: 3,
      siege: 2,
      economy: 3,
      building: 3
    },
    specialAbility: {
      name: 'Circle Summoning',
      description: 'Can summon additional temples during combat',
      mechanics: {
        type: 'circle_summoning',
        additionalEffects: ['Emergency temple construction during warfare', 'Summons troops + 50% additional temples']
      },
      strategicValue: 'Maintain magical capability under pressure, excellent for bounty synergy',
      limitations: 'Most effective in Massacre/Bloodbath games with higher turn rates'
    },
    unitTypes: ['Sidhe Nobles', 'Sidhe Elders', 'Sidhe Mages', 'Sidhe Lords'],
    startingResources: {
      gold: 2400,
      population: 300,
      land: 120,
      turns: 100
    },
    economicMultiplier: 1.0
  },

  Dwarven: {
    id: 'dwarven',
    name: 'Dwarven',
    description: 'Stout defenders with unbreakable defensive capabilities',
    stats: {
      warOffense: 3,
      warDefense: 5, // Best at war defense
      sorcery: 2,
      scum: 2,
      forts: 4,
      tithe: 4,
      training: 3,
      siege: 4,
      economy: 2,    // Updated to match documentation
      building: 4
    },
    specialAbility: {
      name: 'None',
      description: 'No special ability (compensated by strong defensive stats)',
      mechanics: {
        type: 'none'
      },
      strategicValue: 'Unbreakable defensive capabilities',
      limitations: 'Ineffective scum, low sorcery, T2/T3 units require more turn investment'
    },
    unitTypes: ['Dwarven Militia', 'Dwarven Guards', 'Dwarven Warriors', 'Dwarven Lords'],
    startingResources: {
      gold: 1800,
      population: 400,
      land: 85,
      turns: 100
    },
    economicMultiplier: 1.0
  },

  Fae: {
    id: 'fae',
    name: 'Fae',
    description: 'Mystical beings with exceptional income generation abilities',
    stats: {
      warOffense: 3,  // Updated to match documentation
      warDefense: 3,
      sorcery: 4,
      scum: 3,       // Updated to match documentation
      forts: 3,
      tithe: 5,      // Best at tithe/income
      training: 3,
      siege: 2,
      economy: 4,
      building: 3
    },
    specialAbility: {
      name: 'None',
      description: 'No special ability (compensated by excellent income generation)',
      mechanics: {
        type: 'none'
      },
      strategicValue: 'Exceptional income generation abilities',
      limitations: 'None'
    },
    unitTypes: ['Fae Sprites', 'Fae Warriors', 'Fae Nobles', 'Fae Lords'],
    startingResources: {
      gold: 2200,
      population: 350,
      land: 105,
      turns: 100
    },
    economicMultiplier: 1.0
  }
}

// Helper functions for race management
export const getRace = (raceId: string): Race | undefined => {
  return RACES[raceId]
}

export const getAllRaces = (): Race[] => {
  return Object.values(RACES)
}

export const getRaceStats = (raceId: string): RaceStats | undefined => {
  return RACES[raceId]?.stats
}

export const getRaceSpecialAbility = (raceId: string): SpecialAbility | undefined => {
  return RACES[raceId]?.specialAbility
}

// Get caravan cooldown for race (in hours)
export const getCaravanCooldown = (raceId: string): number => {
  const race = RACES[raceId]
  if (race?.specialAbility.mechanics.type === 'caravan_frequency') {
    return race.specialAbility.mechanics.cooldownReduction || 24
  }
  return 24 // Standard cooldown
}

// Check if race can cast remote fog
export const canCastRemoteFog = (raceId: string): boolean => {
  const race = RACES[raceId]
  return race?.specialAbility.mechanics.type === 'remote_fog'
}

// Check if kobold rage is active for race in current age
export const isKoboldRageActive = (raceId: string, currentAge: 'early' | 'middle' | 'late'): boolean => {
  const race = RACES[raceId]
  return race?.specialAbility.mechanics.type === 'kobold_rage' && 
         race.specialAbility.mechanics.ageActivation === currentAge
}

// Get economic multiplier for race
export const getEconomicMultiplier = (raceId: string): number => {
  return RACES[raceId]?.economicMultiplier || 1.0
}

// Race validation
export const isValidRace = (raceId: string): boolean => {
  return raceId in RACES
}

// Calculate effective stats with bonuses
export const calculateEffectiveStats = (
  baseStats: RaceStats,
  bonuses: Partial<RaceStats> = {}
): RaceStats => {
  return {
    warOffense: Math.min(5, baseStats.warOffense + (bonuses.warOffense || 0)),
    warDefense: Math.min(5, baseStats.warDefense + (bonuses.warDefense || 0)),
    sorcery: Math.min(5, baseStats.sorcery + (bonuses.sorcery || 0)),
    scum: Math.min(5, baseStats.scum + (bonuses.scum || 0)),
    forts: Math.min(5, baseStats.forts + (bonuses.forts || 0)),
    tithe: Math.min(5, baseStats.tithe + (bonuses.tithe || 0)),
    training: Math.min(5, baseStats.training + (bonuses.training || 0)),
    siege: Math.min(5, baseStats.siege + (bonuses.siege || 0)),
    economy: Math.min(5, baseStats.economy + (bonuses.economy || 0)),
    building: Math.min(5, baseStats.building + (bonuses.building || 0))
  }
}

export type RaceId = keyof typeof RACES
export const RACE_IDS = Object.keys(RACES) as RaceId[]
