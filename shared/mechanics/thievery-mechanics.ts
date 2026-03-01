/**
 * Thievery System - Core Mechanics that Create Strategic Espionage Balance
 * These mechanics naturally lead to the optimal scum strategies discovered by pro players
 */

export interface ScumOperation {
  type: 'scout' | 'steal' | 'sabotage' | 'intercept' | 'burn'
  turnCost: number
  successRate: number
  casualties: number
  result: any
}

export interface ScumForce {
  green: number
  elite: number
  totalEffectiveness: number
  survivalRate: number
}

export interface ThieveryResult {
  success: boolean
  goldStolen: number
  informationGained: any
  casualtiesInflicted: number
  casualtiesSuffered: number
  detectionLevel: number
}

// Core thievery mechanics that create natural strategic balance
export const THIEVERY_MECHANICS = {
  // Detection thresholds that create natural scum building strategies
  DETECTION: {
    MINIMUM_SCUM: 100,           // Minimum for any detection capability
    OPTIMAL_DETECTION: 0.85,     // 80-90% detection rate target
    VISIBILITY_THRESHOLD: 0.80,  // 80% visibility for reliable intelligence
  },

  // Death rates that create unit type preferences
  DEATH_RATES: {
    GREEN_SCUM: { min: 0.01, max: 0.025 },    // 1-2.5% per operation
    ELITE_SCUM: { min: 0.0088, max: 0.0094 }, // 0.88-0.94% per operation
    SURVIVAL_ADVANTAGE: 2.5,                   // Elite scum 2.5x more survivable
  },

  // Cash theft mechanics that create protection strategies
  THEFT: {
    BASE_THEFT_AMOUNT: 3500000,  // 3.5M per successful loot
    MAX_EXPOSURE_MULTIPLIER: 5,  // 5 successful loots = max exposure
    PROTECTION_EFFECTIVENESS: 0.8, // 80% theft prevention with adequate scum
  },

  // Operation costs that create tactical choices
  OPERATION_COSTS: {
    SCOUT: 2,                    // 2 turns per scout attempt
    STEAL: 3,                    // 3 turns per theft attempt
    SABOTAGE: 3,                 // 3 turns per sabotage attempt
    INTERCEPT: 2,                // 2 turns per caravan intercept
    BURN: 4,                     // 4 turns per burning attempt
    DESECRATE: 3,                // 3 turns — destroy enemy temples (counters mage kingdoms)
  }
}

// Racial scum effectiveness that creates natural race preferences
export const RACIAL_SCUM_EFFECTIVENESS = {
  CENTAUR: {
    effectiveness: 1.005,        // 0.5% advantage (best scum race)
    trainingCost: 1.0,          // Standard cost
    survivalRate: 1.0,          // Standard survival
    specialAbility: 'scum_killing' // Can eliminate enemy scum directly
  },

  HUMAN: {
    effectiveness: 1.0,          // Baseline effectiveness (4/5 rating)
    trainingCost: 1.0,          // Standard cost
    survivalRate: 1.0,          // Standard survival
    specialAbility: 'none'
  },

  VAMPIRE: {
    effectiveness: 1.0,          // Strong scum capability (4/5 rating)
    trainingCost: 1.1,          // 10% higher cost
    survivalRate: 1.1,          // 10% better survival
    specialAbility: 'none'
  },

  SIDHE: {
    effectiveness: 1.0,          // Strong scum capability (4/5 rating)
    trainingCost: 1.2,          // 20% higher cost
    survivalRate: 1.0,          // Standard survival
    specialAbility: 'none'
  },

  ELVEN: {
    effectiveness: 0.9,          // Moderate scum capability (3/5 rating)
    trainingCost: 1.0,          // Standard cost
    survivalRate: 1.0,          // Standard survival
    specialAbility: 'none'
  },

  GOBLIN: {
    effectiveness: 0.8,          // Weak scum (2/5 rating)
    trainingCost: 1.25,         // 25% higher cost than Human
    survivalRate: 0.9,          // 10% worse survival
    specialAbility: 'none'
  },

  DWARVEN: {
    effectiveness: 0.8,          // Weak scum (2/5 rating)
    trainingCost: 1.3,          // 30% higher cost
    survivalRate: 0.9,          // 10% worse survival
    specialAbility: 'none'
  },

  DROBEN: {
    effectiveness: 0.75,         // Heavy war race, poor at espionage
    trainingCost: 1.3,          // 30% higher cost
    survivalRate: 0.85,         // 15% worse survival
    specialAbility: 'none'
  },

  ELEMENTAL: {
    effectiveness: 0.85,         // Magic/builder hybrid, below-average thievery
    trainingCost: 1.2,          // 20% higher cost
    survivalRate: 0.9,          // 10% worse survival
    specialAbility: 'none'
  },

  FAE: {
    effectiveness: 0.95,         // Versatile magic race, moderate thievery
    trainingCost: 1.1,          // 10% higher cost
    survivalRate: 0.95,         // 5% worse survival
    specialAbility: 'none'
  }
}

