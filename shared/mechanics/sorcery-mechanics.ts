/**
 * Sorcery System - Core Mechanics that Create Strategic Magical Balance
 * These mechanics naturally lead to the optimal sorcery strategies discovered by pro players
 */

export interface SpellEffect {
  structureDamage: number
  fortDamage: number
  peasantKills: number
  backlashChance: number
  elanCost: number
}

export interface SorceryResult {
  success: boolean
  structuresDestroyed: number
  fortsDestroyed: number
  peasantsKilled: number
  backlashDamage: number
  shieldsRemoved: number
}

export interface MagicalDefense {
  templeCount: number
  templePercentage: number
  shieldLayers: number
  elanRegeneration: number
}

// Core sorcery mechanics that create natural strategic balance
export const SORCERY_MECHANICS = {
  // Temple thresholds that create natural building strategies
  TEMPLE_THRESHOLDS: {
    TIER_1_SPELLS: 0.02,        // 2% temples for basic spells
    TIER_2_SPELLS: 0.04,        // 4% temples for Hurricane/Lightning Lance
    TIER_3_SPELLS: 0.08,        // 8% temples for Banshee Deluge
    TIER_4_SPELLS: 0.12,        // 12% temples for Foul Light
    OPTIMAL_DEFENSE: 0.16,      // 16% temples for strong magical defense
  },

  // Attacker advantage that creates offensive sorcery preference
  ATTACKER_ADVANTAGE: 1.15,     // 15% bonus for attacking sorcerer

  // Elan generation rates that create racial preferences
  ELAN_GENERATION: {
    SIDHE_VAMPIRE: 0.005,       // 0.5% of temples per turn
    STANDARD_RACES: 0.003,      // 0.3% of temples per turn
  },

  // Shield mechanics that create testing strategies
  SHIELD_SYSTEM: {
    MAX_LAYERS: 5,              // Maximum shield protection
    REMOVAL_COST: 2,            // Turns per shield removal attempt
    BREAKTHROUGH_REVEAL: true,   // First success reveals temple strength
  }
}

// Racial spell effectiveness that creates natural race preferences
export const RACIAL_SPELL_EFFECTIVENESS = {
  // Sidhe - naturally optimal for sorcery
  SIDHE: {
    HURRICANE: { structures: 0.0563, forts: 0.075, backlash: 0.09 },
    LIGHTNING_LANCE: { structures: 0, forts: 0.10, backlash: 0.07 },
    BANSHEE_DELUGE: { structures: 0.0625, forts: 0, backlash: 0.07 },
    FOUL_LIGHT: { structures: 0, forts: 0, backlash: 0.07, peasantKillRate: 0.08 }
  },

  // Tier 2 sorcery races - good magical capability
  ELEMENTAL: {
    HURRICANE: { structures: 0.0438, forts: 0.0625, backlash: 0.13 },
    LIGHTNING_LANCE: { structures: 0, forts: 0.0875, backlash: 0.11 },
    BANSHEE_DELUGE: { structures: 0.05, forts: 0, backlash: 0.11 }
  },
  
  VAMPIRE: {
    HURRICANE: { structures: 0.0438, forts: 0.0625, backlash: 0.13 },
    LIGHTNING_LANCE: { structures: 0, forts: 0.0875, backlash: 0.11 },
    BANSHEE_DELUGE: { structures: 0.05, forts: 0, backlash: 0.11 }
  },

  ELVEN: {
    HURRICANE: { structures: 0.0438, forts: 0.0625, backlash: 0.10 },
    LIGHTNING_LANCE: { structures: 0, forts: 0.0875, backlash: 0.08 },
    BANSHEE_DELUGE: { structures: 0.05, forts: 0, backlash: 0.08 }
  },

  FAE: {
    HURRICANE: { structures: 0.0438, forts: 0.0625, backlash: 0.10 },
    LIGHTNING_LANCE: { structures: 0, forts: 0.0875, backlash: 0.08 },
    BANSHEE_DELUGE: { structures: 0.05, forts: 0, backlash: 0.08 }
  },

  // Human - lower tier sorcery
  HUMAN: {
    HURRICANE: { structures: 0.0313, forts: 0.05, backlash: 0.11 },
    LIGHTNING_LANCE: { structures: 0, forts: 0.075, backlash: 0.09 },
    BANSHEE_DELUGE: { structures: 0.0375, forts: 0, backlash: 0.09 }
  }
}

