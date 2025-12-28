/**
 * Unit utilities for Monarchy Game
 * Provides unit-related functions and types
 */

export interface UnitType {
  name: string;
  cost: number;
  offense: number;
  defense: number;
}

/**
 * Get units available for a specific race
 */
export const getUnitsForRace = (_race: string): UnitType[] => {
  void _race; // Explicitly mark as intentionally unused
  const baseUnits: UnitType[] = [
    { name: 'Peasants', cost: 100, offense: 1, defense: 1 },
    { name: 'Infantry', cost: 500, offense: 3, defense: 2 },
    { name: 'Cavalry', cost: 1000, offense: 5, defense: 3 },
    { name: 'Archers', cost: 750, offense: 4, defense: 2 }
  ];

  // Race-specific unit variations could be added here
  return baseUnits;
};
