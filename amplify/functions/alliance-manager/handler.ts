import type { Schema } from '../../data/resource';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbCreate, dbUpdate, dbDelete, dbList } from '../data-client';

type KingdomRecord = { id: string; owner?: string | null; race?: string };
type AllianceRecord = {
  id: string;
  name: string;
  description?: string | null;
  leaderId: string;
  memberIds: string | string[];
  maxMembers?: number;
  isPublic?: boolean;
  treasury?: unknown;
  stats?: unknown;
};
type AllianceInvitationRecord = {
  id: string;
  guildId: string;
  inviterId: string;
  inviteeId: string;
  status: string;
  createdAt?: string;
};

// Race role categories for composition bonus
const MAGE_RACES = ['Sidhe', 'Elven', 'Vampire', 'Elemental', 'Fae'];
const WARRIOR_RACES = ['Droben', 'Goblin', 'Dwarven', 'Centaur', 'Human'];
const SCUM_RACES = ['Centaur', 'Human', 'Vampire', 'Sidhe', 'Goblin'];

interface CompositionBonus {
  income: number;
  combat: number;
  espionage: number;
}

async function calculateCompositionBonus(memberIds: string[]): Promise<CompositionBonus> {
  const kingdoms = await Promise.all(
    memberIds.slice(0, 20).map(id => dbGet<{ race?: string }>('Kingdom', id))
  );
  const races = kingdoms.map(k => k?.race ?? '').filter(Boolean);
  const hasMage = races.some(r => MAGE_RACES.includes(r));
  const hasWarrior = races.some(r => WARRIOR_RACES.includes(r));
  const hasScum = races.some(r => SCUM_RACES.includes(r));
  const fullComposition = hasMage && hasWarrior && hasScum;
  return {
    income: fullComposition ? 1.05 : 1.0,
    combat: fullComposition ? 1.05 : 1.0,
    espionage: fullComposition ? 1.05 : 1.0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyKingdomOwnership(kingdomId: string, identity: any): Promise<{ error?: { success: boolean; error: string; errorCode: string }; data?: KingdomRecord }> {
  const kingdom = await dbGet<KingdomRecord>('Kingdom', kingdomId);
  if (!kingdom) {
    return { error: { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND } };
  }
  const ownerField = kingdom.owner as string | null;
  if (!ownerField || (!ownerField.includes(identity.sub) && !ownerField.includes(identity.username ?? ''))) {
    return { error: { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN } };
  }
  return { data: kingdom };
}

export const handler: Schema["manageAlliance"]["functionHandler"] = async (event) => {
  const { kingdomId, action, allianceId, name, description, isPublic, targetKingdomId } = event.arguments;
  const args = event.arguments as Record<string, unknown>;
  const targetAllianceId = args.targetAllianceId as string | undefined;
  const relationship = args.relationship as string | undefined;

  try {
    if (!kingdomId || !action) {
      return { success: false, error: 'Missing required parameters: kingdomId, action', errorCode: ErrorCode.MISSING_PARAMS };
    }

    // Verify caller identity
    const identity = (event as any).identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }

    switch (action) {
      case 'create': {
        if (!name) {
          return { success: false, error: 'Missing required parameter: name', errorCode: ErrorCode.MISSING_PARAMS };
        }

        // Verify kingdom ownership
        const kingdomCheck = await verifyKingdomOwnership(kingdomId, identity);
        if (kingdomCheck.error) return kingdomCheck.error;

        const newAlliance = await dbCreate<Record<string, unknown>>('Alliance', {
          name,
          description: description ?? undefined,
          leaderId: kingdomId,
          memberIds: JSON.stringify([kingdomId]),
          maxMembers: 20,
          isPublic: isPublic ?? true,
        });

        if (!newAlliance) {
          return { success: false, error: 'Failed to create alliance', errorCode: ErrorCode.INTERNAL_ERROR };
        }

        // Compute and store composition bonus
        const memberIds = [kingdomId];
        const compositionBonus = await calculateCompositionBonus(memberIds);
        await dbUpdate('Alliance', newAlliance.id as string, {
          stats: JSON.stringify({ compositionBonus }),
        });

        log.info('alliance-manager', 'createAlliance', { kingdomId, allianceId: newAlliance.id });
        return { success: true, result: JSON.stringify({ allianceId: newAlliance.id }) };
      }

      case 'join': {
        if (!allianceId) {
          return { success: false, error: 'Missing required parameter: allianceId', errorCode: ErrorCode.MISSING_PARAMS };
        }

        // Verify kingdom ownership
        const kingdomCheck = await verifyKingdomOwnership(kingdomId, identity);
        if (kingdomCheck.error) return kingdomCheck.error;

        // Fetch alliance
        const alliance = await dbGet<AllianceRecord>('Alliance', allianceId);
        if (!alliance) {
          return { success: false, error: 'Alliance not found', errorCode: ErrorCode.NOT_FOUND };
        }

        const memberIds: string[] = typeof alliance.memberIds === 'string'
          ? JSON.parse(alliance.memberIds)
          : (alliance.memberIds as string[] ?? []);

        // Check if already a member
        if (memberIds.includes(kingdomId)) {
          return { success: false, error: 'Already a member of this alliance', errorCode: ErrorCode.INVALID_PARAM };
        }

        // Verify alliance is public or has a pending invitation
        if (!alliance.isPublic) {
          // Check for pending invitation
          const allInvitations = await dbList<AllianceInvitationRecord>('AllianceInvitation');
          const pendingInvite = allInvitations.find(
            inv => inv.guildId === allianceId && inv.inviteeId === kingdomId && inv.status === 'pending'
          );
          if (!pendingInvite) {
            return { success: false, error: 'Alliance is private and you have no pending invitation', errorCode: ErrorCode.FORBIDDEN };
          }
        }

        if (memberIds.length >= (alliance.maxMembers ?? 20)) {
          return { success: false, error: 'Alliance is at maximum capacity', errorCode: ErrorCode.VALIDATION_FAILED };
        }

        memberIds.push(kingdomId);
        await dbUpdate('Alliance', allianceId, { memberIds: JSON.stringify(memberIds) });

        // Mark any pending invitation as accepted
        const allInvitations = await dbList<AllianceInvitationRecord>('AllianceInvitation');
        const pendingInvitation = allInvitations.find(
          inv => inv.guildId === allianceId && inv.inviteeId === kingdomId && inv.status === 'pending'
        );
        if (pendingInvitation) {
          await dbUpdate('AllianceInvitation', pendingInvitation.id, { status: 'accepted' });
        }

        // Recompute and store composition bonus after member joins
        const compositionBonus = await calculateCompositionBonus(memberIds);
        const existingStats = typeof alliance.stats === 'string'
          ? JSON.parse(alliance.stats as string)
          : (alliance.stats ?? {});
        await dbUpdate('Alliance', allianceId, {
          stats: JSON.stringify({ ...existingStats, compositionBonus }),
        });

        log.info('alliance-manager', 'joinAlliance', { kingdomId, allianceId });
        return { success: true, result: JSON.stringify({ allianceId, memberIds }) };
      }

      case 'leave': {
        if (!allianceId) {
          return { success: false, error: 'Missing required parameter: allianceId', errorCode: ErrorCode.MISSING_PARAMS };
        }

        // Verify kingdom ownership
        const kingdomCheck = await verifyKingdomOwnership(kingdomId, identity);
        if (kingdomCheck.error) return kingdomCheck.error;

        // Fetch alliance
        const alliance = await dbGet<AllianceRecord>('Alliance', allianceId);
        if (!alliance) {
          return { success: false, error: 'Alliance not found', errorCode: ErrorCode.NOT_FOUND };
        }

        let memberIds: string[] = typeof alliance.memberIds === 'string'
          ? JSON.parse(alliance.memberIds)
          : (alliance.memberIds as string[] ?? []);

        memberIds = memberIds.filter((id) => id !== kingdomId);

        if (memberIds.length === 0) {
          // Last member — delete the alliance
          await dbDelete('Alliance', allianceId);
          log.info('alliance-manager', 'leaveAlliance', { kingdomId, allianceId, dissolved: true });
          return { success: true, result: JSON.stringify({ allianceId, dissolved: true }) };
        }

        // If the leaving member was the leader, assign a new leader
        let newLeaderId = alliance.leaderId;
        if (alliance.leaderId === kingdomId) {
          newLeaderId = memberIds[0];
        }

        await dbUpdate('Alliance', allianceId, { memberIds: JSON.stringify(memberIds), leaderId: newLeaderId });

        // Recalculate composition bonus after member leaves
        try {
          const compositionBonus = await calculateCompositionBonus(memberIds);
          const currentStats = typeof alliance.stats === 'string'
            ? JSON.parse(alliance.stats as string)
            : (alliance.stats ?? {});
          await dbUpdate('Alliance', allianceId, {
            stats: JSON.stringify({ ...currentStats, compositionBonus })
          });
        } catch { /* non-fatal */ }

        log.info('alliance-manager', 'leaveAlliance', { kingdomId, allianceId });
        return { success: true, result: JSON.stringify({ allianceId, memberIds, newLeaderId }) };
      }

      case 'kick': {
        if (!allianceId || !targetKingdomId) {
          return { success: false, error: 'Missing required parameters: allianceId, targetKingdomId', errorCode: ErrorCode.MISSING_PARAMS };
        }

        // Verify kingdom ownership
        const kingdomCheck = await verifyKingdomOwnership(kingdomId, identity);
        if (kingdomCheck.error) return kingdomCheck.error;

        // Fetch alliance
        const alliance = await dbGet<AllianceRecord>('Alliance', allianceId);
        if (!alliance) {
          return { success: false, error: 'Alliance not found', errorCode: ErrorCode.NOT_FOUND };
        }

        // Verify caller is the leader
        if (alliance.leaderId !== kingdomId) {
          return { success: false, error: 'Only the alliance leader can kick members', errorCode: ErrorCode.FORBIDDEN };
        }

        let memberIds: string[] = typeof alliance.memberIds === 'string'
          ? JSON.parse(alliance.memberIds)
          : (alliance.memberIds as string[] ?? []);

        memberIds = memberIds.filter((id) => id !== targetKingdomId);
        await dbUpdate('Alliance', allianceId, { memberIds: JSON.stringify(memberIds) });

        log.info('alliance-manager', 'kickMember', { kingdomId, allianceId, targetKingdomId });
        return { success: true, result: JSON.stringify({ allianceId, kickedKingdomId: targetKingdomId, memberIds }) };
      }

      case 'invite': {
        if (!allianceId || !targetKingdomId) {
          return { success: false, error: 'Missing required parameters: allianceId, targetKingdomId', errorCode: ErrorCode.MISSING_PARAMS };
        }

        // Verify kingdom ownership
        const kingdomCheck = await verifyKingdomOwnership(kingdomId, identity);
        if (kingdomCheck.error) return kingdomCheck.error;

        // Fetch alliance
        const alliance = await dbGet<AllianceRecord>('Alliance', allianceId);
        if (!alliance) {
          return { success: false, error: 'Alliance not found', errorCode: ErrorCode.NOT_FOUND };
        }

        // Verify caller is the leader
        if (alliance.leaderId !== kingdomId) {
          return { success: false, error: 'Only the alliance leader can invite members', errorCode: ErrorCode.FORBIDDEN };
        }

        const invitation = await dbCreate<Record<string, unknown>>('AllianceInvitation', {
          guildId: allianceId,
          inviterId: kingdomId,
          inviteeId: targetKingdomId,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });

        if (!invitation) {
          return { success: false, error: 'Failed to create invitation', errorCode: ErrorCode.INTERNAL_ERROR };
        }

        log.info('alliance-manager', 'inviteMember', { kingdomId, allianceId, targetKingdomId });
        return { success: true, result: JSON.stringify({ invitationId: invitation.id, allianceId, targetKingdomId }) };
      }

      case 'decline': {
        if (!allianceId) {
          return { success: false, error: 'Missing required parameter: allianceId', errorCode: ErrorCode.MISSING_PARAMS };
        }

        // Verify kingdom ownership
        const kingdomCheck = await verifyKingdomOwnership(kingdomId, identity);
        if (kingdomCheck.error) return kingdomCheck.error;

        // Find and mark the invitation as declined
        const allInvitations = await dbList<AllianceInvitationRecord>('AllianceInvitation');
        const pendingInvitation = allInvitations.find(
          inv => inv.guildId === allianceId && inv.inviteeId === kingdomId && inv.status === 'pending'
        );
        if (pendingInvitation) {
          await dbUpdate('AllianceInvitation', pendingInvitation.id, { status: 'declined' });
        }

        return { success: true, result: JSON.stringify({ action: 'decline', allianceId }) };
      }

      case 'set_relationship': {
        if (!allianceId || !targetAllianceId || !relationship) {
          return { success: false, error: 'Missing allianceId, targetAllianceId, or relationship', errorCode: ErrorCode.MISSING_PARAMS };
        }

        const VALID_RELATIONSHIPS = ['neutral', 'trade_pact', 'non_aggression', 'allied', 'hostile'];
        if (!VALID_RELATIONSHIPS.includes(relationship)) {
          return { success: false, error: `Invalid relationship. Must be: ${VALID_RELATIONSHIPS.join(', ')}`, errorCode: ErrorCode.INVALID_PARAM };
        }

        const alliance = await dbGet<AllianceRecord>('Alliance', allianceId);
        if (!alliance || alliance.leaderId !== kingdomId) {
          return { success: false, error: 'Only leader can set inter-alliance relationships', errorCode: ErrorCode.FORBIDDEN };
        }

        const stats = typeof alliance.stats === 'string'
          ? JSON.parse(alliance.stats as string)
          : (alliance.stats ?? {});
        const relationships = (stats.relationships as Record<string, string>) ?? {};
        relationships[targetAllianceId] = relationship;

        await dbUpdate('Alliance', allianceId, { stats: JSON.stringify({ ...stats, relationships }) });

        log.info('alliance-manager', 'setRelationship', { kingdomId, allianceId, targetAllianceId, relationship });
        return { success: true, result: JSON.stringify({ allianceId, targetAllianceId, relationship }) };
      }

      case 'get_relationship': {
        if (!allianceId || !targetAllianceId) {
          return { success: false, error: 'Missing allianceId or targetAllianceId', errorCode: ErrorCode.MISSING_PARAMS };
        }

        const alliance = await dbGet<AllianceRecord>('Alliance', allianceId);
        if (!alliance) {
          return { success: false, error: 'Alliance not found', errorCode: ErrorCode.NOT_FOUND };
        }

        const stats = typeof alliance.stats === 'string'
          ? JSON.parse(alliance.stats as string)
          : (alliance.stats ?? {});
        const relationships = (stats.relationships as Record<string, string>) ?? {};
        const currentRelationship = relationships[targetAllianceId] ?? 'neutral';

        return { success: true, result: JSON.stringify({ allianceId, targetAllianceId, relationship: currentRelationship }) };
      }

      default:
        return { success: false, error: `Invalid action: ${action}. Must be one of: create, join, leave, kick, invite, decline, set_relationship, get_relationship`, errorCode: ErrorCode.INVALID_PARAM };
    }
  } catch (error) {
    log.error('alliance-manager', error, { kingdomId, action, allianceId });
    return { success: false, error: 'Alliance management operation failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
