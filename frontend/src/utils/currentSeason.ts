/**
 * Current-season resolver — single source of truth for "which season are we in".
 *
 * Many queries (leaderboard, AI-kingdom roster, world feed) must be scoped to the
 * active season to avoid cross-season leakage: kingdoms/reports from ended seasons
 * leaking into the current game. There was no shared place to ask "what is the
 * current seasonId", so each caller either skipped the filter (the leak) or
 * re-fetched. This caches the active season id for the session and hands it out.
 *
 * In demo mode there is exactly one synthetic season ('demo-season-1'), so callers
 * can still filter consistently.
 */

import { getActiveSeason } from '../services/domain/SeasonService';

let cachedSeasonId: string | null = null;
let inflight: Promise<string | null> | null = null;

/**
 * Resolve the active season id, caching it for the session. Returns null only if
 * no active season can be resolved (e.g. season service unavailable) — callers
 * should treat null as "don't filter" rather than "no results".
 *
 * @param kingdomId optional kingdom to scope the lookup; the season service returns
 *   the globally-active season regardless, so any id (or 'current') works.
 */
export async function getCurrentSeasonId(kingdomId?: string): Promise<string | null> {
  if (cachedSeasonId) return cachedSeasonId;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const result = await getActiveSeason(kingdomId ?? 'current');
      const id = result?.success ? result.season?.id ?? null : null;
      if (id) cachedSeasonId = id;
      return id;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Synchronously read the cached season id without triggering a fetch. */
export function getCachedSeasonId(): string | null {
  return cachedSeasonId;
}

/**
 * Clear the cached season id. Call when the active season changes (season
 * rollover) or on sign-out so the next lookup re-resolves.
 */
export function clearCurrentSeasonCache(): void {
  cachedSeasonId = null;
  inflight = null;
}
