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
