/**
 * Domain service for season-manager calls.
 * Delegates to AmplifyFunctionService for transport.
 */

import { AmplifyFunctionService } from '../amplifyFunctionService';

export interface ActiveSeasonResult {
  success: boolean;
  season?: {
    id: string;
    seasonNumber: number;
    status: string;
    startDate: string;
    currentAge: 'early' | 'middle' | 'late';
    weeksRemaining?: number;
  };
  error?: string;
}

export async function getActiveSeason(kingdomId: string): Promise<ActiveSeasonResult> {
  return AmplifyFunctionService.callFunction('season-manager', {
    kingdomId,
    action: 'getActiveSeason',
  }) as Promise<ActiveSeasonResult>;
}

export async function startSeason(kingdomId: string): Promise<ActiveSeasonResult> {
  return AmplifyFunctionService.callFunction('season-lifecycle', {
    kingdomId,
    action: 'create',
  }) as Promise<ActiveSeasonResult>;
}
