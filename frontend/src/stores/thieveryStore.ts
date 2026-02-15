/**
 * Thievery/Espionage System State Management
 * Manages scum operations: scout, steal, sabotage, burn
 * Uses shared mechanics for all calculations
 */

import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import {
  calculateDetectionRate,
  calculateTheftAmount,
  calculateScumCasualties,
  THIEVERY_MECHANICS
} from '../../../shared/mechanics/thievery-mechanics';
import type { ThieveryResult } from '../../../shared/mechanics/thievery-mechanics';

export type OperationType = 'scout' | 'steal' | 'sabotage' | 'burn';

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
        // Load scum counts from localStorage (consistent with kingdomStore pattern)
        const stored = localStorage.getItem(`kingdom-${kingdomId}`);
        let scumCount = 0;
        let eliteScumCount = 0;

        if (stored) {
          try {
            const data = JSON.parse(stored);
            const units = data.units || [];
            // Look for scum-type units in the kingdom's unit roster
            for (const unit of units) {
              const unitType = (unit.type || '').toLowerCase();
              if (unitType === 'scum' || unitType === 'green_scum' || unitType === 'scouts') {
                scumCount += unit.count || 0;
              }
              if (unitType === 'elite_scum' || unitType === 'assassins') {
                eliteScumCount += unit.count || 0;
              }
            }
          } catch {
            // Fallback defaults if parse fails
          }
        }

        set({
          scumCount,
          eliteScumCount,
          race,
          error: null,
        });
      },

      /**
       * Execute an espionage operation against a target kingdom
       */
      executeOperation: (
        type: OperationType,
        targetId: string,
        targetName: string,
        targetScum: number,
        targetRace: string,
        targetGold: number,
        spendTurnsFn: (amount: number) => boolean
      ): ThieveryOperation | null => {
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
        const greenCasualties = calculateScumCasualties(
          state.scumCount, 'green', operationKey, state.race
        );
        const eliteCasualties = calculateScumCasualties(
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

        // Update scum counts after casualties
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
