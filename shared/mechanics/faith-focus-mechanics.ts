/**
 * Faith and Focus Points Systems - Additional Authentic Monarchy Mechanics
 * These systems add depth to racial abilities and special actions
 */

export interface FaithStatus {
  alignment: string
  faithPoints: number
  maxFaithPoints: number
  faithLevel: number
  faithBonuses: Record<string, number>
}

export interface FocusPointsStatus {
  currentPoints: number
  maxPoints: number
  regenerationRate: number
  lastRegenTime: Date
}

export interface FaithAlignment {
  id: string
  name: string
  description: string
  bonuses: {
    racialAbilityEnhancement?: number
    spellEffectiveness?: number
    combatBonus?: number
    economicBonus?: number
  }
  restrictions?: string[]
  compatibleRaces?: string[]
}

// Faith alignments from authentic documentation
export const FAITH_ALIGNMENTS: Record<string, FaithAlignment> = {
  angelique: {
    id: 'angelique',
    name: 'Angelique',
    description: 'Divine faith alignment providing holy bonuses',
    bonuses: {
      spellEffectiveness: 0.1,    // 10% spell effectiveness bonus
      combatBonus: 0.05,          // 5% combat bonus vs evil alignments
    },
    compatibleRaces: ['vampire', 'human', 'elven', 'fae'],
    restrictions: ['Cannot use certain dark spells']
  },

  // Additional faith alignments can be added as discovered
  neutral: {
    id: 'neutral',
    name: 'Neutral',
    description: 'No faith alignment, balanced approach',
    bonuses: {},
    compatibleRaces: ['human', 'goblin', 'dwarven', 'centaur']
  },

  elemental: {
    id: 'elemental',
    name: 'Elemental',
    description: 'Nature-based faith alignment',
    bonuses: {
      spellEffectiveness: 0.08,   // 8% spell effectiveness
      economicBonus: 0.05,        // 5% economic bonus
    },
    compatibleRaces: ['elemental', 'elven', 'centaur'],
    restrictions: ['Cannot use certain technological buildings']
  }
}

// Focus Points system mechanics
export const FOCUS_MECHANICS = {
  // Base focus point generation
  BASE_GENERATION: {
    POINTS_PER_HOUR: 2,          // 2 focus points per hour
    MAX_STORAGE_BASE: 100,       // Base maximum storage
    RACIAL_MODIFIERS: {
      vampire: 1.2,              // 20% more focus generation/storage
      sidhe: 1.15,               // 15% more focus generation/storage
      elemental: 1.1,            // 10% more focus generation/storage
      human: 1.0,                // Standard generation
    }
  },

  // Focus point costs for special abilities
  ABILITY_COSTS: {
    ENHANCED_RACIAL_ABILITY: 10,  // Cost to enhance racial ability
    SPELL_POWER_BOOST: 15,        // Cost to boost spell effectiveness
    COMBAT_FOCUS: 8,              // Cost for combat focus bonus
    ECONOMIC_FOCUS: 6,            // Cost for economic focus bonus
    EMERGENCY_ACTION: 20,         // Cost for emergency actions
  },

  // Focus point effects
  FOCUS_EFFECTS: {
    RACIAL_ABILITY_BOOST: 1.5,    // 50% boost to racial ability
    SPELL_POWER_BOOST: 1.3,       // 30% boost to spell damage
    COMBAT_FOCUS_BONUS: 0.2,      // 20% combat bonus
    ECONOMIC_FOCUS_BONUS: 0.15,   // 15% economic bonus
    EFFECT_DURATION: 5,           // Effects last 5 turns
  }
}

// Faith system functions
export const calculateFaithLevel = (faithPoints: number): number => {
  if (faithPoints >= 1000) return 5
  if (faithPoints >= 500) return 4
  if (faithPoints >= 200) return 3
  if (faithPoints >= 50) return 2
  if (faithPoints >= 10) return 1
  return 0
}

export const getFaithBonuses = (
  faithAlignment: string,
  faithLevel: number
): Record<string, number> => {
  const alignment = FAITH_ALIGNMENTS[faithAlignment]
  if (!alignment) return {}

  const bonuses: Record<string, number> = {}
  const levelMultiplier = Math.max(0, 1 + (faithLevel * 0.1)) // 10% per faith level

  Object.entries(alignment.bonuses).forEach(([key, value]) => {
    bonuses[key] = value * levelMultiplier
  })

  return bonuses
}

