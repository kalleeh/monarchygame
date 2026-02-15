/**
 * Diplomacy Store - Zustand state management for diplomatic relations
 * Follows existing store patterns from territoryStore and trainingStore
 */

import { create } from 'zustand';
import { DIPLOMACY } from '../constants/gameConfig';
import { DiplomacyService } from '../services/DiplomacyService';
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
  sendTreatyProposal: (proposal: TreatyProposal) => Promise<void>;
  acceptTreatyProposal: (proposalId: string) => Promise<void>;
  rejectTreatyProposal: (proposalId: string) => Promise<void>;
  declareWar: (targetKingdomId: string) => Promise<void>;
  makePeace: (targetKingdomId: string) => Promise<void>;
  updateReputation: (change: number) => void;
}

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

      // Set up real-time subscriptions
      DiplomacyService.subscribeToTreatyProposals(kingdomId, (data: Record<string, unknown>) => {
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

  // Send treaty proposal
  sendTreatyProposal: async (proposal: TreatyProposal) => {
    set({ loading: true, error: null });

    try {
      await DiplomacyService.sendTreatyProposal({
        fromKingdomId: ('fromKingdomId' in proposal ? (proposal as TreatyProposal & { fromKingdomId?: string }).fromKingdomId : proposal.fromKingdom?.id) || '',
        toKingdomId: ('toKingdomId' in proposal ? (proposal as TreatyProposal & { toKingdomId?: string }).toKingdomId : proposal.toKingdom?.id) || '',
        treatyType: proposal.treatyType || '',
        terms: JSON.stringify(proposal.terms || {})
      });

      // Add to active proposals
      
        set(state => ({
        activeProposals: [...state.activeProposals, proposal],
        loading: false
      }));

      // Update diplomatic history
      const action: DiplomaticAction = {
        id: `action-${Date.now()}`,
        type: 'PROPOSAL_SENT',
        fromKingdom: proposal.fromKingdom,
        toKingdom: proposal.toKingdom,
        details: `Sent ${proposal.treatyType} proposal`,
        timestamp: new Date()
      };

      
        set(state => ({
        diplomaticHistory: [action, ...state.diplomaticHistory]
      }));

    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to send proposal',
        loading: false 
      });
      throw error;
    }
  },

  // Accept treaty proposal
  acceptTreatyProposal: async (proposalId: string) => {
    set({ loading: true, error: null });

    try {
      const proposal = get().activeProposals.find(p => p.id === proposalId);
      if (!proposal) throw new Error('Proposal not found');

      await DiplomacyService.acceptTreatyProposal(proposalId);

      // Remove from active proposals
      
        set(state => ({
        activeProposals: state.activeProposals.filter(p => p.id !== proposalId),
        loading: false
      }));

      // Update relationships
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
        relationships: [...state.relationships.filter(r => 
          !(r.fromKingdom.id === proposal.fromKingdom.id && r.toKingdom.id === proposal.toKingdom.id) &&
          !(r.fromKingdom.id === proposal.toKingdom.id && r.toKingdom.id === proposal.fromKingdom.id)
        ), newRelationship]
      }));

      // Increase reputation
      get().updateReputation(10);

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

      // Remove from active proposals
      
        set(state => ({
        activeProposals: state.activeProposals.filter(p => p.id !== proposalId),
        loading: false
      }));

      // Small reputation penalty
      get().updateReputation(-2);

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
      await DiplomacyService.declareWar(
      "default-kingdom", targetKingdomId);

      // Update relationship status
      
        set(state => ({
        relationships: state.relationships.map(rel => {
          if ((rel.fromKingdom.id === targetKingdomId || rel.toKingdom.id === targetKingdomId)) {
            return { ...rel, status: 'WAR', lastAction: new Date() };
          }
          return rel;
        }),
        loading: false
      }));

      // Reputation penalty
      get().updateReputation(-20);

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
      await DiplomacyService.makePeace(
      "default-kingdom", targetKingdomId);

      // Update relationship status
      
        set(state => ({
        relationships: state.relationships.map(rel => {
          if ((rel.fromKingdom.id === targetKingdomId || rel.toKingdom.id === targetKingdomId)) {
            return { ...rel, status: 'NEUTRAL', lastAction: new Date() };
          }
          return rel;
        }),
        loading: false
      }));

      // Small reputation bonus
      get().updateReputation(5);

    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to make peace',
        loading: false 
      });
      throw error;
    }
  },

  // Update reputation
  updateReputation: (change: number) => {
    
        set(state => ({
      reputation: Math.max(0, Math.min(200, state.reputation + change))
    }));
  }
}));
