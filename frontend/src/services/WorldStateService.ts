/**
 * World State Service — Manages fog of war and kingdom visibility.
 * In auth mode, queries the WorldState model via GraphQL.
 * In demo mode, returns full visibility.
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { isDemoMode } from '../utils/authMode';

const client = generateClient<Schema>();

export interface WorldStateData {
  seasonId: string;
  kingdomId: string;
  visibleKingdoms: string[];
  fogOfWar: Record<string, boolean>;
  lastUpdated: string;
}

export class WorldStateService {
  /**
   * Get the current world state for a kingdom.
   * In demo mode, returns full visibility.
   */
  static async getWorldState(kingdomId: string, seasonId: string): Promise<WorldStateData> {
    if (isDemoMode()) {
      return {
        seasonId: 'demo-season',
        kingdomId,
        visibleKingdoms: [], // Demo mode: all visible
        fogOfWar: {},
        lastUpdated: new Date().toISOString()
      };
    }

    try {
      const { data, errors } = await client.queries.getWorldState({
        kingdomId,
        seasonId
      });

      if (errors && errors.length > 0) {
        console.error('WorldState query errors:', errors);
        throw new Error(errors.map(e => e.message).join(', '));
      }

      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return parsed as WorldStateData;
    } catch (error) {
      console.error('Failed to fetch world state:', error);
      // Fallback to full visibility on error
      return {
        seasonId,
        kingdomId,
        visibleKingdoms: [],
        fogOfWar: {},
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Update visibility for a kingdom (e.g., after scouting).
   * No-op in demo mode.
   */
  static async updateVisibility(
    kingdomId: string,
    seasonId: string,
    newVisibleKingdoms: string[]
  ): Promise<void> {
    if (isDemoMode()) return;

    try {
      // Find existing world state
      const { data: existing } = await client.models.WorldState.list({
        filter: {
          kingdomId: { eq: kingdomId },
          seasonId: { eq: seasonId }
        }
      });

      const currentVisible = existing?.[0]?.visibleKingdoms
        ? JSON.parse(existing[0].visibleKingdoms as string)
        : [];
      const merged = [...new Set([...currentVisible, ...newVisibleKingdoms])];

      if (existing && existing.length > 0) {
        await client.models.WorldState.update({
          id: existing[0].id,
          visibleKingdoms: JSON.stringify(merged),
          lastUpdated: new Date().toISOString()
        });
      } else {
        await client.models.WorldState.create({
          kingdomId,
          seasonId,
          visibleKingdoms: JSON.stringify(merged),
          fogOfWar: JSON.stringify({}),
          lastUpdated: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Failed to update visibility:', error);
    }
  }
}
