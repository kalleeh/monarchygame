/**
 * Restoration System State Management
 * Tracks kingdom restoration state after severe damage or elimination.
 * Uses shared restoration mechanics for damage assessment and status calculation.
 */

import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import {
  assessDamageForRestoration,
  calculateRestorationStatus,
  RESTORATION_MECHANICS,
} from '../../../shared/mechanics/restoration-mechanics';
import { isDemoMode } from '../utils/authMode';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

type RestorationType = 'damage_based' | 'death_based' | 'none';

export const useRestorationStore = create(
  combine(
    {
      // Core restoration state
      isInRestoration: false,
      restorationType: 'none' as RestorationType,
      restorationStartTime: null as Date | null,
      restorationEndTime: null as Date | null,
      allowedActions: [] as string[],
      prohibitedActions: [] as string[],
    },
    (set, get) => ({
      /**
       * Check if restoration should trigger after an attack.
       * Uses shared assessDamageForRestoration to evaluate damage.
       */
      checkRestoration: (
        preAttack: { structures: number; population: number; criticalBuildings: string[] },
        postAttack: { structures: number; population: number; criticalBuildings: string[] }
      ) => {
        const assessment = assessDamageForRestoration(preAttack, postAttack);

        if (assessment.qualifiesForRestoration && assessment.restorationType !== 'none') {
          // Auto-start restoration if damage qualifies
          const type = assessment.restorationType;
          const now = new Date();
          const status = calculateRestorationStatus(now, type);

          set({
            isInRestoration: true,
            restorationType: type,
            restorationStartTime: status.startTime,
            restorationEndTime: status.endTime,
            allowedActions: status.allowedActions,
            prohibitedActions: status.prohibitedActions,
          });
        }

        return assessment;
      },

      /**
       * Manually start a restoration period of the given type.
       * Sets timer duration based on type (48h damage, 72h death).
       */
      startRestoration: (type: 'damage_based' | 'death_based') => {
        const now = new Date();
        const durationHours =
          type === 'death_based'
            ? RESTORATION_MECHANICS.TIMING.DEATH_BASED_HOURS
            : RESTORATION_MECHANICS.TIMING.DAMAGE_BASED_HOURS;
        const endTime = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

        set({
          isInRestoration: true,
          restorationType: type,
          restorationStartTime: now,
          restorationEndTime: endTime,
          allowedActions: [...RESTORATION_MECHANICS.ALLOWED_ACTIONS],
          prohibitedActions: [...RESTORATION_MECHANICS.PROHIBITED_ACTIONS],
        });
      },

      /**
       * Check if the restoration period has ended and clear state if so.
       * Should be called periodically (e.g., on tick or when checking actions).
       */
      updateRestoration: () => {
        const { isInRestoration, restorationEndTime } = get();

        if (!isInRestoration || !restorationEndTime) return;

        const now = new Date();
        if (now >= restorationEndTime) {
          set({
            isInRestoration: false,
            restorationType: 'none',
            restorationStartTime: null,
            restorationEndTime: null,
            allowedActions: [],
            prohibitedActions: [],
          });
        }
      },

      /**
       * Check whether a specific action is permitted during restoration.
       * Returns true if not in restoration, or if the action is in the allowed list.
       */
      isActionAllowed: (action: string): boolean => {
        const { isInRestoration, prohibitedActions } = get();

        if (!isInRestoration) return true;

        return !prohibitedActions.includes(action);
      },

      /**
       * Get remaining restoration hours (useful for UI display).
       */
      getRemainingHours: (): number => {
        const { isInRestoration, restorationEndTime } = get();

        if (!isInRestoration || !restorationEndTime) return 0;

        const now = new Date();
        return Math.max(0, (restorationEndTime.getTime() - now.getTime()) / (60 * 60 * 1000));
      },

      /**
       * Clear restoration state manually (e.g., for testing or admin override).
       */
      clearRestoration: () => {
        set({
          isInRestoration: false,
          restorationType: 'none',
          restorationStartTime: null,
          restorationEndTime: null,
          allowedActions: [],
          prohibitedActions: [],
        });
      },

      /**
       * Load restoration status from server in auth mode.
       * Queries the RestorationStatus model for the given kingdom.
       */
      loadRestorationFromServer: async (kingdomId: string) => {
        if (isDemoMode()) return;

        try {
          const { data } = await client.models.RestorationStatus.list({
            filter: { kingdomId: { eq: kingdomId } }
          });

          if (data && data.length > 0) {
            const status = data[0];
            const endTime = new Date(status.endTime);

            // Check if restoration has already ended
            if (new Date() >= endTime) {
              // Clean up expired restoration
              await client.models.RestorationStatus.delete({ id: status.id });
              set({
                isInRestoration: false,
                restorationType: 'none',
                restorationStartTime: null,
                restorationEndTime: null,
                allowedActions: [],
                prohibitedActions: [],
              });
              return;
            }

            set({
              isInRestoration: true,
              restorationType: status.type as RestorationType,
              restorationStartTime: new Date(status.startTime),
              restorationEndTime: endTime,
              allowedActions: status.allowedActions ? JSON.parse(status.allowedActions as string) : [],
              prohibitedActions: status.prohibitedActions ? JSON.parse(status.prohibitedActions as string) : [],
            });
          } else {
            set({
              isInRestoration: false,
              restorationType: 'none',
              restorationStartTime: null,
              restorationEndTime: null,
              allowedActions: [],
              prohibitedActions: [],
            });
          }
        } catch (error) {
          console.error('Failed to load restoration status:', error);
        }
      },

      /**
       * Check if an action is allowed, with server verification in auth mode.
       * In auth mode, the server enforces blocking — this is a client-side hint.
       */
      isActionAllowedWithServerCheck: async (action: string, kingdomId: string): Promise<boolean> => {
        if (isDemoMode()) {
          return get().isActionAllowed(action);
        }

        // In auth mode, refresh from server first
        await get().loadRestorationFromServer(kingdomId);
        return get().isActionAllowed(action);
      },
    })
  )
);