export const canUseFaithAlignment = (
  
  _raceId: string,
  faithAlignment: string
): boolean => {
  const alignment = FAITH_ALIGNMENTS[faithAlignment]
  if (!alignment) return false

  return !alignment.compatibleRaces || 
         alignment.compatibleRaces.includes(
  _raceId.toLowerCase())
}

// Focus Points system functions
export const calculateFocusGeneration = (
  
  _raceId: string,
  baseGeneration: number = FOCUS_MECHANICS.BASE_GENERATION.POINTS_PER_HOUR
): number => {
  const racialModifier = FOCUS_MECHANICS.BASE_GENERATION.RACIAL_MODIFIERS[
    
  _raceId.toLowerCase() as keyof typeof FOCUS_MECHANICS.BASE_GENERATION.RACIAL_MODIFIERS
  ] || 1.0

  return Math.floor(baseGeneration * racialModifier)
}

export const calculateMaxFocusPoints = (
  
  _raceId: string,
  baseMax: number = FOCUS_MECHANICS.BASE_GENERATION.MAX_STORAGE_BASE
): number => {
  const racialModifier = FOCUS_MECHANICS.BASE_GENERATION.RACIAL_MODIFIERS[
    
  _raceId.toLowerCase() as keyof typeof FOCUS_MECHANICS.BASE_GENERATION.RACIAL_MODIFIERS
  ] || 1.0

  return Math.floor(baseMax * racialModifier)
}

export const updateFocusPoints = (
  currentPoints: number,
  maxPoints: number,
  lastUpdateTime: Date,
  generationRate: number,
  currentTime: Date = new Date()
): number => {
  const hoursElapsed = Math.max(0, (currentTime.getTime() - lastUpdateTime.getTime()) / (1000 * 60 * 60))
  const pointsGenerated = Math.floor(hoursElapsed * Math.max(0, generationRate))
  
  return Math.min(maxPoints, currentPoints + pointsGenerated)
}

export const canUseFocusAbility = (
  abilityType: keyof typeof FOCUS_MECHANICS.ABILITY_COSTS,
  currentFocusPoints: number
): { canUse: boolean, cost: number, reason?: string } => {
  const cost = FOCUS_MECHANICS.ABILITY_COSTS[abilityType]
  
  if (currentFocusPoints >= cost) {
    return { canUse: true, cost }
  } else {
    return { 
      canUse: false, 
      cost, 
      reason: `Insufficient focus points: need ${cost}, have ${currentFocusPoints}` 
    }
  }
}

export const applyFocusEffect = (
  effectType: keyof typeof FOCUS_MECHANICS.FOCUS_EFFECTS,
  baseValue: number
): { enhancedValue: number, duration: number } => {
  const effects = FOCUS_MECHANICS.FOCUS_EFFECTS
  
  let enhancedValue = baseValue
  
  switch (effectType) {
    case 'RACIAL_ABILITY_BOOST':
      enhancedValue = baseValue * effects.RACIAL_ABILITY_BOOST
      break
    case 'SPELL_POWER_BOOST':
      enhancedValue = baseValue * effects.SPELL_POWER_BOOST
      break
    case 'COMBAT_FOCUS_BONUS':
      enhancedValue = baseValue * (1 + effects.COMBAT_FOCUS_BONUS)
      break
    case 'ECONOMIC_FOCUS_BONUS':
      enhancedValue = baseValue * (1 + effects.ECONOMIC_FOCUS_BONUS)
      break
  }
  
  return {
    enhancedValue,
    duration: effects.EFFECT_DURATION
  }
}

// Integration with existing racial abilities
export const enhanceRacialAbilityWithFaith = (
  
  _raceId: string,
  abilityEffectiveness: number,
  faithAlignment: string,
  faithLevel: number
): number => {
  const faithBonuses = getFaithBonuses(faithAlignment, faithLevel)
  const racialBonus = faithBonuses.racialAbilityEnhancement || 0
  
  return abilityEffectiveness * (1 + racialBonus)
}

export const enhanceSpellWithFaith = (
  spellDamage: number,
  faithAlignment: string,
  faithLevel: number
): number => {
  const faithBonuses = getFaithBonuses(faithAlignment, faithLevel)
  const spellBonus = faithBonuses.spellEffectiveness || 0
  
  return spellDamage * (1 + spellBonus)
}

// These systems add authentic depth to the game:
// - Faith alignments create meaningful choices and racial synergies
// - Focus points create resource management for special abilities
// - Both systems enhance existing mechanics rather than replacing them
// - Vampire-specific faith (Angelique) documented in authentic sources
