/**
 * Diplomacy Store - Zustand state management for diplomatic relations
 * Follows existing store patterns from territoryStore and trainingStore
 */

import { create } from 'zustand';
import { DIPLOMACY } from '../constants/gameConfig';
import { DiplomacyService } from '../services/DiplomacyService';
import { isDemoMode } from '../utils/authMode';
import { proposeTreaty, declareDiplomaticWar, makeDiplomaticPeace } from '../services/domain/DiplomacyService';
import { useKingdomStore } from './kingdomStore';
import type {
  DiplomaticRelationship,
  TreatyProposal,
  Kingdom,
  DiplomaticAction
} from '../types/diplomacy';

interface DiplomacyStore {
  // State
  relationships: DiplomaticRelationship[];
  activeProposals: TreatyProposal[];
  availableKingdoms: Kingdom[];
  reputation: number;
  diplomaticHistory: DiplomaticAction[];
  loading: boolean;
  error: string | null;

  // Actions
  loadDiplomacyData: (kingdomId: string) => Promise<void>;
  cleanupSubscription: () => void;
  sendTreatyProposal: (proposal: TreatyProposal) => Promise<void>;
  acceptTreatyProposal: (proposalId: string) => Promise<void>;
  rejectTreatyProposal: (proposalId: string) => Promise<void>;
  declareWar: (targetKingdomId: string) => Promise<void>;
  makePeace: (targetKingdomId: string) => Promise<void>;
  updateReputation: (change: number) => void;
  applyIncomingWarDeclaration: (attackerId: string) => void;
}

let _treatySub: { unsubscribe: () => void } | null = null;

