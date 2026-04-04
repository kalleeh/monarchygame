import type { Schema } from '../../data/resource';
import { dbGet, dbCreate, dbUpdate, dbQuery } from '../data-client';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { verifyOwnership } from '../verify-ownership';
import { checkRateLimit } from '../rate-limiter';

const TREATY_DURATION_DAYS = 30;

type CallerIdentity = { sub: string; username?: string };

type KingdomType = {
  id: string;
  owner: string;
};

type TreatyType = {
  id: string;
  proposerId: string;
  recipientId: string;
  seasonId: string;
  type: string;
  status: string;
  terms: string;
  proposedAt: string;
  expiresAt: string;
  respondedAt?: string;
  owner?: string;
};

type DiplomaticRelationType = {
  id: string;
  kingdomId: string;
  targetKingdomId: string;
  status: string;
  reputation: number;
  lastActionAt: string;
  owner?: string;
};

type WarDeclarationType = {
  id: string;
  attackerId: string;
  defenderId: string;
  status: string;
  resolvedAt?: string;
};

export const handler: Schema["sendTreatyProposal"]["functionHandler"] = async (event) => {
  const args = event.arguments;

  try {
    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return JSON.stringify({ success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED });
    }
    const rateLimited = await checkRateLimit(identity.sub, 'diplomacy');
    if (rateLimited) return JSON.stringify(rateLimited);
    const callerIdentity: CallerIdentity = { sub: identity.sub, username: identity.username };

    // Route based on arguments
    if ('treatyId' in args && 'accepted' in args) {
      return await handleRespondToTreaty(args as { treatyId: string; accepted: boolean }, callerIdentity);
    }
    if ('kingdomId' in args && 'targetKingdomId' in args && 'seasonId' in args) {
      return await handleDeclareDiplomaticWar(args as { kingdomId: string; targetKingdomId: string; seasonId: string }, callerIdentity);
    }
    if ('kingdomId' in args && 'targetKingdomId' in args && !('seasonId' in args)) {
      return await handleMakePeace(args as { kingdomId: string; targetKingdomId: string }, callerIdentity);
    }

    // sendTreatyProposal
    const { proposerId, recipientId, seasonId, treatyType, terms } = args as {
      proposerId: string;
      recipientId: string;
      seasonId: string;
      treatyType: string;
      terms?: unknown;
    };

    if (!proposerId || !recipientId || !seasonId || !treatyType) {
      return JSON.stringify({ success: false, error: 'Missing required parameters', errorCode: ErrorCode.MISSING_PARAMS });
    }

    if (proposerId === recipientId) {
      return JSON.stringify({ success: false, error: 'Cannot propose treaty to yourself', errorCode: ErrorCode.INVALID_PARAM });
    }

    // Verify kingdom ownership (proposer)
    const proposerKingdom = await dbGet<KingdomType>('Kingdom', proposerId);
    if (!proposerKingdom) {
      return JSON.stringify({ success: false, error: 'Proposer kingdom not found', errorCode: ErrorCode.NOT_FOUND });
    }
    const proposerOwnerField = (proposerKingdom as any).owner as string | null;
    const proposerDenied = verifyOwnership(callerIdentity, proposerOwnerField);
    if (proposerDenied) return JSON.stringify(proposerDenied);

    // Check for conflicting treaties
    const allTreaties = await dbQuery<TreatyType>('Treaty', 'treatiesByProposerId', { field: 'proposerId', value: proposerId });
    const existingTreaties = allTreaties.filter(t =>
      t.recipientId === recipientId &&
      t.status === 'proposed'
    );

    if (existingTreaties && existingTreaties.length > 0) {
      return JSON.stringify({ success: false, error: 'A pending treaty proposal already exists', errorCode: ErrorCode.TREATY_CONFLICT });
    }

    const expiresAt = new Date(Date.now() + TREATY_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const treaty = await dbCreate<TreatyType>('Treaty', {
      id: crypto.randomUUID(),
      proposerId,
      recipientId,
      seasonId,
      type: treatyType as 'non_aggression' | 'trade_agreement' | 'military_alliance' | 'ceasefire',
      status: 'proposed',
      terms: terms ? JSON.stringify(terms) : '{}',
      proposedAt: new Date().toISOString(),
      expiresAt,
      owner: callerIdentity.sub
    });

    log.info('diplomacy-processor', 'sendTreatyProposal', { proposerId, recipientId, treatyType });
    return JSON.stringify({
      success: true,
      treaty: {
        id: treaty.id,
        proposerId,
        recipientId,
        type: treatyType,
        status: 'proposed',
        expiresAt
      }
    });
  } catch (error) {
    log.error('diplomacy-processor', error);
    return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Diplomacy operation failed', errorCode: ErrorCode.INTERNAL_ERROR });
  }
};

