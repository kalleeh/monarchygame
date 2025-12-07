/**
 * Restoration System - Core Mechanics that Create Strategic Timing Balance
 * These mechanics naturally lead to the optimal restoration strategies discovered by pro players
 */

export interface RestorationStatus {
  type: 'damage_based' | 'death_based' | 'none'
  startTime: Date
  endTime: Date
  remainingHours: number
  allowedActions: string[]
  prohibitedActions: string[]
}

export interface KingdomDamageAssessment {
  structureLossPercentage: number
  criticalInfrastructureDestroyed: boolean
  populationLossPercentage: number
  qualifiesForRestoration: boolean
  restorationType: 'damage_based' | 'death_based' | 'none'
}

export interface RestorationStrategicValue {
  protectionDuration: number
  rebuildingCapability: number
  guildCoordinationValue: number
  enemyDenialValue: number
  totalStrategicWorth: number
}

// Core restoration mechanics that create natural strategic balance
export const RESTORATION_MECHANICS = {
  // Timing mechanics that create strategic windows
  TIMING: {
    DAMAGE_BASED_HOURS: 48,      // 48 hours protection for severe damage
    DEATH_BASED_HOURS: 72,       // 72 hours protection for complete elimination
    GRACE_PERIOD_MINUTES: 15,    // 15 minutes to trigger restoration after damage
  },

  // Damage thresholds that create restoration triggers
  DAMAGE_THRESHOLDS: {
    STRUCTURE_LOSS_MINIMUM: 0.70,    // 70% structure loss triggers damage-based
    CRITICAL_INFRASTRUCTURE: [       // Loss of these triggers restoration
      'palace', 'fortress', 'major_temples'
    ],
    POPULATION_LOSS_MINIMUM: 0.80,   // 80% population loss
    COMPLETE_ELIMINATION: 1.0,       // 100% elimination = death-based
  },

  // Action limitations that create strategic constraints
  ALLOWED_ACTIONS: [
    'building_construction',         // Can build basic infrastructure
    'encamp_usage',                 // Can use Encamp for turn acceleration
    'resource_management',          // Basic economic functions
    'guild_communication',          // Can participate in guild coordination
    'internal_affairs'              // Kingdom management
  ],

  PROHIBITED_ACTIONS: [
    'combat_attacks',               // Cannot attack others
    'combat_defense',               // Cannot be attacked
    'sorcery_casting',              // Cannot cast spells
    'sorcery_targeting',            // Cannot be targeted by magic
    'espionage_operations',         // Cannot conduct scum operations
    'espionage_targeting',          // Cannot be targeted by scum
    'diplomatic_actions',           // Cannot send/receive caravans
    'alliance_changes'              // Cannot change alliance status
  ]
}

// Restoration assessment functions
export const assessDamageForRestoration = (
  preAttackState: { structures: number, population: number, criticalBuildings: string[] },
  postAttackState: { structures: number, population: number, criticalBuildings: string[] }
): KingdomDamageAssessment => {
  const structureLossPercentage = 1 - (postAttackState.structures / preAttackState.structures)
  const populationLossPercentage = 1 - (postAttackState.population / preAttackState.population)
  
  // Check for critical infrastructure destruction
  const criticalInfrastructureDestroyed = preAttackState.criticalBuildings.some(building =>
    !postAttackState.criticalBuildings.includes(building)
  )
  
  // Determine restoration qualification
  let qualifiesForRestoration = false
  let restorationType: 'damage_based' | 'death_based' | 'none' = 'none'
  
  if (postAttackState.structures === 0 || postAttackState.population === 0) {
    // Complete elimination
    qualifiesForRestoration = true
    restorationType = 'death_based'
  } else if (
    structureLossPercentage >= RESTORATION_MECHANICS.DAMAGE_THRESHOLDS.STRUCTURE_LOSS_MINIMUM ||
    populationLossPercentage >= RESTORATION_MECHANICS.DAMAGE_THRESHOLDS.POPULATION_LOSS_MINIMUM ||
    criticalInfrastructureDestroyed
  ) {
    // Severe damage
    qualifiesForRestoration = true
    restorationType = 'damage_based'
  }
  
  return {
    structureLossPercentage,
    criticalInfrastructureDestroyed,
    populationLossPercentage,
    qualifiesForRestoration,
    restorationType
  }
}

export const calculateRestorationStatus = (
  damageTime: Date,
  restorationType: 'damage_based' | 'death_based'
): RestorationStatus => {
  const durationHours = restorationType === 'death_based' ? 
    RESTORATION_MECHANICS.TIMING.DEATH_BASED_HOURS :
    RESTORATION_MECHANICS.TIMING.DAMAGE_BASED_HOURS
  
  const endTime = new Date(damageTime.getTime() + (durationHours * 60 * 60 * 1000))
  const now = new Date()
  const remainingHours = Math.max(0, (endTime.getTime() - now.getTime()) / (60 * 60 * 1000))
  
  return {
    type: restorationType,
    startTime: damageTime,
    endTime,
    remainingHours,
    allowedActions: RESTORATION_MECHANICS.ALLOWED_ACTIONS,
    prohibitedActions: RESTORATION_MECHANICS.PROHIBITED_ACTIONS
  }
}

