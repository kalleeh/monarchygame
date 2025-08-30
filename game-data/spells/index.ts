/**
 * Spell definitions for Monarchy game
 * Based on original Monarchy/Canon game mechanics
 */

export interface SpellCost {
  mana: number          // Mana points required
  turns: number         // Turns required to cast
  gold?: number         // Additional gold cost
  components?: string[] // Required spell components
}

export interface SpellEffect {
  type: 'damage' | 'buff' | 'debuff' | 'summon' | 'utility' | 'economic'
  target: 'self' | 'ally' | 'enemy' | 'territory' | 'global'
  duration?: number     // Turns the effect lasts (0 = permanent, -1 = instant)
  magnitude: number     // Strength of the effect
  description: string
}

export interface Spell {
  id: string
  name: string
  description: string
  school: 'offensive' | 'defensive' | 'utility' | 'summoning' | 'economic'
  level: number         // 1-5, higher level = more powerful
  cost: SpellCost
  effects: SpellEffect[]
  requirements?: {
    buildings?: string[]
    technologies?: string[]
    race?: string[]
    sorceryLevel?: number
  }
  backlashChance?: number // Chance of spell backfiring (0-1)
  cooldown?: number       // Turns before spell can be cast again
}

export const SPELLS: Record<string, Spell> = {
  // Level 1 Spells - Basic Magic
  minor_heal: {
    id: 'minor_heal',
    name: 'Minor Heal',
    description: 'Restores health to damaged units',
    school: 'defensive',
    level: 1,
    cost: {
      mana: 10,
      turns: 1
    },
    effects: [{
      type: 'buff',
      target: 'self',
      duration: 0,
      magnitude: 50,
      description: 'Heals 50 HP to all units'
    }],
    requirements: {
      sorceryLevel: 1
    }
  },

  magic_missile: {
    id: 'magic_missile',
    name: 'Magic Missile',
    description: 'Launches magical projectiles at enemy forces',
    school: 'offensive',
    level: 1,
    cost: {
      mana: 15,
      turns: 1
    },
    effects: [{
      type: 'damage',
      target: 'enemy',
      duration: -1,
      magnitude: 100,
      description: 'Deals 100 damage to enemy units'
    }],
    requirements: {
      sorceryLevel: 1
    },
    backlashChance: 0.05
  },

  detect_magic: {
    id: 'detect_magic',
    name: 'Detect Magic',
    description: 'Reveals magical effects on target kingdom',
    school: 'utility',
    level: 1,
    cost: {
      mana: 8,
      turns: 1
    },
    effects: [{
      type: 'utility',
      target: 'enemy',
      duration: -1,
      magnitude: 1,
      description: 'Reveals active spells on target'
    }],
    requirements: {
      sorceryLevel: 1
    }
  },

  // Level 2 Spells - Intermediate Magic
  fog_of_war: {
    id: 'fog_of_war',
    name: 'Fog of War',
    description: 'Conceals kingdom from enemy reconnaissance',
    school: 'defensive',
    level: 2,
    cost: {
      mana: 25,
      turns: 2
    },
    effects: [{
      type: 'buff',
      target: 'self',
      duration: 10,
      magnitude: 1,
      description: 'Prevents enemy reconnaissance for 10 turns'
    }],
    requirements: {
      sorceryLevel: 2,
      buildings: ['temple']
    }
  },

  remote_fog: {
    id: 'remote_fog',
    name: 'Remote Fog',
    description: 'Cast fog on allied kingdoms of same faith',
    school: 'defensive',
    level: 2,
    cost: {
      mana: 30,
      turns: 2
    },
    effects: [{
      type: 'buff',
      target: 'ally',
      duration: 8,
      magnitude: 1,
      description: 'Casts fog on allied kingdom'
    }],
    requirements: {
      sorceryLevel: 2,
      race: ['Elven']
    }
  },

  fireball: {
    id: 'fireball',
    name: 'Fireball',
    description: 'Explosive magical attack against enemy forces',
    school: 'offensive',
    level: 2,
    cost: {
      mana: 35,
      turns: 2
    },
    effects: [{
      type: 'damage',
      target: 'enemy',
      duration: -1,
      magnitude: 250,
      description: 'Deals 250 fire damage to enemy units'
    }],
    requirements: {
      sorceryLevel: 2
    },
    backlashChance: 0.1
  },

  summon_troops: {
    id: 'summon_troops',
    name: 'Summon Troops',
    description: 'Magically creates temporary military units',
    school: 'summoning',
    level: 2,
    cost: {
      mana: 40,
      turns: 3
    },
    effects: [{
      type: 'summon',
      target: 'self',
      duration: 15,
      magnitude: 100,
      description: 'Summons 100 temporary troops for 15 turns'
    }],
    requirements: {
      sorceryLevel: 2,
      buildings: ['temple']
    }
  },

  // Level 3 Spells - Advanced Magic
  lightning_bolt: {
    id: 'lightning_bolt',
    name: 'Lightning Bolt',
    description: 'Devastating electrical attack',
    school: 'offensive',
    level: 3,
    cost: {
      mana: 50,
      turns: 3
    },
    effects: [{
      type: 'damage',
      target: 'enemy',
      duration: -1,
      magnitude: 400,
      description: 'Deals 400 lightning damage, ignores some armor'
    }],
    requirements: {
      sorceryLevel: 3,
      buildings: ['mage_tower']
    },
    backlashChance: 0.15
  },

  mass_heal: {
    id: 'mass_heal',
    name: 'Mass Heal',
    description: 'Powerful healing magic affecting all units',
    school: 'defensive',
    level: 3,
    cost: {
      mana: 45,
      turns: 3
    },
    effects: [{
      type: 'buff',
      target: 'self',
      duration: 0,
      magnitude: 200,
      description: 'Heals 200 HP to all units and removes debuffs'
    }],
    requirements: {
      sorceryLevel: 3,
      buildings: ['temple']
    }
  },

  dispel_magic: {
    id: 'dispel_magic',
    name: 'Dispel Magic',
    description: 'Removes magical effects from target',
    school: 'utility',
    level: 3,
    cost: {
      mana: 35,
      turns: 2
    },
    effects: [{
      type: 'utility',
      target: 'enemy',
      duration: -1,
      magnitude: 1,
      description: 'Removes all magical effects from target'
    }],
    requirements: {
      sorceryLevel: 3
    }
  },

  // Level 4 Spells - Master Magic
  meteor: {
    id: 'meteor',
    name: 'Meteor',
    description: 'Calls down a devastating meteor strike',
    school: 'offensive',
    level: 4,
    cost: {
      mana: 80,
      turns: 5
    },
    effects: [{
      type: 'damage',
      target: 'enemy',
      duration: -1,
      magnitude: 800,
      description: 'Massive area damage, destroys some buildings'
    }],
    requirements: {
      sorceryLevel: 4,
      buildings: ['mage_tower'],
      technologies: ['advanced_magic']
    },
    backlashChance: 0.2,
    cooldown: 20
  },

  summon_circles: {
    id: 'summon_circles',
    name: 'Summon Circles',
    description: 'Creates magical circles that summon troops and temples',
    school: 'summoning',
    level: 4,
    cost: {
      mana: 70,
      turns: 4
    },
    effects: [
      {
        type: 'summon',
        target: 'self',
        duration: 20,
        magnitude: 150,
        description: 'Summons 150 temporary troops'
      },
      {
        type: 'summon',
        target: 'self',
        duration: 0,
        magnitude: 3,
        description: 'Creates 3 temporary temples'
      }
    ],
    requirements: {
      sorceryLevel: 4,
      race: ['Sidhe']
    }
  },

  time_stop: {
    id: 'time_stop',
    name: 'Time Stop',
    description: 'Briefly stops time, gaining extra actions',
    school: 'utility',
    level: 4,
    cost: {
      mana: 100,
      turns: 1
    },
    effects: [{
      type: 'buff',
      target: 'self',
      duration: 1,
      magnitude: 5,
      description: 'Gain 5 extra turns this round'
    }],
    requirements: {
      sorceryLevel: 4,
      buildings: ['mage_tower'],
      technologies: ['time_magic']
    },
    cooldown: 50
  },

  // Level 5 Spells - Legendary Magic
  apocalypse: {
    id: 'apocalypse',
    name: 'Apocalypse',
    description: 'Ultimate destructive magic affecting entire kingdoms',
    school: 'offensive',
    level: 5,
    cost: {
      mana: 150,
      turns: 10,
      gold: 5000
    },
    effects: [{
      type: 'damage',
      target: 'enemy',
      duration: -1,
      magnitude: 2000,
      description: 'Catastrophic damage to all enemy assets'
    }],
    requirements: {
      sorceryLevel: 5,
      buildings: ['mage_tower'],
      technologies: ['legendary_magic']
    },
    backlashChance: 0.3,
    cooldown: 100
  },

  divine_intervention: {
    id: 'divine_intervention',
    name: 'Divine Intervention',
    description: 'Calls upon divine power for miraculous effects',
    school: 'defensive',
    level: 5,
    cost: {
      mana: 120,
      turns: 8
    },
    effects: [
      {
        type: 'buff',
        target: 'self',
        duration: 0,
        magnitude: 1000,
        description: 'Full heal and blessing on all units'
      },
      {
        type: 'buff',
        target: 'self',
        duration: 25,
        magnitude: 2,
        description: 'Double all income for 25 turns'
      }
    ],
    requirements: {
      sorceryLevel: 5,
      buildings: ['temple', 'mage_tower']
    },
    cooldown: 200
  },

  // Special Racial Spells
  kobold_rage_spell: {
    id: 'kobold_rage_spell',
    name: 'Kobold Rage',
    description: 'Enrages kobold units, doubling their combat effectiveness',
    school: 'offensive',
    level: 2,
    cost: {
      mana: 30,
      turns: 2
    },
    effects: [{
      type: 'buff',
      target: 'self',
      duration: 5,
      magnitude: 2,
      description: 'Doubles kobold offensive power for 5 turns'
    }],
    requirements: {
      sorceryLevel: 2,
      race: ['Goblin']
    }
  },

  kill_scum_spell: {
    id: 'kill_scum_spell',
    name: 'Kill Scum',
    description: 'Eliminates enemy espionage agents',
    school: 'offensive',
    level: 2,
    cost: {
      mana: 25,
      turns: 2
    },
    effects: [{
      type: 'damage',
      target: 'enemy',
      duration: -1,
      magnitude: 100,
      description: 'Kills enemy scum/spy units'
    }],
    requirements: {
      sorceryLevel: 2,
      race: ['Centaur']
    }
  }
}

