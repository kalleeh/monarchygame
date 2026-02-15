/**
 * Turn Generation System - Core Mechanics for Turn Accumulation and Acceleration
 * These mechanics create the exact turn generation rates documented by pro players
 */

export interface TurnStatus {
  currentTurns: number
  maxStoredTurns: number
  turnsPerHour: number
  nextTurnTime: Date
  encampStatus: EncampStatus | null
}

export interface EncampStatus {
  type: 'encamp_24' | 'encamp_16'
  startTime: Date
  endTime: Date
  bonusTurns: number
  remainingHours: number
  isActive: boolean
}

export interface TurnGeneration {
  baseTurnsPerHour: number
  encampBonuses: Record<string, number>
  maxTurnStorage: number
  turnAcceleration: number
}

// Core turn mechanics from pro player documentation
export const TURN_MECHANICS = {
  // Base turn generation (exact rate from documentation)
  BASE_GENERATION: {
    TURNS_PER_HOUR: 3,           // 3 turns per hour base rate
    MINUTES_PER_TURN: 20,        // 20 minutes per turn
    MAX_STORED_TURNS: 72,        // 72 turns maximum storage
    TURN_OVERFLOW_LOSS: true     // Turns beyond max are lost
  },

  // Encamp bonuses (exact values from documentation)
  ENCAMP_BONUSES: {
    ENCAMP_24_HOURS: {
      duration: 24,              // 24 hours
      bonusTurns: 10,           // +10 bonus turns
      totalTurns: 82            // 72 base + 10 bonus
    },
    ENCAMP_16_HOURS: {
      duration: 16,              // 16 hours  
      bonusTurns: 7,            // +7 bonus turns
      totalTurns: 79            // 72 base + 7 bonus
    }
  },

  // Turn acceleration mechanics
  ACCELERATION: {
    STANDARD_RATE: 1.0,          // Normal turn generation
    BONUS_RATE: 1.5,             // 50% faster during events
    PENALTY_RATE: 0.5            // 50% slower during penalties
  },

  // Turn usage costs (from documentation)
  TURN_COSTS: {
    BUILDING: 1,                 // 1 turn per building action
    TRAINING: 1,                 // 1 turn per training action
    COMBAT_ATTACK: 1,            // 1 turn per attack
    SORCERY_CAST: 1,             // 1 turn per spell cast
    ESPIONAGE_OPERATION: 2,      // 2-4 turns per scum operation
    CARAVAN_SEND: 1,             // 1 turn per caravan
    DIPLOMATIC_ACTION: 1         // 1 turn per diplomatic action
  }
}

// Turn generation calculation functions
export const calculateTurnGeneration = (
  baseRate: number = TURN_MECHANICS.BASE_GENERATION.TURNS_PER_HOUR,
  accelerationMultiplier: number = 1.0
): TurnGeneration => {
  return {
    baseTurnsPerHour: baseRate * accelerationMultiplier,
    encampBonuses: {
      encamp_24: TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_24_HOURS.bonusTurns,
      encamp_16: TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_16_HOURS.bonusTurns
    },
    maxTurnStorage: TURN_MECHANICS.BASE_GENERATION.MAX_STORED_TURNS,
    turnAcceleration: accelerationMultiplier
  }
}

export const calculateCurrentTurns = (
  lastUpdateTime: Date,
  storedTurns: number,
  currentTime: Date = new Date(),
  encampStatus: EncampStatus | null = null
): TurnStatus => {
  const hoursElapsed = Math.max(0, (currentTime.getTime() - lastUpdateTime.getTime()) / (1000 * 60 * 60))

  // Calculate base turn generation
  let newTurns = Math.floor(hoursElapsed * TURN_MECHANICS.BASE_GENERATION.TURNS_PER_HOUR)
  
  // Add encamp bonus if active
  let encampBonusTurns = 0
  if (encampStatus && encampStatus.isActive && currentTime <= encampStatus.endTime) {
    encampBonusTurns = encampStatus.bonusTurns
  }
  
  // Calculate total turns with storage limit
  const totalTurns = Math.min(
    storedTurns + newTurns + encampBonusTurns,
    TURN_MECHANICS.BASE_GENERATION.MAX_STORED_TURNS + encampBonusTurns
  )
  
  // Calculate next turn time
  const minutesUntilNextTurn = TURN_MECHANICS.BASE_GENERATION.MINUTES_PER_TURN
  const nextTurnTime = new Date(currentTime.getTime() + (minutesUntilNextTurn * 60 * 1000))
  
  return {
    currentTurns: totalTurns,
    maxStoredTurns: TURN_MECHANICS.BASE_GENERATION.MAX_STORED_TURNS + encampBonusTurns,
    turnsPerHour: TURN_MECHANICS.BASE_GENERATION.TURNS_PER_HOUR,
    nextTurnTime,
    encampStatus
  }
}

export const startEncamp = (
  encampType: 'encamp_24' | 'encamp_16',
  startTime: Date = new Date()
): EncampStatus => {
  const encampData = encampType === 'encamp_24' ? 
    TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_24_HOURS :
    TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_16_HOURS
  
  const endTime = new Date(startTime.getTime() + (encampData.duration * 60 * 60 * 1000))
  const remainingHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
  
  return {
    type: encampType,
    startTime,
    endTime,
    bonusTurns: encampData.bonusTurns,
    remainingHours,
    isActive: true
  }
}

