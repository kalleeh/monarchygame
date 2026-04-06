import type { Schema } from '../../data/resource';
import { dbGet, dbCreate, dbUpdate, dbQuery } from '../data-client';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { verifyOwnership } from '../verify-ownership';
import { checkRateLimit } from '../rate-limiter';

type KingdomType = {
  id: string;
  owner: string;
};

type WarDeclarationType = {
  id: string;
  attackerId: string;
  defenderId: string;
  seasonId?: string;
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
  owner?: string;
};

export const handler: Schema["declareWar"]["functionHandler"] = async (event) => {
  const args = event.arguments;

  try {
    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return JSON.stringify({ success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED });
    }
    const rateLimited = await checkRateLimit(identity.sub, 'diplomacy');
    if (rateLimited) return JSON.stringify(rateLimited);

    // Route based on which mutation was called
    if ('warId' in args && 'resolution' in args) {
      return await handleResolveWar(args as { warId: string; resolution: string }, identity);
    }

    // declareWar
    const { attackerId, defenderId, seasonId, reason } = args as {
      attackerId: string;
      defenderId: string;
      seasonId?: string;
      reason?: string;
    };

    if (!attackerId || !defenderId) {
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
    const denied = verifyOwnership(identity, attackerOwnerField);
    if (denied) return JSON.stringify(denied);

    // Verify defender exists
    const defenderKingdom = await dbGet('Kingdom', defenderId);
    if (!defenderKingdom) {
      return JSON.stringify({ success: false, error: 'Target kingdom does not exist', errorCode: 'NOT_FOUND' });
    }

    // Check for existing active war
    const attackerWars = await dbQuery<WarDeclarationType>(
      'WarDeclaration', 'warDeclarationsByAttackerIdAndStatus', { field: 'attackerId', value: attackerId }
    );
    const existingWars = attackerWars.filter(w =>
      w.defenderId === defenderId &&
      (!seasonId || w.seasonId === seasonId) &&
      w.status === 'active'
    );

    if (existingWars && existingWars.length > 0) {
      return JSON.stringify({ success: false, error: 'War already declared against this kingdom', errorCode: ErrorCode.VALIDATION_FAILED });
    }

    // Check for treaty conflicts
    const allTreaties = await dbQuery<TreatyType>('Treaty', 'treatiesByProposerId', { field: 'proposerId', value: attackerId });
    const treaties = allTreaties.filter(t =>
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
      reason: (reason || 'Formal war declaration').slice(0, 500)
    });

    // Notify the defender that war has been declared against them
    await dbCreate('CombatNotification', {
      recipientId: defenderId,
      type: 'defense',
      message: `War has been declared against your kingdom by ${attackerId}!`,
      data: JSON.stringify({ warId: warDeclaration.id, attackerId, seasonId }),
      isRead: false,
      createdAt: new Date().toISOString(),
      owner: identity.sub,
    });

    // Update diplomatic relation to war
    const allRelations = await dbQuery<DiplomaticRelationType>('DiplomaticRelation', 'diplomaticRelationsByKingdomId', { field: 'kingdomId', value: attackerId });
    const relations = allRelations.filter(r =>
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
        lastActionAt: new Date().toISOString(),
        owner: identity.sub
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
    return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'War operation failed', errorCode: ErrorCode.INTERNAL_ERROR });
  }
};

async function handleResolveWar(args: { warId: string; resolution: string }, identity: { sub?: string; username?: string }): Promise<string> {
  const { warId, resolution } = args;

  if (!warId || !resolution) {
    return JSON.stringify({ success: false, error: 'Missing warId or resolution', errorCode: ErrorCode.MISSING_PARAMS });
  }

  const war = await dbGet<WarDeclarationType>('WarDeclaration', warId);
  if (!war) {
    return JSON.stringify({ success: false, error: 'War declaration not found', errorCode: ErrorCode.NOT_FOUND });
  }

  // Verify caller is a party to this war (attacker or defender)
  const [attackerKingdom, defenderKingdom] = await Promise.all([
    dbGet<{ owner?: string | null }>('Kingdom', war.attackerId as string),
    dbGet<{ owner?: string | null }>('Kingdom', war.defenderId as string),
  ]);
  const isAttacker = !verifyOwnership(identity, attackerKingdom?.owner ?? null);
  const isDefender = !verifyOwnership(identity, defenderKingdom?.owner ?? null);
  if (!isAttacker && !isDefender) {
    return JSON.stringify({ success: false, error: 'You are not a party to this war', errorCode: ErrorCode.FORBIDDEN });
  }

  await dbUpdate('WarDeclaration', warId, {
    status: 'resolved',
    resolvedAt: new Date().toISOString()
  });

  // Update diplomatic relation
  const allRelations = await dbQuery<DiplomaticRelationType>('DiplomaticRelation', 'diplomaticRelationsByKingdomId', { field: 'kingdomId', value: war.attackerId });
  const relations = allRelations.filter(r =>
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
