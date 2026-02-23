import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';

const client = generateClient<Schema>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyKingdomOwnership(kingdomId: string, identity: any): Promise<{ error?: { success: boolean; error: string; errorCode: string }; data?: any }> {
  const result = await client.models.Kingdom.get({ id: kingdomId });
  if (!result.data) {
    return { error: { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND } };
  }
  const ownerField = (result.data as any).owner as string | null;
  if (!ownerField || (!ownerField.includes(identity.sub) && !ownerField.includes(identity.username ?? ''))) {
    return { error: { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN } };
  }
  return { data: result.data };
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

        const newAlliance = await client.models.Alliance.create({
          name,
          description: description ?? undefined,
          leaderId: kingdomId,
          memberIds: JSON.stringify([kingdomId]),
          maxMembers: 20,
          isPublic: isPublic ?? true,
        });

        if (!newAlliance.data) {
          return { success: false, error: 'Failed to create alliance', errorCode: ErrorCode.INTERNAL_ERROR };
        }

        log.info('alliance-manager', 'createAlliance', { kingdomId, allianceId: newAlliance.data.id });
        return { success: true, result: JSON.stringify({ allianceId: newAlliance.data.id }) };
      }

      case 'join': {
        if (!allianceId) {
          return { success: false, error: 'Missing required parameter: allianceId', errorCode: ErrorCode.MISSING_PARAMS };
        }

        // Verify kingdom ownership
        const kingdomCheck = await verifyKingdomOwnership(kingdomId, identity);
        if (kingdomCheck.error) return kingdomCheck.error;

        // Fetch alliance
        const allianceResult = await client.models.Alliance.get({ id: allianceId });
        if (!allianceResult.data) {
          return { success: false, error: 'Alliance not found', errorCode: ErrorCode.NOT_FOUND };
        }

        const alliance = allianceResult.data;
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
          const invitations = await client.models.AllianceInvitation.list({
            filter: {
              guildId: { eq: allianceId },
              inviteeId: { eq: kingdomId },
              status: { eq: 'pending' },
            },
          });
          if (!invitations.data || invitations.data.length === 0) {
            return { success: false, error: 'Alliance is private and you have no pending invitation', errorCode: ErrorCode.FORBIDDEN };
          }
        }

        memberIds.push(kingdomId);
        await client.models.Alliance.update({ id: allianceId, memberIds: JSON.stringify(memberIds) });

        // Mark any pending invitation as accepted
        const pendingInvitations = await client.models.AllianceInvitation.list({
          filter: {
            guildId: { eq: allianceId },
            inviteeId: { eq: kingdomId },
            status: { eq: 'pending' },
          },
        });
        if (pendingInvitations.data && pendingInvitations.data.length > 0) {
          await client.models.AllianceInvitation.update({ id: pendingInvitations.data[0].id, status: 'accepted' });
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
        const allianceResult = await client.models.Alliance.get({ id: allianceId });
        if (!allianceResult.data) {
          return { success: false, error: 'Alliance not found', errorCode: ErrorCode.NOT_FOUND };
        }

        const alliance = allianceResult.data;
        let memberIds: string[] = typeof alliance.memberIds === 'string'
          ? JSON.parse(alliance.memberIds)
          : (alliance.memberIds as string[] ?? []);

        memberIds = memberIds.filter((id) => id !== kingdomId);

        if (memberIds.length === 0) {
          // Last member — delete the alliance
          await client.models.Alliance.delete({ id: allianceId });
          log.info('alliance-manager', 'leaveAlliance', { kingdomId, allianceId, dissolved: true });
          return { success: true, result: JSON.stringify({ allianceId, dissolved: true }) };
        }

        // If the leaving member was the leader, assign a new leader
        let newLeaderId = alliance.leaderId;
        if (alliance.leaderId === kingdomId) {
          newLeaderId = memberIds[0];
        }

        await client.models.Alliance.update({ id: allianceId, memberIds: JSON.stringify(memberIds), leaderId: newLeaderId });

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
        const allianceResult = await client.models.Alliance.get({ id: allianceId });
        if (!allianceResult.data) {
          return { success: false, error: 'Alliance not found', errorCode: ErrorCode.NOT_FOUND };
        }

        const alliance = allianceResult.data;

        // Verify caller is the leader
        if (alliance.leaderId !== kingdomId) {
          return { success: false, error: 'Only the alliance leader can kick members', errorCode: ErrorCode.FORBIDDEN };
        }

        let memberIds: string[] = typeof alliance.memberIds === 'string'
          ? JSON.parse(alliance.memberIds)
          : (alliance.memberIds as string[] ?? []);

        memberIds = memberIds.filter((id) => id !== targetKingdomId);
        await client.models.Alliance.update({ id: allianceId, memberIds: JSON.stringify(memberIds) });

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
        const allianceResult = await client.models.Alliance.get({ id: allianceId });
        if (!allianceResult.data) {
          return { success: false, error: 'Alliance not found', errorCode: ErrorCode.NOT_FOUND };
        }

        const alliance = allianceResult.data;

        // Verify caller is the leader
        if (alliance.leaderId !== kingdomId) {
          return { success: false, error: 'Only the alliance leader can invite members', errorCode: ErrorCode.FORBIDDEN };
        }

        const invitation = await client.models.AllianceInvitation.create({
          guildId: allianceId,
          inviterId: kingdomId,
          inviteeId: targetKingdomId,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });

        if (!invitation.data) {
          return { success: false, error: 'Failed to create invitation', errorCode: ErrorCode.INTERNAL_ERROR };
        }

        log.info('alliance-manager', 'inviteMember', { kingdomId, allianceId, targetKingdomId });
        return { success: true, result: JSON.stringify({ invitationId: invitation.data.id, allianceId, targetKingdomId }) };
      }

      case 'decline': {
        if (!allianceId) {
          return { success: false, error: 'Missing required parameter: allianceId', errorCode: ErrorCode.MISSING_PARAMS };
        }

        // Verify kingdom ownership
        const kingdomCheck = await verifyKingdomOwnership(kingdomId, identity);
        if (kingdomCheck.error) return kingdomCheck.error;

        // Find and mark the invitation as declined
        const invitations = await client.models.AllianceInvitation.list({
          filter: {
            guildId: { eq: allianceId },
            inviteeId: { eq: kingdomId },
            status: { eq: 'pending' },
          },
        });
        if (invitations.data && invitations.data.length > 0) {
          await client.models.AllianceInvitation.update({ id: invitations.data[0].id, status: 'declined' });
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
