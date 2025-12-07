/**
 * Resource Calculations - Aligned with Reference Material
 * IQC Compliant: Uses building data from game-data
 */

// Building counts interface
export interface BuildingCounts {
  quarries?: number;
  hovels?: number;
  guildhalls?: number;
  temples?: number;
  barracks?: number;
  forts?: number;
}

// Calculate gold income per hour from buildings (from game-data/buildings)
export function calculateGoldIncome(buildings: BuildingCounts): number {
  const quarryIncome = (buildings.quarries || 0) * 20;  // 20 gold per quarry
  const hovelIncome = (buildings.hovels || 0) * 8;      // 8 gold per hovel
  const guildhallIncome = (buildings.guildhalls || 0) * 50; // 50 gold per guildhall
  
  return quarryIncome + hovelIncome + guildhallIncome;
}

// Calculate population growth per hour from buildings
export function calculatePopulationGrowth(buildings: BuildingCounts): number {
  const hovelGrowth = (buildings.hovels || 0) * 10;  // 10 population per hovel
  
  return hovelGrowth;
}

// Calculate turn generation (from reference: 3 per hour)
export function calculateTurnGeneration(hours: number): number {
  return hours * 3;  // 3 turns per hour (20 minutes each)
}

// Calculate total resource generation for time travel
export function calculateTimeTravel(hours: number, buildings: BuildingCounts) {
  return {
    turns: calculateTurnGeneration(hours),
    gold: calculateGoldIncome(buildings) * hours,
    population: calculatePopulationGrowth(buildings) * hours,
    land: 0  // Land only gained through conquest, not time
  };
}