// Mana generation and management
export const MANA_GENERATION = {
  baseGeneration: 10,        // Base mana per turn
  templeBonus: 5,           // Mana per temple
  mageBonus: 10,            // Mana per mage unit
  sorceryMultiplier: 0.2    // 20% bonus per sorcery point above 1
}

// Helper functions
export const getSpell = (spellId: string): Spell | undefined => {
  return SPELLS[spellId]
}

export const getSpellsBySchool = (school: string): Spell[] => {
  return Object.values(SPELLS).filter(spell => spell.school === school)
}

export const getSpellsByLevel = (level: number): Spell[] => {
  return Object.values(SPELLS).filter(spell => spell.level === level)
}

export const canCastSpell = (
  spellId: string,
  casterStats: {
    sorcery: number
    mana: number
    turns: number
    gold: number
  },
  buildings: Record<string, number> = {},
  technologies: string[] = [],
  race?: string
): { canCast: boolean, reason?: string } => {
  const spell = getSpell(spellId)
  if (!spell) {
    return { canCast: false, reason: 'Unknown spell' }
  }

  // Check sorcery level requirement
  if (spell.requirements?.sorceryLevel && casterStats.sorcery < spell.requirements.sorceryLevel) {
    return { canCast: false, reason: `Requires sorcery level ${spell.requirements.sorceryLevel}` }
  }

  // Check resource costs
  if (casterStats.mana < spell.cost.mana) {
    return { canCast: false, reason: 'Insufficient mana' }
  }

  if (casterStats.turns < spell.cost.turns) {
    return { canCast: false, reason: 'Insufficient turns' }
  }

  if (spell.cost.gold && casterStats.gold < spell.cost.gold) {
    return { canCast: false, reason: 'Insufficient gold' }
  }

  // Check building requirements
  if (spell.requirements?.buildings) {
    for (const requiredBuilding of spell.requirements.buildings) {
      if (!buildings[requiredBuilding] || buildings[requiredBuilding] === 0) {
        return { canCast: false, reason: `Requires ${requiredBuilding}` }
      }
    }
  }

  // Check technology requirements
  if (spell.requirements?.technologies) {
    for (const requiredTech of spell.requirements.technologies) {
      if (!technologies.includes(requiredTech)) {
        return { canCast: false, reason: `Requires ${requiredTech} technology` }
      }
    }
  }

  // Check race requirements
  if (spell.requirements?.race && race && !spell.requirements.race.includes(race)) {
    return { canCast: false, reason: `Only available to ${spell.requirements.race.join(', ')}` }
  }

  return { canCast: true }
}

