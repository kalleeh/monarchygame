/**
 * Combat System - Core Mechanics that Create Strategic Balance
 * These mechanics naturally lead to the optimal strategies discovered by pro players
 */

export interface CombatResult {
  success: boolean
  landGained: number
  attackerLosses: number
  defenderLosses: number
  resultType: 'with_ease' | 'good_fight' | 'failed'
  goldLooted: number
  structuresDestroyed: number
}

export interface AttackForce {
  units: Record<string, number>
  totalOffense: number
  totalDefense: number
}

export interface DefenseForce {
  units: Record<string, number>
  forts: number
  totalDefense: number
  ambushActive: boolean
}

// Core combat mechanics that create natural strategic balance
export const COMBAT_MECHANICS = {
  // Land acquisition ranges - creates natural progression strategy
  LAND_ACQUISITION: {
    FULL_STRIKE_MIN: 0.0679,    // 6.79% minimum
    FULL_STRIKE_MAX: 0.0735,    // 7.35% maximum
    WITH_EASE_MIN: 0.070,       // 7.0% when dominating
    WITH_EASE_MAX: 0.0735,      // 7.35% when dominating
    GOOD_FIGHT_MIN: 0.0679,     // 6.79% when contested
    GOOD_FIGHT_MAX: 0.070,      // 7.0% when contested
  },

  // Controlled strike mechanics - creates testing/probing strategy
  CONTROLLED_STRIKE: {
    CS1_PERCENTAGE: 0.01,       // 1% of enemy land
    CS100_PERCENTAGE: 1.0,      // 100% of enemy land
    PROGRESSION_THRESHOLD: 2,    // "with ease" 2x before escalation
  },

  // Army reduction efficiency - creates "Rule of 0.25%" strategy
  EFFICIENCY_REDUCTION: {
    REDUCTION_RATE: 0.25,       // 25% reduction per successful attack
    EFFECTIVENESS_THRESHOLD: 'with_ease', // Must maintain this level
  },

  // Ambush mechanics - creates counter-strategy necessity
  AMBUSH: {
    SUCCESS_RATE: 0.95,         // 95% effectiveness
    DETECTION_TURNS: 2,         // Scout cost
    REMOVAL_TURNS: 4,           // Guerrilla raid cost
  },

  // Summon mechanics - creates networth inflation strategy
  SUMMON_RATES: {
    DROBEN: 0.0304,            // 3.04% of networth
    ELEMENTAL: 0.0284,         // 2.84% of networth
    GOBLIN: 0.0275,            // 2.75% of networth
    DWARVEN: 0.0275,           // 2.75% of networth
    HUMAN: 0.025,              // 2.5% of networth (estimated)
  }
}

// Unit combat values that create natural tier preferences
export const UNIT_COMBAT_VALUES = {
  // Droben units (naturally optimal for offense)
  DROBEN_BUNAR: 27.50,         // T3 - highest attack value
  DROBEN_GUERRILLA: 25.0,      // T1 - excellent for raids

  // Goblin units (naturally optimal for efficiency)
  GOBLIN_T4: 22.50,            // More efficient than Dwarven T3
  
  // Dwarven units (naturally optimal for defense)
  DWARVEN_T3: 22.50,           // Same power as Goblin T4, more turns

  // Fort defense values by race
  FORT_DEFENSE: {
    GOBLIN: 285,               // Strong forts
    HUMAN: 250,                // Standard forts
    DWARVEN: 300,              // Strongest forts
  }
}

// Combat calculation functions that create strategic depth
export const calculateLandGained = (
  attackerOffense: number,
  defenderDefense: number,
  targetLand: number,
  attackType: 'full_strike' | 'controlled_strike',
  csPercentage?: number
): number => {
  const offenseRatio = attackerOffense / defenderDefense
  
  if (attackType === 'controlled_strike') {
    const targetPercentage = csPercentage || COMBAT_MECHANICS.CONTROLLED_STRIKE.CS1_PERCENTAGE
    return Math.floor(targetLand * targetPercentage)
  }

  // Full strike land calculation - creates natural range
  let landPercentage: number
  
  if (offenseRatio >= 2.0) {
    // "With ease" - higher land gain
    landPercentage = COMBAT_MECHANICS.LAND_ACQUISITION.WITH_EASE_MIN + 
      (Math.random() * (COMBAT_MECHANICS.LAND_ACQUISITION.WITH_EASE_MAX - COMBAT_MECHANICS.LAND_ACQUISITION.WITH_EASE_MIN))
  } else if (offenseRatio >= 1.2) {
    // "Good fight" - moderate land gain
    landPercentage = COMBAT_MECHANICS.LAND_ACQUISITION.GOOD_FIGHT_MIN + 
      (Math.random() * (COMBAT_MECHANICS.LAND_ACQUISITION.GOOD_FIGHT_MAX - COMBAT_MECHANICS.LAND_ACQUISITION.GOOD_FIGHT_MIN))
  } else {
    // Failed attack
    return 0
  }

  return Math.floor(targetLand * landPercentage)
}

