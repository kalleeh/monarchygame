import type { Schema } from '../../data/resource';
import { dbList, dbGet, dbCreate, dbUpdate } from '../data-client';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';

type KingdomType = {
  id: string;
  owner: string;
};

type WarDeclarationType = {
  id: string;
  attackerId: string;
  defenderId: string;
  seasonId: string;
  status: string;
  attackCount: number;
  declaredAt: string;
  reason: string;
  resolvedAt?: string;
};

type TreatyType = {
  id: string;
  proposerId: string;
  recipientId: string;
  status: string;
};

type DiplomaticRelationType = {
  id: string;
  kingdomId: string;
  targetKingdomId: string;
  status: string;
  reputation: number;
  lastActionAt: string;
};

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
    const attackerKingdom = await dbGet<KingdomType>('Kingdom', attackerId);
    if (!attackerKingdom) {
      return JSON.stringify({ success: false, error: 'Attacker kingdom not found', errorCode: ErrorCode.NOT_FOUND });
    }
    const attackerOwnerField = (attackerKingdom as any).owner as string | null;
    if (!attackerOwnerField || (!attackerOwnerField.includes(identity.sub) && !attackerOwnerField.includes(identity.username ?? ''))) {
      return JSON.stringify({ success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN });
    }

    // Check for existing active war
    const allWars = await dbList<WarDeclarationType>('WarDeclaration');
    const existingWars = allWars.filter(w =>
      w.attackerId === attackerId &&
      w.defenderId === defenderId &&
      w.seasonId === seasonId &&
      w.status === 'active'
    );

    if (existingWars && existingWars.length > 0) {
      return JSON.stringify({ success: false, error: 'War already declared against this kingdom', errorCode: ErrorCode.VALIDATION_FAILED });
    }

    // Check for treaty conflicts
    const allTreaties = await dbList<TreatyType>('Treaty');
    const treaties = allTreaties.filter(t =>
      t.proposerId === attackerId &&
      t.recipientId === defenderId &&
      t.status === 'active'
    );

    if (treaties && treaties.length > 0) {
      // Break any active treaties
      for (const treaty of treaties) {
        await dbUpdate('Treaty', treaty.id, { status: 'broken' });
      }
    }

    // Create war declaration
    const warDeclaration = await dbCreate<WarDeclarationType>('WarDeclaration', {
      id: crypto.randomUUID(),
      attackerId,
      defenderId,
      seasonId,
      status: 'active',
      attackCount: 0,
      declaredAt: new Date().toISOString(),
      reason: reason || 'Formal war declaration'
    });

    // Notify the defender that war has been declared against them
    await dbCreate('CombatNotification', {
      recipientId: defenderId,
      type: 'defense',
      message: `War has been declared against your kingdom by ${attackerId}!`,
      data: JSON.stringify({ warId: warDeclaration.id, attackerId, seasonId }),
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    // Update diplomatic relation to war
    const allRelations = await dbList<DiplomaticRelationType>('DiplomaticRelation');
    const relations = allRelations.filter(r =>
      r.kingdomId === attackerId &&
      r.targetKingdomId === defenderId
    );

    if (relations && relations.length > 0) {
      await dbUpdate('DiplomaticRelation', relations[0].id, {
        status: 'war',
        lastActionAt: new Date().toISOString()
      });
    } else {
      await dbCreate<DiplomaticRelationType>('DiplomaticRelation', {
        id: crypto.randomUUID(),
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
        id: warDeclaration.id,
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

  const war = await dbGet<WarDeclarationType>('WarDeclaration', warId);
  if (!war) {
    return JSON.stringify({ success: false, error: 'War declaration not found', errorCode: ErrorCode.NOT_FOUND });
  }

  await dbUpdate('WarDeclaration', warId, {
    status: 'resolved',
    resolvedAt: new Date().toISOString()
  });

  // Update diplomatic relation
  const allRelations = await dbList<DiplomaticRelationType>('DiplomaticRelation');
  const relations = allRelations.filter(r =>
    r.kingdomId === war.attackerId &&
    r.targetKingdomId === war.defenderId
  );

  if (relations && relations.length > 0) {
    await dbUpdate('DiplomaticRelation', relations[0].id, {
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
