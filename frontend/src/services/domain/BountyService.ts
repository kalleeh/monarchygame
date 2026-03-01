/**
 * Domain service for bounty processor calls.
 * Delegates to AmplifyFunctionService for transport.
 */

import { AmplifyFunctionService } from '../amplifyFunctionService';

export interface ClaimBountyPayload {
  kingdomId: string;
  targetId: string;
}

export interface CompleteBountyPayload {
  kingdomId: string;
  targetId: string;
  landGained: number;
}

export interface BountyResult {
  success: boolean;
  result?: string;
  error?: string;
}

export async function claimBounty(payload: ClaimBountyPayload): Promise<BountyResult> {
  return AmplifyFunctionService.callFunction('bounty-processor', {
    kingdomId: payload.kingdomId,
    action: 'claim',
    targetId: payload.targetId,
  }) as Promise<BountyResult>;
}

export async function completeBounty(payload: CompleteBountyPayload): Promise<BountyResult> {
  return AmplifyFunctionService.callFunction('bounty-processor', {
    kingdomId: payload.kingdomId,
    action: 'complete',
    targetId: payload.targetId,
    amount: payload.landGained,
  }) as Promise<BountyResult>;
}
