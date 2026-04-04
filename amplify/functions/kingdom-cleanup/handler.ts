import type { Schema } from '../../data/resource';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbDelete, dbQuery } from '../data-client';
import { verifyOwnership } from '../verify-ownership';
import { checkRateLimit } from '../rate-limiter';

type KingdomType = Record<string, unknown>;

export const handler = async (event: Parameters<Schema['cleanupKingdom']['functionHandler']>[0]) => {
  const { kingdomId, confirmation } = event.arguments;

  try {
    if (!kingdomId) {
      return { success: false, error: 'Missing required parameter: kingdomId', errorCode: ErrorCode.MISSING_PARAMS };
    }
    if (!confirmation) {
      return { success: false, error: 'Missing required parameter: confirmation', errorCode: ErrorCode.MISSING_PARAMS };
    }
    if (confirmation !== 'DELETE') {
      return { success: false, error: 'confirmation must be exactly "DELETE"', errorCode: ErrorCode.INVALID_PARAM };
    }

    const identity = event.identity as { sub?: string; username?: string; claims?: Record<string, string> } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }

    const rateLimited = await checkRateLimit(identity.sub, 'default');
    if (rateLimited) return rateLimited;

    const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
    if (!kingdom) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    // Verify ownership OR admin (admin check via groups claim)
    const groups: string[] = ((identity.claims?.['cognito:groups']) ?? '').split(',').filter(Boolean);
    const isAdmin = groups.includes('admin');
    if (!isAdmin) {
      const denied = verifyOwnership(identity, kingdom.owner as string | null);
      if (denied) {
        log.warn('kingdom-cleanup', 'ownershipMismatch', { ownerField: kingdom.owner, userSub: identity.sub, kingdomId });
        return denied;
      }
    }

    // Delete related records
    const territories = await dbQuery<{ id: string; kingdomId?: string }>('Territory', 'territoriesByKingdomIdAndCreatedAt', { field: 'kingdomId', value: kingdomId });
    for (const t of territories) await dbDelete('Territory', t.id);

    const restorations = await dbQuery<{ id: string; kingdomId?: string }>('RestorationStatus', 'restorationStatusesByKingdomIdAndEndTime', { field: 'kingdomId', value: kingdomId });
    for (const r of restorations) await dbDelete('RestorationStatus', r.id);

    const notifications = await dbQuery<{ id: string; recipientId?: string }>('CombatNotification', 'combatNotificationsByRecipientId', { field: 'recipientId', value: kingdomId });
    for (const n of notifications) await dbDelete('CombatNotification', n.id);

    const [attackerReports, defenderReports] = await Promise.all([
      dbQuery<{ id: string; attackerId?: string; defenderId?: string }>('BattleReport', 'battleReportsByAttackerIdAndDefenderId', { field: 'attackerId', value: kingdomId }),
      dbQuery<{ id: string; attackerId?: string; defenderId?: string }>('BattleReport', 'battleReportsByDefenderIdAndTimestamp', { field: 'defenderId', value: kingdomId }),
    ]);
    const battleReportIds = new Set<string>();
    const battleReports = [...attackerReports, ...defenderReports].filter(r => {
      if (battleReportIds.has(r.id)) return false;
      battleReportIds.add(r.id);
      return true;
    });
    for (const r of battleReports) await dbDelete('BattleReport', r.id);

    const [attackerWars, defenderWars] = await Promise.all([
      dbQuery<{ id: string; attackerId?: string; defenderId?: string }>('WarDeclaration', 'warDeclarationsByAttackerIdAndStatus', { field: 'attackerId', value: kingdomId }),
      dbQuery<{ id: string; attackerId?: string; defenderId?: string }>('WarDeclaration', 'warDeclarationsByDefenderIdAndStatus', { field: 'defenderId', value: kingdomId }),
    ]);
    const warIds = new Set<string>();
    const wars = [...attackerWars, ...defenderWars].filter(w => {
      if (warIds.has(w.id)) return false;
      warIds.add(w.id);
      return true;
    });
    for (const w of wars) await dbDelete('WarDeclaration', w.id);

    const [sellerOffers, buyerOffers] = await Promise.all([
      dbQuery<{ id: string; sellerId?: string }>('TradeOffer', 'tradeOffersBySellerId', { field: 'sellerId', value: kingdomId }),
      dbQuery<{ id: string; buyerId?: string }>('TradeOffer', 'tradeOffersByBuyerId', { field: 'buyerId', value: kingdomId }),
    ]);
    const tradeOfferIds = new Set<string>();
    const tradeOffers = [...sellerOffers, ...buyerOffers].filter(o => {
      if (tradeOfferIds.has(o.id)) return false;
      tradeOfferIds.add(o.id);
      return true;
    });
    for (const o of tradeOffers) await dbDelete('TradeOffer', o.id);

    // Note: Only finds relations where kingdomId matches. Relations where targetKingdomId = kingdomId require a separate GSI (not yet added).
    const relations = await dbQuery<{ id: string; kingdomId?: string }>('DiplomaticRelation', 'diplomaticRelationsByKingdomId', { field: 'kingdomId', value: kingdomId });
    for (const r of relations) await dbDelete('DiplomaticRelation', r.id);

    const [proposerTreaties, recipientTreaties] = await Promise.all([
      dbQuery<{ id: string; proposerId?: string }>('Treaty', 'treatiesByProposerId', { field: 'proposerId', value: kingdomId }),
      dbQuery<{ id: string; recipientId?: string }>('Treaty', 'treatiesByRecipientId', { field: 'recipientId', value: kingdomId }),
    ]);
    const treatyIds = new Set<string>();
    const treaties = [...proposerTreaties, ...recipientTreaties].filter(t => {
      if (treatyIds.has(t.id)) return false;
      treatyIds.add(t.id);
      return true;
    });
    for (const t of treaties) await dbDelete('Treaty', t.id);

    const [inviteeInvitations, inviterInvitations] = await Promise.all([
      dbQuery<{ id: string; inviteeId?: string }>('AllianceInvitation', 'allianceInvitationsByInviteeId', { field: 'inviteeId', value: kingdomId }),
      dbQuery<{ id: string; inviterId?: string }>('AllianceInvitation', 'allianceInvitationsByInviterId', { field: 'inviterId', value: kingdomId }),
    ]);
    const invitationIds = new Set<string>();
    const invitations = [...inviteeInvitations, ...inviterInvitations].filter(i => {
      if (invitationIds.has(i.id)) return false;
      invitationIds.add(i.id);
      return true;
    });
    for (const i of invitations) await dbDelete('AllianceInvitation', i.id);

    await dbDelete('Kingdom', kingdomId);

    log.info('kingdom-cleanup', 'cleanupKingdom', {
      kingdomId,
      territories: territories.length,
      restorations: restorations.length,
      notifications: notifications.length,
      battleReports: battleReports.length,
      wars: wars.length,
      tradeOffers: tradeOffers.length,
      relations: relations.length,
      treaties: treaties.length,
      invitations: invitations.length,
    });

    return {
      success: true,
      deleted: {
        territories: territories.length,
        restorationStatuses: restorations.length,
        combatNotifications: notifications.length,
        battleReports: battleReports.length,
        warDeclarations: wars.length,
        tradeOffers: tradeOffers.length,
        diplomaticRelations: relations.length,
        treaties: treaties.length,
        allianceInvitations: invitations.length,
      },
    };
  } catch (error) {
    log.error('kingdom-cleanup', error, { kingdomId });
    return { success: false, error: error instanceof Error ? error.message : 'Kingdom cleanup failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
