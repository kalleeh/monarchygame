import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { configureAmplify } from '../amplify-configure';

configureAmplify();
const client = generateClient<Schema>({ authMode: 'iam' });

export const handler: Schema["declareWar"]["functionHandler"] = async (event) => {
  const args = event.arguments;

  try {
    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return JSON.stringify({ success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED });
    }

    // Route based on which mutation was called
    if ('warId' in args && 'resolution' in args) {
      return await handleResolveWar(args as { warId: string; resolution: string });
    }

    // declareWar
    const { attackerId, defenderId, seasonId, reason } = args as {
      attackerId: string;
      defenderId: string;
      seasonId: string;
      reason?: string;
    };

    if (!attackerId || !defenderId || !seasonId) {
      return JSON.stringify({ success: false, error: 'Missing required parameters', errorCode: ErrorCode.MISSING_PARAMS });
    }

    if (attackerId === defenderId) {
      return JSON.stringify({ success: false, error: 'Cannot declare war on yourself', errorCode: ErrorCode.INVALID_PARAM });
    }

    // Verify kingdom ownership (attacker)
    const { data: attackerKingdom } = await client.models.Kingdom.get({ id: attackerId });
    if (!attackerKingdom) {
      return JSON.stringify({ success: false, error: 'Attacker kingdom not found', errorCode: ErrorCode.NOT_FOUND });
    }
    const attackerOwnerField = (attackerKingdom as any).owner as string | null;
    if (!attackerOwnerField || (!attackerOwnerField.includes(identity.sub) && !attackerOwnerField.includes(identity.username ?? ''))) {
      return JSON.stringify({ success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN });
    }

    // Check for existing active war
    const { data: existingWars } = await client.models.WarDeclaration.list({
      filter: {
        attackerId: { eq: attackerId },
        defenderId: { eq: defenderId },
        seasonId: { eq: seasonId },
        status: { eq: 'active' }
      }
    });

    if (existingWars && existingWars.length > 0) {
      return JSON.stringify({ success: false, error: 'War already declared against this kingdom', errorCode: ErrorCode.VALIDATION_FAILED });
    }

    // Check for treaty conflicts
    const { data: treaties } = await client.models.Treaty.list({
      filter: {
        proposerId: { eq: attackerId },
        recipientId: { eq: defenderId },
        status: { eq: 'active' }
      }
    });

    if (treaties && treaties.length > 0) {
      // Break any active treaties
      for (const treaty of treaties) {
        await client.models.Treaty.update({
          id: treaty.id,
          status: 'broken'
        });
      }
    }

    // Create war declaration
    const warDeclaration = await client.models.WarDeclaration.create({
      attackerId,
      defenderId,
      seasonId,
      status: 'active',
      attackCount: 0,
      declaredAt: new Date().toISOString(),
      reason: reason || 'Formal war declaration'
    });

    // Update diplomatic relation to war
    const { data: relations } = await client.models.DiplomaticRelation.list({
      filter: {
        kingdomId: { eq: attackerId },
        targetKingdomId: { eq: defenderId }
      }
    });

    if (relations && relations.length > 0) {
      await client.models.DiplomaticRelation.update({
        id: relations[0].id,
        status: 'war',
        lastActionAt: new Date().toISOString()
      });
    } else {
      await client.models.DiplomaticRelation.create({
        kingdomId: attackerId,
        targetKingdomId: defenderId,
        status: 'war',
        reputation: -50,
        lastActionAt: new Date().toISOString()
      });
    }

    log.info('war-manager', 'declareWar', { attackerId, defenderId, seasonId });
    return JSON.stringify({
      success: true,
      warDeclaration: {
        id: warDeclaration.data?.id,
        attackerId,
        defenderId,
        status: 'active',
        declaredAt: new Date().toISOString()
      }
    });
  } catch (error) {
    log.error('war-manager', error);
    return JSON.stringify({ success: false, error: 'War operation failed', errorCode: ErrorCode.INTERNAL_ERROR });
  }
};

async function handleResolveWar(args: { warId: string; resolution: string }): Promise<string> {
  const { warId, resolution } = args;

  if (!warId || !resolution) {
    return JSON.stringify({ success: false, error: 'Missing warId or resolution', errorCode: ErrorCode.MISSING_PARAMS });
  }

  const { data: war } = await client.models.WarDeclaration.get({ id: warId });
  if (!war) {
    return JSON.stringify({ success: false, error: 'War declaration not found', errorCode: ErrorCode.NOT_FOUND });
  }

  await client.models.WarDeclaration.update({
    id: warId,
    status: 'resolved',
    resolvedAt: new Date().toISOString()
  });

  // Update diplomatic relation
  const { data: relations } = await client.models.DiplomaticRelation.list({
    filter: {
      kingdomId: { eq: war.attackerId },
      targetKingdomId: { eq: war.defenderId }
    }
  });

  if (relations && relations.length > 0) {
    await client.models.DiplomaticRelation.update({
      id: relations[0].id,
      status: 'neutral',
      lastActionAt: new Date().toISOString()
    });
  }

  return JSON.stringify({
    success: true,
    resolution,
    warId
  });
}
