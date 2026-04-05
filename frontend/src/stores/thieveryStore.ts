/**
 * Thievery/Espionage System State Management
 * Manages scum operations: scout, steal, sabotage, burn
 * Uses shared mechanics for all calculations
 */

import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import { useKingdomStore } from './kingdomStore';
import {
  calculateDetectionRate,
  calculateTheftAmount,
  calculateScumCasualties,
  THIEVERY_MECHANICS
} from '../../../shared/mechanics/thievery-mechanics';
import type { ThieveryResult } from '../../../shared/mechanics/thievery-mechanics';
import { executeThievery } from '../services/domain/ThieveryService';
import { isDemoMode } from '../utils/authMode';

export type OperationType = 'scout' | 'steal' | 'sabotage' | 'burn' | 'desecrate' | 'spread_dissention' | 'intercept_caravans' | 'scum_kill';

export interface ThieveryOperation {
  id: string;
  type: OperationType;
  targetId: string;
  targetName: string;
  timestamp: number;
  turnCost: number;
  success: boolean;
  result: ThieveryResult;
}

export const useThieveryStore = create(
  combine(
    {
      // Kingdom identity
      kingdomId: '' as string,

      // Scum counts
      scumCount: 0,
      eliteScumCount: 0,
      race: 'Human',

      // Detection
      detectionRate: 0,

      // Operation history
      operations: [] as ThieveryOperation[],

      // UI state
      loading: false,
      error: null as string | null,
    },
    (set, get) => ({
      /**
       * Initialize thievery state from kingdom units and race
       */
      initializeThievery: (kingdomId: string, race: string) => {
        // Read scum counts from kingdomStore (authoritative, synced from server)
        const units = useKingdomStore.getState().units || [];
        let scumCount = 0;
        let eliteScumCount = 0;

        for (const unit of units) {
          const unitType = (unit.type || '').toLowerCase();
          if (unitType === 'scum' || unitType === 'green_scum' || unitType === 'scouts') {
            scumCount += unit.count || 0;
          }
          if (unitType === 'elite_scum' || unitType === 'assassins' || unitType === 'elite_scouts') {
            eliteScumCount += unit.count || 0;
          }
        }

        set({
          kingdomId,
          scumCount,
          eliteScumCount,
          race,
          error: null,
        });
      },

      /**
       * Execute an espionage operation against a target kingdom
       */
      executeOperation: async (
        type: OperationType,
        targetId: string,
        targetName: string,
        targetScum: number,
        targetRace: string,
        targetGold: number,
        spendTurnsFn: (amount: number) => boolean
      ): Promise<ThieveryOperation | null> => {
        const state = get();
        const totalScum = state.scumCount + state.eliteScumCount;

        // Validate minimum scum
        if (totalScum < THIEVERY_MECHANICS.DETECTION.MINIMUM_SCUM) {
          set({ error: `Need at least ${THIEVERY_MECHANICS.DETECTION.MINIMUM_SCUM} scum to perform operations` });
          return null;
        }

        // Determine turn cost
        const turnCosts: Record<OperationType, number> = {
          scout: THIEVERY_MECHANICS.OPERATION_COSTS.SCOUT,
          steal: THIEVERY_MECHANICS.OPERATION_COSTS.STEAL,
          sabotage: THIEVERY_MECHANICS.OPERATION_COSTS.SABOTAGE,
          burn: THIEVERY_MECHANICS.OPERATION_COSTS.BURN,
          desecrate: THIEVERY_MECHANICS.OPERATION_COSTS.DESECRATE,
          spread_dissention: THIEVERY_MECHANICS.OPERATION_COSTS.SPREAD_DISSENTION,
          intercept_caravans: THIEVERY_MECHANICS.OPERATION_COSTS.INTERCEPT,
          scum_kill: THIEVERY_MECHANICS.OPERATION_COSTS.SCUM_KILL,
        };
        const turnCost = turnCosts[type];

        // Spend turns via kingdomStore
        const turnsSpent = spendTurnsFn(turnCost);
        if (!turnsSpent) {
          set({ error: `Not enough turns. Need ${turnCost} turns for ${type} operation.` });
          return null;
        }

        set({ loading: true, error: null });

        // Calculate casualties for green and elite scum
        const operationKey = type.toUpperCase() as keyof typeof THIEVERY_MECHANICS.OPERATION_COSTS;
        let greenCasualties = calculateScumCasualties(
          state.scumCount, 'green', operationKey, state.race
        );
        let eliteCasualties = calculateScumCasualties(
          state.eliteScumCount, 'elite', operationKey, state.race
        );

        // Build result based on operation type
        let result: ThieveryResult;

        if (type === 'steal') {
          const theftResult = calculateTheftAmount(
            totalScum, state.race, targetScum, targetRace, targetGold
          );
          result = {
            success: theftResult.stolen > 0,
            goldStolen: theftResult.stolen,
            informationGained: null,
            casualtiesInflicted: 0,
            casualtiesSuffered: greenCasualties + eliteCasualties,
            detectionLevel: calculateDetectionRate(targetScum, targetRace, totalScum, state.race),
          };
        } else if (type === 'scout') {
          const detection = calculateDetectionRate(totalScum, state.race, targetScum, targetRace);
          const success = Math.random() > detection * 0.5; // Scouting has better success odds
          result = {
            success,
            goldStolen: 0,
            informationGained: success ? {
              estimatedGold: Math.floor(targetGold * (0.8 + Math.random() * 0.4)),
              estimatedScum: Math.floor(targetScum * (0.7 + Math.random() * 0.6)),
              defenseRating: Math.random() > 0.5 ? 'strong' : 'weak',
            } : null,
            casualtiesInflicted: 0,
            casualtiesSuffered: greenCasualties + eliteCasualties,
            detectionLevel: detection,
          };
        } else if (type === 'sabotage') {
          const detection = calculateDetectionRate(targetScum, targetRace, totalScum, state.race);
          const successRate = 1 - detection;
          const success = Math.random() < successRate;
          result = {
            success,
            goldStolen: 0,
            informationGained: null,
            casualtiesInflicted: success ? Math.floor(targetScum * 0.03) : 0,
            casualtiesSuffered: greenCasualties + eliteCasualties,
            detectionLevel: detection,
          };
        } else {
          // burn
          const detection = calculateDetectionRate(targetScum, targetRace, totalScum, state.race);
          const successRate = (1 - detection) * 0.8; // Burning is harder
          const success = Math.random() < successRate;
          result = {
            success,
            goldStolen: 0,
            informationGained: null,
            casualtiesInflicted: success ? Math.floor(targetScum * 0.05) : 0,
            casualtiesSuffered: greenCasualties + eliteCasualties,
            detectionLevel: detection,
          };
        }

        // Centaur scum killing bonus: 50% more casualties on sabotage/burn
        if ((type === 'sabotage' || type === 'burn') && state.race === 'Centaur') {
          result.casualtiesInflicted = Math.floor(result.casualtiesInflicted * 1.5);
        }

        // In auth mode, await Lambda confirmation before applying casualties —
        // prevents permanent scum loss if the server rejects the operation.
        if (!isDemoMode()) {
          const { kingdomId } = get();
          try {
            const serverResponse = await executeThievery({ kingdomId, action: type, targetId });
            // Parse the server result and override the locally-computed result
            if (serverResponse.success && serverResponse.result) {
              const serverData = typeof serverResponse.result === 'string'
                ? JSON.parse(serverResponse.result) : serverResponse.result;
              result = {
                success: serverData.succeeded ?? false,
                goldStolen: serverData.goldStolen ?? 0,
                informationGained: serverData.intelligence?.targetGold != null ? {
                  estimatedGold: serverData.intelligence.targetGold,
                  estimatedScum: serverData.intelligence.targetScouts,
                  defenseRating: serverData.intelligence.defenseRating,
                } : null,
                casualtiesInflicted: serverData.intelligence?.scoutsKilled ?? 0,
                casualtiesSuffered: serverData.casualties ?? 0,
                detectionLevel: 0,
                templesDestroyed: serverData.intelligence?.templesDestroyed ?? 0,
                populationKilled: serverData.intelligence?.populationKilled ?? 0,
                goldIntercepted: serverData.intelligence?.goldIntercepted ?? 0,
                scoutsKilled: serverData.intelligence?.scoutsKilled ?? 0,
                promoted: serverData.promoted ?? 0,
              };
              greenCasualties = serverData.casualties ?? 0;
              eliteCasualties = 0;
              // Server handles green/elite split — refresh from server to get accurate counts
              const { kingdomId: kid } = get();
              if (kid) {
                void import('../services/amplifyFunctionService').then(m =>
                  m.AmplifyFunctionService.refreshKingdomResources(kid)
                );
              }
            } else if (!serverResponse.success) {
              set({ loading: false, error: serverResponse.error || 'Operation failed' });
              return null;
            }
          } catch (error) {
            console.error('[thieveryStore] Lambda call failed, aborting operation:', error);
            set({ loading: false, error: 'Operation failed — server unavailable' });
            return null;
          }
        }

        // Apply casualties and record operation locally.
        // In auth mode the Lambda updates DynamoDB's totalUnits.scouts, but the
        // thieveryStore tracks green vs elite scum counts separately (local-only
        // state not persisted to DynamoDB). The Lambda only returns aggregate
        // casualties, so local tracking is the only way to maintain the split.
        const operation: ThieveryOperation = {
          id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type,
          targetId,
          targetName,
          timestamp: Date.now(),
          turnCost,
          success: result.success,
          result,
        };

        const newScumCount = Math.max(0, state.scumCount - greenCasualties);
        const newEliteScumCount = Math.max(0, state.eliteScumCount - eliteCasualties);

        set((prev) => ({
          scumCount: newScumCount,
          eliteScumCount: newEliteScumCount,
          operations: [operation, ...prev.operations.slice(0, 49)],
          loading: false,
        }));

        return operation;
      },

      /**
       * Wrapper around shared calculateDetectionRate
       */
      getDetectionRate: (enemyScum: number, enemyRace: string): number => {
        const state = get();
        const totalScum = state.scumCount + state.eliteScumCount;
        return calculateDetectionRate(totalScum, state.race, enemyScum, enemyRace);
      },

      /**
       * Clear error state
       */
      clearError: () => {
        set({ error: null });
      },

      /**
       * Reset store state
       */
      reset: () => {
        set({
          scumCount: 0,
          eliteScumCount: 0,
          race: 'Human',
          detectionRate: 0,
          operations: [],
          loading: false,
          error: null,
        });
      },
    })
  )
);
