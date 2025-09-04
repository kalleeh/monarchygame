/**
 * Game balance configuration for Monarchy game
 * Exact formulas and constants from pro player documentation that create strategic depth
 */

// === COMBAT BALANCE (Exact values from documentation) ===
export const COMBAT_BALANCE = {
  // Land acquisition ranges that create natural progression strategies
  LAND_ACQUISITION: {
    FULL_STRIKE_MIN: 0.0679,     // 6.79% minimum land gain
    FULL_STRIKE_MAX: 0.0735,     // 7.35% maximum land gain
    WITH_EASE_MIN: 0.070,        // 7.0% when dominating
    WITH_EASE_MAX: 0.0735,       // 7.35% when dominating
    GOOD_FIGHT_MIN: 0.0679,      // 6.79% when contested
    GOOD_FIGHT_MAX: 0.070,       // 7.0% when contested
  },

  // Combat thresholds that create result categories
  COMBAT_THRESHOLDS: {
    WITH_EASE_RATIO: 2.0,        // 2:1 offense:defense ratio
    GOOD_FIGHT_RATIO: 1.2,       // 1.2:1 offense:defense ratio
    FAILED_ATTACK_RATIO: 1.0,    // Below 1.2:1 = failure
  },

  // Controlled strike mechanics
  CONTROLLED_STRIKE: {
    CS1_PERCENTAGE: 0.01,        // 1% of enemy land
    CS100_PERCENTAGE: 1.0,       // 100% of enemy land
    PROGRESSION_THRESHOLD: 2,     // "with ease" 2x before escalation
  },

  // Army efficiency reduction (Rule of 0.25%)
  ARMY_EFFICIENCY: {
    REDUCTION_RATE: 0.25,        // 25% reduction per successful attack
    EFFECTIVENESS_MAINTENANCE: 'with_ease', // Must maintain this level
  },

  // Racial combat effectiveness (exact summon percentages)
  RACIAL_SUMMON_RATES: {
    DROBEN: 0.0304,             // 3.04% of networth (best)
    ELEMENTAL: 0.0284,          // 2.84% of networth (second)
    GOBLIN: 0.0275,             // 2.75% of networth (tied third)
    DWARVEN: 0.0275,            // 2.75% of networth (tied third)
    HUMAN: 0.025,               // 2.5% of networth
    VAMPIRE: 0.024,             // 2.4% of networth
    ELVEN: 0.023,               // 2.3% of networth
    CENTAUR: 0.022,             // 2.2% of networth
    SIDHE: 0.021,               // 2.1% of networth
    FAE: 0.020,                 // 2.0% of networth (lowest)
  },

  // Unit combat values (exact attack values from documentation)
  UNIT_ATTACK_VALUES: {
    DROBEN_BUNAR: 27.50,        // Highest attack value in game
    DROBEN_GUERRILLA: 25.0,     // Excellent T1 raiding unit
    GOBLIN_T4: 22.50,           // Efficient high-tier unit
    DWARVEN_T3: 22.50,          // Same power, more turns
    HUMAN_DRAGONS: 20.0,        // Balanced T4 unit
    ELEMENTAL_T4: 21.0,         // Easiest T4 training
  },

  // Fort defense values by race
  FORT_DEFENSE_VALUES: {
    GOBLIN: 285,                // Strong forts
    DWARVEN: 300,               // Strongest forts
    VAMPIRE: 280,               // High-quality forts
    HUMAN: 250,                 // Standard forts
    ELEMENTAL: 260,             // Above-average forts
    ELVEN: 240,                 // Below-average forts
    DROBEN: 230,                // Weak forts (offense-focused)
    CENTAUR: 220,               // Weak forts
    SIDHE: 270,                 // Good forts
    FAE: 245,                   // Standard forts
  }
}

