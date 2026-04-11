import { generateClient } from 'aws-amplify/data';
import type { DiplomaticRelationship, TreatyProposal, DiplomaticAction } from '../types/diplomacy';
import { isDemoMode } from '../utils/authMode';
import type { Schema } from '../../../amplify/data/resource';
import { getClient } from '../utils/amplifyClient';

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
      const { data } = await getClient().models.DiplomaticRelation.list({
        filter: { kingdomId: { eq: _kingdomId } } as Parameters<ReturnType<typeof generateClient<Schema>>['models']['DiplomaticRelation']['list']>[0]['filter'],
        limit: 50,
      });
      return (data ?? []).map(rel => ({
        id: rel.id,
        fromKingdom: { id: _kingdomId, name: 'You', race: '', reputation: rel.reputation ?? 0 },
        toKingdom: { id: rel.targetKingdomId, name: rel.targetKingdomId, race: '', reputation: 0 },
        status: (rel.status ?? 'NEUTRAL').toUpperCase(),
        treaties: [],
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
      const { data } = await getClient().models.Treaty.list({
        filter: { recipientId: { eq: _kingdomId }, status: { eq: 'proposed' } } as Parameters<ReturnType<typeof generateClient<Schema>>['models']['Treaty']['list']>[0]['filter'],
        limit: 50,
      });
      return (data ?? []).map(t => ({
        id: t.id,
        fromKingdom: { id: t.proposerId, name: t.proposerId, race: '', reputation: 0 },
        toKingdom: { id: t.recipientId, name: _kingdomId, race: '', reputation: 0 },
        treatyType: (t.type ?? 'NON_AGGRESSION').toUpperCase(),
        terms: typeof t.terms === 'string' ? JSON.parse(t.terms) : (t.terms ?? {}),
        status: t.status ?? 'proposed',
        createdAt: t.proposedAt ?? new Date().toISOString(),
        expiresAt: t.expiresAt ?? new Date().toISOString(),
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
          reputation: (k as Record<string, unknown>).reputation as number ?? 100,
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
      const { data } = await getClient().models.Kingdom.get({ id: _kingdomId });
      return (data as Record<string, unknown>)?.reputation as number ?? 100;
    } catch {
      return 100;
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
      // No dedicated history model — derive from relations
      const { data } = await getClient().models.DiplomaticRelation.list({
        filter: { kingdomId: { eq: _kingdomId } } as Parameters<ReturnType<typeof generateClient<Schema>>['models']['DiplomaticRelation']['list']>[0]['filter'],
        limit: 20,
      });
      return (data ?? [])
        .filter(r => r.lastActionAt)
        .map(r => ({
          id: r.id,
          type: r.status ?? 'neutral',
          description: `Relation with ${r.targetKingdomId}: ${r.status}`,
          timestamp: r.lastActionAt ?? new Date().toISOString(),
          fromKingdom: { id: _kingdomId, name: 'You' },
          toKingdom: { id: r.targetKingdomId, name: r.targetKingdomId },
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
          terms: data.terms || '{}'
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
      const sub = getClient().models.Treaty.observeQuery({
        filter: { recipientId: { eq: kingdomId }, status: { eq: 'proposed' } } as Parameters<ReturnType<typeof generateClient<Schema>>['models']['Treaty']['observeQuery']>[0]['filter'],
      }).subscribe({
        next: ({ items }) => {
          for (const item of items) {
            callback(item as unknown as Record<string, unknown>);
          }
        },
        error: (error: Error) => console.error('Treaty subscription error:', error),
      });
      return { unsubscribe: () => sub.unsubscribe() };
    } catch (error) {
      console.error('Error setting up subscription:', error);
      return { unsubscribe: () => {} };
    }
  }
}
