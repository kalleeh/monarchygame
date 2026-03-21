/**
 * Domain service for season-manager calls.
 * Delegates to AmplifyFunctionService for transport.
 */

import { AmplifyFunctionService } from '../amplifyFunctionService';
import { isDemoMode } from '../../utils/authMode';

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

// Demo mode mock: Season 1 in early age, avoids Amplify calls when unconfigured
const DEMO_SEASON: ActiveSeasonResult = {
  success: true,
  season: {
    id: 'demo-season-1',
    seasonNumber: 1,
    status: 'active',
    startDate: new Date().toISOString(),
    currentAge: 'early',
    weeksRemaining: 8,
  },
};

export async function getActiveSeason(kingdomId: string): Promise<ActiveSeasonResult> {
  if (isDemoMode()) return DEMO_SEASON;
  return AmplifyFunctionService.callFunction('season-manager', {
    kingdomId,
    action: 'getActiveSeason',
  }) as Promise<ActiveSeasonResult>;
}

export async function startSeason(kingdomId: string): Promise<ActiveSeasonResult> {
  if (isDemoMode()) return DEMO_SEASON;
  return AmplifyFunctionService.callFunction('season-lifecycle', {
    kingdomId,
    action: 'create',
  }) as Promise<ActiveSeasonResult>;
}
