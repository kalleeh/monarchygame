/**
 * Elan System Mechanics (Official Terminology)
 * Calculates elan based on temple count and land
 * From war-sorcery-screens.md - Official Forum Documentation
 * IQC Compliant: Authentic game mechanics
 */

export interface ElanCalculation {
  currentElan: number;
  maxElan: number;
  templeCount: number;
  templePercentage: number;
  elanGenerationRate: number;
}

// Elan calculation constants from documentation
export const ELAN_MECHANICS = {
  // Elan generation per turn (from documentation)
  ELAN_GENERATION_RATES: {
    SIDHE: 0.005,    // ceil(temples × 0.005)
    VAMPIRE: 0.005,  // ceil(temples × 0.005)
    OTHERS: 0.003    // ceil(temples × 0.003)
  },
  
  // Temple requirements for spell tiers (from documentation)
  TEMPLE_REQUIREMENTS: {
    TIER_1: 0.02,  // 2% temples - Shattering Calm
    TIER_2: 0.04,  // 4% temples - Wild Design
    TIER_3: 0.08,  // 8% temples - Blazing Noise/Fog
    TIER_4: 0.12   // 12% temples - Banshee Deluge, Foul Light
  },
  
  // Spell costs (from documentation)
  SPELL_COSTS: {
    CALMING_CHANT: 0,      // Grants 1 elan
    AWAKENED_SPIRITS: 10,
    SHATTERING_CALM: 20,
    WILD_DESIGN: 40,
    BLAZING_NOISE: 60,
    BANSHEE_DELUGE: 80
  },
  
  // All spells cost 2 turns
  SPELL_TURN_COST: 2,
  
  // Racial elan bonuses
  RACIAL_ELAN_MULTIPLIERS: {
    SIDHE: 1.5,      // 50% bonus (master sorcerers)
    VAMPIRE: 1.3,    // 30% bonus
    ELEMENTAL: 1.2,  // 20% bonus
    ELVEN: 1.2,      // 20% bonus
    FAE: 1.2,        // 20% bonus
    HUMAN: 1.0,      // Standard
    GOBLIN: 1.0,     // Standard
    DROBEN: 0.9,     // 10% penalty (warriors)
    CENTAUR: 1.0,    // Standard
    DWARVEN: 0.9     // 10% penalty (warriors)
  }
};

/**
 * Calculate elan generation per turn based on temples
 * From documentation: Sidhe/Vampire = ceil(temples × 0.005), Others = ceil(temples × 0.003)
 */
export const calculateElanGeneration = (
  templeCount: number,
  raceId: string = 'HUMAN'
): number => {
  const isHighMagicRace = raceId.toUpperCase() === 'SIDHE' || raceId.toUpperCase() === 'VAMPIRE';
  const rate = isHighMagicRace 
    ? ELAN_MECHANICS.ELAN_GENERATION_RATES.SIDHE 
    : ELAN_MECHANICS.ELAN_GENERATION_RATES.OTHERS;
  
  return Math.ceil(templeCount * rate);
};

/**
 * Calculate maximum elan storage based on temples and land
 */
export const calculateMaxElan = (
  templeCount: number,
  _landCount: number,
  raceId: string = 'HUMAN'
): number => {
  // Base elan storage scales with temples
  const baseElan = templeCount * 10;
  
  // Apply racial multiplier
  const raceMultiplier = ELAN_MECHANICS.RACIAL_ELAN_MULTIPLIERS[
    raceId.toUpperCase() as keyof typeof ELAN_MECHANICS.RACIAL_ELAN_MULTIPLIERS
  ] || 1.0;
  
  return Math.floor(baseElan * raceMultiplier);
};

/**
 * Calculate complete elan status for a kingdom
 */
export const calculateElanStatus = (
  templeCount: number,
  landCount: number,
  _totalStructures: number,
  raceId: string,
  currentElan?: number
): ElanCalculation => {
  const maxElan = calculateMaxElan(templeCount, landCount, raceId);
  const templePercentage = landCount > 0 ? (templeCount / landCount) * 100 : 0;
  const elanGenerationRate = calculateElanGeneration(templeCount, raceId);
  
  return {
    currentElan: currentElan !== undefined ? Math.min(currentElan, maxElan) : 0,
    maxElan,
    templeCount,
    templePercentage,
    elanGenerationRate
  };
};

/**
 * Validate if kingdom has enough elan for spell
 */
export const canAffordSpell = (
  currentElan: number,
  spellCost: number
): boolean => {
  return currentElan >= spellCost;
};

/**
 * Validate if kingdom has enough temples for spell tier
 */
export const hasRequiredTemples = (
  templePercentage: number,
  requiredPercentage: number
): boolean => {
  return templePercentage >= requiredPercentage;
};

/**
 * Calculate elan after spell cast
 */
export const calculateElanAfterCast = (
  currentElan: number,
  spellCost: number,
  maxElan: number
): number => {
  const newElan = currentElan - spellCost;
  return Math.max(0, Math.min(newElan, maxElan));
};

/**
 * Calculate backlash damage (destroys temples)
 * From documentation: Backlash destroys temples, costs elan and turns
 */
export interface BacklashResult {
  templesDestroyed: number;
  elanLost: number;
  turnsCost: number;
}

export const calculateBacklash = (
  templeCount: number,
  raceId: string
): BacklashResult => {
  // Backlash rates vary by race (from documentation)
  const backlashRates: Record<string, number> = {
    SIDHE: 0.09,      // 9% backlash
    ELVEN: 0.10,      // 10% backlash
    FAE: 0.10,        // 10% backlash
    VAMPIRE: 0.13,    // 13% backlash
    ELEMENTAL: 0.11,  // 11% backlash
    HUMAN: 0.12,      // 12% backlash (estimated)
    GOBLIN: 0.12,     // 12% backlash (estimated)
    DROBEN: 0.15,     // 15% backlash (warriors)
    CENTAUR: 0.12,    // 12% backlash (estimated)
    DWARVEN: 0.15     // 15% backlash (warriors)
  };
  
  const backlashRate = backlashRates[raceId.toUpperCase()] || 0.12;
  const templesDestroyed = Math.floor(templeCount * backlashRate);
  const elanLost = Math.ceil(templesDestroyed * 2); // Lose elan proportional to temples
  
  return {
    templesDestroyed,
    elanLost,
    turnsCost: 2 // Always 2 turns
  };
};
