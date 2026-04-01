/**
 * Domain service for territory claiming calls.
 * Delegates to AmplifyFunctionService for transport.
 */

import { AmplifyFunctionService } from '../amplifyFunctionService';

export interface ClaimTerritoryPayload {
  kingdomId: string;
  name: string;
  terrainType: string;
  coordinates: { x: number; y: number };
  territoryAmount?: number;
  goldCost?: number;
  regionId?: string;
  category?: string;
}

export interface TerritoryResult {
  success: boolean;
  territoryId?: string;
  kingdomId?: string;
  name?: string;
  terrainType?: string;
  error?: string;
}

export async function claimTerritory(payload: ClaimTerritoryPayload): Promise<TerritoryResult> {
  return AmplifyFunctionService.claimTerritory(payload) as Promise<TerritoryResult>;
}

export interface UpgradeTerritoryResult {
  success: boolean;
  defenseLevel?: number;
  error?: string;
}

export async function upgradeTerritory(
  kingdomId: string,
  territoryId: string,
  newDefenseLevel: number,
  goldCost: number
): Promise<UpgradeTerritoryResult> {
  return AmplifyFunctionService.upgradeTerritory(kingdomId, territoryId, newDefenseLevel, goldCost) as Promise<UpgradeTerritoryResult>;
}
