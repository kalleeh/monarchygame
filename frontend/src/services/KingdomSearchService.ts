import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { isDemoMode } from '../utils/authMode';
import { getClient } from '../utils/amplifyClient';

export interface KingdomPage {
  kingdoms: Array<{
    id: string;
    name: string;
    race: string;
    owner?: string;
    resources: { gold: number; population: number; land: number; turns: number };
    stats: Record<string, number>;
    totalUnits: { peasants: number; militia: number; knights: number; cavalry: number };
    isOnline: boolean;
    lastActive?: Date;
    guildId?: string;
    networth: number;
  }>;
  nextToken: string | null;
  total?: number;
}

export class KingdomSearchService {
  /**
   * Load a page of kingdoms sorted by networth (descending).
   * In demo mode returns null so the caller falls back to local data.
   */
  static async listByNetworth(opts: {
    limit?: number;
    nextToken?: string | null;
    nameSearch?: string;
    race?: string;
    minNetworth?: number;
    maxNetworth?: number;
  }): Promise<KingdomPage | null> {
    if (isDemoMode()) return null;
    const { limit = 50, nextToken, nameSearch, race, minNetworth, maxNetworth } = opts;

    // Build AppSync filter — active kingdoms only; AI kingdoms are valid leaderboard competition
    // Note: name search is done client-side for case-insensitive matching
    const filter: Record<string, unknown> = { isActive: { eq: true } };
    if (race) filter.race = { eq: race };
    if (minNetworth != null || maxNetworth != null) {
      const nwFilter: Record<string, number> = {};
      if (minNetworth != null) nwFilter.gte = minNetworth;
      if (maxNetworth != null) nwFilter.lte = maxNetworth;
      filter.networth = nwFilter;
    }

    try {
      const { data, nextToken: nt } = await getClient().models.Kingdom.list({
        filter: filter as Parameters<ReturnType<typeof generateClient<Schema>>['models']['Kingdom']['list']>[0]['filter'],
        limit,
        nextToken: nextToken ?? undefined,
      });

      return {
        kingdoms: [...(data ?? [])].map(k => {
          const res: Record<string, number> =
            typeof k.resources === 'string' ? JSON.parse(k.resources) : (k.resources ?? {});
          const units: Record<string, number> =
            typeof k.totalUnits === 'string' ? JSON.parse(k.totalUnits) : (k.totalUnits ?? {});
          const rawStats = (k.stats ?? {}) as Record<string, unknown>;
          return {
            id: k.id,
            name: k.name ?? 'Unknown',
            race: k.race ?? 'Human',
            owner: k.owner ?? undefined,
            resources: {
              gold: res.gold ?? 0,
              population: res.population ?? 0,
              land: res.land ?? 0,
              turns: res.turns ?? 0,
            },
            stats: {
              warOffense: Number(rawStats.warOffense ?? 0),
              warDefense: Number(rawStats.warDefense ?? 0),
              sorcery: Number(rawStats.sorcery ?? 0),
              scum: Number(rawStats.scum ?? 0),
              forts: Number(rawStats.forts ?? 0),
              tithe: Number(rawStats.tithe ?? 0),
              training: Number(rawStats.training ?? 0),
              siege: Number(rawStats.siege ?? 0),
              economy: Number(rawStats.economy ?? 0),
              building: Number(rawStats.building ?? 0),
              previousSeasonRank: rawStats.previousSeasonRank != null ? Number(rawStats.previousSeasonRank) : 0,
              previousSeasonNetworth: rawStats.previousSeasonNetworth != null ? Number(rawStats.previousSeasonNetworth) : 0,
              previousSeasonNumber: rawStats.previousSeasonNumber != null ? Number(rawStats.previousSeasonNumber) : 0,
            },
            totalUnits: {
              peasants: units.peasants ?? 0,
              militia: units.militia ?? 0,
              knights: units.knights ?? 0,
              cavalry: units.cavalry ?? 0,
            },
            isOnline: k.isOnline ?? false,
            lastActive: k.lastActive ? new Date(k.lastActive) : undefined,
            guildId: k.guildId ?? undefined,
            networth: k.networth ?? 0,
          };
        }).filter(k => {
          if (!nameSearch?.trim()) return true;
          return k.name.toLowerCase().includes(nameSearch.trim().toLowerCase());
        }).sort((a, b) => {
          return (b.networth ?? 0) - (a.networth ?? 0);
        }),
        nextToken: nt ?? null,
      };
    } catch (err) {
      console.error('[KingdomSearchService] listByNetworth error:', err);
      return null;
    }
  }

  /** Search kingdoms by name prefix — for autocomplete. Returns up to 10. */
  static async searchByName(namePrefix: string, limit = 10): Promise<KingdomPage['kingdoms']> {
    if (isDemoMode() || !namePrefix.trim()) return [];
    const result = await KingdomSearchService.listByNetworth({ nameSearch: namePrefix, limit });
    return result?.kingdoms ?? [];
  }
}
