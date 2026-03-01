import type { Schema } from '../../data/resource';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbCreate, dbUpdate, dbDelete, dbList } from '../data-client';

type KingdomRecord = { id: string; owner?: string | null };
type AllianceRecord = {
  id: string;
  name: string;
  description?: string | null;
  leaderId: string;
  memberIds: string | string[];
  maxMembers?: number;
  isPublic?: boolean;
  treasury?: unknown;
};
type AllianceInvitationRecord = {
  id: string;
  guildId: string;
  inviterId: string;
  inviteeId: string;
  status: string;
  createdAt?: string;
};

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

      default:
        return { success: false, error: `Invalid action: ${action}. Must be one of: create, join, leave, kick, invite, decline`, errorCode: ErrorCode.INVALID_PARAM };
    }
  } catch (error) {
    log.error('alliance-manager', error, { kingdomId, action, allianceId });
    return { success: false, error: 'Alliance management operation failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
