/**
 * useKingdom Hook - Centralized kingdom data access
 * Ensures all components use the same resource state
 */

import { useMemo } from 'react';
import { useKingdomStore } from '../stores/kingdomStore';
import type { Schema } from '../../../amplify/data/resource';

interface KingdomData {
  id: string;
  name: string;
  race: string;
  resources: {
    gold: number;
    population: number;
    land: number;
    turns: number;
  };
  stats: Record<string, unknown>;
  totalUnits: Record<string, unknown>;
  owner: string;
  isOnline: boolean;
  lastActive: string;
  allianceId: string | null;
}

/**
 * Hook to get current kingdom data with live resources
 * @param staticKingdom - The static kingdom prop (for ID, name, race, etc.)
 * @returns Kingdom data with live resources from centralized store
 */
export function useKingdom(staticKingdom: Schema['Kingdom']['type']): KingdomData {
  const resources = useKingdomStore((state) => state.resources);

  // Destructure stable scalar fields so useMemo only re-runs when actual values change,
  // not because the staticKingdom object reference was replaced with equivalent data.
  const { id, name, race, stats, totalUnits, owner, isOnline, lastActive } = staticKingdom;
  const allianceId = (staticKingdom as unknown as { allianceId?: string | null }).allianceId ?? null;

  return useMemo(() => ({
    id,
    name,
    race: race || 'Human',
    resources: {
      gold: resources.gold || 0,
      population: resources.population || 0,
      land: resources.land || 0,
      turns: resources.turns || 0
    },
    stats: (stats as Record<string, unknown>) || {},
    totalUnits: (totalUnits as Record<string, unknown>) || {},
    owner: owner || 'current-player',
    isOnline: isOnline || true,
    lastActive: lastActive || new Date().toISOString(),
    allianceId
  }), [
    id, name, race, stats, totalUnits, owner, isOnline, lastActive, allianceId,
    resources.gold, resources.population, resources.land, resources.turns
  ]);
}
