/**
 * Building System - BRT (Buildrate) Mechanics
 * From township-screen.md - Official Forum Documentation
 */

// BRT percentage table from documentation
export const BRT_TABLE: Record<string, number> = {
  '0-4.999': 4,
  '5-9.999': 6,
  '10-14.999': 8,
  '15-19.999': 10,
  '20-24.999': 12,
  '25-29.999': 14,
  '30-34.999': 16,
  '35-39.999': 18,
  '40-44.999': 19,
  '45-49.999': 20,
  '50-54.999': 21,
  '55-59.999': 22,
  '60-64.999': 23,
  '65-69.999': 24,
  '70-74.999': 25,
  '75-79.999': 26,
  '80-84.999': 27,
  '85-89.999': 28,
  '90-94.999': 29,
  '95-99.999': 30,
  '100': 31, // Impossible - no land to build on
};

/**
 * Calculate BRT (structures per turn) based on quarry percentage
 * @param quarryPercentage - Percentage of land dedicated to quarries (0-100)
 * @returns BRT value (4-31)
 */
export function calculateBRT(quarryPercentage: number): number {
  if (quarryPercentage < 5) return 4;
  if (quarryPercentage < 10) return 6;
  if (quarryPercentage < 15) return 8;
  if (quarryPercentage < 20) return 10;
  if (quarryPercentage < 25) return 12;
  if (quarryPercentage < 30) return 14;
  if (quarryPercentage < 35) return 16;
  if (quarryPercentage < 40) return 18;
  if (quarryPercentage < 45) return 19;
  if (quarryPercentage < 50) return 20;
  if (quarryPercentage < 55) return 21;
  if (quarryPercentage < 60) return 22;
  if (quarryPercentage < 65) return 23;
  if (quarryPercentage < 70) return 24;
  if (quarryPercentage < 75) return 25;
  if (quarryPercentage < 80) return 26;
  if (quarryPercentage < 85) return 27;
  if (quarryPercentage < 90) return 28;
  if (quarryPercentage < 95) return 29;
  if (quarryPercentage < 100) return 30;
  return 31; // 100% (impossible scenario)
}

/**
 * Calculate turn cost for building action
 * @param buildingCount - Number of structures to build
 * @param brt - Current BRT value
 * @returns Number of turns required
 */
export function calculateBuildTurns(buildingCount: number, brt: number): number {
  return Math.ceil(buildingCount / brt);
}

/**
 * Calculate efficiency warning for building action
 * @param buildingCount - Number of structures to build
 * @param brt - Current BRT value
 * @returns Warning message if inefficient, null otherwise
 */
export function getBuildEfficiencyWarning(buildingCount: number, brt: number): string | null {
  const turnsNeeded = calculateBuildTurns(buildingCount, brt);
  const wastedPotential = (turnsNeeded * brt) - buildingCount;
  
  if (wastedPotential > 0 && wastedPotential < brt) {
    return `⚠️ Building ${buildingCount} uses ${turnsNeeded} turn${turnsNeeded > 1 ? 's' : ''} but could build ${wastedPotential} more structures for same cost`;
  }
  
  return null;
}

/**
 * Building type recommendations from documentation
 */
export const BUILDING_RECOMMENDATIONS = {
  income: {
    name: 'Income Buildings',
    maxPercentage: 10,
    reason: 'Vulnerable to sabotage, keep at 10% max'
  },
  peasant: {
    name: 'Peasant Buildings',
    recommendedPercentage: 10,
    reason: 'Increases population and income'
  },
  troop: {
    name: 'Troop Buildings',
    minPercentage: 30,
    reason: 'Increases training rate and reduces expenses'
  },
  buildrate: {
    name: 'Buildrate Buildings',
    earlyGame: 80, // Until 3,000 built
    midGame: 40,   // Next few days
    lateGame: 30,  // Ideal 25-35%
    reason: 'Critical for rapid expansion and repair'
  },
  magic: {
    name: 'Magic Buildings',
    warrior: 10,
    sorcerer: 20,
    dedicatedSorcerer: 35,
    suisorc: 50,
    reason: 'Boosts sorcery power and elan generation'
  },
  fortress: {
    name: 'Fortresses',
    maxPercentage: 10,
    reason: 'Defensive structures, 5-10% recommended'
  }
};

/**
 * Race-specific building names from documentation
 */
export const RACE_BUILDING_NAMES: Record<string, Record<string, string>> = {
  HUMAN: {
    income: 'Guildhalls',
    peasant: 'Hovels',
    troop: 'Barracks',
    buildrate: 'Quarries',
    magic: 'Temples',
    fortress: 'Fortresses'
  },
  ELVEN: {
    income: 'Markets',
    peasant: 'Lodges',
    troop: 'Garrisons',
    buildrate: 'Mills',
    magic: 'Groves',
    fortress: 'Towers'
  },
  GOBLIN: {
    income: 'Smithies',
    peasant: 'Dens',
    troop: 'Barrak',
    buildrate: 'Mines',
    magic: 'Shrines',
    fortress: 'Tunnels'
  },
  DROBEN: {
    income: 'TimoTon',
    peasant: 'Baklavs',
    troop: 'RumaNa',
    buildrate: 'Waterfalls',
    magic: 'Enclaves',
    fortress: 'Arches'
  },
  VAMPIRE: {
    income: 'Underwoods',
    peasant: 'Tombs',
    troop: 'Great Halls',
    buildrate: 'Bloodbaths',
    magic: 'Focus Points',
    fortress: 'Centrocs'
  },
  ELEMENTAL: {
    income: 'Slave Markets',
    peasant: 'Charging Cells',
    troop: 'Cages',
    buildrate: 'Spectral Mists',
    magic: 'Casting Pits',
    fortress: 'Altars'
  },
  CENTAUR: {
    income: 'Trinket Shops',
    peasant: 'Hollowed Oaks',
    troop: 'Thickets',
    buildrate: 'Forges',
    magic: 'Fires',
    fortress: 'Briars'
  },
  SIDHE: {
    income: 'Wagons',
    peasant: 'Tents',
    troop: 'Sacred Fields',
    buildrate: 'Looms',
    magic: 'Magick Circles',
    fortress: 'Spires'
  },
  DWARVEN: {
    income: 'Gem Mines',
    peasant: 'Caves',
    troop: 'Caverns',
    buildrate: 'Ore Mines',
    magic: 'Sanctums',
    fortress: 'Strongholds'
  },
  FAE: {
    income: 'Dolmen',
    peasant: 'Brambles',
    troop: 'Henges',
    buildrate: 'Wishing Wells',
    magic: 'Cairns',
    fortress: 'Ringforts'
  }
};

/**
 * Get race-specific building name
 */
export function getBuildingName(race: string, buildingType: string): string {
  const raceNames = RACE_BUILDING_NAMES[race.toUpperCase()];
  return raceNames?.[buildingType] || buildingType;
}
