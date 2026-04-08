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
import { updateFaith } from '../services/domain/FaithService';
import { ToastService } from '../services/toastService';
import { isDemoMode } from '../utils/authMode';
import { STORAGE_KEYS } from '../constants/storageKeys';

// --- localStorage helpers for FP persistence ---
const FP_STORAGE_KEY = STORAGE_KEYS.FAITH_FP;

interface PersistedFP {
  focusPoints: number;
  lastFocusRegenTime: string; // ISO string
}

function loadPersistedFP(kingdomId: string): PersistedFP | null {
  if (!kingdomId) return null;
  try {
    const raw = isDemoMode() ? localStorage.getItem(FP_STORAGE_KEY(kingdomId)) : null;
    return raw ? (JSON.parse(raw) as PersistedFP) : null;
  } catch {
    return null;
  }
}

function savePersistedFP(kingdomId: string, fp: number, regenTime: Date) {
  if (!kingdomId) return;
  try {
    const data: PersistedFP = { focusPoints: fp, lastFocusRegenTime: regenTime.toISOString() };
    if (isDemoMode()) { localStorage.setItem(FP_STORAGE_KEY(kingdomId), JSON.stringify(data)); }
  } catch {
    // ignore storage errors
  }
}

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
      initializeFaith: (race: string, kingdomId?: string, serverFocusPoints?: number) => {
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
        const resolvedKingdomId = kingdomId ?? '';

        // Restore persisted FP so progress survives page reloads
        const persisted = loadPersistedFP(resolvedKingdomId);
        let restoredFP = persisted ? Math.min(maxFocus, persisted.focusPoints) : 0;
        const restoredRegenTime = persisted ? new Date(persisted.lastFocusRegenTime) : new Date();

        // If the server has a higher value (from offline regen), use it
        if (serverFocusPoints !== undefined && serverFocusPoints > restoredFP) {
          restoredFP = serverFocusPoints;
          try {
            if (isDemoMode() && resolvedKingdomId) {
              localStorage.setItem('faith-fp-' + resolvedKingdomId, JSON.stringify({
                focusPoints: restoredFP,
                lastRegenTime: Date.now(),
              }));
            }
          } catch { /* no-op */ }
        }

        set({
          kingdomId: resolvedKingdomId,
          alignment: defaultAlignment,
          faithLevel: 0,
          faithPoints: 0,
          focusPoints: restoredFP,
          maxFocusPoints: maxFocus,
          focusRegenRate: regenRate,
          lastFocusRegenTime: restoredRegenTime,
          activeEffects: [],
          error: null,
        });
      },

      /**
       * Select a faith alignment, validating it against the race's compatibility.
       */
      selectAlignment: async (alignment: FaithAlignmentType, race: string) => {
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

        // In auth mode, persist alignment selection to the backend BEFORE updating local state
        const { kingdomId } = get();
        if (!isDemoMode() && kingdomId) {
          try {
            await updateFaith({
              kingdomId,
              action: 'selectAlignment',
              alignment,
            });
          } catch (err) {
            console.error('[faithStore] selectAlignment Lambda failed:', err);
            ToastService.error('Failed to save faith alignment. Please try again.');
            return;
          }
        }

        // Only update local state after Lambda confirms success (or in demo mode)
        set({ alignment, error: null });
      },

      /**
       * Generate focus points based on race and time elapsed since last regeneration.
       * Persists updated FP to localStorage so progress survives page reloads.
       */
      generateFocusPoints: (race: string) => {
        const { lastFocusRegenTime, focusPoints, maxFocusPoints, kingdomId } = get();
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
          savePersistedFP(kingdomId, newPoints, now);
        }
      },

      /**
       * Grant focus points immediately (e.g., on turn/income generation in demo mode).
       * Persists to localStorage.
       */
      grantFocusPoints: (amount: number) => {
        const { focusPoints, maxFocusPoints, kingdomId } = get();
        const newPoints = Math.min(maxFocusPoints, focusPoints + amount);
        const now = new Date();
        set({ focusPoints: newPoints, lastFocusRegenTime: now });
        savePersistedFP(kingdomId, newPoints, now);
      },

      /**
       * Use a focus ability, deducting focus points and applying the effect.
       * Returns the result of the ability usage.
       */
      useFocusAbility: async (
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

        // In auth mode, await Lambda before updating local state
        const { kingdomId } = get();
        // Map frontend SCREAMING_SNAKE_CASE ability keys to the Lambda's expected snake_case values
        const abilityTypeMap: Record<string, string> = {
          ENHANCED_RACIAL_ABILITY: 'racial_ability',
          SPELL_POWER_BOOST: 'spell_power',
          COMBAT_FOCUS: 'combat_focus',
          ECONOMIC_FOCUS: 'economic_focus',
          EMERGENCY_ACTION: 'emergency',
        };
        const lambdaAbilityType = abilityTypeMap[abilityType as string] ?? (abilityType as string).toLowerCase();

        if (!isDemoMode() && kingdomId) {
          try {
            await updateFaith({
              kingdomId,
              action: 'useFocusAbility',
              abilityType: lambdaAbilityType,
            });
          } catch (err) {
            console.error('[faithStore] useFocusAbility Lambda failed:', err);
            ToastService.error('Failed to save focus ability usage. Please try again.');
            return { success: false, reason: 'Backend save failed' };
          }
        }

        // Only deduct cost and track effect after Lambda confirms success (or in demo mode)
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

        // Persist updated FP to localStorage
        const afterState = get();
        savePersistedFP(afterState.kingdomId, afterState.focusPoints, new Date());

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
