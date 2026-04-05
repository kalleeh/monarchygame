import type { KingdomResources } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbUpdate, dbQuery, parseJsonField } from '../data-client';
import { verifyOwnership } from '../verify-ownership';
import { checkRateLimit } from '../rate-limiter';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KingdomType = {
  id: string;
  owner?: string | null;
  resources?: KingdomResources | null;
  stats?: Record<string, unknown> | null;
};

const MIN_LAND_GAINED = 1000;
const MAX_LAND_GAINED = 10000;

type CallerIdentity = { sub: string; username?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleClaim(args: { kingdomId?: string | null; targetId?: string | null }, callerIdentity: CallerIdentity): Promise<any> {
  const { kingdomId, targetId } = args;

  if (!kingdomId || !targetId) {
    return { success: false, error: 'Missing required parameters: kingdomId, targetId', errorCode: ErrorCode.MISSING_PARAMS };
  }

  const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
  if (!kingdom) {
    return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
  }

  // Verify kingdom ownership
  const denied = verifyOwnership(callerIdentity, kingdom.owner ?? null);
  if (denied) return denied;

  // Check restoration status — claiming a new bounty target counts as an attack action
  const restorations = await dbQuery<{ kingdomId: string; endTime: string; prohibitedActions?: string }>('RestorationStatus', 'restorationStatusesByKingdomIdAndEndTime', { field: 'kingdomId', value: kingdomId });
  const activeRestoration = restorations.find(r => new Date(r.endTime) > new Date());
  if (activeRestoration) {
    const prohibited: string[] = parseJsonField<string[]>(activeRestoration.prohibitedActions, []);
    if (prohibited.some(a => ['attack'].includes(a))) {
      return { success: false, error: 'Kingdom is in restoration and cannot perform this action', errorCode: ErrorCode.RESTORATION_BLOCKED };
    }
  }

  const stats = parseJsonField<Record<string, unknown>>(kingdom.stats, {});

  if (stats.activeBountyTargetId) {
    return { success: false, error: 'Bounty already active — complete or abandon the current bounty first', errorCode: ErrorCode.VALIDATION_FAILED };
  }

  const updatedStats = {
    ...stats,
    activeBountyTargetId: targetId,
    activeBountyClaimedAt: new Date().toISOString(),
  };

  await dbUpdate('Kingdom', kingdomId, {
    stats: updatedStats,
  });

  log.info('bounty-processor', 'claimBounty', { kingdomId, targetId });
  return { success: true, result: JSON.stringify({ targetId }) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleComplete(args: { kingdomId?: string | null; targetId?: string | null; landGained?: number | null }, callerIdentity: CallerIdentity): Promise<any> {
  const { kingdomId, targetId, landGained } = args;

  if (!kingdomId || !targetId || landGained == null) {
    return { success: false, error: 'Missing required parameters: kingdomId, targetId, landGained', errorCode: ErrorCode.MISSING_PARAMS };
  }

  if (landGained < MIN_LAND_GAINED) {
    return { success: false, error: `landGained must be at least ${MIN_LAND_GAINED}`, errorCode: ErrorCode.INVALID_PARAM };
  }
  if (landGained > MAX_LAND_GAINED) {
    return { success: false, error: `landGained must be at most ${MAX_LAND_GAINED}`, errorCode: ErrorCode.INVALID_PARAM };
  }

  const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
  if (!kingdom) {
    return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
  }

  // Verify kingdom ownership
  const denied = verifyOwnership(callerIdentity, kingdom.owner ?? null);
  if (denied) return denied;

  const stats = parseJsonField<Record<string, unknown>>(kingdom.stats, {});

  if (stats.activeBountyTargetId !== targetId) {
    return { success: false, error: 'No active bounty matches the provided targetId', errorCode: ErrorCode.VALIDATION_FAILED };
  }

  // Verify landGained against actual BattleReport records since bounty was claimed
  const claimedAt = (stats.activeBountyClaimedAt as string) ?? new Date(0).toISOString();
  const reports = await dbQuery<{ attackerId: string; defenderId: string; landGained?: number; timestamp?: string }>(
    'BattleReport', 'battleReportsByDefenderIdAndTimestamp', { field: 'defenderId', value: targetId }
  );
  const actualLandGained = reports
    .filter(r => r.attackerId === kingdomId && (r.timestamp ?? '') >= claimedAt)
    .reduce((sum, r) => sum + (r.landGained ?? 0), 0);

  if (landGained > actualLandGained) {
    return { success: false, error: `Claimed landGained (${landGained}) exceeds verified total (${actualLandGained})`, errorCode: ErrorCode.VALIDATION_FAILED };
  }

  // Calculate rewards
  const structuresGained = Math.floor(landGained * 0.36);
  const goldReward = Math.floor(landGained * 500);
  const populationReward = structuresGained * 2;

  // Update resources
  const resources = parseJsonField<KingdomResources>(kingdom.resources, {} as KingdomResources);
  const updatedResources: KingdomResources = {
    ...resources,
    gold: (resources.gold ?? 0) + goldReward,
    population: (resources.population ?? 0) + populationReward,
  };

  // Clear bounty claim from stats
  const updatedStats = { ...stats };
  delete updatedStats.activeBountyTargetId;
  delete updatedStats.activeBountyClaimedAt;
  updatedStats.bountyCompletions =
    typeof stats.bountyCompletions === 'number' ? stats.bountyCompletions + 1 : 1;

  await dbUpdate('Kingdom', kingdomId, {
    stats: updatedStats,
    resources: updatedResources,
  });

  log.info('bounty-processor', 'completeBounty', { kingdomId, targetId, landGained });
  return { success: true, result: JSON.stringify({ goldReward, populationReward, structuresGained }) };
}

// Single handler export — dispatch based on which mutation was called
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any) => {
  const fieldName = event.info?.fieldName as string | undefined;

  try {
    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }
    const rateLimited = await checkRateLimit(identity.sub, 'bounty');
    if (rateLimited) return rateLimited;
    const callerIdentity: CallerIdentity = { sub: identity.sub, username: identity.username };

    if (fieldName === 'claimBounty') {
      return await handleClaim(event.arguments, callerIdentity);
    } else if (fieldName === 'completeBounty') {
      return await handleComplete(event.arguments, callerIdentity);
    } else {
      return { success: false, error: `Unknown mutation: ${fieldName}`, errorCode: ErrorCode.INVALID_PARAM };
    }
  } catch (error) {
    log.error('bounty-processor', error, { fieldName });
    return { success: false, error: error instanceof Error ? error.message : 'Bounty operation failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
