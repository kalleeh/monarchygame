import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { configureAmplify } from '../amplify-configure';

configureAmplify();
const client = generateClient<Schema>({ authMode: 'iam' });

const TREATY_DURATION_DAYS = 30;

type CallerIdentity = { sub: string; username?: string };

export const handler: Schema["sendTreatyProposal"]["functionHandler"] = async (event) => {
  const args = event.arguments;

  try {
    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return JSON.stringify({ success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED });
    }
    const callerIdentity: CallerIdentity = { sub: identity.sub, username: identity.username };

    // Route based on arguments
    if ('treatyId' in args && 'accepted' in args) {
      return await handleRespondToTreaty(args as { treatyId: string; accepted: boolean });
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
    const { data: proposerKingdom } = await client.models.Kingdom.get({ id: proposerId });
    if (!proposerKingdom) {
      return JSON.stringify({ success: false, error: 'Proposer kingdom not found', errorCode: ErrorCode.NOT_FOUND });
    }
    const proposerOwnerField = (proposerKingdom as any).owner as string | null;
    if (!proposerOwnerField || (!proposerOwnerField.includes(callerIdentity.sub) && !proposerOwnerField.includes(callerIdentity.username ?? ''))) {
      return JSON.stringify({ success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN });
    }

    // Check for conflicting treaties
    const { data: existingTreaties } = await client.models.Treaty.list({
      filter: {
        proposerId: { eq: proposerId },
        recipientId: { eq: recipientId },
        status: { eq: 'proposed' }
      }
    });

    if (existingTreaties && existingTreaties.length > 0) {
      return JSON.stringify({ success: false, error: 'A pending treaty proposal already exists', errorCode: ErrorCode.TREATY_CONFLICT });
    }

    const expiresAt = new Date(Date.now() + TREATY_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const treaty = await client.models.Treaty.create({
      proposerId,
      recipientId,
      seasonId,
      type: treatyType as 'non_aggression' | 'trade_agreement' | 'military_alliance' | 'ceasefire',
      status: 'proposed',
      terms: terms ? JSON.stringify(terms) : '{}',
      proposedAt: new Date().toISOString(),
      expiresAt
    });

    log.info('diplomacy-processor', 'sendTreatyProposal', { proposerId, recipientId, treatyType });
    return JSON.stringify({
      success: true,
      treaty: {
        id: treaty.data?.id,
        proposerId,
        recipientId,
        type: treatyType,
        status: 'proposed',
        expiresAt
      }
    });
  } catch (error) {
    log.error('diplomacy-processor', error);
    return JSON.stringify({ success: false, error: 'Diplomacy operation failed', errorCode: ErrorCode.INTERNAL_ERROR });
  }
};

async function handleRespondToTreaty(args: { treatyId: string; accepted: boolean }): Promise<string> {
  const { treatyId, accepted } = args;

  const { data: treaty } = await client.models.Treaty.get({ id: treatyId });
  if (!treaty) {
    return JSON.stringify({ success: false, error: 'Treaty not found', errorCode: ErrorCode.NOT_FOUND });
  }

  if (treaty.status !== 'proposed') {
    return JSON.stringify({ success: false, error: 'Treaty is no longer pending', errorCode: ErrorCode.VALIDATION_FAILED });
  }

  const newStatus = accepted ? 'active' : 'expired';
  await client.models.Treaty.update({
    id: treatyId,
    status: newStatus,
    respondedAt: new Date().toISOString()
  });

  if (accepted) {
    // Update diplomatic relation
    const { data: relations } = await client.models.DiplomaticRelation.list({
      filter: {
        kingdomId: { eq: treaty.proposerId },
        targetKingdomId: { eq: treaty.recipientId }
      }
    });

    const newDiplomaticStatus = treaty.type === 'military_alliance' ? 'allied' : 'friendly';

    if (relations && relations.length > 0) {
      await client.models.DiplomaticRelation.update({
        id: relations[0].id,
        status: newDiplomaticStatus as 'neutral' | 'friendly' | 'allied' | 'hostile' | 'war',
        reputation: (relations[0].reputation ?? 0) + 10,
        lastActionAt: new Date().toISOString()
      });
    } else {
      await client.models.DiplomaticRelation.create({
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
  const { data: kingdom } = await client.models.Kingdom.get({ id: kingdomId });
  if (!kingdom) {
    return JSON.stringify({ success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND });
  }
  const ownerField = (kingdom as any).owner as string | null;
  if (!ownerField || (!ownerField.includes(callerIdentity.sub) && !ownerField.includes(callerIdentity.username ?? ''))) {
    return JSON.stringify({ success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN });
  }

  // Break any active treaties
  const { data: treaties } = await client.models.Treaty.list({
    filter: {
      proposerId: { eq: kingdomId },
      recipientId: { eq: targetKingdomId },
      status: { eq: 'active' }
    }
  });

  if (treaties) {
    for (const treaty of treaties) {
      await client.models.Treaty.update({ id: treaty.id, status: 'broken' });
    }
  }

  // Update diplomatic relation
  const { data: relations } = await client.models.DiplomaticRelation.list({
    filter: {
      kingdomId: { eq: kingdomId },
      targetKingdomId: { eq: targetKingdomId }
    }
  });

  if (relations && relations.length > 0) {
    await client.models.DiplomaticRelation.update({
      id: relations[0].id,
      status: 'war',
      reputation: Math.max(-100, (relations[0].reputation ?? 0) - 30),
      lastActionAt: new Date().toISOString()
    });
  } else {
    await client.models.DiplomaticRelation.create({
      kingdomId,
      targetKingdomId,
      status: 'war',
      reputation: -30,
      lastActionAt: new Date().toISOString()
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
  const { data: kingdom } = await client.models.Kingdom.get({ id: kingdomId });
  if (!kingdom) {
    return JSON.stringify({ success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND });
  }
  const ownerField = (kingdom as any).owner as string | null;
  if (!ownerField || (!ownerField.includes(callerIdentity.sub) && !ownerField.includes(callerIdentity.username ?? ''))) {
    return JSON.stringify({ success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN });
  }

  // Resolve any active wars
  const { data: wars } = await client.models.WarDeclaration.list({
    filter: {
      attackerId: { eq: kingdomId },
      defenderId: { eq: targetKingdomId },
      status: { eq: 'active' }
    }
  });

  if (wars) {
    for (const war of wars) {
      await client.models.WarDeclaration.update({
        id: war.id,
        status: 'resolved',
        resolvedAt: new Date().toISOString()
      });
    }
  }

  // Update diplomatic relation
  const { data: relations } = await client.models.DiplomaticRelation.list({
    filter: {
      kingdomId: { eq: kingdomId },
      targetKingdomId: { eq: targetKingdomId }
    }
  });

  if (relations && relations.length > 0) {
    await client.models.DiplomaticRelation.update({
      id: relations[0].id,
      status: 'neutral',
      reputation: (relations[0].reputation ?? 0) + 5,
      lastActionAt: new Date().toISOString()
    });
  }

  return JSON.stringify({ success: true, kingdomId, targetKingdomId, status: 'neutral' });
}
