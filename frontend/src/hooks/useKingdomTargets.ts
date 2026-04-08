import { useState, useEffect, useCallback } from 'react';
import { useKingdomStore } from '../stores/kingdomStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { isDemoMode } from '../utils/authMode';
import { KingdomSearchService } from '../services/KingdomSearchService';

function usePlayerNetworth(): number {
  const resources = useKingdomStore(s => s.resources);
  const units = useKingdomStore(s => s.units);
  const totalUnits = units.reduce((sum, u) => sum + u.count, 0);
  return (resources.land ?? 0) * 1000 + (resources.gold ?? 0) + totalUnits * 100;
}

export interface TargetKingdom {
  id: string;
  name: string;
  race: string;
  resources: { gold: number; population: number; land: number; turns: number };
  networth: number;
  difficulty?: string;
  isOnline?: boolean;
}

interface UseKingdomTargetsOptions {
  range?: [number, number];
  limit?: number;
  nameSearch?: string;
  race?: string;
}

export function useKingdomTargets(opts: UseKingdomTargetsOptions = {}) {
  const { range = [0.25, 2.0], limit = 50, nameSearch, race } = opts;
  const rangeMin = range[0];
  const rangeMax = range[1];
  const playerNetworth = usePlayerNetworth();
  const aiKingdoms = useAIKingdomStore(s => s.aiKingdoms);
  const [targets, setTargets] = useState<TargetKingdom[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (append: boolean, token: string | null) => {
    if (isDemoMode()) {
      const min = playerNetworth * rangeMin;
      const max = playerNetworth * rangeMax;
      const filtered = aiKingdoms
        .filter(k => {
          const nw = (k.resources.land ?? 0) * 1000 + (k.resources.gold ?? 0);
          const nameMatch = !nameSearch || k.name.toLowerCase().includes(nameSearch.toLowerCase());
          const raceMatch = !race || k.race === race;
          const networthMatch = nameSearch ? true : (nw >= min && nw <= max);
          return networthMatch && nameMatch && raceMatch;
        })
        .slice(0, limit);
      setTargets(filtered.map(k => ({
        id: k.id,
        name: k.name,
        race: k.race,
        resources: k.resources,
        networth: (k.resources.land ?? 0) * 1000 + (k.resources.gold ?? 0),
        difficulty: k.difficulty,
        isOnline: false,
      })));
      return;
    }

    setLoading(true);
    try {
      const result = await KingdomSearchService.listByNetworth({
        minNetworth: !nameSearch && playerNetworth > 0 ? playerNetworth * rangeMin : undefined,
        maxNetworth: !nameSearch && playerNetworth > 0 ? playerNetworth * rangeMax : undefined,
        limit,
        nextToken: append ? token : null,
        nameSearch,
        race,
      });
      if (result) {
        const mapped: TargetKingdom[] = result.kingdoms.map(k => ({
          id: k.id,
          name: k.name,
          race: k.race,
          resources: k.resources,
          networth: k.networth,
          isOnline: k.isOnline,
        }));
        setTargets(prev => append ? [...prev, ...mapped] : mapped);
        setNextToken(result.nextToken);
        setHasMore(!!result.nextToken);
      }
    } finally {
      setLoading(false);
    }
  }, [playerNetworth, aiKingdoms, rangeMin, rangeMax, limit, nameSearch, race]);

  useEffect(() => {
    setNextToken(null);
    setHasMore(false);
    void load(false, null);
  }, [playerNetworth, nameSearch, race, load]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) void load(true, nextToken);
  }, [hasMore, loading, load, nextToken]);

  return { targets, loading, hasMore, loadMore };
}