// Core thievery calculation functions
export const calculateDetectionRate = (
  yourScum: number,
  yourRace: string,
  enemyScum: number,
  enemyRace: string
): number => {
  // Must have minimum scum for any detection
  if (yourScum < THIEVERY_MECHANICS.DETECTION.MINIMUM_SCUM) {
    return 0
  }

  const yourEffectiveness = RACIAL_SCUM_EFFECTIVENESS[yourRace.toUpperCase() as keyof typeof RACIAL_SCUM_EFFECTIVENESS]?.effectiveness || 1.0
  const enemyEffectiveness = RACIAL_SCUM_EFFECTIVENESS[enemyRace.toUpperCase() as keyof typeof RACIAL_SCUM_EFFECTIVENESS]?.effectiveness || 1.0

  const yourStrength = yourScum * yourEffectiveness
  const enemyStrength = enemyScum * enemyEffectiveness

  // Detection rate based on relative strength
  const detectionRate = (yourStrength + enemyStrength) > 0 ? yourStrength / (yourStrength + enemyStrength) : 0
  
  // Cap at 95% to maintain uncertainty
  return Math.min(0.95, detectionRate)
}

export const calculateOptimalScumCount = (
  expectedEnemyScum: number,
  enemyRace: string,
  yourRace: string,
  targetDetectionRate: number = THIEVERY_MECHANICS.DETECTION.OPTIMAL_DETECTION
): number => {
  const yourEffectiveness = RACIAL_SCUM_EFFECTIVENESS[yourRace.toUpperCase() as keyof typeof RACIAL_SCUM_EFFECTIVENESS]?.effectiveness || 1.0
  const enemyEffectiveness = RACIAL_SCUM_EFFECTIVENESS[enemyRace.toUpperCase() as keyof typeof RACIAL_SCUM_EFFECTIVENESS]?.effectiveness || 1.0

  // Calculate required scum for target detection rate
  const denominator = yourEffectiveness * (1 - targetDetectionRate)
  if (denominator <= 0) {
    return THIEVERY_MECHANICS.DETECTION.MINIMUM_SCUM
  }
  const requiredScum = (expectedEnemyScum * enemyEffectiveness * targetDetectionRate) / denominator

  return Math.max(THIEVERY_MECHANICS.DETECTION.MINIMUM_SCUM, Math.ceil(requiredScum))
}

export const calculateTheftAmount = (
  attackerScum: number,
  attackerRace: string,
  defenderScum: number,
  defenderRace: string,
  targetCash: number
): { stolen: number, casualties: number } => {
  const detectionRate = calculateDetectionRate(defenderScum, defenderRace, attackerScum, attackerRace)
  
  // Success rate inversely related to detection
  const successRate = 1 - detectionRate
  
  if (Math.random() > successRate) {
    // Failed theft - higher casualties
    const casualties = Math.floor(attackerScum * 0.05) // 5% casualties on failure
    return { stolen: 0, casualties }
  }

  // Successful theft
  const baseTheft = THIEVERY_MECHANICS.THEFT.BASE_THEFT_AMOUNT
  const actualTheft = Math.min(baseTheft, targetCash * 0.1) // Max 10% of available cash
  const casualties = Math.floor(attackerScum * 0.015) // 1.5% casualties on success

  return { stolen: actualTheft, casualties }
}

