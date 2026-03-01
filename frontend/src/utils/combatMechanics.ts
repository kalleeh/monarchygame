/**
 * Shared combat calculation primitives
 * Used by combatService, aiCombatService, and combatStore.
 * Do NOT add logic here that only belongs to one consumer.
 */

import { COMBAT } from '../constants/gameConfig';

/**
 * Calculate gold looted from a successful attack.
 * Uses the authoritative COMBAT.GOLD_LOOTED_PER_ACRE constant.
 */
export function calculateGoldLoot(landGained: number): number {
  return landGained * COMBAT.GOLD_LOOTED_PER_ACRE;
}

/**
 * Apply a casualty rate to a unit count, returning whole casualties.
 */
export function applyCasualtyRate(count: number, rate: number): number {
  return Math.floor(count * rate);
}