// Spell definitions that create natural tactical preferences
export const SPELL_DEFINITIONS = {
  // Tier 1 - Shield breaking and testing
  ROUSING_WIND: {
    tier: 1,
    elanCost: 1,
    primaryEffect: 'shield_removal',
    templeThreshold: SORCERY_MECHANICS.TEMPLE_THRESHOLDS.TIER_1_SPELLS
  },

  SHATTERING_CALM: {
    tier: 1,
    elanCost: 2,
    primaryEffect: 'shield_removal',
    templeThreshold: SORCERY_MECHANICS.TEMPLE_THRESHOLDS.TIER_1_SPELLS
  },

  // Tier 2 - Primary offensive spells
  HURRICANE: {
    tier: 2,
    elanCost: 3,
    primaryEffect: 'structure_fort_damage',
    templeThreshold: SORCERY_MECHANICS.TEMPLE_THRESHOLDS.TIER_2_SPELLS
  },

  LIGHTNING_LANCE: {
    tier: 2,
    elanCost: 3,
    primaryEffect: 'fort_damage_only',
    templeThreshold: SORCERY_MECHANICS.TEMPLE_THRESHOLDS.TIER_2_SPELLS
  },

  // Tier 3 - Specialized destruction
  BANSHEE_DELUGE: {
    tier: 3,
    elanCost: 5,
    primaryEffect: 'structure_damage_only',
    templeThreshold: SORCERY_MECHANICS.TEMPLE_THRESHOLDS.TIER_3_SPELLS
  },

  // Tier 4 - Population elimination
  FOUL_LIGHT: {
    tier: 4,
    elanCost: 8,
    primaryEffect: 'peasant_killing',
    templeThreshold: SORCERY_MECHANICS.TEMPLE_THRESHOLDS.TIER_4_SPELLS
  }
}

// Core sorcery calculation functions
export const calculateSpellSuccess = (
  casterTemples: number,
  casterTotalStructures: number,
  targetTemples: number,
  targetTotalStructures: number,
  spellTier: number
): boolean => {
  const casterTemplePercentage = casterTemples / casterTotalStructures
  const targetTemplePercentage = targetTemples / targetTotalStructures
  
  // Get required threshold for spell tier
  const thresholds = Object.values(SORCERY_MECHANICS.TEMPLE_THRESHOLDS)
  const requiredThreshold = thresholds[spellTier - 1] || 0.02
  
  // Caster must meet minimum threshold
  if (casterTemplePercentage < requiredThreshold) {
    return false
  }
  
  // Calculate relative magical strength with attacker advantage
  const casterStrength = casterTemplePercentage * SORCERY_MECHANICS.ATTACKER_ADVANTAGE
  const targetStrength = targetTemplePercentage
  
  // Success based on relative strength
  return casterStrength > targetStrength
}

export const calculateSpellDamage = (
  spellName: string,
  casterRace: string,
  targetStructures: number,
  targetForts: number,
  targetPeasants: number
): SpellEffect => {
  const raceEffectiveness = RACIAL_SPELL_EFFECTIVENESS[casterRace.toUpperCase() as keyof typeof RACIAL_SPELL_EFFECTIVENESS]
  
  if (!raceEffectiveness) {
    return { structureDamage: 0, fortDamage: 0, peasantKills: 0, backlashChance: 0, elanCost: 0 }
  }

  const spellData = raceEffectiveness[spellName.toUpperCase() as keyof typeof raceEffectiveness] as {
    structures?: number;
    forts?: number;
    backlash: number;
    peasantKillRate?: number;
  }
  
  if (!spellData) {
    return { structureDamage: 0, fortDamage: 0, peasantKills: 0, backlashChance: 0, elanCost: 0 }
  }

  return {
    structureDamage: Math.floor(targetStructures * (spellData.structures || 0)),
    fortDamage: Math.floor(targetForts * (spellData.forts || 0)),
    peasantKills: spellData.peasantKillRate ? Math.floor(targetPeasants * spellData.peasantKillRate) : 0,
    backlashChance: spellData.backlash,
    elanCost: SPELL_DEFINITIONS[spellName.toUpperCase() as keyof typeof SPELL_DEFINITIONS]?.elanCost || 3
  }
}

