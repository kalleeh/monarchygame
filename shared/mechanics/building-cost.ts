import type { KingdomBuildings } from '../types/kingdom-resources';
import { calculateBRT } from './building-mechanics';

export const BUILD_COST_BASE = 300;          // gold/acre floor
export const BUILD_COST_LAND_COEFF = 0.017;  // +gold/acre per acre owned (~308@500, ~319@1100, ~325@1500)

export function buildingGoldCostPerAcre(totalLand: number): number {
  return Math.round(BUILD_COST_BASE + BUILD_COST_LAND_COEFF * Math.max(0, totalLand));
}
export function buildingGoldCost(quantity: number, totalLand: number): number {
  return Math.max(0, quantity) * buildingGoldCostPerAcre(totalLand);
}
export function kingdomBRT(buildings: KingdomBuildings, land: number): number {
  const quarries = buildings.mine ?? 0;
  const pct = land > 0 ? (quarries / land) * 100 : 0;
  return calculateBRT(pct);
}
