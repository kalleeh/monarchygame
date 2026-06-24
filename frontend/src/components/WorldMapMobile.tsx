/**
 * WorldMapMobile — card-list territory view for screens < 768px.
 *
 * Replaces the ReactFlow canvas on mobile where clientWidth/height can be 0
 * in headless/PWA contexts. Shows territories grouped by ownership category
 * as scrollable touch-friendly cards.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Schema } from '../../../amplify/data/resource';
import { useTerritoryStore } from '../stores/territoryStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { useScoutStore } from '../stores/scoutStore';
import { useKingdomStore } from '../stores/kingdomStore';
import { ToastService } from '../services/toastService';
import { achievementTriggers } from '../utils/achievementTriggers';
import { claimTerritory as claimTerritoryApi } from '../services/domain/TerritoryService';
import { AmplifyFunctionService } from '../services/amplifyFunctionService';
import { isDemoMode } from '../utils/authMode';
import {
  WORLD_REGIONS,
  type RegionSlot,
  hashId,
  getRegionTerrain,
  isAdjacentToPlayer,
  isContested,
  isInFogOfWar,
  claimCost,
} from './worldmap/KingdomNode';
import { SeedlingIcon, BoltIcon, FireIcon } from './ui/MenuIcons';
import type { CategorisedRegion, TerritoryCategory } from './worldmap/territoryTypes';
import { MapSection } from './worldmap/MapSection';
import './WorldMapMobile.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorldMapMobileProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export const WorldMapMobile: React.FC<WorldMapMobileProps> = ({ kingdom, onBack }) => {
  const navigate = useNavigate();

  const ownedTerritories = useTerritoryStore((s) => s.ownedTerritories);
  const pendingSettlements = useTerritoryStore((s) => s.pendingSettlements);
  const aiKingdoms = useAIKingdomStore((s) => s.aiKingdoms);
  const scoutedKingdomIds = useScoutStore((s) => s.scoutedKingdomIds);

  // Season age for atmosphere
  const seasonAge = useMemo((): 'early' | 'middle' | 'late' => {
    const age = (kingdom as Record<string, unknown>).currentAge as string | undefined;
    if (age === 'early' || age === 'middle' || age === 'late') return age;
    return 'early';
  }, [kingdom]);

  // Parse server-side pending settlements from kingdom.stats (set by territory-claimer Lambda)
  const serverPendingSettlements = useMemo((): Array<{ regionId: string | null; completesAt: string }> => {
    try {
      const raw = kingdom.stats;
      const stats: Record<string, unknown> = typeof raw === 'string'
        ? (JSON.parse(raw) as Record<string, unknown>)
        : ((raw ?? {}) as Record<string, unknown>);
      const arr = stats.pendingSettlements as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(arr)) return [];
      return arr
        .filter(ps => ps.completesAt)
        .map(ps => ({ regionId: (ps.regionId as string | null) ?? null, completesAt: ps.completesAt as string }));
    } catch {
      return [];
    }
  }, [kingdom.stats]);
  const resources = useKingdomStore((s) => s.resources);
  const addGold = useKingdomStore((s) => s.addGold);
  const addTurns = useKingdomStore((s) => s.addTurns);

  // ── Build ownership map (mirrors WorldMap.tsx logic) ──────────────────────

  const territoryOwnership = useMemo((): Record<string, 'player' | 'enemy' | 'neutral'> => {
    const ownership: Record<string, 'player' | 'enemy' | 'neutral'> = {};
    WORLD_REGIONS.forEach((r) => { ownership[r.id] = 'neutral'; });

    ownedTerritories.forEach((t, i) => {
      const byRegionId = (t as unknown as { regionId?: string }).regionId;
      if (byRegionId && WORLD_REGIONS.find(r => r.id === byRegionId)) {
        ownership[byRegionId] = 'player';
      } else {
        let assigned = 0;
        for (const r of WORLD_REGIONS) {
          if (ownership[r.id] !== 'neutral') continue;
          if (r.type === 'capital' && assigned === i) {
            ownership[r.id] = 'player';
            break;
          }
          if (r.type === 'capital') assigned++;
        }
      }
    });

    aiKingdoms.forEach((k) => {
      const h = hashId(k.id);
      const slotCount = 1 + (h % 3);
      const startIdx = h % WORLD_REGIONS.length;
      let claimed = 0;
      for (let offset = 0; offset < WORLD_REGIONS.length && claimed < slotCount; offset++) {
        const idx = (startIdx + offset) % WORLD_REGIONS.length;
        const r = WORLD_REGIONS[idx];
        if (ownership[r.id] === 'neutral') {
          ownership[r.id] = 'enemy';
          claimed++;
        }
      }
    });

    return ownership;
  }, [ownedTerritories, aiKingdoms]);

  const playerPositions = useMemo(
    () => WORLD_REGIONS
      .filter((wt) => territoryOwnership[wt.id] === 'player')
      .map((wt) => wt.position),
    [territoryOwnership],
  );

  // ── Build AI kingdom → region mapping ───────────────────────────────────────

  const aiRegionMap = useMemo((): Record<string, { ownerId: string; race: string; isAI: boolean; power: number }> => {
    const map: Record<string, { ownerId: string; race: string; isAI: boolean; power: number }> = {};
    aiKingdoms.forEach((k) => {
      const h = hashId(k.id);
      const slotCount = 1 + (h % 3);
      const startIdx = h % WORLD_REGIONS.length;
      let claimed = 0;
      for (let offset = 0; offset < WORLD_REGIONS.length && claimed < slotCount; offset++) {
        const idx = (startIdx + offset) % WORLD_REGIONS.length;
        const r = WORLD_REGIONS[idx];
        if (territoryOwnership[r.id] === 'enemy' && !map[r.id]) {
          map[r.id] = {
            ownerId: k.id,
            race: (k as unknown as Record<string, unknown>).race as string ?? 'Human',
            isAI: true,
            power: (k as unknown as Record<string, unknown>).networth as number ?? 1000,
          };
          claimed++;
        }
      }
    });
    return map;
  }, [aiKingdoms, territoryOwnership]);

  // ── Categorise all 50 regions ─────────────────────────────────────────────

  const categorised = useMemo((): CategorisedRegion[] => {
    return WORLD_REGIONS.map((region) => {
      const ownership = territoryOwnership[region.id] ?? 'neutral';
      const ownerScouted = !!aiRegionMap[region.id]?.ownerId && scoutedKingdomIds.includes(aiRegionMap[region.id].ownerId);
      const inFog = !ownerScouted && isInFogOfWar(region.position, playerPositions);
      const settling = pendingSettlements.find(
        (ps) => ps.regionId === region.id && ps.kingdomId === 'current-player',
      );
      // Also check server-side pending settlements (real 3-hour timer)
      const serverSettling = serverPendingSettlements.find(ps => ps.regionId === region.id);
      const terrain = getRegionTerrain(region.id);

      let category: TerritoryCategory;
      if (ownership === 'player') {
        category = 'owned';
      } else if (ownership === 'enemy' || isContested(region, territoryOwnership)) {
        // Enemy-owned or adjacent-to-both = contested for the player
        category = 'contested';
      } else if (inFog || !isAdjacentToPlayer(region.position, playerPositions)) {
        category = 'fog';
      } else {
        category = 'available';
      }

      const aiInfo = aiRegionMap[region.id];

      return {
        region,
        category,
        terrain,
        isSettling: !!settling || !!serverSettling,
        turnsRemaining: settling?.turnsRemaining,
        completesAt: serverSettling?.completesAt,
        race: ownership === 'player' ? (kingdom.race ?? 'Human') : aiInfo?.race,
        isAI: aiInfo?.isAI ?? false,
        power: aiInfo?.power,
      };
    });
  }, [territoryOwnership, playerPositions, pendingSettlements, serverPendingSettlements, aiRegionMap, scoutedKingdomIds, kingdom.race]);

  const owned     = categorised.filter((c) => c.category === 'owned');
  const available = categorised.filter((c) => c.category === 'available');
  const contested = categorised.filter((c) => c.category === 'contested');
  const fog       = categorised.filter((c) => c.category === 'fog');

  // ── Send settlers handler ─────────────────────────────────────────────────

  const handleSendSettlers = async (region: RegionSlot) => {
    if (isContested(region, territoryOwnership)) {
      ToastService.error('This region is contested — take it by combat');
      return;
    }
    if (!isAdjacentToPlayer(region.position, playerPositions)) {
      ToastService.error('Too far away! You can only claim regions adjacent to your existing territories.');
      return;
    }

    const cost = claimCost(region, playerPositions);
    const currentGold = resources.gold ?? 0;
    const currentTurns = resources.turns ?? 0;

    if (currentGold < cost.gold) {
      ToastService.error(`Not enough gold! Need ${cost.gold.toLocaleString()}g (you have ${currentGold.toLocaleString()}g).`);
      return;
    }
    if (currentTurns < cost.turns) {
      ToastService.error(`Not enough turns! Need ${cost.turns} turns (you have ${currentTurns}).`);
      return;
    }

    // In auth mode, call the server-side territory-claimer (no local resource mutations)
    if (!isDemoMode()) {
      try {
        const result = await claimTerritoryApi({
          kingdomId: kingdom.id,
          name: region.name,
          terrainType: getRegionTerrain(region.id) ?? 'plains',
          coordinates: region.position,
          goldCost: cost.gold,
        });
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        if (!parsed.success) {
          ToastService.error(parsed.error || 'Failed to send settlers');
          return;
        }
        void AmplifyFunctionService.refreshKingdomResources(kingdom.id);
        // Show server-side completesAt if available
        if (parsed.completesAt) {
          const msLeft = new Date(parsed.completesAt).getTime() - Date.now();
          const h = Math.floor(msLeft / 3600000);
          const m = Math.floor((msLeft % 3600000) / 60000);
          ToastService.success(`Settlers dispatched to ${region.name}! Arrives in ${h}h ${m}min.`);
        } else {
          ToastService.success(`Settlers dispatched to ${region.name}!`);
        }
        return;
      } catch {
        ToastService.error('Failed to send settlers');
        return;
      }
    }

    // Demo mode: local resource mutations
    addGold(-cost.gold);
    addTurns(-cost.turns);

    try {
      useTerritoryStore.getState().startSettlement({
        regionId: region.id,
        regionName: region.name,
        kingdomId: kingdom.id,
        turnsRemaining: cost.settlingTurns,
        totalTurns: cost.settlingTurns,
        goldRefund: Math.floor(cost.gold * 0.5),
        startedAtTurns: resources.turns ?? 0,
      });

      achievementTriggers.onTerritoryExplored(region.id);
      ToastService.success(`Settlers dispatched to ${region.name}! Arrives in ${cost.settlingTurns} turns.`);
    } catch (err) {
      addGold(cost.gold);
      addTurns(cost.turns);
      console.error('Failed to dispatch settlers:', err);
    }
  };

  const handleAttack = (item: CategorisedRegion) => {
    // The owning AI kingdom id is recorded directly on the region map.
    const targetKingdomId = aiRegionMap[item.region.id]?.ownerId;
    navigate(`/kingdom/${kingdom.id}/combat`, targetKingdomId ? { state: { targetKingdomId } } : undefined);
  };

  // ── Resources summary for card affordability checks ───────────────────────

  const resourceSummary = {
    gold: resources.gold ?? 0,
    turns: resources.turns ?? 0,
  };

  const SEASON_BANNERS: Record<string, { icon: React.ReactNode; text: string; color: string }> = {
    early: { icon: <SeedlingIcon />, text: 'Early Age — Kingdoms Grow', color: '#22c55e' },
    middle: { icon: <BoltIcon />, text: 'Middle Age — Alliances Form', color: '#f59e0b' },
    late: { icon: <FireIcon />, text: 'Late Age — War Intensifies', color: '#ef4444' },
  };
  const seasonBanner = SEASON_BANNERS[seasonAge];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="wm-mobile">
      <div className="wm-mobile-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <h1>World Map</h1>
      </div>

      <div className="wm-mobile-body">
        {/* Season atmosphere banner */}
        {seasonBanner && (
          <div style={{
            padding: '0.4rem 0.75rem',
            margin: '0 0.5rem 0.5rem',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 600,
            background: `${seasonBanner.color}15`,
            border: `1px solid ${seasonBanner.color}40`,
            color: seasonBanner.color,
            textAlign: 'center',
          }}>
            {seasonBanner.icon} {seasonBanner.text}
          </div>
        )}

        <MapSection
          title="Your Territories"
          variant="yours"
          items={owned}
          playerPositions={playerPositions}
          resources={resourceSummary}
          onSendSettlers={handleSendSettlers}
          onAttack={handleAttack}
          seasonAge={seasonAge}
        />
        <MapSection
          title="Available to Claim"
          variant="available"
          items={available}
          playerPositions={playerPositions}
          resources={resourceSummary}
          onSendSettlers={handleSendSettlers}
          onAttack={handleAttack}
          seasonAge={seasonAge}
        />
        <MapSection
          title="Contested"
          variant="contested"
          items={contested}
          playerPositions={playerPositions}
          resources={resourceSummary}
          onSendSettlers={handleSendSettlers}
          onAttack={handleAttack}
          seasonAge={seasonAge}
        />
        <MapSection
          title="Unknown / Fog of War"
          variant="fog"
          items={fog}
          playerPositions={playerPositions}
          resources={resourceSummary}
          onSendSettlers={handleSendSettlers}
          onAttack={handleAttack}
          seasonAge={seasonAge}
        />
      </div>
    </div>
  );
};