export const updateEncampStatus = (
  encampStatus: EncampStatus,
  currentTime: Date = new Date()
): EncampStatus => {
  const remainingHours = Math.max(0, (encampStatus.endTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60))
  const isActive = remainingHours > 0
  
  return {
    ...encampStatus,
    remainingHours,
    isActive
  }
}

export const calculateActionTurnCost = (
  actionType: keyof typeof TURN_MECHANICS.TURN_COSTS,
  quantity: number = 1,
  actionSpecificModifiers: Record<string, number> = {}
): number => {
  const baseCost = TURN_MECHANICS.TURN_COSTS[actionType] || 1
  const modifier = actionSpecificModifiers[actionType] || 1
  
  // Most actions cost 1 turn regardless of quantity (from documentation)
  if (['BUILDING', 'TRAINING', 'COMBAT_ATTACK', 'SORCERY_CAST'].includes(actionType)) {
    return Math.ceil(baseCost * modifier)
  }
  
  // Espionage operations can vary by type
  if (actionType === 'ESPIONAGE_OPERATION') {
    return Math.ceil(baseCost * modifier) // 2-4 turns based on operation type
  }
  
  return Math.ceil(baseCost * quantity * modifier)
}

export const calculateOptimalEncampTiming = (
  currentTurns: number,
  plannedActions: Array<{ type: keyof typeof TURN_MECHANICS.TURN_COSTS, quantity: number }>,
  timeUntilCriticalAction: number // hours
): { recommendEncamp: boolean, encampType: 'encamp_24' | 'encamp_16' | null, reasoning: string[] } => {
  const reasoning = []
  
  // Calculate total turn cost of planned actions
  const totalTurnCost = plannedActions.reduce((total, action) => {
    return total + calculateActionTurnCost(action.type, action.quantity)
  }, 0)
  
  const turnsNeeded = totalTurnCost - currentTurns
  
  if (turnsNeeded <= 0) {
    reasoning.push('Sufficient turns available for planned actions')
    return { recommendEncamp: false, encampType: null, reasoning }
  }
  
  // Calculate time to generate needed turns naturally
  const hoursToGenerateNaturally = turnsNeeded / TURN_MECHANICS.BASE_GENERATION.TURNS_PER_HOUR
  
  if (timeUntilCriticalAction > hoursToGenerateNaturally) {
    reasoning.push(`Natural generation (${hoursToGenerateNaturally.toFixed(1)}h) faster than encamp`)
    return { recommendEncamp: false, encampType: null, reasoning }
  }
  
  // Determine optimal encamp type
  if (timeUntilCriticalAction >= 24) {
    reasoning.push('24-hour encamp provides maximum bonus turns')
    return { recommendEncamp: true, encampType: 'encamp_24', reasoning }
  } else if (timeUntilCriticalAction >= 16) {
    reasoning.push('16-hour encamp fits available time window')
    return { recommendEncamp: true, encampType: 'encamp_16', reasoning }
  } else {
    reasoning.push('Insufficient time for effective encamp usage')
    return { recommendEncamp: false, encampType: null, reasoning }
  }
}

export const calculateTurnEfficiency = (
  turnsSpent: number,
  resultsAchieved: { landGained?: number, structuresBuilt?: number, unitsTrained?: number, enemiesDefeated?: number }
): { efficiency: number, breakdown: Record<string, number> } => {
  if (turnsSpent === 0) {
    return { efficiency: 0, breakdown: {} }
  }

  const breakdown: Record<string, number> = {}
  let totalValue = 0

  // Land efficiency (most valuable)
  if (resultsAchieved.landGained) {
    const landEfficiency = resultsAchieved.landGained / turnsSpent
    breakdown.landEfficiency = landEfficiency
    totalValue += resultsAchieved.landGained * 10 // Weight land highly
  }

  // Structure efficiency
  if (resultsAchieved.structuresBuilt) {
    const structureEfficiency = resultsAchieved.structuresBuilt / turnsSpent
    breakdown.structureEfficiency = structureEfficiency
    totalValue += resultsAchieved.structuresBuilt * 5 // Weight structures moderately
  }

  // Unit efficiency
  if (resultsAchieved.unitsTrained) {
    const unitEfficiency = resultsAchieved.unitsTrained / turnsSpent
    breakdown.unitEfficiency = unitEfficiency
    totalValue += resultsAchieved.unitsTrained * 3 // Weight units lower
  }

  // Combat efficiency
  if (resultsAchieved.enemiesDefeated) {
    const combatEfficiency = resultsAchieved.enemiesDefeated / turnsSpent
    breakdown.combatEfficiency = combatEfficiency
    totalValue += resultsAchieved.enemiesDefeated * 8 // Weight combat highly
  }

  const efficiency = totalValue / turnsSpent

  return { efficiency, breakdown }
}

// These mechanics create the exact turn generation system documented by pro players:
// - 3 turns per hour base rate (not 24 per day)
// - Encamp bonuses: +10 for 24h, +7 for 16h
// - 72 turn storage limit with overflow loss
// - 1 turn per action regardless of quantity (building/training efficiency)
// - Turn acceleration during special events
// - Optimal encamp timing calculations for strategic planning
