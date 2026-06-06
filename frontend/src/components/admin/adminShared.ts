/**
 * Shared helpers and types for the AdminDashboard panels.
 * Extracted from AdminDashboard.tsx so each panel can live in its own file.
 */

import type { Schema } from '../../../../amplify/data/resource';
import type { KingdomResources } from '../../../../shared/types/kingdom-resources';

export type KingdomRow = Schema['Kingdom']['type'];
export type SeasonRow = Schema['GameSeason']['type'];

export function parseResources(raw: unknown): KingdomResources {
  try {
    if (typeof raw === 'string') return { gold: 0, population: 0, land: 0, turns: 0, ...JSON.parse(raw) };
    if (raw && typeof raw === 'object') return { gold: 0, population: 0, land: 0, turns: 0, ...(raw as Record<string, number>) };
  } catch {
    /* ignore */
  }
  return { gold: 0, population: 0, land: 0, turns: 0 };
}

export function calcNetworth(res: KingdomResources): number {
  return (res.land ?? 0) * 1000 + (res.gold ?? 0);
}
