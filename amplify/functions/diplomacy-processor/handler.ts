import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import { ErrorCode } from '../../../shared/types/kingdom';

const client = generateClient<Schema>();

const TREATY_DURATION_DAYS = 30;

export const handler: Schema["sendTreatyProposal"]["functionHandler"] = async (event) => {
  const args = event.arguments;

  try {
    // Route based on arguments
    if ('treatyId' in args && 'accepted' in args) {
      return await handleRespondToTreaty(args as { treatyId: string; accepted: boolean });
    }
    if ('kingdomId' in args && 'targetKingdomId' in args && 'seasonId' in args) {
      return await handleDeclareDiplomaticWar(args as { kingdomId: string; targetKingdomId: string; seasonId: string });
    }
    if ('kingdomId' in args && 'targetKingdomId' in args && !('seasonId' in args)) {
      return await handleMakePeace(args as { kingdomId: string; targetKingdomId: string });
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Diplomacy processor error:', message);
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

async function handleDeclareDiplomaticWar(args: { kingdomId: string; targetKingdomId: string; seasonId: string }): Promise<string> {
  const { kingdomId, targetKingdomId, seasonId } = args;

  if (!kingdomId || !targetKingdomId || !seasonId) {
    return JSON.stringify({ success: false, error: 'Missing required parameters', errorCode: ErrorCode.MISSING_PARAMS });
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

async function handleMakePeace(args: { kingdomId: string; targetKingdomId: string }): Promise<string> {
  const { kingdomId, targetKingdomId } = args;

  if (!kingdomId || !targetKingdomId) {
    return JSON.stringify({ success: false, error: 'Missing required parameters', errorCode: ErrorCode.MISSING_PARAMS });
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
