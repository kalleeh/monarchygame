/**
 * Bounty Store - Bounty Hunting System
 * Zustand store that integrates with shared bounty mechanics to rank AI kingdoms
 * as bounty targets, track claimed bounties, and award completion rewards.
 * Works in demo mode with localStorage persistence.
 */
import { create } from 'zustand';
import { calculateBountyValue, identifyOptimalBountyTargets, BOUNTY_MECHANICS } from '../../../shared/mechanics/bounty-mechanics';
import type { BountyTarget, BountyReward } from '../../../shared/mechanics/bounty-mechanics';
import { useKingdomStore } from './kingdomStore';
import type { AIKingdom } from './aiKingdomStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BountyEntry {
  /** The AI kingdom being targeted */
  target: BountyTarget;
  /** Name of the AI kingdom */
  targetName: string;
  /** Race of the AI kingdom */
  targetRace: string;
  /** Calculated reward for completing the bounty */
  reward: BountyReward;
  /** Efficiency score (reward.totalValue / estimatedTurns) */
  efficiency: number;
  /** Whether this bounty has been claimed by the player */
  claimed: boolean;
  /** Timestamp when the bounty was claimed, if applicable */
  claimedAt: number | null;
}

export interface CompletedBounty {
  /** Target kingdom ID */
  targetId: string;
  /** Target kingdom name */
  targetName: string;
  /** Reward that was awarded */
  reward: BountyReward;
  /** Actual land gained from the attack */
  landGained: number;
  /** Timestamp of completion */
  completedAt: number;
}

interface BountyState {
  availableBounties: BountyEntry[];
  completedBounties: CompletedBounty[];
  loading: boolean;
  error: string | null;

  // Actions
  generateBounties: (aiKingdoms: AIKingdom[]) => void;
  claimBounty: (targetId: string) => void;
  completeBounty: (targetId: string, landGained: number) => void;
  clearError: () => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_BOUNTIES = 'bounty-available';
const STORAGE_KEY_COMPLETED = 'bounty-completed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function saveBounties(bounties: BountyEntry[]): void {
  localStorage.setItem(STORAGE_KEY_BOUNTIES, JSON.stringify(bounties));
}

function loadBounties(): BountyEntry[] {
  const raw = localStorage.getItem(STORAGE_KEY_BOUNTIES);
  return raw ? JSON.parse(raw) : [];
}

function saveCompleted(completed: CompletedBounty[]): void {
  localStorage.setItem(STORAGE_KEY_COMPLETED, JSON.stringify(completed));
}

function loadCompleted(): CompletedBounty[] {
  const raw = localStorage.getItem(STORAGE_KEY_COMPLETED);
  return raw ? JSON.parse(raw) : [];
}

/**
 * Convert an AIKingdom into a BountyTarget for the shared mechanics.
 * Estimates build ratio from unit counts relative to land, and
 * difficulty-based turn estimates.
 */
