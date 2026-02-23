/**
 * Spell definitions for Monarchy game
 * Authentic Monarchy spells with exact damage percentages from pro player documentation
 */

export interface SpellCost {
  elan: number          // Elan points required
  turns: number         // Turns required to cast
  templeThreshold: number // Minimum temple percentage required
}

export interface SpellEffect {
  type: 'structure_damage' | 'fort_damage' | 'peasant_kill' | 'shield_removal' | 'utility'
  damagePercentage?: number    // Percentage of target destroyed
  peasantKillRate?: number     // Rate of peasant kills for peasant_kill spells
  backlashChance: number       // Chance of spell backfiring
  racialVariations: Record<string, { damage?: number, backlash?: number }>
}

export interface Spell {
  id: string
  name: string
  description: string
  tier: number          // 1-4, determines temple requirements
  cost: SpellCost
  effects: SpellEffect
  targetType: 'enemy_kingdom' | 'enemy_structures' | 'enemy_forts' | 'enemy_peasants' | 'enemy_shields' | 'self'
}

// Authentic Monarchy spells with exact mechanics from documentation
export const SPELLS: Record<string, Spell> = {
  // === UNIVERSAL SPELLS (No temple threshold) ===
  calming_chant: {
    id: 'calming_chant',
    name: 'Calming Chant',
    description: 'Temporary income increase and grants 1 elan per casting',
    tier: 0,
    cost: {
      elan: 0,
      turns: 2,
      templeThreshold: 0.0  // Available to all races
    },
    effects: {
      type: 'utility',
      backlashChance: 0.0,  // No backlash risk
      racialVariations: {
        SIDHE: { damage: 0, backlash: 0.0 },
        ELEMENTAL: { damage: 0, backlash: 0.0 },
        VAMPIRE: { damage: 0, backlash: 0.0 },
        ELVEN: { damage: 0, backlash: 0.0 },
        FAE: { damage: 0, backlash: 0.0 },
        HUMAN: { damage: 0, backlash: 0.0 },
        GOBLIN: { damage: 0, backlash: 0.0 },
        DWARVEN: { damage: 0, backlash: 0.0 },
        CENTAUR: { damage: 0, backlash: 0.0 },
        DROBEN: { damage: 0, backlash: 0.0 }
      }
    },
    targetType: 'self'
  },

  // === TIER 1 SPELLS (2% temple threshold) ===
  rousing_wind: {
    id: 'rousing_wind',
    name: 'Rousing Wind',
    description: 'Removes enemy magical shields with minimal backlash risk',
    tier: 1,
    cost: {
      elan: 1,
      turns: 2,
      templeThreshold: 0.02  // 2% temples required
    },
    effects: {
      type: 'shield_removal',
      backlashChance: 0.05,  // 5% backlash (lowest risk)
      racialVariations: {
        SIDHE: { backlash: 0.04 },
        ELEMENTAL: { backlash: 0.06 },
        VAMPIRE: { backlash: 0.06 },
        ELVEN: { backlash: 0.05 },
        FAE: { backlash: 0.05 },
        HUMAN: { backlash: 0.07 }
      }
    },
    targetType: 'enemy_shields'
  },

  shattering_calm: {
    id: 'shattering_calm',
    name: 'Shattering Calm',
    description: 'Alternative shield removal spell with higher backlash',
    tier: 1,
    cost: {
      elan: 2,
      turns: 2,
      templeThreshold: 0.02  // 2% temples required
    },
    effects: {
      type: 'shield_removal',
      backlashChance: 0.08,  // 8% backlash (higher risk)
      racialVariations: {
        SIDHE: { backlash: 0.07 },
        ELEMENTAL: { backlash: 0.09 },
        VAMPIRE: { backlash: 0.09 },
        ELVEN: { backlash: 0.08 },
        FAE: { backlash: 0.08 },
        HUMAN: { backlash: 0.10 }
      }
    },
    targetType: 'enemy_shields'
  },

  // === TIER 2 SPELLS (4% temple threshold) ===
  hurricane: {
    id: 'hurricane',
    name: 'Hurricane',
    description: 'Destroys both structures and forts with racial damage variations',
    tier: 2,
    cost: {
      elan: 3,
      turns: 3,
      templeThreshold: 0.04  // 4% temples required
    },
    effects: {
      type: 'structure_damage',
      backlashChance: 0.09,  // Base backlash
      racialVariations: {
        SIDHE: { 
          damage: 0.0563,      // 5.63% structures
          backlash: 0.09       // 9% backlash
        },
        ELEMENTAL: { 
          damage: 0.0438,      // 4.38% structures
          backlash: 0.13       // 13% backlash
        },
        VAMPIRE: { 
          damage: 0.0438,      // 4.38% structures
          backlash: 0.13       // 13% backlash
        },
        ELVEN: { 
          damage: 0.0438,      // 4.38% structures
          backlash: 0.10       // 10% backlash
        },
        FAE: { 
          damage: 0.0438,      // 4.38% structures
          backlash: 0.08       // 8% backlash
        },
        HUMAN: {
          damage: 0.0313,      // 3.13% structures
          backlash: 0.11       // 11% backlash
        },
        GOBLIN: {
          damage: 0.025,       // 2.5% structures (slight siege bonus)
          backlash: 0.14       // 14% backlash
        },
        DWARVEN: {
          damage: 0.025,       // 2.5% structures
          backlash: 0.15       // 15% backlash
        },
        CENTAUR: {
          damage: 0.028,       // 2.8% structures
          backlash: 0.13       // 13% backlash
        },
        DROBEN: {
          damage: 0.02,        // 2.0% structures (worst magic)
          backlash: 0.18       // 18% backlash
        }
      }
    },
    targetType: 'enemy_structures'
  },

  lightning_lance: {
    id: 'lightning_lance',
    name: 'Lightning Lance',
    description: 'Targets forts only, no structure damage',
    tier: 2,
    cost: {
      elan: 3,
      turns: 3,
      templeThreshold: 0.04  // 4% temples required
    },
    effects: {
      type: 'fort_damage',
      backlashChance: 0.07,  // Base backlash
      racialVariations: {
        SIDHE: { 
          damage: 0.10,        // 10% forts only
          backlash: 0.07       // 7% backlash
        },
        ELEMENTAL: { 
          damage: 0.0875,      // 8.75% forts only
          backlash: 0.11       // 11% backlash
        },
        VAMPIRE: { 
          damage: 0.0875,      // 8.75% forts only
          backlash: 0.11       // 11% backlash
        },
        ELVEN: { 
          damage: 0.0875,      // 8.75% forts only
          backlash: 0.08       // 8% backlash
        },
        FAE: { 
          damage: 0.0875,      // 8.75% forts only
          backlash: 0.08       // 8% backlash
        },
        HUMAN: {
          damage: 0.075,       // 7.5% forts only
          backlash: 0.09       // 9% backlash
        },
        GOBLIN: {
          damage: 0.04,        // 4.0% forts (slight siege bonus)
          backlash: 0.14       // 14% backlash
        },
        DWARVEN: {
          damage: 0.05,        // 5.0% forts (fortified)
          backlash: 0.15       // 15% backlash
        },
        CENTAUR: {
          damage: 0.04,        // 4.0% forts
          backlash: 0.13       // 13% backlash
        },
        DROBEN: {
          damage: 0.035,       // 3.5% forts (worst magic)
          backlash: 0.18       // 18% backlash
        }
      }
    },
    targetType: 'enemy_forts'
  },

  // === TIER 3 SPELLS (8% temple threshold) ===
  banshee_deluge: {
    id: 'banshee_deluge',
    name: 'Banshee Deluge',
    description: 'Destroys structures only, no fort damage',
    tier: 3,
    cost: {
      elan: 5,
      turns: 4,
      templeThreshold: 0.08  // 8% temples required
    },
    effects: {
      type: 'structure_damage',
      backlashChance: 0.07,  // Base backlash
      racialVariations: {
        SIDHE: { 
          damage: 0.0625,      // 6.25% structures (no fort effect)
          backlash: 0.07       // 7% backlash
        },
        ELEMENTAL: { 
          damage: 0.05,        // 5.0% structures (no fort effect)
          backlash: 0.11       // 11% backlash
        },
        VAMPIRE: { 
          damage: 0.05,        // 5.0% structures (no fort effect)
          backlash: 0.11       // 11% backlash
        },
        ELVEN: { 
          damage: 0.05,        // 5.0% structures (no fort effect)
          backlash: 0.08       // 8% backlash
        },
        FAE: { 
          damage: 0.05,        // 5.0% structures (no fort effect)
          backlash: 0.08       // 8% backlash
        },
        HUMAN: {
          damage: 0.0375,      // 3.75% structures (no fort effect)
          backlash: 0.09       // 9% backlash
        },
        GOBLIN: {
          damage: 0.025,       // 2.5% structures (slight siege bonus)
          backlash: 0.14       // 14% backlash
        },
        DWARVEN: {
          damage: 0.025,       // 2.5% structures
          backlash: 0.15       // 15% backlash
        },
        CENTAUR: {
          damage: 0.028,       // 2.8% structures
          backlash: 0.13       // 13% backlash
        },
        DROBEN: {
          damage: 0.02,        // 2.0% structures (worst magic)
          backlash: 0.18       // 18% backlash
        }
      }
    },
    targetType: 'enemy_structures'
  },

  // === TIER 4 SPELLS (12% temple threshold) ===
  foul_light: {
    id: 'foul_light',
    name: 'Foul Light',
    description: 'Eliminates peasant population for sorcery kills',
    tier: 4,
    cost: {
      elan: 8,
      turns: 5,
      templeThreshold: 0.12  // 12% temples required
    },
    effects: {
      type: 'peasant_kill',
      backlashChance: 0.07,  // Base backlash
      racialVariations: {
        SIDHE: { 
          damage: 0.08,        // 8% peasant kill rate (40 peasants per cast)
          backlash: 0.07       // 7% backlash
        },
        ELEMENTAL: { 
          damage: 0.06,        // 6% peasant kill rate
          backlash: 0.11       // 11% backlash
        },
        VAMPIRE: { 
          damage: 0.06,        // 6% peasant kill rate
          backlash: 0.11       // 11% backlash
        },
        ELVEN: { 
          damage: 0.06,        // 6% peasant kill rate
          backlash: 0.08       // 8% backlash
        },
        FAE: { 
          damage: 0.06,        // 6% peasant kill rate
          backlash: 0.08       // 8% backlash
        },
        HUMAN: {
          damage: 0.04,        // 4% peasant kill rate (<30 peasants per cast)
          backlash: 0.09       // 9% backlash
        },
        GOBLIN: {
          damage: 0.032,       // 3.2% peasant kill rate
          backlash: 0.14       // 14% backlash
        },
        DWARVEN: {
          damage: 0.032,       // 3.2% peasant kill rate
          backlash: 0.15       // 15% backlash
        },
        CENTAUR: {
          damage: 0.036,       // 3.6% peasant kill rate
          backlash: 0.13       // 13% backlash
        },
        DROBEN: {
          damage: 0.026,       // 2.6% peasant kill rate (worst magic)
          backlash: 0.18       // 18% backlash
        }
      }
    },
    targetType: 'enemy_peasants'
  }
}

