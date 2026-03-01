/**
 * Domain service for thievery processor calls.
 * Delegates to AmplifyFunctionService for transport.
 */

import { AmplifyFunctionService } from '../amplifyFunctionService';

export interface ThieveryPayload {
  kingdomId: string;
  action: string;
  targetId: string;
}

export interface ThieveryResult {
  success: boolean;
  result?: string;
  error?: string;
}

export async function executeThievery(payload: ThieveryPayload): Promise<ThieveryResult> {
  return AmplifyFunctionService.callFunction('thievery-processor', {
    kingdomId: payload.kingdomId,
    action: payload.action,
    targetId: payload.targetId,
  }) as Promise<ThieveryResult>;
}
