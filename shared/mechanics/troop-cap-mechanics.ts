/**
 * Troop cap — the ceiling on cumulative gold a kingdom may invest in troops.
 *
 * In original Monarchy/Canon the cap scaled with land amount and troop buildings
 * ("Troop Cap: Based on land amount and troop buildings"), NOT a flat number. A
 * prior bug hardcoded the docs' 10,000,000 *example* as the cap for everyone, so it
 * never grew with the kingdom. This restores the scaling behaviour.
 *
 * The exact original coefficients aren't recorded in the reference material, so these
 * are a balance choice calibrated against documented kingdom sizes:
 *   - new kingdom (~100 land, 0 barracks)        -> floored at MIN (~2M)
 *   - mid kingdom (~5k land, ~1.5k barracks)      -> ~8M  (near the old flat 10M)
 *   - 30k-acre war kingdom (~10k barracks)        -> ~50M
 *
 * Shared by the frontend (display + pre-submit guard) and the unit-trainer Lambda
 * (authoritative enforcement) so the shown cap is the enforced cap.
 */

export const TROOP_CAP = {
  /** Gold of cap per acre of land. */
  GOLD_PER_LAND: 1000,
  /** Gold of cap per barracks (troop building). */
  GOLD_PER_BARRACKS: 2000,
  /** Minimum cap so new/small kingdoms can still field a starter army. */
  MIN_CAP_GOLD: 2_000_000,
} as const;

export interface TroopCapInput {
  /** Current land/acres. */
  land: number;
  /** Number of troop buildings (barracks). */
  barracks: number;
}

/**
 * Compute the troop cap (max accumulated gold spent on troops) for a kingdom.
 * Scales with land + barracks, with a floor for small kingdoms.
 */
export function calculateTroopCapGold({ land, barracks }: TroopCapInput): number {
  const scaled = Math.max(0, land) * TROOP_CAP.GOLD_PER_LAND
    + Math.max(0, barracks) * TROOP_CAP.GOLD_PER_BARRACKS;
  return Math.max(TROOP_CAP.MIN_CAP_GOLD, scaled);
}
