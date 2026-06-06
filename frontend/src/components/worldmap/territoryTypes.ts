/**
 * territoryTypes.ts
 *
 * Shared types and presentational helpers for the mobile world-map card view.
 * Extracted verbatim from WorldMapMobile.tsx (behavior-preserving).
 */

import type { RegionSlot } from './KingdomNode';

// ─── Production rates by territory type ───────────────────────────────────────

export interface ProductionRate {
  gold: number;
  pop: number;
  land: number;
}

export const PRODUCTION_BY_TYPE: Record<string, ProductionRate> = {
  capital:    { gold: 40,  pop: 50,  land: 80  },
  settlement: { gold: 20,  pop: 30,  land: 50  },
  outpost:    { gold: 10,  pop: 10,  land: 30  },
  fortress:   { gold: 5,   pop: 0,   land: 0   },
};

// ─── Territory category groupings ─────────────────────────────────────────────

export type TerritoryCategory = 'owned' | 'available' | 'contested' | 'fog';

export interface CategorisedRegion {
  region: RegionSlot;
  category: TerritoryCategory;
  terrain: string;
  isSettling: boolean;
  turnsRemaining?: number;
  completesAt?: string;
  race?: string;
  isAI?: boolean;
  power?: number;
}

// ─── Helper: type display label ───────────────────────────────────────────────

export function typeLabel(type: string): string {
  switch (type) {
    case 'capital':    return 'Capital';
    case 'settlement': return 'Settlement';
    case 'fortress':   return 'Fortress';
    case 'outpost':    return 'Outpost';
    default:           return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

// ─── Helper: settling countdown label ─────────────────────────────────────────

export function settlingCountdown(completesAt: string): string {
  const msRemaining = new Date(completesAt).getTime() - Date.now();
  if (msRemaining <= 0) return 'arriving soon';
  const totalMinutes = Math.ceil(msRemaining / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}min`;
}