// === SORCERY BALANCE (Exact percentages from documentation) ===
export const SORCERY_BALANCE = {
  // Temple thresholds that create natural building strategies
  TEMPLE_THRESHOLDS: {
    TIER_1_SPELLS: 0.02,        // 2% temples for basic spells
    TIER_2_SPELLS: 0.04,        // 4% temples for Hurricane/Lightning Lance
    TIER_3_SPELLS: 0.08,        // 8% temples for Banshee Deluge
    TIER_4_SPELLS: 0.12,        // 12% temples for Foul Light
    OPTIMAL_DEFENSE: 0.16,      // 16% temples for strong defense
  },

  // Racial spell effectiveness (exact damage percentages)
  RACIAL_SPELL_DAMAGE: {
    SIDHE: {
      HURRICANE_STRUCTURES: 0.0563,    // 5.63% structure damage
      HURRICANE_FORTS: 0.075,          // 7.5% fort damage
      HURRICANE_BACKLASH: 0.09,        // 9% backlash chance
      LIGHTNING_LANCE_FORTS: 0.10,     // 10% fort damage only
      BANSHEE_DELUGE_STRUCTURES: 0.0625, // 6.25% structure damage
      FOUL_LIGHT_KILL_RATE: 0.08,     // 8% peasant kill rate
    },
    TIER_2_RACES: { // Elemental, Vampire, Elf, Fae
      HURRICANE_STRUCTURES: 0.0438,    // 4.38% structure damage
      HURRICANE_FORTS: 0.0625,         // 6.25% fort damage
      LIGHTNING_LANCE_FORTS: 0.0875,   // 8.75% fort damage
      BANSHEE_DELUGE_STRUCTURES: 0.05, // 5.0% structure damage
    },
    HUMAN: {
      HURRICANE_STRUCTURES: 0.0313,    // 3.13% structure damage
      HURRICANE_FORTS: 0.05,           // 5% fort damage
      HURRICANE_BACKLASH: 0.11,        // 11% backlash chance
      LIGHTNING_LANCE_FORTS: 0.075,    // 7.5% fort damage
      BANSHEE_DELUGE_STRUCTURES: 0.0375, // 3.75% structure damage
    }
  },

  // Elan generation rates that create temple building incentives
  ELAN_GENERATION: {
    SIDHE_VAMPIRE_RATE: 0.005,   // 0.5% of temples per turn
    STANDARD_RATE: 0.003,        // 0.3% of temples per turn
  },

  // Attacker advantage that creates offensive preference
  ATTACKER_ADVANTAGE: 1.15,     // 15% bonus for attacking sorcerer

  // Parking lot progression (exact turn counts from documentation)
  PARKING_LOT_EFFICIENCY: {
    PREP_TURNS: 50,              // 50 turns preparation
    SORCERY_TURNS: 44,           // 44 turns sorcery phase
    TOTAL_TURNS: 94,             // 94 total turns to neutralize 21k realm
    FINAL_STRUCTURES: 5179,      // Final structure count after parking lot
  }
}

// === THIEVERY BALANCE (Exact rates from documentation) ===
export const THIEVERY_BALANCE = {
  // Detection mechanics that create scum building strategies
  DETECTION: {
    MINIMUM_SCUM: 100,           // Minimum for any detection
    OPTIMAL_DETECTION_RATE: 0.85, // 80-90% target detection
    VISIBILITY_THRESHOLD: 0.80,   // 80% for reliable intelligence
  },

  // Death rates that create unit type preferences
  DEATH_RATES: {
    GREEN_SCUM_MIN: 0.01,        // 1% minimum casualties
    GREEN_SCUM_MAX: 0.025,       // 2.5% maximum casualties
    ELITE_SCUM_MIN: 0.0088,      // 0.88% minimum casualties
    ELITE_SCUM_MAX: 0.0094,      // 0.94% maximum casualties
    ELITE_SURVIVAL_ADVANTAGE: 2.5, // 2.5x more survivable
  },

  // Racial scum effectiveness
  RACIAL_SCUM_EFFECTIVENESS: {
    CENTAUR: 1.005,              // 0.5% advantage (best)
    HUMAN: 1.0,                  // Baseline effectiveness
    VAMPIRE: 1.0,                // Strong capability
    SIDHE: 1.0,                  // Strong capability
    ELVEN: 0.9,                  // Moderate capability
    GOBLIN: 0.8,                 // Weak scum
    DWARVEN: 0.8,                // Weak scum
    DROBEN: 0.7,                 // Very weak scum
    ELEMENTAL: 0.75,             // Below-average scum
    FAE: 0.85,                   // Below-average scum
  },

  // Cash theft mechanics
  THEFT: {
    BASE_THEFT_AMOUNT: 3500000,  // 3.5M per successful theft
    MAX_EXPOSURE_MULTIPLIER: 5,  // 5 thefts = 17.5M exposure
    PROTECTION_EFFECTIVENESS: 0.8, // 80% theft prevention
  },

  // Operation turn costs
  OPERATION_COSTS: {
    SCOUT: 2,                    // 2 turns per scout
    STEAL: 3,                    // 3 turns per theft
    SABOTAGE: 3,                 // 3 turns per sabotage
    INTERCEPT: 2,                // 2 turns per intercept
    BURN: 4,                     // 4 turns per burn
  }
}

// === BUILDING BALANCE (Build Rate system from documentation) ===
export const BUILDING_BALANCE = {
  // Build Rate mechanics that create natural building strategies
  BUILD_RATE: {
    OPTIMAL_MIN: 16,             // 16 BR minimum for efficiency
    OPTIMAL_MAX: 20,             // 20 BR maximum for efficiency
    MAX_SUSTAINABLE: 28,         // 28 BR maximum without debt
    DEVELOPMENT_COST: 317.5,     // 310-325 gold per acre average
  },

  // Optimal building ratios (discovered by pro players)
  OPTIMAL_RATIOS: {
    QUARRIES: { min: 0.30, max: 0.35 },    // 30-35% of structures
    BARRACKS: { min: 0.30, max: 0.35 },    // 30-35% of structures
    GUILDHALLS: 0.10,                      // 10% of structures
    HOVELS: 0.10,                          // 10% of structures
    FORTS: { min: 0.05, max: 0.06 },      // 5-6% of structures
    TEMPLES: 0.12,                         // 12% of structures
  },

  // Building vulnerability system
  VULNERABILITY: {
    PERMANENT_SURVIVAL_RATE: 0.9,  // 90% survive attacks
    PERISHABLE_SURVIVAL_RATE: 0.6, // 60% survive attacks
  }
}