export const calculateScumCasualties = (
  scumCount: number,
  scumType: 'green' | 'elite',
  operationType: keyof typeof THIEVERY_MECHANICS.OPERATION_COSTS,
  raceId: string
): number => {
  const deathRates = THIEVERY_MECHANICS.DEATH_RATES
  const baseRate = scumType === 'elite' ? 
    (deathRates.ELITE_SCUM.min + deathRates.ELITE_SCUM.max) / 2 :
    (deathRates.GREEN_SCUM.min + deathRates.GREEN_SCUM.max) / 2

  const racialSurvival = RACIAL_SCUM_EFFECTIVENESS[raceId.toUpperCase() as keyof typeof RACIAL_SCUM_EFFECTIVENESS]?.survivalRate || 1.0
  const adjustedRate = baseRate / racialSurvival

  // Operation type affects casualty rate
  const operationMultipliers = {
    scout: 0.5,      // Lower risk
    steal: 1.0,      // Standard risk
    sabotage: 1.2,   // Higher risk
    intercept: 0.8,  // Moderate risk
    burn: 1.5        // Highest risk
  }

  const finalRate = adjustedRate * (operationMultipliers[operationType.toLowerCase() as keyof typeof operationMultipliers] || 1.0)
  return Math.floor(scumCount * finalRate)
}

// Scum protection strategies that create natural defensive preferences
export const calculateProtectionLevels = (
  totalLand: number,
  threatLevel: 'low' | 'medium' | 'high',
  raceId: string
): { recommended: number, minimum: number, optimal: number } => {
  const baseRatios = {
    low: 0.1,      // 100 scum per 1,000 acres
    medium: 0.4,   // 400 scum per 1,000 acres  
    high: 0.8      // 800 scum per 1,000 acres
  }

  const racialEfficiency = RACIAL_SCUM_EFFECTIVENESS[raceId.toUpperCase() as keyof typeof RACIAL_SCUM_EFFECTIVENESS]?.effectiveness || 1.0
  
  // Adjust for racial efficiency
  const adjustedRatio = baseRatios[threatLevel] / racialEfficiency

  return {
    minimum: Math.max(THIEVERY_MECHANICS.DETECTION.MINIMUM_SCUM, Math.floor(totalLand * 0.1)),
    recommended: Math.floor(totalLand * adjustedRatio),
    optimal: Math.floor(totalLand * adjustedRatio * 1.2) // 20% buffer
  }
}

// Cost-effectiveness calculation that creates natural investment strategies
export const calculateScumCostEffectiveness = (
  scumCount: number,
  raceId: string,
  trainingCost: number,
  maintenanceCost: number
): { protectionValue: number, costPerProtection: number, efficiency: number } => {
  const racialData = RACIAL_SCUM_EFFECTIVENESS[raceId.toUpperCase() as keyof typeof RACIAL_SCUM_EFFECTIVENESS]
  
  if (!racialData) {
    return { protectionValue: 0, costPerProtection: Infinity, efficiency: 0 }
  }

  const totalCost = (trainingCost * racialData.trainingCost) + maintenanceCost
  const protectionValue = scumCount * racialData.effectiveness * racialData.survivalRate
  const costPerProtection = protectionValue > 0 ? totalCost / protectionValue : Infinity
  const efficiency = totalCost > 0 ? protectionValue / totalCost : 0

  return { protectionValue, costPerProtection, efficiency }
}

// Layered defense calculation for different kingdom sizes
export const calculateLayeredDefense = (
  totalLand: number,
  totalMilitary: number,
  scumAllocation: number
): { scumPercentage: number, militaryPercentage: number, effectiveness: number } => {
  const scumPercentage = (scumAllocation + totalMilitary) > 0 ? scumAllocation / (scumAllocation + totalMilitary) : 0
  const militaryPercentage = 1 - scumPercentage

  let effectiveness: number

  if (totalLand < 20000) {
    // Under 20k acres - 50/50 split optimal
    const optimalScumRatio = 0.5
    const deviation = Math.abs(scumPercentage - optimalScumRatio)
    effectiveness = Math.max(0.5, 1 - (deviation * 2))
  } else {
    // Over 20k acres - need T1/T2 troops to protect scum
    const optimalScumRatio = 0.4 // 40% scum, 60% military
    const deviation = Math.abs(scumPercentage - optimalScumRatio)
    effectiveness = Math.max(0.6, 1 - (deviation * 1.5))
  }

  return { scumPercentage, militaryPercentage, effectiveness }
}

// These mechanics create the natural strategic preferences discovered by pro players:
// - Detection thresholds create natural scum building ratios (80-90% detection target)
// - Death rates create unit type preferences (Elite scum 2.5x more survivable)
// - Racial effectiveness creates natural race preferences (Centaur > Human > others)
// - Cost structures create investment strategies (balance scum vs military)
// - Layered defense creates size-based tactical adjustments (50/50 under 20k, adjusted over 20k)