export const calculateStrategicRestorationValue = (
  restorationType: 'damage_based' | 'death_based',
  guildWarStatus: 'active' | 'planning' | 'recovery',
  enemyThreatLevel: 'low' | 'medium' | 'high'
): RestorationStrategicValue => {
  const protectionDuration = restorationType === 'death_based' ? 72 : 48
  
  // Rebuilding capability during restoration
  let rebuildingCapability = 0.6 // 60% normal building capability
  if (restorationType === 'damage_based') {
    rebuildingCapability = 0.8 // 80% capability for damage-based
  }
  
  // Guild coordination value
  let guildCoordinationValue = 0.5 // Base coordination value
  if (guildWarStatus === 'active') {
    guildCoordinationValue = 0.9 // High value during active war
  } else if (guildWarStatus === 'planning') {
    guildCoordinationValue = 0.7 // Medium value during planning
  }
  
  // Enemy denial value (removing target from enemy options)
  let enemyDenialValue = 0.3 // Base denial value
  if (enemyThreatLevel === 'high') {
    enemyDenialValue = 0.8 // High value against major threats
  } else if (enemyThreatLevel === 'medium') {
    enemyDenialValue = 0.6 // Medium value against moderate threats
  }
  
  const totalStrategicWorth = (
    protectionDuration * 0.3 +
    rebuildingCapability * 100 +
    guildCoordinationValue * 50 +
    enemyDenialValue * 75
  )
  
  return {
    protectionDuration,
    rebuildingCapability,
    guildCoordinationValue,
    enemyDenialValue,
    totalStrategicWorth
  }
}

export const calculateSorceryKillVsRestorationEfficiency = (
  sorceryTurns: number,
  targetRemovalHours: number,
  alternativeTargetValue: number
): { efficiency: number, recommendation: 'sorcery_kill' | 'alternative_target', reasoning: string[] } => {
  // Sorcery kill efficiency: turns invested vs hours of target removal
  const sorceryEfficiency = targetRemovalHours / sorceryTurns
  
  // Alternative efficiency: immediate gains vs turn investment
  const alternativeEfficiency = alternativeTargetValue / sorceryTurns
  
  const reasoning = []
  let recommendation: 'sorcery_kill' | 'alternative_target'
  
  if (sorceryEfficiency > alternativeEfficiency) {
    recommendation = 'sorcery_kill'
    reasoning.push(`${targetRemovalHours} hours removal worth ${sorceryTurns} turn investment`)
    if (targetRemovalHours >= 72) {
      reasoning.push('Complete elimination provides maximum strategic denial')
    }
  } else {
    recommendation = 'alternative_target'
    reasoning.push(`Alternative target provides ${alternativeTargetValue} immediate value`)
    reasoning.push('Sorcery kill turn investment not justified by removal duration')
  }
  
  return { efficiency: sorceryEfficiency, recommendation, reasoning }
}

export const calculateGuildRestorationCoordination = (
  restoredRealms: number,
  activeRealms: number,
  guildResourcePool: number
): { resourceReallocation: number, coordinationEfficiency: number, strategicAdvantage: number } => {
  const restorationRatio = restoredRealms / (restoredRealms + activeRealms)
  
  // Resource reallocation to active realms
  const resourceReallocation = guildResourcePool * restorationRatio
  
  // Coordination efficiency (restored realms can still communicate and plan)
  const coordinationEfficiency = 1 - (restorationRatio * 0.3) // 30% efficiency loss per restored realm
  
  // Strategic advantage from protected rebuilding
  const strategicAdvantage = restoredRealms * 0.4 // Each restored realm provides 40% strategic value
  
  return { resourceReallocation, coordinationEfficiency, strategicAdvantage }
}

export const calculateOptimalRestorationTiming = (
  warPhase: 'preparation' | 'active_combat' | 'resolution',
  guildNeedsAssessment: { needsRebuilding: boolean, needsCoordination: boolean, needsResources: boolean }
): { optimalTrigger: boolean, strategicBenefit: number, recommendations: string[] } => {
  const recommendations = []
  let strategicBenefit = 0
  let optimalTrigger = false
  
  if (warPhase === 'preparation') {
    if (guildNeedsAssessment.needsRebuilding) {
      strategicBenefit += 0.8
      recommendations.push('Use restoration time for infrastructure rebuilding')
    }
    if (guildNeedsAssessment.needsCoordination) {
      strategicBenefit += 0.6
      recommendations.push('Coordinate guild strategy during protection period')
    }
    optimalTrigger = strategicBenefit > 0.7
  } else if (warPhase === 'active_combat') {
    strategicBenefit += 0.9 // High value during active combat
    recommendations.push('Remove target from enemy options during critical phase')
    optimalTrigger = true
  } else if (warPhase === 'resolution') {
    strategicBenefit += 0.4 // Lower value during resolution
    recommendations.push('Consider alternative targets for better immediate gains')
    optimalTrigger = strategicBenefit > 0.6
  }
  
  return { optimalTrigger, strategicBenefit, recommendations }
}

// These mechanics create the natural strategic preferences discovered by pro players:
// - 48/72 hour protection creates strategic timing windows for guild coordination
// - Action limitations create trade-offs between safety and capability
// - Damage thresholds create natural triggers for restoration qualification
// - Strategic value calculations create decision frameworks for sorcery kill vs alternatives
// - Guild coordination mechanics create team-based restoration strategies
// - Turn investment analysis creates efficiency metrics for restoration-based tactics