export const useDiplomacyStore = create<DiplomacyStore>((set, get) => ({
  // Initial state
  relationships: [],
  activeProposals: [],
  availableKingdoms: [],
  reputation: 100, // Start with neutral reputation
  diplomaticHistory: [],
  loading: false,
  error: null,

  // Load all diplomacy data for a kingdom
  loadDiplomacyData: async (kingdomId: string) => {
    set({ loading: true, error: null });
    
    try {
      const [relationships, proposals, kingdoms, reputation, history] = await Promise.all([
        DiplomacyService.getKingdomRelationships(kingdomId),
        DiplomacyService.getActiveProposals(kingdomId),
        DiplomacyService.getAvailableKingdoms(kingdomId),
        DiplomacyService.getKingdomReputation(kingdomId),
        DiplomacyService.getDiplomaticHistory(kingdomId)
      ]);

      set({
        relationships,
        activeProposals: proposals,
        availableKingdoms: kingdoms as unknown as Kingdom[],
        reputation,
        diplomaticHistory: history,
        loading: false
      });

      // Set up real-time subscriptions (clean up previous first)
      if (_treatySub) { _treatySub.unsubscribe(); _treatySub = null; }
      _treatySub = DiplomacyService.subscribeToTreatyProposals(kingdomId, (data: Record<string, unknown>) => {
        const proposal = data as unknown as TreatyProposal;
        set(state => ({
          activeProposals: [...state.activeProposals, proposal]
        }));
      });

    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load diplomacy data',
        loading: false 
      });
    }
  },

  cleanupSubscription: () => {
    if (_treatySub) { _treatySub.unsubscribe(); _treatySub = null; }
  },

  // Send treaty proposal
  sendTreatyProposal: async (proposal: TreatyProposal) => {
    set({ loading: true, error: null });

    try {
      // Auth mode: call Lambda
      if (!isDemoMode()) {
        const result = await proposeTreaty({
          kingdomId: ('fromKingdomId' in proposal ? (proposal as TreatyProposal & { fromKingdomId?: string }).fromKingdomId : proposal.fromKingdom?.id) || '',
          defenderKingdomId: ('toKingdomId' in proposal ? (proposal as TreatyProposal & { toKingdomId?: string }).toKingdomId : proposal.toKingdom?.id) || '',
          seasonId: 'current',
          treatyType: proposal.treatyType || ''
        }) as unknown;

        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        if (!parsed.success) {
          set({ error: parsed.error || 'Failed to send treaty proposal', loading: false });
          throw new Error(parsed.error);
        }
      } else {
        await DiplomacyService.sendTreatyProposal({
          fromKingdomId: ('fromKingdomId' in proposal ? (proposal as TreatyProposal & { fromKingdomId?: string }).fromKingdomId : proposal.fromKingdom?.id) || '',
          toKingdomId: ('toKingdomId' in proposal ? (proposal as TreatyProposal & { toKingdomId?: string }).toKingdomId : proposal.toKingdom?.id) || '',
          treatyType: proposal.treatyType || '',
          terms: JSON.stringify(proposal.terms || {})
        });
      }

      // Add to active proposals and update diplomatic history atomically
      const action: DiplomaticAction = {
        id: `action-${Date.now()}`,
        type: 'PROPOSAL_SENT',
        fromKingdom: proposal.fromKingdom,
        toKingdom: proposal.toKingdom,
        details: `Sent ${proposal.treatyType} proposal`,
        timestamp: new Date()
      };

      set(state => ({
        activeProposals: [...state.activeProposals, proposal],
        diplomaticHistory: [action, ...state.diplomaticHistory],
        loading: false
      }));

    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to send proposal',
        loading: false
      });
    }
  },

  // Accept treaty proposal
  acceptTreatyProposal: async (proposalId: string) => {
    set({ loading: true, error: null });

    try {
      const proposal = get().activeProposals.find(p => p.id === proposalId);
      if (!proposal) throw new Error('Proposal not found');

      await DiplomacyService.acceptTreatyProposal(proposalId);

      // Update proposals, relationships, and reputation atomically
      const newRelationship: DiplomaticRelationship = {
        id: `rel-${Date.now()}`,
        fromKingdom: proposal.fromKingdom,
        toKingdom: proposal.toKingdom,
        status: proposal.treatyType === 'MILITARY_ALLIANCE' ? 'ALLIED' : 'FRIENDLY',
        treaties: [{
          id: `treaty-${Date.now()}`,
          type: proposal.treatyType,
          terms: proposal.terms,
          status: 'ACTIVE',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + DIPLOMACY.TREATY_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
        }],
        reputation: 0,
        lastAction: new Date()
      };

      set(state => ({
        activeProposals: state.activeProposals.filter(p => p.id !== proposalId),
        relationships: [...state.relationships.filter(r =>
          !(r.fromKingdom.id === proposal.fromKingdom.id && r.toKingdom.id === proposal.toKingdom.id) &&
          !(r.fromKingdom.id === proposal.toKingdom.id && r.toKingdom.id === proposal.fromKingdom.id)
        ), newRelationship],
        reputation: Math.max(0, Math.min(200, state.reputation + 10)),
        loading: false
      }));

    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to accept proposal',
        loading: false 
      });
      throw error;
    }
  },

  // Reject treaty proposal
  rejectTreatyProposal: async (proposalId: string) => {
    set({ loading: true, error: null });

    try {
      await DiplomacyService.rejectTreatyProposal(proposalId);

      // Remove from active proposals and apply reputation penalty atomically
      set(state => ({
        activeProposals: state.activeProposals.filter(p => p.id !== proposalId),
        reputation: Math.max(0, Math.min(200, state.reputation - 2)),
        loading: false
      }));

    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to reject proposal',
        loading: false 
      });
      throw error;
    }
  },

  // Declare war
  declareWar: async (targetKingdomId: string) => {
    set({ loading: true, error: null });

    try {
      if (!isDemoMode()) {
        const result = await declareDiplomaticWar({
          kingdomId: useKingdomStore.getState().kingdomId ?? 'default-kingdom',
          defenderKingdomId: targetKingdomId,
          seasonId: 'current'
        }) as unknown;
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        if (!parsed.success) {
          set({ error: parsed.error || 'Failed to declare war', loading: false });
          throw new Error(parsed.error);
        }
      } else {
        await DiplomacyService.declareWar(useKingdomStore.getState().kingdomId ?? 'default-kingdom', targetKingdomId);
      }

      // Update relationship status and reputation atomically
      set(state => ({
        relationships: state.relationships.map(rel => {
          if ((rel.fromKingdom.id === targetKingdomId || rel.toKingdom.id === targetKingdomId)) {
            return { ...rel, status: 'WAR' as const, lastAction: new Date() };
          }
          return rel;
        }),
        reputation: Math.max(0, Math.min(200, state.reputation - 20)),
        loading: false
      }));

    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to declare war',
        loading: false 
      });
      throw error;
    }
  },

  // Make peace
  makePeace: async (targetKingdomId: string) => {
    set({ loading: true, error: null });

    try {
      if (!isDemoMode()) {
        const result = await makeDiplomaticPeace({
          kingdomId: useKingdomStore.getState().kingdomId ?? 'default-kingdom',
          defenderKingdomId: targetKingdomId
        }) as unknown;
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        if (!parsed.success) {
          set({ error: parsed.error || 'Failed to make peace', loading: false });
          throw new Error(parsed.error);
        }
      } else {
        await DiplomacyService.makePeace(useKingdomStore.getState().kingdomId ?? 'default-kingdom', targetKingdomId);
      }

      // Update relationship status and reputation atomically
      set(state => ({
        relationships: state.relationships.map(rel => {
          if ((rel.fromKingdom.id === targetKingdomId || rel.toKingdom.id === targetKingdomId)) {
            return { ...rel, status: 'NEUTRAL' as const, lastAction: new Date() };
          }
          return rel;
        }),
        reputation: Math.max(0, Math.min(200, state.reputation + 5)),
        loading: false
      }));

    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to make peace',
        loading: false 
      });
      throw error;
    }
  },

  applyIncomingWarDeclaration: (attackerId: string) => {
    set(state => ({
      relationships: state.relationships.map(rel =>
        (rel.fromKingdom.id === attackerId || rel.toKingdom.id === attackerId)
          ? { ...rel, status: 'WAR' as const, lastAction: new Date() }
          : rel
      ),
    }));
  },

  // Update reputation
  updateReputation: (change: number) => {
    
        set(state => ({
      reputation: Math.max(0, Math.min(200, state.reputation + change))
    }));
  }
}));
