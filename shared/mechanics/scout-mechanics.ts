/**
 * Scout-expert mechanics — map a scouter's race `scum` rating (1-5) to the
 * QUALITY of the intel they bring home: how long it stays useful and how much
 * detail it reveals. This makes a high-scum race (Centaur 5; Human/Vampire/Sidhe
 * 4) a real "designated scout" role inside a guild.
 *
 * Pure functions only — no DB / SDK / I/O. The thievery-processor Lambda imports
 * these to scale `ScoutIntel.expiresAt` and the `defenderSnapshot` detail at
 * scout time; tests import them directly.
 */

/**
 * Canonical race → scum rating (1-5), mirroring the race stat table in
 * `frontend/src/shared-races/index.ts` (the single source of truth for the
 * 1-5 stats). Duplicated here so the backend Lambda can resolve a race's scum
 * without importing frontend code. Keep in sync with that table.
 */
export const RACE_SCUM_RATING: Record<string, number> = {
  Human: 4,
  Elven: 3,
  Goblin: 2,
  Droben: 3,
  Vampire: 4,
  Elemental: 2,
  Centaur: 5,
  Sidhe: 4,
  Dwarven: 2,
  Fae: 3,
};

/** Default scum rating for an unknown/missing race (mid-tier). */
export const DEFAULT_SCUM_RATING = 3;

/** Resolve a kingdom race name to its scum rating, clamped to [1, 5]. */
export function scumRatingForRace(race: string | null | undefined): number {
  const rating = race ? RACE_SCUM_RATING[race] : undefined;
  return clampScum(rating ?? DEFAULT_SCUM_RATING);
}

function clampScum(scum: number): number {
  if (!Number.isFinite(scum)) return 1;
  return Math.max(1, Math.min(5, Math.round(scum)));
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Intel expiry window in ms, scaling monotonically with scum:
 *   scum 1 → 12h, 2 → 21h, 3 → 30h, 4 → 39h, 5 → 48h
 * (12h base + 9h per scum point above 1). Higher scum = longer-lasting intel.
 */
export function scoutIntelExpiryMs(scum: number): number {
  const s = clampScum(scum);
  return (12 + (s - 1) * 9) * HOUR_MS;
}

/** Detail tiers a scout snapshot can carry. */
export type ScoutIntelDetail = 'coarse' | 'full';

/**
 * Detail tier the scout reveals: high scum (≥ 4) brings back the exact army
 * composition + fort level ("full"); lower scum only coarse bands ("coarse").
 * The threshold puts the 4/5-scum races (Human, Vampire, Sidhe, Centaur) in the
 * full-intel tier — the designated-scout payoff.
 */
export function scoutIntelDetail(scum: number): ScoutIntelDetail {
  return clampScum(scum) >= 4 ? 'full' : 'coarse';
}

/**
 * The revealed defender numbers captured at scout time. A snapshot, not live —
 * guildmates run their own battle preview against this defense without
 * re-scouting. `detail` records the scout's intel quality; for 'coarse' the
 * numeric fields are banded (less precise) but the TS shape is identical so
 * combat-processor / frontend read it the same way.
 */
export interface DefenderSnapshot {
  detail: ScoutIntelDetail;
  totalDefense: number;       // matches previewCombat's defenderDefense math
  armyByTier: Record<string, number>;  // exact units the defender fields (combat only)
  fortLevel: number;          // buildings.fortress
  land: number;
  goldEstimate: number;       // revealed gold at scout time
  defenderName: string;
}

/**
 * Round a value to a human-readable band: the larger the number, the coarser the
 * band (nearest 1k under 10k, nearest 5k under 100k, nearest 10k above). Keeps
 * "~30k defense" readable without revealing the exact figure.
 */
export function bandNumber(value: number): number {
  if (value <= 0) return 0;
  let step: number;
  if (value < 10_000) step = 1_000;
  else if (value < 100_000) step = 5_000;
  else step = 10_000;
  return Math.round(value / step) * step;
}

/** Map a unit-type's defensive tier index to a coarse army bucket name. */
function coarseTierBucket(tierIndex: number): string {
  switch (tierIndex) {
    case 0: return 'light';
    case 1: return 'medium';
    case 2: return 'heavy';
    default: return 'elite';
  }
}

/**
 * Produce a snapshot whose precision reflects the scout's intel quality.
 * - `full`: returned unchanged (exact composition, exact gold, exact fort).
 * - `coarse`: `totalDefense` and `goldEstimate` are banded; `armyByTier` is
 *   re-keyed into coarse buckets (light/medium/heavy/elite) with banded counts;
 *   `fortLevel` is hidden (-1 sentinel = "unknown"). The TS shape is preserved
 *   so existing readers don't break.
 *
 * `tierOf` maps a unit type to its defensive tier index (the caller passes the
 * same map used to build the snapshot, keeping this module I/O-free).
 */
export function coarsenSnapshot(
  snapshot: DefenderSnapshot,
  detail: ScoutIntelDetail,
  tierOf: (unitType: string) => number,
): DefenderSnapshot {
  if (detail === 'full') {
    return { ...snapshot, detail: 'full' };
  }

  const coarseArmy: Record<string, number> = {};
  for (const [unitType, count] of Object.entries(snapshot.armyByTier)) {
    const bucket = coarseTierBucket(tierOf(unitType));
    coarseArmy[bucket] = (coarseArmy[bucket] ?? 0) + (count ?? 0);
  }
  for (const bucket of Object.keys(coarseArmy)) {
    coarseArmy[bucket] = bandNumber(coarseArmy[bucket]);
  }

  return {
    detail: 'coarse',
    totalDefense: bandNumber(snapshot.totalDefense),
    armyByTier: coarseArmy,
    fortLevel: -1,            // unknown at coarse detail
    land: bandNumber(snapshot.land),
    goldEstimate: bandNumber(snapshot.goldEstimate),
    defenderName: snapshot.defenderName,
  };
}