export const calculateManaGeneration = (
  sorceryLevel: number,
  temples: number,
  mages: number
): number => {
  const base = MANA_GENERATION.baseGeneration
  const templeBonus = temples * MANA_GENERATION.templeBonus
  const mageBonus = mages * MANA_GENERATION.mageBonus
  const sorceryBonus = base * (sorceryLevel - 1) * MANA_GENERATION.sorceryMultiplier

  return Math.floor(base + templeBonus + mageBonus + sorceryBonus)
}

export const calculateSpellDamage = (
  spell: Spell,
  casterSorcery: number,
  targetDefense: number = 0
): number => {
  const damageEffect = spell.effects.find(effect => effect.type === 'damage')
  if (!damageEffect) return 0

  const baseDamage = damageEffect.magnitude
  const sorceryMultiplier = 1 + (casterSorcery - 1) * 0.25 // 25% bonus per sorcery point above 1
  const defense = Math.max(0, targetDefense)

  return Math.floor((baseDamage * sorceryMultiplier) - defense)
}

export const rollBacklash = (spell: Spell, casterSorcery: number): boolean => {
  if (!spell.backlashChance) return false

  // Higher sorcery reduces backlash chance
  const adjustedChance = spell.backlashChance * (1 - (casterSorcery - 1) * 0.1)
  return Math.random() < Math.max(0.01, adjustedChance) // Minimum 1% chance
}

export type SpellId = keyof typeof SPELLS
export const SPELL_IDS = Object.keys(SPELLS) as SpellId[]