async function handleRespondToTreaty(args: { treatyId: string; accepted: boolean }, callerIdentity: CallerIdentity): Promise<string> {
  const { treatyId, accepted } = args;

  const treaty = await dbGet<TreatyType>('Treaty', treatyId);
  if (!treaty) {
    return JSON.stringify({ success: false, error: 'Treaty not found', errorCode: ErrorCode.NOT_FOUND });
  }

  // Verify caller owns the recipient kingdom
  const recipientKingdom = await dbGet<KingdomType>('Kingdom', treaty.recipientId);
  const denied = verifyOwnership(callerIdentity, (recipientKingdom as Record<string, unknown>)?.owner as string | null);
  if (denied) return JSON.stringify(denied);

  if (treaty.status !== 'proposed') {
    return JSON.stringify({ success: false, error: 'Treaty is no longer pending', errorCode: ErrorCode.VALIDATION_FAILED });
  }

  const newStatus = accepted ? 'active' : 'expired';
  await dbUpdate('Treaty', treatyId, {
    status: newStatus,
    respondedAt: new Date().toISOString()
  });

  if (accepted) {
    // Update diplomatic relation
    const allRelations = await dbQuery<DiplomaticRelationType>('DiplomaticRelation', 'diplomaticRelationsByKingdomId', { field: 'kingdomId', value: treaty.proposerId });
    const relations = allRelations.filter(r =>
      r.targetKingdomId === treaty.recipientId
    );

    const newDiplomaticStatus = treaty.type === 'military_alliance' ? 'allied' : 'friendly';

    if (relations && relations.length > 0) {
      await dbUpdate('DiplomaticRelation', relations[0].id, {
        status: newDiplomaticStatus as 'neutral' | 'friendly' | 'allied' | 'hostile' | 'war',
        reputation: (relations[0].reputation ?? 0) + 10,
        lastActionAt: new Date().toISOString()
      });
    } else {
      await dbCreate<DiplomaticRelationType>('DiplomaticRelation', {
        id: crypto.randomUUID(),
        kingdomId: treaty.proposerId,
        targetKingdomId: treaty.recipientId,
        status: newDiplomaticStatus as 'neutral' | 'friendly' | 'allied' | 'hostile' | 'war',
        reputation: 10,
        lastActionAt: new Date().toISOString()
      });
    }
  }

  return JSON.stringify({
    success: true,
    treatyId,
    accepted,
    status: newStatus
  });
}

async function handleDeclareDiplomaticWar(args: { kingdomId: string; targetKingdomId: string; seasonId: string }, callerIdentity: CallerIdentity): Promise<string> {
  const { kingdomId, targetKingdomId, seasonId } = args;

  if (!kingdomId || !targetKingdomId || !seasonId) {
    return JSON.stringify({ success: false, error: 'Missing required parameters', errorCode: ErrorCode.MISSING_PARAMS });
  }

  // Verify kingdom ownership
  const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
  if (!kingdom) {
    return JSON.stringify({ success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND });
  }
  const ownerField = (kingdom as any).owner as string | null;
  const denied = verifyOwnership(callerIdentity, ownerField);
  if (denied) return JSON.stringify(denied);

  // Break any active treaties
  const allTreaties = await dbQuery<TreatyType>('Treaty', 'treatiesByProposerId', { field: 'proposerId', value: kingdomId });
  const treaties = allTreaties.filter(t =>
    t.recipientId === targetKingdomId &&
    t.status === 'active'
  );

  if (treaties) {
    for (const treaty of treaties) {
      await dbUpdate('Treaty', treaty.id, { status: 'broken' });
    }
  }

  // Update diplomatic relation
  const allRelations = await dbQuery<DiplomaticRelationType>('DiplomaticRelation', 'diplomaticRelationsByKingdomId', { field: 'kingdomId', value: kingdomId });
  const relations = allRelations.filter(r =>
    r.targetKingdomId === targetKingdomId
  );

  if (relations && relations.length > 0) {
    await dbUpdate('DiplomaticRelation', relations[0].id, {
      status: 'war',
      reputation: Math.max(-100, (relations[0].reputation ?? 0) - 30),
      lastActionAt: new Date().toISOString()
    });
  } else {
    await dbCreate<DiplomaticRelationType>('DiplomaticRelation', {
      id: crypto.randomUUID(),
      kingdomId,
      targetKingdomId,
      status: 'war',
      reputation: -30,
      lastActionAt: new Date().toISOString(),
      owner: callerIdentity.sub
    });
  }

  return JSON.stringify({ success: true, kingdomId, targetKingdomId, status: 'war' });
}

async function handleMakePeace(args: { kingdomId: string; targetKingdomId: string }, callerIdentity: CallerIdentity): Promise<string> {
  const { kingdomId, targetKingdomId } = args;

  if (!kingdomId || !targetKingdomId) {
    return JSON.stringify({ success: false, error: 'Missing required parameters', errorCode: ErrorCode.MISSING_PARAMS });
  }

  // Verify kingdom ownership
  const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
  if (!kingdom) {
    return JSON.stringify({ success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND });
  }
  const ownerField = (kingdom as any).owner as string | null;
  const denied = verifyOwnership(callerIdentity, ownerField);
  if (denied) return JSON.stringify(denied);

  // Resolve any active wars
  const allWars = await dbQuery<WarDeclarationType>('WarDeclaration', 'warDeclarationsByAttackerIdAndStatus', { field: 'attackerId', value: kingdomId });
  const wars = allWars.filter(w =>
    w.defenderId === targetKingdomId &&
    w.status === 'active'
  );

  if (wars) {
    for (const war of wars) {
      await dbUpdate('WarDeclaration', war.id, {
        status: 'resolved',
        resolvedAt: new Date().toISOString()
      });
    }
  }

  // Update diplomatic relation
  const allRelations = await dbQuery<DiplomaticRelationType>('DiplomaticRelation', 'diplomaticRelationsByKingdomId', { field: 'kingdomId', value: kingdomId });
  const relations = allRelations.filter(r =>
    r.targetKingdomId === targetKingdomId
  );

  if (relations && relations.length > 0) {
    await dbUpdate('DiplomaticRelation', relations[0].id, {
      status: 'neutral',
      reputation: (relations[0].reputation ?? 0) + 5,
      lastActionAt: new Date().toISOString()
    });
  }

  return JSON.stringify({ success: true, kingdomId, targetKingdomId, status: 'neutral' });
}
