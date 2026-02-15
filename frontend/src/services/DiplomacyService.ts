import { generateClient } from 'aws-amplify/data';
import type { DiplomaticRelationship, TreatyProposal, DiplomaticAction } from '../types/diplomacy';
import { isDemoMode } from '../utils/authMode';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

export class DiplomacyService {
  /**
   * Get diplomatic relationships for a kingdom
   */
  static async getKingdomRelationships(kingdomId: string): Promise<DiplomaticRelationship[]> {
    try {
      const queries = client.queries as Record<string, (args: unknown) => Promise<unknown>>;
      const rawResponse = await queries.getDiplomaticRelationships({
        kingdomId
      });
      const response = rawResponse as Record<string, unknown>;

      if (!response.data) {
        return [];
      }

      return (response.data as unknown as Record<string, unknown>[]).map((rel: Record<string, unknown>) => ({
        id: rel.id as string,
        kingdomId: rel.kingdomId as string,
        targetKingdomId: rel.targetKingdomId as string,
        targetKingdomName: rel.targetKingdomName as string,
        relationship: rel.relationship as string,
        reputation: rel.reputation as number,
        lastAction: rel.lastAction as string,
        createdAt: rel.createdAt as string,
        updatedAt: rel.updatedAt as string
      } as unknown as DiplomaticRelationship));
    } catch (error) {
      console.error('Failed to fetch diplomatic relationships:', error);
      return [];
    }
  }

  /**
   * Get active treaty proposals
   */
  static async getActiveProposals(kingdomId: string): Promise<TreatyProposal[]> {
    try {
      const queries = client.queries as Record<string, (args: unknown) => Promise<unknown>>;
      const rawResponse = await queries.getActiveProposals({ kingdomId });
      const response = rawResponse as Record<string, unknown>;

      if (!response.data) {
        return [];
      }

      return (response.data as unknown as Record<string, unknown>[]).map((proposal: Record<string, unknown>) => ({
        id: proposal.id as string,
        fromKingdomId: proposal.fromKingdomId as string,
        toKingdomId: proposal.toKingdomId as string,
        treatyType: proposal.treatyType as string,
        terms: proposal.terms as Record<string, unknown>,
        status: proposal.status as string,
        expiresAt: proposal.expiresAt as string,
        createdAt: proposal.createdAt as string
      } as unknown as TreatyProposal));
    } catch (error) {
      console.error('Failed to fetch active proposals:', error);
      return [];
    }
  }

  /**
   * Get available kingdoms for diplomacy
   */
  static async getAvailableKingdoms(kingdomId: string): Promise<Record<string, unknown>[]> {
    try {
      const queries = client.queries as Record<string, (args: unknown) => Promise<unknown>>;
      const rawResponse = await queries.getAvailableKingdoms({ kingdomId });
      const response = rawResponse as Record<string, unknown>;

      if (!response.data) {
        return [];
      }

      return (response.data as unknown as Record<string, unknown>[]).map((kingdom: Record<string, unknown>) => ({
        id: kingdom.id as string,
        name: kingdom.name as string,
        race: kingdom.race as string,
        power: kingdom.power as number,
        reputation: kingdom.reputation as number,
        relationship: kingdom.relationship as string
      }));
    } catch (error) {
      console.error('Failed to fetch available kingdoms:', error);
      return [];
    }
  }

  /**
   * Get kingdom reputation
   */
  static async getKingdomReputation(kingdomId: string): Promise<number> {
    try {
      const queries = client.queries as Record<string, (args: unknown) => Promise<unknown>>;
      const rawResponse = await queries.getKingdomReputation({ kingdomId });
      const response = rawResponse as Record<string, unknown>;
      const data = response.data as Record<string, unknown>;
      return Number(data?.reputation) || 0;
    } catch (error) {
      console.error('Failed to fetch kingdom reputation:', error);
      return 0;
    }
  }

