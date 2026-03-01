/**
 * Domain service for unit training calls.
 * Delegates to AmplifyFunctionService for transport.
 */

import { AmplifyFunctionService } from '../amplifyFunctionService';

export interface TrainUnitsPayload {
  kingdomId: string;
  unitType: string;
  quantity: number;
  goldCost?: number;
}

export interface TrainUnitsResult {
  success: boolean;
  units?: string;
  error?: string;
}

export async function trainUnits(payload: TrainUnitsPayload): Promise<TrainUnitsResult> {
  return AmplifyFunctionService.callFunction('unit-trainer', payload) as Promise<TrainUnitsResult>;
}

export async function refreshKingdomResources(kingdomId: string): Promise<void> {
  return AmplifyFunctionService.refreshKingdomResources(kingdomId);
}
