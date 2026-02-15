/**
 * Building mechanics for Monarchy Game
 * Re-exports authoritative implementations from shared mechanics
 */

export { calculateBRT, getBuildingName, RACE_BUILDING_NAMES } from '../../../shared/mechanics/building-mechanics';

export interface BuildingMechanics {
  calculateBRT: (quarryPercentage: number) => number;
  getBuildingName: (race: string, buildingType: string) => string;
}
