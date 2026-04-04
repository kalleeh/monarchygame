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
  terrainEmoji,
  terrainModSummary,
  getRegionTerrain,
  getTerritoryImage,
  isAdjacentToPlayer,
  isContested,
  isInFogOfWar,
  claimCost,
} from './worldmap/KingdomNode';
import './WorldMapMobile.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorldMapMobileProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
}

// ─── Production rates by territory type ───────────────────────────────────────

interface ProductionRate {
  gold: number;
  pop: number;
  land: number;
}

const PRODUCTION_BY_TYPE: Record<string, ProductionRate> = {
  capital:    { gold: 40,  pop: 50,  land: 80  },
  settlement: { gold: 20,  pop: 30,  land: 50  },
  outpost:    { gold: 10,  pop: 10,  land: 30  },
  fortress:   { gold: 5,   pop: 0,   land: 0   },
};

// ─── Territory category groupings ─────────────────────────────────────────────

type TerritoryCategory = 'owned' | 'available' | 'contested' | 'fog';

interface CategorisedRegion {
  region: RegionSlot;
  category: TerritoryCategory;
  terrain: string;
  isSettling: boolean;
  turnsRemaining?: number;
  completesAt?: string;
}

// ─── Helper: type display label ───────────────────────────────────────────────

function typeLabel(type: string): string {
  switch (type) {
    case 'capital':    return 'Capital';
    case 'settlement': return 'Settlement';
    case 'fortress':   return 'Fortress';
    case 'outpost':    return 'Outpost';
    default:           return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

// ─── Individual territory card ────────────────────────────────────────────────

interface CardProps {
  item: CategorisedRegion;
  playerPositions: { x: number; y: number }[];
  resources: { gold: number; turns: number };
  onSendSettlers: (region: RegionSlot) => void;
  onAttack: () => void;
}

function settlingCountdown(completesAt: string): string {
  const msRemaining = new Date(completesAt).getTime() - Date.now();
  if (msRemaining <= 0) return 'arriving soon';
  const totalMinutes = Math.ceil(msRemaining / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}min`;
}

const TerritoryCard: React.FC<CardProps> = ({
  item,
  playerPositions,
  resources,
  onSendSettlers,
  onAttack,
}) => {
  const { region, category, terrain, isSettling, turnsRemaining, completesAt } = item;
  const prod = PRODUCTION_BY_TYPE[region.type] ?? { gold: 0, pop: 0, land: 0 };
  const terrainMod = terrainModSummary(terrain);
  const emoji = terrainEmoji(terrain);
  const img = getTerritoryImage(region.name, region.type);

  const cardClass = [
    'wm-mobile-card',
    category === 'owned'     ? 'card-owned'     : '',
    category === 'available' ? 'card-available'  : '',
    category === 'contested' ? 'card-contested'  : '',
    category === 'fog'       ? 'card-fog'        : '',
    isSettling               ? 'card-settling'   : '',
  ].filter(Boolean).join(' ');

  // Status badge
  let statusBadgeClass = 'wm-badge ';
  let statusText = '';
  if (category === 'owned') {
    statusBadgeClass += 'wm-badge-owned';
    statusText = '\u265A Owned';
  } else if (isSettling) {
    statusBadgeClass += 'wm-badge-settling';
    statusText = completesAt
      ? `\u2691 Settling — ${settlingCountdown(completesAt)}`
      : `\u2691 Settling (${turnsRemaining}t)`;
  } else if (category === 'available') {
    statusBadgeClass += 'wm-badge-unclaimed';
    statusText = '\u25CB Unclaimed';
  } else if (category === 'contested') {
    statusBadgeClass += 'wm-badge-contested';
    statusText = '\u2694 Contested';
  } else {
    statusBadgeClass += 'wm-badge-fog';
    statusText = '??? Fog';
  }

  // Claim cost for available territories
  let costLine: string | null = null;
  if (category === 'available' && !isSettling) {
    const cost = claimCost(region, playerPositions);
    costLine = `Cost: ${cost.gold.toLocaleString()}g · ${cost.turns}t dispatch · ${cost.settlingTurns}t to settle`;
    const canAfford = resources.gold >= cost.gold && resources.turns >= cost.turns;
    if (!canAfford) {
      costLine += ' (insufficient resources)';
    }
  }

  // Action button
  let actionEl: React.ReactNode = null;
  if (category === 'owned') {
    const ownedTerritories = useTerritoryStore.getState().ownedTerritories;
    const territory = ownedTerritories.find(t => t.regionId === region.id);
    const upgradeCost = territory ? useTerritoryStore.getState().getUpgradeCost(territory.id) : null;
    const canAfford = territory ? useTerritoryStore.getState().canAffordUpgrade(territory.id) : false;
    const isSettlingTerritory = territory?.serverConfirmed === false;

    actionEl = territory ? (
      <button
        className="wm-territory-action wm-action-upgrade"
        disabled={!canAfford || isSettlingTerritory}
        onClick={() => void useTerritoryStore.getState().upgradeTerritory(territory.id)}
      >
        {isSettlingTerritory
          ? '⏳ Settling...'
          : canAfford && upgradeCost
            ? `Upgrade to Lv.${(territory.defenseLevel ?? 0) + 1} · 💰${Math.floor(upgradeCost.gold).toLocaleString()}`
            : 'Insufficient Gold'}
      </button>
    ) : (
      <button className="wm-territory-action wm-action-upgrade" disabled>
        Upgrade
      </button>
    );
  } else if (isSettling) {
    const settlingLabel = completesAt
      ? `Settlers en route — arrives in ${settlingCountdown(completesAt)}`
      : `Settling… ${turnsRemaining}t remaining`;
    actionEl = (
      <button className="wm-territory-action wm-action-settling" disabled>
        {settlingLabel}
      </button>
    );
  } else if (category === 'available') {
    const cost = claimCost(region, playerPositions);
    const canAfford = resources.gold >= cost.gold && resources.turns >= cost.turns;
    actionEl = (
      <button
        className="wm-territory-action wm-action-settlers"
        disabled={!canAfford}
        onClick={() => onSendSettlers(region)}
      >
        Send Settlers ({cost.gold.toLocaleString()}g / {cost.turns}t)
      </button>
    );
  } else if (category === 'contested') {
    actionEl = (
      <button className="wm-territory-action wm-action-attack" onClick={onAttack}>
        Attack
      </button>
    );
  }

  return (
    <div className={cardClass}>
      {/* Name row */}
      <div className="wm-territory-name-row">
        <span className="wm-territory-name">
          {emoji} {region.name}
        </span>
        <img
          src={img}
          alt={region.type}
          style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
        />
      </div>

      {/* Badges */}
      <div className="wm-territory-badges">
        <span className={`wm-badge wm-badge-type-${region.type}`}>{typeLabel(region.type)}</span>
        <span className={statusBadgeClass}>{statusText}</span>
      </div>

      {/* Production stats — hide for fog */}
      {category !== 'fog' && (
        <div className="wm-territory-stats">
          <span className="wm-stat">💰 {prod.gold}/tick</span>
          <span className="wm-stat">👥 {prod.pop}/tick</span>
          <span className="wm-stat">🏞 {prod.land}/tick</span>
        </div>
      )}

      {/* Terrain modifier */}
      {category !== 'fog' && (
        <div className="wm-terrain-mod">{terrainMod}</div>
      )}

      {/* Claim cost */}
      {costLine && <div className="wm-claim-cost">{costLine}</div>}

      {/* Action */}
      {actionEl}
    </div>
  );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  variant: 'yours' | 'available' | 'contested' | 'fog';
  items: CategorisedRegion[];
  playerPositions: { x: number; y: number }[];
  resources: { gold: number; turns: number };
  onSendSettlers: (region: RegionSlot) => void;
  onAttack: () => void;
}

const Section: React.FC<SectionProps> = ({
  title, variant, items, playerPositions, resources, onSendSettlers, onAttack,
}) => (
  <div className="wm-mobile-section">
    <div className={`wm-mobile-section-heading ${variant}`}>
      {title}
      <span className="wm-mobile-section-count">({items.length})</span>
    </div>
    {items.length === 0 ? (
      <div className="wm-empty">None</div>
    ) : (
      items.map((item) => (
        <TerritoryCard
          key={item.region.id}
          item={item}
          playerPositions={playerPositions}
          resources={resources}
          onSendSettlers={onSendSettlers}
          onAttack={onAttack}
        />
      ))
    )}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const WorldMapMobile: React.FC<WorldMapMobileProps> = ({ kingdom, onBack }) => {
  const navigate = useNavigate();

  const ownedTerritories = useTerritoryStore((s) => s.ownedTerritories);
  const pendingSettlements = useTerritoryStore((s) => s.pendingSettlements);
  const aiKingdoms = useAIKingdomStore((s) => s.aiKingdoms);

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

  // ── Categorise all 50 regions ─────────────────────────────────────────────

  const categorised = useMemo((): CategorisedRegion[] => {
    return WORLD_REGIONS.map((region) => {
      const ownership = territoryOwnership[region.id] ?? 'neutral';
      const inFog = isInFogOfWar(region.position, playerPositions);
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

      return {
        region,
        category,
        terrain,
        isSettling: !!settling || !!serverSettling,
        turnsRemaining: settling?.turnsRemaining,
        completesAt: serverSettling?.completesAt,
      };
    });
  }, [territoryOwnership, playerPositions, pendingSettlements, serverPendingSettlements]);

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

  const handleAttack = () => {
    navigate(`/kingdom/${kingdom.id}/combat`);
  };

  // ── Resources summary for card affordability checks ───────────────────────

  const resourceSummary = {
    gold: resources.gold ?? 0,
    turns: resources.turns ?? 0,
  };

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
        <Section
          title="Your Territories"
          variant="yours"
          items={owned}
          playerPositions={playerPositions}
          resources={resourceSummary}
          onSendSettlers={handleSendSettlers}
          onAttack={handleAttack}
        />
        <Section
          title="Available to Claim"
          variant="available"
          items={available}
          playerPositions={playerPositions}
          resources={resourceSummary}
          onSendSettlers={handleSendSettlers}
          onAttack={handleAttack}
        />
        <Section
          title="Contested"
          variant="contested"
          items={contested}
          playerPositions={playerPositions}
          resources={resourceSummary}
          onSendSettlers={handleSendSettlers}
          onAttack={handleAttack}
        />
        <Section
          title="Unknown / Fog of War"
          variant="fog"
          items={fog}
          playerPositions={playerPositions}
          resources={resourceSummary}
          onSendSettlers={handleSendSettlers}
          onAttack={handleAttack}
        />
      </div>
    </div>
  );
};