// === BOUNTY BALANCE (Exact values from documentation) ===
export const BOUNTY_BALANCE = {
  // Land acquisition from bounties
  LAND_ACQUISITION_RATE: 0.30,    // 30% of target realm
  STRUCTURE_BONUS_RATE: 0.20,     // 20% built ratio bonus
  TURN_SAVINGS_BASE: 100,         // 100+ turns equivalent

  // Shared kill mechanics
  SHARED_KILL: {
    SORCERER_REDUCTION: 0.95,     // 95% reduction by sorcerer
    WARRIOR_FINISH: 0.05,         // 5% remaining for warrior
  },

  // Timing thresholds
  TITHING_EXHAUSTION: {
    MIN_ACRES: 11000,             // 11k acres minimum
    MAX_ACRES: 15000,             // 15k acres maximum
  }
}

// === RESTORATION BALANCE (Exact timing from documentation) ===
export const RESTORATION_BALANCE = {
  // Restoration timing
  DAMAGE_BASED_HOURS: 48,         // 48 hours for severe damage
  DEATH_BASED_HOURS: 72,          // 72 hours for elimination

  // Damage thresholds
  DAMAGE_THRESHOLDS: {
    STRUCTURE_LOSS: 0.70,         // 70% structure loss
    POPULATION_LOSS: 0.80,        // 80% population loss
  }
}

// === ECONOMIC BALANCE (Cash management from documentation) ===
export const ECONOMIC_BALANCE = {
  // Cash management formulas
  SAFE_CASH_MULTIPLIER: { min: 1.0, max: 1.5 }, // 1.0-1.5x acreage in millions
  WAR_ALLOCATION: { min: 0.33, max: 0.50 },      // 33-50% for war preparation

  // Turn generation
  TURNS_PER_HOUR: 3,              // 3 turns per hour base
  ENCAMP_BONUS: {
    HOURS_24: 10,                 // +10 turns for 24h encamp
    HOURS_16: 7,                  // +7 turns for 16h encamp
  }
}

// Helper functions for balance calculations
export const calculateOptimalBuildRate = (structures: number, land: number): number => {
  return Math.floor((structures / land) * 100)
}

export const isOptimalBR = (br: number): boolean => {
  return br >= BUILDING_BALANCE.BUILD_RATE.OPTIMAL_MIN && 
         br <= BUILDING_BALANCE.BUILD_RATE.OPTIMAL_MAX
}

export const calculateLandGainRange = (
  attackerOffense: number,
  defenderDefense: number,
  targetLand: number
): { min: number, max: number, resultType: string } => {
  const ratio = attackerOffense / defenderDefense
  
  if (ratio >= COMBAT_BALANCE.COMBAT_THRESHOLDS.WITH_EASE_RATIO) {
    return {
      min: Math.floor(targetLand * COMBAT_BALANCE.LAND_ACQUISITION.WITH_EASE_MIN),
      max: Math.floor(targetLand * COMBAT_BALANCE.LAND_ACQUISITION.WITH_EASE_MAX),
      resultType: 'with_ease'
    }
  } else if (ratio >= COMBAT_BALANCE.COMBAT_THRESHOLDS.GOOD_FIGHT_RATIO) {
    return {
      min: Math.floor(targetLand * COMBAT_BALANCE.LAND_ACQUISITION.GOOD_FIGHT_MIN),
      max: Math.floor(targetLand * COMBAT_BALANCE.LAND_ACQUISITION.GOOD_FIGHT_MAX),
      resultType: 'good_fight'
    }
  } else {
    return { min: 0, max: 0, resultType: 'failed' }
  }
}

export const calculateSummonTroops = (raceId: string, networth: number): number => {
  const rate = COMBAT_BALANCE.RACIAL_SUMMON_RATES[raceId.toUpperCase() as keyof typeof COMBAT_BALANCE.RACIAL_SUMMON_RATES] || 0.02
  return Math.floor(networth * rate)
}

export const calculateTempleRequirement = (spellTier: number, totalStructures: number): number => {
  const thresholds = [
    SORCERY_BALANCE.TEMPLE_THRESHOLDS.TIER_1_SPELLS,
    SORCERY_BALANCE.TEMPLE_THRESHOLDS.TIER_2_SPELLS,
    SORCERY_BALANCE.TEMPLE_THRESHOLDS.TIER_3_SPELLS,
    SORCERY_BALANCE.TEMPLE_THRESHOLDS.TIER_4_SPELLS
  ]
  
  const threshold = thresholds[spellTier - 1] || 0.02
  return Math.ceil(totalStructures * threshold)
}

// These exact values create the strategic depth discovered by pro players through mathematical optimization
