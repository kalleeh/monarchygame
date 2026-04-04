import { generateClient } from 'aws-amplify/data';
import type { DiplomaticRelationship, TreatyProposal, DiplomaticAction } from '../types/diplomacy';
import { isDemoMode } from '../utils/authMode';
import type { Schema } from '../../../amplify/data/resource';

let _client: ReturnType<typeof generateClient<Schema>> | null = null;
const getClient = () => { if (!_client) _client = generateClient<Schema>(); return _client; };

// ── Demo / mock data ────────────────────────────────────────────────────────

const DEMO_KINGDOMS = [
  { id: 'demo-kingdom-1', name: 'Iron Reach', race: 'Droben', power: 4200, reputation: 65, relationship: 'neutral' },
  { id: 'demo-kingdom-2', name: 'The Thornwood', race: 'Elven', power: 3800, reputation: 80, relationship: 'trade_pact' },
  { id: 'demo-kingdom-3', name: 'Golden Keep', race: 'Human', power: 5100, reputation: 55, relationship: 'neutral' },
];

const DEMO_RELATIONSHIPS: DiplomaticRelationship[] = [
  {
    id: 'demo-rel-1',
    fromKingdom: { id: 'demo-kingdom-2', name: 'The Thornwood', race: 'Elven', reputation: 80 },
    toKingdom: { id: 'player-kingdom', name: 'Your Kingdom', race: 'Human', reputation: 100 },
    status: 'FRIENDLY',
    treaties: [
      {
        id: 'demo-treaty-1',
        type: 'TRADE_AGREEMENT',
        terms: { tradeBonus: '10%', duration: '60 days' },
        status: 'ACTIVE',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 57 * 24 * 60 * 60 * 1000),
      },
    ],
    reputation: 80,
    lastAction: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'demo-rel-2',
    fromKingdom: { id: 'demo-kingdom-1', name: 'Iron Reach', race: 'Droben', reputation: 65 },
    toKingdom: { id: 'player-kingdom', name: 'Your Kingdom', race: 'Human', reputation: 100 },
    status: 'NEUTRAL',
    treaties: [],
    reputation: 65,
    lastAction: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  },
];

const DEMO_PROPOSALS: TreatyProposal[] = [
  {
    id: 'demo-proposal-1',
    fromKingdom: { id: 'demo-kingdom-3', name: 'Golden Keep', race: 'Human', reputation: 55 },
    toKingdom: { id: 'player-kingdom', name: 'Your Kingdom', race: 'Human', reputation: 100 },
    treatyType: 'NON_AGGRESSION',
    terms: { duration: '30 days' },
    status: 'PENDING',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
];

const DEMO_HISTORY: DiplomaticAction[] = [
  {
    id: 'demo-history-1',
    type: 'PROPOSAL_ACCEPTED',
    fromKingdom: { id: 'player-kingdom', name: 'Your Kingdom', race: 'Human', reputation: 100 },
    toKingdom: { id: 'demo-kingdom-2', name: 'The Thornwood', race: 'Elven', reputation: 80 },
    details: 'Accepted TRADE_AGREEMENT proposal',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
];

// ────────────────────────────────────────────────────────────────────────────

export class DiplomacyService {
  /**
   * Get diplomatic relationships for a kingdom
   */
  static async getKingdomRelationships(_kingdomId: string): Promise<DiplomaticRelationship[]> {
    if (isDemoMode()) {
      return DEMO_RELATIONSHIPS;
    }
    try {
      const queries = getClient().queries as Record<string, (args: unknown) => Promise<unknown>>;
      const rawResponse = await queries.getDiplomaticRelationships({
        kingdomId: _kingdomId
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
  static async getActiveProposals(_kingdomId: string): Promise<TreatyProposal[]> {
    if (isDemoMode()) {
      return DEMO_PROPOSALS;
    }
    try {
      const queries = getClient().queries as Record<string, (args: unknown) => Promise<unknown>>;
      const rawResponse = await queries.getActiveProposals({ kingdomId: _kingdomId });
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
  static async getAvailableKingdoms(_kingdomId: string): Promise<Record<string, unknown>[]> {
    if (isDemoMode()) {
      return DEMO_KINGDOMS;
    }
    try {
      const { data } = await getClient().models.Kingdom.list({
        filter: { isActive: { eq: true } } as Parameters<ReturnType<typeof generateClient<Schema>>['models']['Kingdom']['list']>[0]['filter'],
        limit: 50,
      });
      return (data ?? [])
        .filter(k => k.id !== _kingdomId)
        .map(k => ({
          id: k.id,
          name: k.name ?? 'Unknown',
          race: k.race ?? 'Human',
          power: k.networth ?? 0,
          reputation: 50,
          relationship: 'neutral',
        }));
    } catch (error) {
      console.error('Failed to fetch available kingdoms:', error);
      return [];
    }
  }

  /**
   * Get kingdom reputation
   */
  static async getKingdomReputation(_kingdomId: string): Promise<number> {
    if (isDemoMode()) {
      return 100;
    }
    try {
      const queries = getClient().queries as Record<string, (args: unknown) => Promise<unknown>>;
      const rawResponse = await queries.getKingdomReputation({ kingdomId: _kingdomId });
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
  static async getDiplomaticHistory(_kingdomId: string): Promise<DiplomaticAction[]> {
    if (isDemoMode()) {
      return DEMO_HISTORY;
    }
    try {
      const queries = getClient().queries as Record<string, (args: unknown) => Promise<unknown>>;
      const rawResponse = await queries.getDiplomaticHistory({ kingdomId: _kingdomId });
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
        await getClient().mutations.sendTreatyProposal({
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
        await getClient().mutations.respondToTreaty({
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
        await getClient().mutations.respondToTreaty({
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
        await getClient().mutations.declareDiplomaticWar({
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
        await getClient().mutations.makeDiplomaticPeace({
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
    // Demo mode: no real-time subscription needed
    if (isDemoMode()) {
      return { unsubscribe: () => {} };
    }
    try {
      const queries = getClient().queries as Record<string, (args: unknown) => unknown>;
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
