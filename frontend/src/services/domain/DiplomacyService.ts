/**
 * Domain service for diplomacy processor calls.
 * Delegates to AmplifyFunctionService for transport.
 */

import { AmplifyFunctionService } from '../amplifyFunctionService';

export interface ProposeTreatyPayload {
  kingdomId: string;
  defenderKingdomId: string;
  seasonId: string;
  treatyType: string;
  terms?: unknown;
}

export interface RespondTreatyPayload {
  kingdomId: string;
  treatyId: string;
  accepted: boolean;
}

export interface DeclareWarPayload {
  kingdomId: string;
  defenderKingdomId: string;
  seasonId: string;
}

export interface MakePeacePayload {
  kingdomId: string;
  defenderKingdomId: string;
}

export interface DiplomacyResult {
  success: boolean;
  treaty?: { id: string; status: string };
  error?: string;
}

export async function proposeTreaty(payload: ProposeTreatyPayload): Promise<DiplomacyResult> {
  return AmplifyFunctionService.callFunction('diplomacy-processor', {
    ...payload,
    action: 'propose',
  }) as Promise<DiplomacyResult>;
}

export async function respondToTreaty(payload: RespondTreatyPayload): Promise<DiplomacyResult> {
  return AmplifyFunctionService.callFunction('diplomacy-processor', {
    ...payload,
    action: 'respond',
  }) as Promise<DiplomacyResult>;
}

export async function declareDiplomaticWar(payload: DeclareWarPayload): Promise<DiplomacyResult> {
  return AmplifyFunctionService.callFunction('diplomacy-processor', {
    ...payload,
    action: 'declare-war',
  }) as Promise<DiplomacyResult>;
}

export async function makeDiplomaticPeace(payload: MakePeacePayload): Promise<DiplomacyResult> {
  return AmplifyFunctionService.callFunction('diplomacy-processor', {
    ...payload,
    action: 'peace',
  }) as Promise<DiplomacyResult>;
}
