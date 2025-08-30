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

export interface Race {
  id: string
  name: string
  description: string
  stats: RaceStats
  specialAbility: string
  unitTypes: string[]
  startingResources: {
    gold: number
    population: number
    land: number
    turns: number
  }
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
      scum: 3,
      forts: 3,
      tithe: 4,      // Good at income
      training: 3,
      siege: 3,
      economy: 5,    // Best at economy
      building: 3
    },
    specialAbility: 'Can send caravans to allies twice as often',
    unitTypes: ['Peasants', 'Militia', 'Knights', 'Cavalry'],
    startingResources: {
      gold: 1000,
      population: 500,
      land: 100,
      turns: 50
    }
  },

  Elven: {
    id: 'elven',
    name: 'Elven',
    description: 'Skilled warriors and mages with excellent training capabilities',
    stats: {
      warOffense: 4,
      warDefense: 3,
      sorcery: 4,
      scum: 3,
      forts: 3,
      tithe: 3,
      training: 5,   // Best at training
      siege: 3,
      economy: 3,
      building: 3
    },
    specialAbility: 'Can cast fog remotely onto other kingdoms in their faith',
    unitTypes: ['Elven Scouts', 'Elven Warriors', 'Elven Archers', 'Elven Lords'],
    startingResources: {
      gold: 800,
      population: 400,
      land: 120,
      turns: 50
    }
  },

  Goblin: {
    id: 'goblin',
    name: 'Goblin',
    description: 'Cunning and numerous, excellent at siege warfare and sabotage',
    stats: {
      warOffense: 3,
      warDefense: 2,
      sorcery: 2,
      scum: 4,
      forts: 2,
      tithe: 3,
      training: 4,
      siege: 5,      // Best at siege
      economy: 3,
      building: 4
    },
    specialAbility: 'Kobold Rage: 1 in 25 chance to double kobold offensive strength',
    unitTypes: ['Goblins', 'Hobgoblins', 'Kobolds', 'Goblin Riders'],
    startingResources: {
      gold: 600,
      population: 800,
      land: 80,
      turns: 50
    }
  },

  Droben: {
    id: 'droben',
    name: 'Droben',
    description: 'Fierce warriors focused on pure offensive might',
    stats: {
      warOffense: 5,  // Best at war offense
      warDefense: 2,
      sorcery: 2,
      scum: 3,
      forts: 3,
      tithe: 3,
      training: 3,
      siege: 4,
      economy: 2,
      building: 3
    },
    specialAbility: 'Boosted summons: calculated with max sorcery score regardless of actual sorcery',
    unitTypes: ['Droben Warriors', 'Droben Berserkers', 'Droben Bunar', 'Droben Champions'],
    startingResources: {
      gold: 700,
      population: 600,
      land: 90,
      turns: 50
    }
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
    specialAbility: 'Generate Elan slightly quicker (shared with Sidhe)',
    unitTypes: ['Thralls', 'Vampire Spawn', 'Vampire Lords', 'Ancient Vampires'],
    startingResources: {
      gold: 900,
      population: 300,
      land: 110,
      turns: 50
    }
  },

  Elemental: {
    id: 'elemental',
    name: 'Elemental',
    description: 'Masters of construction and magical forces of nature',
    stats: {
      warOffense: 3,
      warDefense: 3,
      sorcery: 4,     // +1 bonus but higher backlash chance
      scum: 2,
      forts: 4,
      tithe: 3,
      training: 3,
      siege: 3,
      economy: 3,
      building: 5     // Best at building
    },
    specialAbility: 'Take and destroy enemy forts on Controlled Strike attacks',
    unitTypes: ['Earth Elementals', 'Fire Elementals', 'Water Elementals', 'Air Elementals'],
    startingResources: {
      gold: 800,
      population: 400,
      land: 100,
      turns: 50
    }
  },

  Centaur: {
    id: 'centaur',
    name: 'Centaur',
    description: 'Swift and cunning, masters of espionage and sabotage',
    stats: {
      warOffense: 4,
      warDefense: 3,
      sorcery: 3,
      scum: 5,       // Best at scum/espionage
      forts: 3,
      tithe: 3,
      training: 4,
      siege: 3,
      economy: 3,
      building: 2
    },
    specialAbility: 'Kill Scum: additional option to kill enemy scum directly',
    unitTypes: ['Centaur Scouts', 'Centaur Warriors', 'Centaur Archers', 'Centaur Chiefs'],
    startingResources: {
      gold: 750,
      population: 500,
      land: 95,
      turns: 50
    }
  },

  Sidhe: {
    id: 'sidhe',
    name: 'Sidhe',
    description: 'Ancient magical beings with unparalleled sorcerous power',
    stats: {
      warOffense: 3,
      warDefense: 4,
      sorcery: 5,    // Best at sorcery
      scum: 3,
      forts: 4,
      tithe: 3,
      training: 3,
      siege: 2,
      economy: 3,
      building: 3
    },
    specialAbility: 'Summon Circles: summons troops + 50% additional temples',
    unitTypes: ['Sidhe Nobles', 'Sidhe Elders', 'Sidhe Mages', 'Sidhe Lords'],
    startingResources: {
      gold: 1200,
      population: 300,
      land: 120,
      turns: 50
    }
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
      economy: 4,
      building: 4
    },
    specialAbility: 'None (compensated by strong defensive stats)',
    unitTypes: ['Dwarven Militia', 'Dwarven Guards', 'Dwarven Warriors', 'Dwarven Lords'],
    startingResources: {
      gold: 900,
      population: 400,
      land: 85,
      turns: 50
    }
  },

  Fae: {
    id: 'fae',
    name: 'Fae',
    description: 'Mystical beings with exceptional income generation abilities',
    stats: {
      warOffense: 2,
      warDefense: 3,
      sorcery: 4,
      scum: 4,
      forts: 3,
      tithe: 5,      // Best at tithe/income
      training: 3,
      siege: 2,
      economy: 4,
      building: 3
    },
    specialAbility: 'None (compensated by excellent income generation)',
    unitTypes: ['Fae Sprites', 'Fae Warriors', 'Fae Nobles', 'Fae Lords'],
    startingResources: {
      gold: 1100,
      population: 350,
      land: 105,
      turns: 50
    }
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

export const getRaceSpecialAbility = (raceId: string): string | undefined => {
  return RACES[raceId]?.specialAbility
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
