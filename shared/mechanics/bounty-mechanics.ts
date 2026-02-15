/**
 * Bounty System - Core Mechanics that Create Strategic Bounty Hunting
 * These mechanics naturally lead to the optimal bounty strategies discovered by pro players
 */

export interface BountyReward {
  landGained: number
  structuresGained: number
  turnsSaved: number
  totalValue: number
}

export interface BountyTarget {
  kingdomId: string
  totalLand: number
  totalStructures: number
  buildRatio: number
  difficulty: 'easy' | 'medium' | 'hard'
  estimatedTurns: number
}

interface RankedBountyTarget extends BountyTarget {
  efficiency: number
}

export interface SharedKillOperation {
  
    
    
    sorcererReduction: number  // Percentage reduced by sorcerer
  warriorFinish: boolean     // Whether warrior delivers final blow
  bountyClaimant: 'sorcerer' | 'warrior'
  landRecipient: 'sorcerer' | 'warrior'
}

// Core bounty mechanics that create natural strategic balance
export const BOUNTY_MECHANICS = {
  // Land acquisition rates that create bounty value
  LAND_ACQUISITION: {
    SORCERY_KILL_RATE: 0.30,    // 30% of target realm land
    STRUCTURE_BONUS_RATE: 0.20,  // ~20% built ratio bonus
    MINIMUM_LAND_GAIN: 1000,     // Minimum viable bounty size
  },

  // Turn savings calculations that create efficiency metrics
  TURN_SAVINGS: {
    BASE_TURN_VALUE: 100,        // 100+ turns equivalent value
    BR_MULTIPLIER: {             // Turn value by build rate
      16: 90,
      17: 95,
      18: 100,
      19: 105,
      20: 110
    },
    STRUCTURE_TURN_VALUE: 0.5,   // Turns saved per structure gained
  },

  // Shared kill mechanics that create cooperation strategies
  SHARED_KILL: {
    SORCERER_REDUCTION_TARGET: 0.95, // 95% elimination by sorcerer
    WARRIOR_FINISH_THRESHOLD: 0.05,  // 5% remaining for warrior
    DUAL_BENEFIT: true,              // Both players benefit
  },

  // Timing thresholds that create strategic windows
  TIMING: {
    TITHING_EXHAUSTION_MIN: 11000,   // 11k acres minimum
    TITHING_EXHAUSTION_MAX: 15000,   // 15k acres maximum
    OPPORTUNITY_WINDOW_TURNS: 250,   // 250 turns for 4k acres consideration
  },

  // Environmental assessment that creates meta-game strategy
  ENVIRONMENT: {
    MAJOR_GUILD_COUNT: 3,            // Typical major guild count
    MINOR_GUILD_COUNT: 3,            // Typical minor guild count
    SAFE_ENGAGEMENT_RATIO: 0.67,     // 2 of 3 major guilds engaged = safe
  }
}

// Bounty value calculation functions
export const calculateBountyValue = (
  targetLand: number,
  
  _targetStructures: number,
  targetBuildRatio: number,
  hunterBuildRate: number = 18
): BountyReward => {
  // Land gained from sorcery kill
  const landGained = Math.floor(targetLand * BOUNTY_MECHANICS.LAND_ACQUISITION.SORCERY_KILL_RATE)
  
  // Structures gained (includes built structures bonus)
  const baseStructures = Math.floor(landGained * (targetBuildRatio / 100))
  const bonusStructures = Math.floor(baseStructures * BOUNTY_MECHANICS.LAND_ACQUISITION.STRUCTURE_BONUS_RATE)
  const structuresGained = baseStructures + bonusStructures
  
  // Turn savings calculation
  const brMultiplier = BOUNTY_MECHANICS.TURN_SAVINGS.BR_MULTIPLIER[hunterBuildRate as keyof typeof BOUNTY_MECHANICS.TURN_SAVINGS.BR_MULTIPLIER] || 100
  const baseTurnSavings = BOUNTY_MECHANICS.TURN_SAVINGS.BASE_TURN_VALUE * (brMultiplier / 100)
  const structureTurnSavings = structuresGained * BOUNTY_MECHANICS.TURN_SAVINGS.STRUCTURE_TURN_VALUE
  const turnsSaved = Math.floor(baseTurnSavings + structureTurnSavings)
  
  // Total value calculation
  const totalValue = landGained + structuresGained + turnsSaved
  
  return {
    landGained,
    structuresGained,
    turnsSaved,
    totalValue
  }
}

export const calculateSharedKillBenefit = (
  targetLand: number,
  
  _targetStructures: number,
  sorcererTurns: number,
  warriorTurns: number
): { sorcererBenefit: BountyReward, warriorBenefit: BountyReward, totalEfficiency: number } => {
  // Sorcerer reduces target to 95%
  const sorcererReduction = BOUNTY_MECHANICS.SHARED_KILL.SORCERER_REDUCTION_TARGET;
  
  // Sorcerer gets bounty reward (using reduction factor)
  const sorcererBenefit = calculateBountyValue(targetLand * sorcererReduction, 
  _targetStructures, 20) // Assume good build ratio
  
  // Warrior gets land from finishing blow
  const warriorLandGain = Math.floor(targetLand * 0.15) // 15% for finishing blow
  const warriorBenefit: BountyReward = {
    landGained: warriorLandGain,
    structuresGained: Math.floor(warriorLandGain * 0.1), // Minimal structures
    turnsSaved: 20, // Minimal turn investment
    totalValue: warriorLandGain + 20
  }
  
  // Calculate total efficiency
  const totalTurns = sorcererTurns + warriorTurns
  const totalBenefit = sorcererBenefit.totalValue + warriorBenefit.totalValue
  const totalEfficiency = totalBenefit / totalTurns
  
  return { sorcererBenefit, warriorBenefit, totalEfficiency }
}

