/**
 * Age System - Core Mechanics that Create Age-Based Game Effects
 * These mechanics create natural timing windows for racial abilities and strategic shifts
 */

export interface AgeStatus {
  currentAge: 'early' | 'middle' | 'late'
  ageStartTime: Date
  ageEndTime: Date
  ageDuration: number  // Hours
  remainingTime: number // Hours
}

export interface AgeEffects {
  racialAbilityModifiers: Record<string, number>
  unitEffectivenessModifiers: Record<string, number>
  economicModifiers: {
    buildingCostMultiplier: number
    trainingCostMultiplier: number
    incomeMultiplier: number
  }
  combatModifiers: {
    offenseMultiplier: number
    defenseMultiplier: number
  }
}

// Core age mechanics that create natural timing-based strategic shifts
export const AGE_MECHANICS = {
  // Age duration that creates strategic timing windows
  AGE_DURATIONS: {
    EARLY_AGE_HOURS: 168,    // 7 days (1 week)
    MIDDLE_AGE_HOURS: 336,   // 14 days (2 weeks) 
    LATE_AGE_HOURS: 504,     // 21 days (3 weeks)
    TOTAL_GAME_HOURS: 1008   // 42 days (6 weeks) total
  },

  // Age transition thresholds
  TRANSITION_THRESHOLDS: {
    EARLY_TO_MIDDLE: 0.25,   // 25% of game time
    MIDDLE_TO_LATE: 0.67     // 67% of game time
  },

  // Racial ability age triggers (core mechanics, not strategies)
  RACIAL_AGE_TRIGGERS: {
    GOBLIN_KOBOLD_RAGE: {
      activeAge: 'middle',
      effectType: 'unit_combat_bonus',
      affectedUnits: ['kobolds'],  // T2 Goblin units
      bonusMultiplier: 1.5         // 50% combat bonus during middle age
    }
  },

  // Economic age effects that create natural strategic shifts
  ECONOMIC_AGE_EFFECTS: {
    early: {
      buildingCostMultiplier: 0.8,    // 20% cheaper building (expansion phase)
      trainingCostMultiplier: 1.0,    // Standard training costs
      incomeMultiplier: 1.2           // 20% higher income (growth phase)
    },
    middle: {
      buildingCostMultiplier: 1.0,    // Standard building costs
      trainingCostMultiplier: 0.9,    // 10% cheaper training (military buildup)
      incomeMultiplier: 1.0           // Standard income
    },
    late: {
      buildingCostMultiplier: 1.2,    // 20% more expensive building
      trainingCostMultiplier: 0.8,    // 20% cheaper training (war phase)
      incomeMultiplier: 0.9           // 10% lower income (resource depletion)
    }
  },

  // Combat age effects that create natural power shifts
  COMBAT_AGE_EFFECTS: {
    early: {
      offenseMultiplier: 0.9,         // 10% weaker offense (defensive advantage)
      defenseMultiplier: 1.1          // 10% stronger defense
    },
    middle: {
      offenseMultiplier: 1.0,         // Balanced combat
      defenseMultiplier: 1.0
    },
    late: {
      offenseMultiplier: 1.1,         // 10% stronger offense (aggressive phase)
      defenseMultiplier: 0.9          // 10% weaker defense
    }
  }
}

// Age calculation functions
export const calculateCurrentAge = (gameStartTime: Date, currentTime: Date = new Date()): AgeStatus => {
  const gameElapsedHours = Math.max(0, (currentTime.getTime() - gameStartTime.getTime()) / (1000 * 60 * 60))
  const totalGameHours = AGE_MECHANICS.AGE_DURATIONS.TOTAL_GAME_HOURS
  const gameProgress = gameElapsedHours / totalGameHours

  let currentAge: 'early' | 'middle' | 'late'
  let ageStartTime: Date
  let ageEndTime: Date
  let ageDuration: number

  if (gameProgress < AGE_MECHANICS.TRANSITION_THRESHOLDS.EARLY_TO_MIDDLE) {
    currentAge = 'early'
    ageStartTime = gameStartTime
    ageDuration = AGE_MECHANICS.AGE_DURATIONS.EARLY_AGE_HOURS
    ageEndTime = new Date(gameStartTime.getTime() + (ageDuration * 60 * 60 * 1000))
  } else if (gameProgress < AGE_MECHANICS.TRANSITION_THRESHOLDS.MIDDLE_TO_LATE) {
    currentAge = 'middle'
    ageStartTime = new Date(gameStartTime.getTime() + (AGE_MECHANICS.AGE_DURATIONS.EARLY_AGE_HOURS * 60 * 60 * 1000))
    ageDuration = AGE_MECHANICS.AGE_DURATIONS.MIDDLE_AGE_HOURS
    ageEndTime = new Date(ageStartTime.getTime() + (ageDuration * 60 * 60 * 1000))
  } else {
    currentAge = 'late'
    ageStartTime = new Date(gameStartTime.getTime() + ((AGE_MECHANICS.AGE_DURATIONS.EARLY_AGE_HOURS + AGE_MECHANICS.AGE_DURATIONS.MIDDLE_AGE_HOURS) * 60 * 60 * 1000))
    ageDuration = AGE_MECHANICS.AGE_DURATIONS.LATE_AGE_HOURS
    ageEndTime = new Date(ageStartTime.getTime() + (ageDuration * 60 * 60 * 1000))
  }

  const remainingTime = Math.max(0, (ageEndTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60))

  return {
    currentAge,
    ageStartTime,
    ageEndTime,
    ageDuration,
    remainingTime
  }
}

