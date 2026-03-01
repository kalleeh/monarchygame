/**
 * Domain service for faith processor calls.
 * Delegates to AmplifyFunctionService for transport.
 */

import { AmplifyFunctionService } from '../amplifyFunctionService';

export interface UpdateFaithPayload {
  kingdomId: string;
  action: string;
  alignment?: string;
  abilityType?: string;
}

export interface FaithResult {
  success: boolean;
  result?: string;
  error?: string;
}

export async function updateFaith(payload: UpdateFaithPayload): Promise<FaithResult> {
  return AmplifyFunctionService.callFunction('faith-processor', payload) as Promise<FaithResult>;
}