export const calculateCombatResult = (
  attacker: AttackForce,
  defender: DefenseForce,
  targetLand: number,
  attackType: 'full_strike' | 'controlled_strike' = 'full_strike',
  csPercentage?: number
): CombatResult => {
  let effectiveAttackerOffense = attacker.totalOffense
  let effectiveDefenderDefense = defender.totalDefense

  // Ambush reduces attacker effectiveness - creates counter-strategy need
  if (defender.ambushActive) {
    effectiveAttackerOffense *= (1 - COMBAT_MECHANICS.AMBUSH.SUCCESS_RATE)
  }

  const offenseRatio = effectiveAttackerOffense / effectiveDefenderDefense
  
  // Determine result type - creates natural progression strategy
  let resultType: 'with_ease' | 'good_fight' | 'failed'
  if (offenseRatio >= 2.0) {
    resultType = 'with_ease'
  } else if (offenseRatio >= 1.2) {
    resultType = 'good_fight'
  } else {
    resultType = 'failed'
  }

  const landGained = resultType !== 'failed' ? 
    calculateLandGained(effectiveAttackerOffense, effectiveDefenderDefense, targetLand, attackType, csPercentage) : 0

  // Calculate losses based on combat intensity
  const attackerLossRate = resultType === 'with_ease' ? 0.05 : resultType === 'good_fight' ? 0.15 : 0.25
  const defenderLossRate = resultType === 'with_ease' ? 0.20 : resultType === 'good_fight' ? 0.15 : 0.05

  return {
    success: resultType !== 'failed',
    landGained,
    attackerLosses: Math.floor(attacker.totalOffense * attackerLossRate),
    defenderLosses: Math.floor(defender.totalDefense * defenderLossRate),
    resultType,
    goldLooted: landGained * 1000, // Simplified looting calculation
    structuresDestroyed: Math.floor(landGained * 0.1) // 10% of gained land in structures
  }
}

// Summon calculation that creates networth inflation strategy
export const calculateSummonTroops = (
  raceId: string,
  totalNetworth: number,
  cashMultiplier: number = 1.0,
  guildhallBonus: number = 0
): number => {
  const baseRate = COMBAT_MECHANICS.SUMMON_RATES[raceId.toUpperCase() as keyof typeof COMBAT_MECHANICS.SUMMON_RATES] || 0.025
  
  // Cash and guildhall bonuses create natural inflation strategy
  const inflatedNetworth = totalNetworth * cashMultiplier + guildhallBonus
  
  return Math.floor(inflatedNetworth * baseRate)
}

// Army efficiency calculation that creates "Rule of 0.25%" strategy
export const calculateOptimalArmyReduction = (
  currentArmy: number,
  lastResultType: 'with_ease' | 'good_fight' | 'failed'
): number => {
  if (lastResultType === 'with_ease') {
    // Can reduce army while maintaining effectiveness
    return Math.floor(currentArmy * (1 - COMBAT_MECHANICS.EFFICIENCY_REDUCTION.REDUCTION_RATE))
  }
  
  // Need to maintain or increase army size
  return currentArmy
}

// Fort defense calculation that creates natural building preferences
export const calculateFortDefense = (
  raceId: string,
  fortCount: number
): number => {
  const fortValue = UNIT_COMBAT_VALUES.FORT_DEFENSE[raceId.toUpperCase() as keyof typeof UNIT_COMBAT_VALUES.FORT_DEFENSE] || 250
  return fortCount * fortValue
}

// Multi-realm coordination mechanics
export const calculatePassThePlateEfficiency = (
  warriors: Array<{ offense: number, landCapacity: number }>,
  targetLand: number
): { totalLandGained: number, turnsRequired: number, efficiency: number } => {
  let remainingLand = targetLand
  let totalTurns = 0
  let totalLandGained = 0

  for (const warrior of warriors) {
    if (remainingLand <= 0) break

    const landGained = Math.min(
      warrior.landCapacity,
      Math.floor(remainingLand * COMBAT_MECHANICS.LAND_ACQUISITION.FULL_STRIKE_MAX)
    )
    
    totalLandGained += landGained
    remainingLand -= landGained
    totalTurns += 1 // Simplified - each warrior uses 1 turn
  }

  return {
    totalLandGained,
    turnsRequired: totalTurns,
    efficiency: totalLandGained / totalTurns
  }
}

// These mechanics create the natural strategic preferences discovered by pro players:
// - 6.79-7.35% land gain creates progression strategy (CS1 -> CS100 -> Full Strike)
// - 25% army reduction creates cash conservation strategy
// - Summon rates create networth inflation strategy
// - Fort values create natural racial building preferences
// - Ambush mechanics create counter-strategy necessity
