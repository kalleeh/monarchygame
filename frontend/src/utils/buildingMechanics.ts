/**
 * Building mechanics for Monarchy Game
 * Provides building-related calculations and utilities
 */

export interface BuildingMechanics {
  calculateBRT: (quarryPercentage: number) => number;
  getBuildingName: (race: string, buildingType: string) => string;
}

/**
 * Calculate Build Rate per Turn (BRT) based on quarry percentage
 */
export const calculateBRT = (quarryPercentage: number): number => {
  // Basic BRT calculation: 1 structure per turn at 100% quarry
  return Math.max(1, Math.floor(quarryPercentage / 100));
};

/**
 * Get race-specific building names
 */
export const getBuildingName = (race: string, buildingType: string): string => {
  const buildingNames: Record<string, Record<string, string>> = {
    Human: {
      buildrate: 'Quarries',
      military: 'Barracks',
      magic: 'Towers',
      income: 'Markets'
    },
    Elven: {
      buildrate: 'Groves',
      military: 'Halls',
      magic: 'Sanctuaries',
      income: 'Guilds'
    },
    Droben: {
      buildrate: 'Forges',
      military: 'Strongholds',
      magic: 'Altars',
      income: 'Mines'
    },
    Sidhe: {
      buildrate: 'Circles',
      military: 'Courts',
      magic: 'Nexuses',
      income: 'Exchanges'
    }
  };

  return buildingNames[race]?.[buildingType] || buildingNames.Human[buildingType] || buildingType;
};