function aiKingdomToBountyTarget(kingdom: AIKingdom): BountyTarget {
  const totalUnits = kingdom.units.tier1 + kingdom.units.tier2 + kingdom.units.tier3 + kingdom.units.tier4;
  // Build ratio: percentage of land that has structures/units (heuristic)
  const buildRatio = kingdom.resources.land > 0
    ? Math.min(100, Math.floor((totalUnits / kingdom.resources.land) * 100))
    : 10;

  // Estimated turns to defeat based on difficulty
  const turnsByDifficulty: Record<string, number> = {
    easy: 30,
    medium: 60,
    hard: 100,
  };

  return {
    kingdomId: kingdom.id,
    totalLand: kingdom.resources.land,
    totalStructures: totalUnits,
    buildRatio,
    difficulty: kingdom.difficulty,
    estimatedTurns: turnsByDifficulty[kingdom.difficulty] || 60,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useBountyStore = create<BountyState>((set, get) => ({
  availableBounties: loadBounties(),
  completedBounties: loadCompleted(),
  loading: false,
  error: null,

  // -----------------------------------------------------------------------
  // generateBounties — rank AI kingdoms as bounty targets using shared mechanics
  // -----------------------------------------------------------------------
  generateBounties: (aiKingdoms: AIKingdom[]) => {
    set({ loading: true, error: null });

    try {
      // Convert AI kingdoms to BountyTarget format
      const allTargets = aiKingdoms.map(aiKingdomToBountyTarget);

      // Use shared mechanics to identify optimal targets
      // Default hunter capabilities: 150 max turns, build rate 18
      const optimalTargets = identifyOptimalBountyTargets(allTargets, {
        maxTurns: 150,
        buildRate: 18,
        _raceId: 'human',
      });

      // Build BountyEntry list from the ranked targets
      const previousBounties = get().availableBounties;
      const completedIds = new Set(get().completedBounties.map(b => b.targetId));

      const bounties: BountyEntry[] = optimalTargets
        .filter(target => !completedIds.has(target.kingdomId))
        .map(target => {
          const kingdom = aiKingdoms.find(k => k.id === target.kingdomId);
          const reward = calculateBountyValue(
            target.totalLand,
            target.totalStructures,
            target.buildRatio,
            18 // hunterBuildRate
          );
          const efficiency = target.estimatedTurns > 0 ? reward.totalValue / target.estimatedTurns : 0;

          // Preserve claimed status from previous generation
          const prev = previousBounties.find(b => b.target.kingdomId === target.kingdomId);

          return {
            target,
            targetName: kingdom?.name || 'Unknown Kingdom',
            targetRace: kingdom?.race || 'Unknown',
            reward,
            efficiency: parseFloat(efficiency.toFixed(2)),
            claimed: prev?.claimed || false,
            claimedAt: prev?.claimedAt || null,
          };
        });

      saveBounties(bounties);
      set({ availableBounties: bounties, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to generate bounties',
        loading: false,
      });
    }
  },

  // -----------------------------------------------------------------------
  // claimBounty — mark a bounty as active (player commits to hunting it)
  // Requires a successful attack to complete.
  // -----------------------------------------------------------------------
  claimBounty: (targetId: string) => {
    const { availableBounties } = get();
    const bounty = availableBounties.find(b => b.target.kingdomId === targetId);

    if (!bounty) {
      set({ error: 'Bounty target not found' });
      return;
    }
    if (bounty.claimed) {
      set({ error: 'Bounty already claimed' });
      return;
    }

    // Check minimum land threshold from BOUNTY_MECHANICS
    if (bounty.target.totalLand < BOUNTY_MECHANICS.LAND_ACQUISITION.MINIMUM_LAND_GAIN) {
      set({ error: `Target has too little land (${bounty.target.totalLand}). Minimum bounty size: ${BOUNTY_MECHANICS.LAND_ACQUISITION.MINIMUM_LAND_GAIN}` });
      return;
    }

    const updatedBounties = availableBounties.map(b =>
      b.target.kingdomId === targetId
        ? { ...b, claimed: true, claimedAt: Date.now() }
        : b
    );

    saveBounties(updatedBounties);
    set({ availableBounties: updatedBounties, error: null });
  },

  // -----------------------------------------------------------------------
  // completeBounty — awards bounty rewards after a successful attack
  // Updates kingdom resources via kingdomStore.
  // -----------------------------------------------------------------------
  completeBounty: (targetId: string, landGained: number) => {
    const { availableBounties, completedBounties } = get();
    const bounty = availableBounties.find(
      b => b.target.kingdomId === targetId && b.claimed
    );

    if (!bounty) {
      set({ error: 'No claimed bounty found for this target' });
      return;
    }

    if (landGained <= 0) {
      set({ error: 'Attack must gain land to complete a bounty' });
      return;
    }

    // Award bounty rewards to the player's kingdom
    const kingdom = useKingdomStore.getState();
    const currentGold = kingdom.resources.gold || 0;
    const currentLand = kingdom.resources.land || 0;
    const currentPop = kingdom.resources.population || 0;

    // Bounty bonus: extra gold proportional to the bounty's total value
    const goldBonus = Math.floor(bounty.reward.totalValue * 0.5);
    // Population boost from conquered subjects
    const populationBonus = Math.floor(bounty.reward.structuresGained * 2);

    kingdom.updateResources({
      gold: currentGold + goldBonus,
      land: currentLand + landGained,
      population: currentPop + populationBonus,
    });

    // Record completion
    const completed: CompletedBounty = {
      targetId,
      targetName: bounty.targetName,
      reward: bounty.reward,
      landGained,
      completedAt: Date.now(),
    };

    const updatedCompleted = [completed, ...completedBounties];
    saveCompleted(updatedCompleted);

    // Remove from available bounties
    const updatedBounties = availableBounties.filter(
      b => b.target.kingdomId !== targetId
    );
    saveBounties(updatedBounties);

    set({
      availableBounties: updatedBounties,
      completedBounties: updatedCompleted,
      error: null,
    });
  },

  // -----------------------------------------------------------------------
  // clearError
  // -----------------------------------------------------------------------
  clearError: () => {
    set({ error: null });
  },

  // -----------------------------------------------------------------------
  // reset — clear all bounty state and localStorage
  // -----------------------------------------------------------------------
  reset: () => {
    localStorage.removeItem(STORAGE_KEY_BOUNTIES);
    localStorage.removeItem(STORAGE_KEY_COMPLETED);
    set({
      availableBounties: [],
      completedBounties: [],
      loading: false,
      error: null,
    });
  },
}));