// Helper functions
export const getSpell = (spellId: string): Spell | undefined => {
  return SPELLS[spellId]
}

export const getSpellsByTier = (tier: number): Spell[] => {
  return Object.values(SPELLS).filter(spell => spell.tier === tier)
}

export const calculateSpellDamage = (
  spellId: string,
  casterRace: string,
  targetCount: number
): { damage: number, backlashChance: number } => {
  const spell = getSpell(spellId)
  if (!spell) return { damage: 0, backlashChance: 0 }

  const raceVariation = spell.effects.racialVariations[casterRace.toUpperCase()]
  if (!raceVariation) return { damage: 0, backlashChance: spell.effects.backlashChance }

  const damagePercentage = raceVariation.damage || 0
  const damage = Math.floor(targetCount * damagePercentage)
  const backlashChance = raceVariation.backlash || spell.effects.backlashChance

  return { damage, backlashChance }
}

export const canCastSpell = (
  spellId: string,
  casterTemples: number,
  casterTotalStructures: number,
  availableElan: number
): { canCast: boolean, reason?: string } => {
  const spell = getSpell(spellId)
  if (!spell) return { canCast: false, reason: 'Unknown spell' }

  // Check elan requirement
  if (availableElan < spell.cost.elan) {
    return { canCast: false, reason: `Insufficient elan: need ${spell.cost.elan}, have ${availableElan}` }
  }

  // Check temple threshold
  const templePercentage = casterTemples / casterTotalStructures
  if (templePercentage < spell.cost.templeThreshold) {
    const requiredTemples = Math.ceil(casterTotalStructures * spell.cost.templeThreshold)
    return { 
      canCast: false, 
      reason: `Insufficient temples: need ${requiredTemples} (${(spell.cost.templeThreshold * 100).toFixed(0)}%), have ${casterTemples}` 
    }
  }

  return { canCast: true }
}

export const getOptimalSpellSequence = (
  targetType: 'parking_lot' | 'sorcery_kill' | 'fort_removal'
): string[] => {
  switch (targetType) {
    case 'parking_lot':
      return ['rousing_wind', 'hurricane', 'hurricane', 'banshee_deluge', 'banshee_deluge']
    case 'sorcery_kill':
      return ['rousing_wind', 'foul_light', 'foul_light', 'foul_light']
    case 'fort_removal':
      return ['rousing_wind', 'lightning_lance', 'lightning_lance']
    default:
      return ['rousing_wind']
  }
}

export type SpellId = keyof typeof SPELLS
export const SPELL_IDS = Object.keys(SPELLS) as SpellId[]
