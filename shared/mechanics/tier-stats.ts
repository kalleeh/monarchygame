/**
 * Single source of truth for per-tier unit stats.
 *
 * Tiers 0–3 are the four military units every race fields (cheapest → elite).
 * Combat (combat-processor + combatCache), the AI strategist, unit-cost lookup,
 * and the frontend unit catalogue all read these arrays so the numbers can never
 * drift apart.
 *
 * COST CURVE (flattened): power-per-gold is held roughly constant across tiers,
 * so no tier is a strictly dominant "buy" — the real decision is unit-SLOTS
 * (higher tiers pack more power per slot, which matters under the land-based unit
 * cap) versus gold flexibility and unit-counter composition. Defense ≈ 0.75×
 * offense at each tier. Indexed by tier 0–3.
 */

export const TIER_STATS = {
  /** Attack value per unit, tier 0–3. */
  OFFENSE: [1, 7, 18, 40],
  /** Defense value per unit, tier 0–3. */
  DEFENSE: [1, 5, 13, 30],
  /** Base gold cost per unit, tier 0–3 (before race economicMultiplier). */
  GOLD: [50, 350, 900, 2000],
  /** Population cost per unit, tier 0–3. */
  POP: [1, 1, 2, 3],
  /** Hit points per unit, tier 0–3. */
  HIT_POINTS: [5, 10, 20, 35],
  /** Gold upkeep per unit/tick, tier 0–3. */
  UPKEEP: [0, 2, 5, 10],
} as const;

/** Number of military tiers (0-indexed length). */
export const TIER_COUNT = TIER_STATS.OFFENSE.length;
