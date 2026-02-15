/**
 * Central Game Configuration Constants
 *
 * All game-balancing numbers live here so they can be tuned in one place.
 * Grouped by subsystem for easy navigation.
 */

// ---------------------------------------------------------------------------
// Resource generation (per time-travel tick)
// ---------------------------------------------------------------------------
export const RESOURCE_GENERATION = {
  /** Base gold income per tick */
  BASE_INCOME_PER_TICK: 1000,
  /** Base population growth per tick */
  BASE_POPULATION_GROWTH: 10,
  /** Land auto-growth per tick (currently none) */
  LAND_GROWTH: 0,
  /** Turns granted per hour */
  TURNS_PER_HOUR: 3,
} as const;

// ---------------------------------------------------------------------------
// Default starting resources (fallback when race data is unavailable)
// ---------------------------------------------------------------------------
export const DEFAULT_STARTING_RESOURCES = {
  gold: 2000,
  population: 1000,
  land: 500,
  turns: 50,
} as const;

// ---------------------------------------------------------------------------
// Networth calculation weights
// ---------------------------------------------------------------------------
export const NETWORTH = {
  /** Gold pieces per acre of land when calculating networth */
  LAND_VALUE: 1000,
  /** Value multiplier per unit when calculating networth */
  UNIT_VALUE: 100,
} as const;

// ---------------------------------------------------------------------------
// AI kingdom generation
// ---------------------------------------------------------------------------
export const AI_KINGDOM = {
  /** Minimum networth used as baseline when generating AI kingdoms */
  MINIMUM_NETWORTH: 100_000,
  /** Each acre of land is worth this much when deriving AI base resources */
  LAND_WORTH: 1000,
} as const;

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------
export const COMBAT = {
  /** Gold looted per acre of land gained in combat */
  GOLD_LOOTED_PER_ACRE: 1000,
} as const;

// ---------------------------------------------------------------------------
// Diplomacy
// ---------------------------------------------------------------------------
export const DIPLOMACY = {
  /** Treaty duration in days */
  TREATY_EXPIRATION_DAYS: 30,
} as const;

// ---------------------------------------------------------------------------
// Rate limiting (client-side token-bucket configs per action type)
// ---------------------------------------------------------------------------
export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number;
  refillInterval: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'combat-processor':     { maxTokens: 2, refillRate: 1, refillInterval: 5000 },
  'resource-manager':     { maxTokens: 3, refillRate: 1, refillInterval: 3000 },
  'building-constructor': { maxTokens: 5, refillRate: 1, refillInterval: 2000 },
  'unit-trainer':         { maxTokens: 5, refillRate: 1, refillInterval: 2000 },
  'spell-caster':         { maxTokens: 3, refillRate: 1, refillInterval: 4000 },
  'territory-claimer':    { maxTokens: 2, refillRate: 1, refillInterval: 5000 },
  'season-manager':       { maxTokens: 5, refillRate: 1, refillInterval: 3000 },
  'war-manager':          { maxTokens: 2, refillRate: 1, refillInterval: 5000 },
  'trade-processor':      { maxTokens: 3, refillRate: 1, refillInterval: 4000 },
  'diplomacy-processor':  { maxTokens: 3, refillRate: 1, refillInterval: 4000 },
  'season-lifecycle':     { maxTokens: 1, refillRate: 1, refillInterval: 10000 },
};

// ---------------------------------------------------------------------------
// Auth / session retry
// ---------------------------------------------------------------------------
export const AUTH = {
  /** Milliseconds between auth-session retries */
  SESSION_RETRY_DELAY_MS: 2000,
} as const;