// Elan generation that creates natural temple building strategies
export const calculateElanGeneration = (
  raceId: string,
  templeCount: number
): number => {
  const isHighMagicRace = raceId.toLowerCase() === 'sidhe' || raceId.toLowerCase() === 'vampire'
  const rate = isHighMagicRace ? 
    SORCERY_MECHANICS.ELAN_GENERATION.SIDHE_VAMPIRE : 
    SORCERY_MECHANICS.ELAN_GENERATION.STANDARD_RACES
  
  return Math.ceil(templeCount * rate)
}

// Parking lot progression calculation
export const calculateParkingLotProgression = (
  initialStructures: number,
  initialForts: number,
  casterRace: string,
  spellSequence: string[]
): Array<{ turn: number, structures: number, forts: number, trainRate: number }> => {
  let currentStructures = initialStructures
  let currentForts = initialForts
  const progression: Array<{ turn: number, structures: number, forts: number, trainRate: number }> = []
  
  spellSequence.forEach((spell, index) => {
    const damage = calculateSpellDamage(spell, casterRace, currentStructures, currentForts, 0)
    
    currentStructures = Math.max(0, currentStructures - damage.structureDamage)
    currentForts = Math.max(0, currentForts - damage.fortDamage)
    
    // Train rate approximation based on remaining structures
    const trainRate = Math.floor(currentStructures * 0.15) // Simplified calculation
    
    progression.push({
      turn: index + 1,
      structures: currentStructures,
      forts: currentForts,
      trainRate
    })
  })
  
  return progression
}

// Sorcery kill progression for population elimination
export const calculateSorceryKillProgression = (
  initialPeasants: number,
  casterRace: string,
  killSpell: string = 'FOUL_LIGHT'
): Array<{ cast: number, peasantsRemaining: number, percentageKilled: number }> => {
  let currentPeasants = initialPeasants
  const progression = []
  let castCount = 0
  
  while (currentPeasants > 0 && castCount < 100) { // Safety limit
    castCount++
    const damage = calculateSpellDamage(killSpell, casterRace, 0, 0, currentPeasants)
    const killed = Math.min(damage.peasantKills, currentPeasants)
    
    currentPeasants -= killed
    const percentageKilled = ((initialPeasants - currentPeasants) / initialPeasants) * 100
    
    progression.push({
      cast: castCount,
      peasantsRemaining: currentPeasants,
      percentageKilled
    })
    
    if (currentPeasants === 0) break
  }
  
  return progression
}

// Optimal temple percentage calculation that creates natural building strategies
export const calculateOptimalTemplePercentage = (
  primaryRole: 'offensive_sorcerer' | 'defensive_target' | 'balanced',
  expectedThreatLevel: 'low' | 'medium' | 'high'
): number => {
  const basePercentages = {
    offensive_sorcerer: SORCERY_MECHANICS.TEMPLE_THRESHOLDS.TIER_3_SPELLS, // 8% for casting
    defensive_target: SORCERY_MECHANICS.TEMPLE_THRESHOLDS.OPTIMAL_DEFENSE,  // 16% for defense
    balanced: SORCERY_MECHANICS.TEMPLE_THRESHOLDS.TIER_2_SPELLS             // 4% for basic protection
  }
  
  const threatMultipliers = {
    low: 1.0,
    medium: 1.5,
    high: 2.0
  }
  
  return Math.min(0.20, basePercentages[primaryRole] * threatMultipliers[expectedThreatLevel])
}

// These mechanics create the natural strategic preferences discovered by pro players:
// - Temple thresholds create natural building percentages (2%, 4%, 8%, 12%, 16%)
// - Racial effectiveness creates natural race preferences (Sidhe > Tier 2 > Human)
// - Attacker advantage creates offensive sorcery preference
// - Elan generation creates temple building strategies
// - Spell progression creates natural tactical sequences (shield break → damage → kill)
