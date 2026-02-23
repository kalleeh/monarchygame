/**
 * Faith and Focus Points System State Management
 * Manages faith alignment selection and focus point generation/usage.
 * Uses shared faith-focus mechanics for validation and calculations.
 */

import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import {
  getFaithBonuses as sharedGetFaithBonuses,
  canUseFaithAlignment,
  calculateFocusGeneration,
  calculateMaxFocusPoints,
  calculateFaithLevel,
  canUseFocusAbility,
  applyFocusEffect,
  FAITH_ALIGNMENTS,
  FOCUS_MECHANICS,
} from '../../../shared/mechanics/faith-focus-mechanics';
import { AmplifyFunctionService } from '../services/amplifyFunctionService';
import { isDemoMode } from '../utils/authMode';

type FaithAlignmentType = 'angelique' | 'neutral' | 'elemental' | null;

export const useFaithStore = create(
  combine(
    {
      // Kingdom identity
      kingdomId: '' as string,

      // Faith alignment state
      alignment: null as FaithAlignmentType,
      faithLevel: 0,
      faithPoints: 0,

      // Focus points state
      focusPoints: 0,
      maxFocusPoints: FOCUS_MECHANICS.BASE_GENERATION.MAX_STORAGE_BASE,
      focusRegenRate: FOCUS_MECHANICS.BASE_GENERATION.POINTS_PER_HOUR,
      lastFocusRegenTime: null as Date | null,

      // Active focus effects
      activeEffects: [] as Array<{
        effectType: string;
        enhancedValue: number;
        duration: number;
        appliedAt: number;
      }>,

      // UI state
      error: null as string | null,
    },
    (set, get) => ({
      /**
       * Initialize faith system for a given race.
       * Checks available alignments and sets a default (neutral if compatible, else first compatible).
       */
      initializeFaith: (race: string, kingdomId?: string) => {
        // Determine which alignments this race can use
        const availableAlignments = Object.keys(FAITH_ALIGNMENTS).filter((alignmentId) =>
          canUseFaithAlignment(race, alignmentId)
        );

        // Default to neutral if available, otherwise first compatible, otherwise null
        let defaultAlignment: FaithAlignmentType = null;
        if (availableAlignments.includes('neutral')) {
          defaultAlignment = 'neutral';
        } else if (availableAlignments.length > 0) {
          defaultAlignment = availableAlignments[0] as FaithAlignmentType;
        }

        const maxFocus = calculateMaxFocusPoints(race);
        const regenRate = calculateFocusGeneration(race);

        set({
          kingdomId: kingdomId ?? '',
          alignment: defaultAlignment,
          faithLevel: 0,
          faithPoints: 0,
          focusPoints: 0,
          maxFocusPoints: maxFocus,
          focusRegenRate: regenRate,
          lastFocusRegenTime: new Date(),
          activeEffects: [],
          error: null,
        });
      },

      /**
       * Select a faith alignment, validating it against the race's compatibility.
       */
      selectAlignment: (alignment: FaithAlignmentType, race: string) => {
        if (alignment === null) {
          set({ alignment: null, error: null });
          return;
        }

        if (!canUseFaithAlignment(race, alignment)) {
          set({
            error: `The ${alignment} faith alignment is not compatible with the ${race} race.`,
          });
          return;
        }

        set({ alignment, error: null });

        // In auth mode, persist alignment selection to the backend
        const { kingdomId } = get();
        if (!isDemoMode() && kingdomId) {
          AmplifyFunctionService.callFunction('faith-processor', {
            kingdomId,
            action: 'selectAlignment',
            alignment,
          }).catch(err => console.error('[faithStore] selectAlignment Lambda failed:', err));
        }
      },

      /**
       * Generate focus points based on race and time elapsed since last regeneration.
       */
      generateFocusPoints: (race: string) => {
        const { lastFocusRegenTime, focusPoints, maxFocusPoints } = get();
        const now = new Date();

        if (!lastFocusRegenTime) {
          set({ lastFocusRegenTime: now });
          return;
        }

        const hoursElapsed = Math.max(
          0,
          (now.getTime() - lastFocusRegenTime.getTime()) / (1000 * 60 * 60)
        );
        const regenRate = calculateFocusGeneration(race);
        const pointsGenerated = Math.floor(hoursElapsed * regenRate);

        if (pointsGenerated > 0) {
          const newPoints = Math.min(maxFocusPoints, focusPoints + pointsGenerated);
          set({
            focusPoints: newPoints,
            lastFocusRegenTime: now,
            focusRegenRate: regenRate,
          });
        }
      },

      /**
       * Use a focus ability, deducting focus points and applying the effect.
       * Returns the result of the ability usage.
       */
      useFocusAbility: (
        abilityType: keyof typeof FOCUS_MECHANICS.ABILITY_COSTS,
        baseValue: number = 1
      ) => {
        const { focusPoints } = get();
        const check = canUseFocusAbility(abilityType, focusPoints);

        if (!check.canUse) {
          set({ error: check.reason || 'Cannot use this ability.' });
          return { success: false, reason: check.reason };
        }

        // Map ability type to effect type
        const abilityToEffect: Record<string, keyof typeof FOCUS_MECHANICS.FOCUS_EFFECTS> = {
          ENHANCED_RACIAL_ABILITY: 'RACIAL_ABILITY_BOOST',
          SPELL_POWER_BOOST: 'SPELL_POWER_BOOST',
          COMBAT_FOCUS: 'COMBAT_FOCUS_BONUS',
          ECONOMIC_FOCUS: 'ECONOMIC_FOCUS_BONUS',
          EMERGENCY_ACTION: 'RACIAL_ABILITY_BOOST', // Emergency uses racial boost as default
        };

        const effectType = abilityToEffect[abilityType] || 'RACIAL_ABILITY_BOOST';
        const effect = applyFocusEffect(effectType, baseValue);

        // Deduct cost and track effect
        set((state) => ({
          focusPoints: state.focusPoints - check.cost,
          activeEffects: [
            ...state.activeEffects,
            {
              effectType: abilityType,
              enhancedValue: effect.enhancedValue,
              duration: effect.duration,
              appliedAt: Date.now(),
            },
          ],
          error: null,
        }));

        // In auth mode, persist focus ability usage to the backend
        const { kingdomId } = get();
        if (!isDemoMode() && kingdomId) {
          AmplifyFunctionService.callFunction('faith-processor', {
            kingdomId,
            action: 'useFocusAbility',
            abilityType,
          }).catch(err => console.error('[faithStore] useFocusAbility Lambda failed:', err));
        }

        return { success: true, effect };
      },

      /**
       * Get faith bonuses for the current alignment and faith level.
       * Wraps the shared getFaithBonuses function.
       */
      getFaithBonuses: (): Record<string, number> => {
        const { alignment, faithLevel } = get();
        if (!alignment) return {};
        return sharedGetFaithBonuses(alignment, faithLevel);
      },

      /**
       * Add faith points and recalculate faith level.
       */
      addFaithPoints: (points: number) => {
        const newPoints = get().faithPoints + points;
        const newLevel = calculateFaithLevel(newPoints);

        set({
          faithPoints: newPoints,
          faithLevel: newLevel,
        });
      },

      /**
       * Clean up expired focus effects based on their duration (in turns).
       * Called externally when turns are processed.
       */
      cleanupExpiredEffects: (currentTurnTimestamp: number) => {
        const effectDurationMs = FOCUS_MECHANICS.FOCUS_EFFECTS.EFFECT_DURATION * 60 * 1000; // approximate turn-to-ms

        set((state) => ({
          activeEffects: state.activeEffects.filter(
            (effect) => currentTurnTimestamp - effect.appliedAt < effectDurationMs
          ),
        }));
      },

      /**
       * Clear error state.
       */
      clearError: () => {
        set({ error: null });
      },

      /**
       * Reset faith state (for testing or reinitialization).
       */
      resetFaithState: () => {
        set({
          alignment: null,
          faithLevel: 0,
          faithPoints: 0,
          focusPoints: 0,
          maxFocusPoints: FOCUS_MECHANICS.BASE_GENERATION.MAX_STORAGE_BASE,
          focusRegenRate: FOCUS_MECHANICS.BASE_GENERATION.POINTS_PER_HOUR,
          lastFocusRegenTime: null,
          activeEffects: [],
          error: null,
        });
      },
    })
  )
);