  /**
   * Get diplomatic history
   */
  static async getDiplomaticHistory(kingdomId: string): Promise<DiplomaticAction[]> {
    try {
      const queries = client.queries as Record<string, (args: unknown) => Promise<unknown>>;
      const rawResponse = await queries.getDiplomaticHistory({ kingdomId });
      const response = rawResponse as Record<string, unknown>;

      if (!response.data) {
        return [];
      }

      return (response.data as unknown as Record<string, unknown>[]).map((action: Record<string, unknown>) => ({
        id: action.id as string,
        kingdomId: action.kingdomId as string,
        targetKingdomId: action.targetKingdomId as string,
        actionType: action.actionType as string,
        description: action.description as string,
        timestamp: action.timestamp as string
      } as unknown as DiplomaticAction));
    } catch (error) {
      console.error('Failed to fetch diplomatic history:', error);
      return [];
    }
  }

  /**
   * Send treaty proposal
   */
  static async sendTreatyProposal(data: {
    fromKingdomId: string;
    toKingdomId: string;
    treatyType: string;
    terms: string;
  }): Promise<boolean> {
    try {
      if (!isDemoMode()) {
        await client.mutations.sendTreatyProposal({
          proposerId: data.fromKingdomId,
          recipientId: data.toKingdomId,
          seasonId: 'current',
          treatyType: data.treatyType,
          terms: JSON.parse(data.terms || '{}')
        });
        return true;
      }
      // Demo mode fallback
      return true;
    } catch (error) {
      console.error('Failed to send treaty proposal:', error);
      return false;
    }
  }

  /**
   * Accept treaty proposal
   */
  static async acceptTreatyProposal(proposalId: string): Promise<boolean> {
    try {
      if (!isDemoMode()) {
        await client.mutations.respondToTreaty({
          treatyId: proposalId,
          accepted: true
        });
        return true;
      }
      // Demo mode fallback
      return true;
    } catch (error) {
      console.error('Failed to accept treaty proposal:', error);
      return false;
    }
  }

  /**
   * Reject treaty proposal
   */
  static async rejectTreatyProposal(proposalId: string): Promise<boolean> {
    try {
      if (!isDemoMode()) {
        await client.mutations.respondToTreaty({
          treatyId: proposalId,
          accepted: false
        });
        return true;
      }
      // Demo mode fallback
      return true;
    } catch (error) {
      console.error('Failed to reject treaty proposal:', error);
      return false;
    }
  }

  /**
   * Declare war
   */
  static async declareWar(fromKingdomId: string, toKingdomId: string): Promise<boolean> {
    try {
      if (!isDemoMode()) {
        await client.mutations.declareDiplomaticWar({
          kingdomId: fromKingdomId,
          targetKingdomId: toKingdomId,
          seasonId: 'current'
        });
        return true;
      }
      // Demo mode fallback
      return true;
    } catch (error) {
      console.error('Failed to declare war:', error);
      return false;
    }
  }

  /**
   * Make peace
   */
  static async makePeace(fromKingdomId: string, toKingdomId: string): Promise<boolean> {
    try {
      if (!isDemoMode()) {
        await client.mutations.makeDiplomaticPeace({
          kingdomId: fromKingdomId,
          targetKingdomId: toKingdomId
        });
        return true;
      }
      // Demo mode fallback
      return true;
    } catch (error) {
      console.error('Failed to make peace:', error);
      return false;
    }
  }

  /**
   * Subscribe to treaty proposals
   */
  static subscribeToTreatyProposals(kingdomId: string, callback: (data: Record<string, unknown>) => void) {
    try {
      const queries = client.queries as Record<string, (args: unknown) => unknown>;
      const subscriptionResult = queries.onTreatyProposal({ kingdomId });
      const subscription = (subscriptionResult as unknown as { subscribe: (handlers: { next: (data: unknown) => void; error: (error: Error) => void }) => { unsubscribe: () => void } }).subscribe({
        next: (data: unknown) => callback(data as Record<string, unknown>),
        error: (error: Error) => console.error('Subscription error:', error)
      });

      return {
        unsubscribe: () => subscription.unsubscribe()
      };
    } catch (error) {
      console.error('Error setting up subscription:', error);
      return {
        unsubscribe: () => {}
      };
    }
  }
}
