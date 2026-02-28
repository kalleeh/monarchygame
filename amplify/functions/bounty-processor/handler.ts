import type { KingdomResources } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbUpdate } from '../data-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KingdomType = {
  id: string;
  owner?: string | null;
  resources?: KingdomResources | null;
  stats?: Record<string, unknown> | null;
};

const MIN_LAND_GAINED = 1000;

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
  const ownerField = kingdom.owner ?? null;
  if (!ownerField || (!ownerField.includes(callerIdentity.sub) && !ownerField.includes(callerIdentity.username ?? ''))) {
    return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
  }

  const stats = (kingdom.stats ?? {}) as Record<string, unknown>;

  if (stats.activeBountyTargetId) {
    return { success: false, error: 'Bounty already active — complete or abandon the current bounty first', errorCode: ErrorCode.VALIDATION_FAILED };
  }

  const updatedStats = {
    ...stats,
    activeBountyTargetId: targetId,
    activeBountyClaimedAt: Date.now(),
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

  const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
  if (!kingdom) {
    return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
  }

  // Verify kingdom ownership
  const ownerField = kingdom.owner ?? null;
  if (!ownerField || (!ownerField.includes(callerIdentity.sub) && !ownerField.includes(callerIdentity.username ?? ''))) {
    return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
  }

  const stats = (kingdom.stats ?? {}) as Record<string, unknown>;

  if (stats.activeBountyTargetId !== targetId) {
    return { success: false, error: 'No active bounty matches the provided targetId', errorCode: ErrorCode.VALIDATION_FAILED };
  }

  // Calculate rewards
  const structuresGained = Math.floor(landGained * 0.36);
  const goldReward = Math.floor(landGained * 500);
  const populationReward = structuresGained * 2;

  // Update resources
  const resources = (kingdom.resources ?? {}) as KingdomResources;
  const updatedResources: KingdomResources = {
    ...resources,
    gold: (resources.gold ?? 0) + goldReward,
    population: (resources.population ?? 0) + populationReward,
  };

  // Clear bounty claim from stats
  const updatedStats = { ...stats };
  delete updatedStats.activeBountyTargetId;
  delete updatedStats.activeBountyClaimedAt;

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
    return { success: false, error: 'Bounty operation failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
