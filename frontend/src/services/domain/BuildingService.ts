/**
 * Domain service for building construction calls.
 * Delegates to AmplifyFunctionService for transport.
 */

import { AmplifyFunctionService } from '../amplifyFunctionService';

export interface ConstructBuildingsPayload {
  kingdomId: string;
  buildingType: string;
  quantity: number;
  goldCost?: number;
  territoryId?: string;
}

export interface ConstructBuildingsResult {
  success: boolean;
  buildings?: string;
  error?: string;
}

export async function constructBuildings(payload: ConstructBuildingsPayload): Promise<ConstructBuildingsResult> {
  return AmplifyFunctionService.callFunction('building-constructor', payload) as Promise<ConstructBuildingsResult>;
}
