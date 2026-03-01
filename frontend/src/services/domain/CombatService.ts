/**
 * Domain service for combat processor calls.
 * Delegates to AmplifyFunctionService for transport.
 */

import { AmplifyFunctionService } from '../amplifyFunctionService';

export interface CombatPayload {
  kingdomId: string;
  attackerKingdomId: string;
  defenderKingdomId: string;
  attackType: string;
  units: Record<string, number>;
  formationId?: string;
  terrainId?: string;
}

export interface CombatResult {
  success: boolean;
  result?: string;
  casualties?: { attacker: Record<string, number>; defender: Record<string, number> };
  landGained?: number;
  goldLooted?: number;
  error?: string;
}

export interface WarDeclarePayload {
  kingdomId: string;
  attackerId?: string;
  defenderKingdomId: string;
  seasonId?: string;
  reason?: string;
  action?: string;
}

export async function processCombat(payload: CombatPayload): Promise<CombatResult> {
  return AmplifyFunctionService.callFunction('combat-processor', payload) as Promise<CombatResult>;
}

export async function declareWar(payload: WarDeclarePayload): Promise<unknown> {
  return AmplifyFunctionService.callFunction('war-manager', payload);
}

export async function refreshKingdomResources(kingdomId: string): Promise<void> {
  return AmplifyFunctionService.refreshKingdomResources(kingdomId);
}