export const calculateAgeEffects = (currentAge: 'early' | 'middle' | 'late'): AgeEffects => {
  const economicEffects = AGE_MECHANICS.ECONOMIC_AGE_EFFECTS[currentAge]
  const combatEffects = AGE_MECHANICS.COMBAT_AGE_EFFECTS[currentAge]

  // Calculate racial ability modifiers
  const racialAbilityModifiers: Record<string, number> = {}
  
  // Goblin Kobold Rage effect
  if (currentAge === 'middle') {
    racialAbilityModifiers['goblin_kobold_rage'] = AGE_MECHANICS.RACIAL_AGE_TRIGGERS.GOBLIN_KOBOLD_RAGE.bonusMultiplier
  } else {
    racialAbilityModifiers['goblin_kobold_rage'] = 1.0 // No bonus outside middle age
  }

  // Unit effectiveness modifiers based on age
  const unitEffectivenessModifiers: Record<string, number> = {}
  
  // T2 Goblin units (Kobolds) get bonus during middle age
  if (currentAge === 'middle') {
    unitEffectivenessModifiers['kobolds'] = AGE_MECHANICS.RACIAL_AGE_TRIGGERS.GOBLIN_KOBOLD_RAGE.bonusMultiplier
  }

  return {
    racialAbilityModifiers,
    unitEffectivenessModifiers,
    economicModifiers: economicEffects,
    combatModifiers: combatEffects
  }
}

export const isRacialAbilityActive = (
  raceId: string,
  abilityType: string,
  currentAge: 'early' | 'middle' | 'late'
): boolean => {
  // Check Goblin Kobold Rage
  if (raceId.toLowerCase() === 'goblin' && abilityType === 'kobold_rage') {
    return currentAge === 'middle'
  }

  // Other racial abilities are always active (not age-dependent)
  return true
}

export const calculateAgeBasedUnitEffectiveness = (
  unitId: string,
  baseEffectiveness: number,
  currentAge: 'early' | 'middle' | 'late'
): number => {
  const ageEffects = calculateAgeEffects(currentAge)
  
  // Apply unit-specific age modifiers
  const unitModifier = ageEffects.unitEffectivenessModifiers[unitId] || 1.0
  
  // Apply general combat age modifiers
  const combatModifier = ageEffects.combatModifiers.offenseMultiplier
  
  return baseEffectiveness * unitModifier * combatModifier
}

export const calculateAgeBasedCosts = (
  baseCost: number,
  costType: 'building' | 'training',
  currentAge: 'early' | 'middle' | 'late'
): number => {
  const ageEffects = calculateAgeEffects(currentAge)
  
  const multiplier = costType === 'building' ?
    ageEffects.economicModifiers.buildingCostMultiplier :
    ageEffects.economicModifiers.trainingCostMultiplier

  return Math.ceil(Math.max(0, baseCost) * multiplier)
}

export const calculateAgeBasedIncome = (
  baseIncome: number,
  currentAge: 'early' | 'middle' | 'late'
): number => {
  const ageEffects = calculateAgeEffects(currentAge)
  return Math.floor(baseIncome * ageEffects.economicModifiers.incomeMultiplier)
}

export const getAgeTransitionWarning = (
  gameStartTime: Date,
  currentTime: Date = new Date()
): { warningType: 'none' | 'approaching' | 'imminent', nextAge?: 'middle' | 'late', hoursRemaining?: number } => {
  const currentAgeStatus = calculateCurrentAge(gameStartTime, currentTime)
  
  if (currentAgeStatus.remainingTime <= 0) {
    return { warningType: 'none' }
  }
  
  if (currentAgeStatus.remainingTime <= 24) { // 24 hours warning
    const nextAge = currentAgeStatus.currentAge === 'early' ? 'middle' : 'late'
    return {
      warningType: 'imminent',
      nextAge,
      hoursRemaining: currentAgeStatus.remainingTime
    }
  }
  
  if (currentAgeStatus.remainingTime <= 72) { // 72 hours warning
    const nextAge = currentAgeStatus.currentAge === 'early' ? 'middle' : 'late'
    return {
      warningType: 'approaching',
      nextAge,
      hoursRemaining: currentAgeStatus.remainingTime
    }
  }
  
  return { warningType: 'none' }
}

// These mechanics create natural timing-based strategic shifts:
// - Economic modifiers create natural expansion (early) -> buildup (middle) -> war (late) phases
// - Combat modifiers create defensive (early) -> balanced (middle) -> aggressive (late) phases  
// - Racial ability triggers create specific timing windows (Kobold Rage in middle age)
// - Age transitions create strategic decision points and timing considerations
