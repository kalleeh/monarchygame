/**
 * DynamoDB deserialization helpers.
 *
 * DynamoDB stores composite Kingdom fields (resources, stats, totalUnits) as JSON
 * strings — or, in demo/observeQuery paths, as already-parsed objects. These helpers
 * normalize both shapes into typed values with safe fallbacks, replacing the ad-hoc
 * `typeof x === 'string' ? JSON.parse(x) : (x ?? {})` + `as Record<...>` casts scattered
 * across stores and components.
 */

import type { KingdomResources } from '../../../shared/types/kingdom-resources';

/** Parse an unknown DynamoDB field that may be a JSON string or an object. */
function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') return value as Record<string, unknown>;
  return {};
}

/**
 * Parse a kingdom `resources` field into a fully-populated KingdomResources.
 * Required numeric fields (gold/population/land/turns) always default to 0 so the
 * result satisfies the canonical type even for pre-migration records.
 */
export function parseKingdomResources(resources: unknown): KingdomResources {
  const p = parseJsonObject(resources);
  const num = (v: unknown): number | undefined => (v == null ? undefined : Number(v) || 0);
  return {
    gold: num(p.gold) ?? 0,
    population: num(p.population) ?? 0,
    land: num(p.land) ?? 0,
    turns: num(p.turns) ?? 0,
    ...(p.mana != null ? { mana: Number(p.mana) || 0 } : {}),
    ...(p.elan != null ? { elan: Number(p.elan) || 0 } : {}),
  };
}

/** Parse a kingdom `stats` field into a plain numeric record (all values coerced to number). */
export function parseKingdomStats(stats: unknown): Record<string, number> {
  const p = parseJsonObject(stats);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))) {
      out[k] = Number(v);
    }
  }
  return out;
}

/** Parse a kingdom `totalUnits` field into a numeric record keyed by unit type. */
export function parseKingdomUnits(totalUnits: unknown): Record<string, number> {
  const p = parseJsonObject(totalUnits);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(p)) {
    out[k] = Number(v) || 0;
  }
  return out;
}