export const calculateTithingExhaustionThreshold = (
  
  _raceId: string,
  currentLand: number,
  tithingBonus: number
): { isExhausted: boolean, optimalBountyTiming: boolean } => {
  const minThreshold = BOUNTY_MECHANICS.TIMING.TITHING_EXHAUSTION_MIN
  const maxThreshold = BOUNTY_MECHANICS.TIMING.TITHING_EXHAUSTION_MAX
  
  // Racial modifiers for tithing efficiency
  const racialTithingEfficiency = {
    human: 1.2,    // 20% better tithing
    fae: 1.15,     // 15% better tithing
    dwarven: 1.1,  // 10% better tithing
    vampire: 0.8,  // 20% worse tithing (higher costs)
  }
  
  const efficiency = racialTithingEfficiency[
  _raceId.toLowerCase() as keyof typeof racialTithingEfficiency] || 1.0
  const adjustedThreshold = maxThreshold * efficiency
  
  const isExhausted = currentLand >= adjustedThreshold || tithingBonus < 0.1
  const optimalBountyTiming = currentLand >= minThreshold && isExhausted
  
  return { isExhausted, optimalBountyTiming }
}

export const assessBountyEnvironment = (
  majorGuildsAtWar: number,
  
  _minorGuildsAtWar: number,
  playerGuildStatus: 'major' | 'minor' | 'independent'
): { safetyLevel: 'safe' | 'moderate' | 'dangerous', recommendBountyHunting: boolean } => {
  const totalMajorGuilds = BOUNTY_MECHANICS.ENVIRONMENT.MAJOR_GUILD_COUNT
  const safeEngagementRatio = BOUNTY_MECHANICS.ENVIRONMENT.SAFE_ENGAGEMENT_RATIO
  
  const majorGuildEngagementRatio = majorGuildsAtWar / totalMajorGuilds
  
  let safetyLevel: 'safe' | 'moderate' | 'dangerous'
  let recommendBountyHunting: boolean
  
  if (majorGuildEngagementRatio >= safeEngagementRatio) {
    safetyLevel = 'safe'
    recommendBountyHunting = true
  } else if (majorGuildEngagementRatio >= 0.33) {
    safetyLevel = 'moderate'
    recommendBountyHunting = playerGuildStatus !== 'major'
  } else {
    safetyLevel = 'dangerous'
    recommendBountyHunting = false
  }
  
  return { safetyLevel, recommendBountyHunting }
}

export const calculateBountyEfficiency = (
  bountyReward: BountyReward,
  turnsInvested: number,
  alternativeWarGains: number = 2000 // Typical "low level" war gains
): { efficiency: number, comparison: 'better' | 'worse' | 'equal', advantage: number } => {
  const bountyEfficiency = bountyReward.totalValue / turnsInvested
  const warEfficiency = alternativeWarGains / turnsInvested
  
  let comparison: 'better' | 'worse' | 'equal'
  const advantage = bountyEfficiency - warEfficiency
  
  if (advantage > 5) {
    comparison = 'better'
  } else if (advantage < -5) {
    comparison = 'worse'
  } else {
    comparison = 'equal'
  }
  
  return { efficiency: bountyEfficiency, comparison, advantage }
}

export const identifyOptimalBountyTargets = (
  availableTargets: BountyTarget[],
  hunterCapabilities: { maxTurns: number, buildRate: number, 
  _raceId: string }
): BountyTarget[] => {
  return availableTargets
    .filter(target => target.estimatedTurns <= hunterCapabilities.maxTurns)
    .map((target): RankedBountyTarget => {
      const reward = calculateBountyValue(
        target.totalLand,
        target.totalStructures,
        target.buildRatio,
        hunterCapabilities.buildRate
      )
      return {
        ...target,
        efficiency: reward.totalValue / target.estimatedTurns
      }
    })
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, 5) // Top 5 targets
}

export const calculateNPCBountyAdvantage = (
  npcTarget: BountyTarget,
  playerTarget: BountyTarget
): { npcAdvantage: number, recommendNPC: boolean, reasons: string[] } => {
  const npcReward = calculateBountyValue(npcTarget.totalLand, npcTarget.totalStructures, npcTarget.buildRatio)
  const playerReward = calculateBountyValue(playerTarget.totalLand, playerTarget.totalStructures, playerTarget.buildRatio)
  
  const npcEfficiency = npcReward.totalValue / npcTarget.estimatedTurns
  const playerEfficiency = playerReward.totalValue / playerTarget.estimatedTurns
  
  const npcAdvantage = npcEfficiency - playerEfficiency
  const recommendNPC = npcAdvantage > 0
  
  const reasons = []
  if (npcTarget.difficulty === 'easy') reasons.push('Lower resistance')
  if (npcTarget.estimatedTurns < playerTarget.estimatedTurns) reasons.push('Faster completion')
  if (npcReward.landGained > playerReward.landGained) reasons.push('More land gained')
  if (npcReward.structuresGained > playerReward.structuresGained) reasons.push('Better structures')
  
  return { npcAdvantage, recommendNPC, reasons }
}

// These mechanics create the natural strategic preferences discovered by pro players:
// - 30% land acquisition creates superior turn-to-land ratio vs traditional warfare
// - Structure bonus (20%) creates value beyond just land acquisition
// - Turn savings calculations create efficiency metrics for bounty evaluation
// - Tithing exhaustion thresholds create natural timing windows (11k-15k acres)
// - Environmental assessment creates meta-game strategic timing
// - Shared kill mechanics create cooperation incentives between sorcerers and warriors
