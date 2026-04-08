import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  MiniMap,
  Panel,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './WorldMap.css';
import { ErrorBoundary } from './ErrorBoundary';
import type { Schema } from '../../../amplify/data/resource';
import { WorldStateService } from '../services/WorldStateService';
import { useTerritoryStore } from '../stores/territoryStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { useKingdomStore } from '../stores/kingdomStore';
import { ToastService } from '../services/toastService';
import { achievementTriggers } from '../utils/achievementTriggers';
import {
  WORLD_REGIONS,
  TerritoryNode,
  WorldStateResult,
  SelectedTerritoryInfo,
  MAP_BG_NODE,
  nodeTypes,
  hashId,
  getRegionTerrain,
  terrainEmoji,
  buildNodeStyle,
  getLandCategory,
  isInFogOfWar,
  isContested,
  isAdjacentToPlayer,
  claimCost,
  CLAIM_ADJACENCY_RADIUS,
  dist,
} from './worldmap/KingdomNode';
import { MapLegend } from './worldmap/MapLegend';
import { MapControls } from './worldmap/MapControls';
import { TopNavigation } from './TopNavigation';
import { WorldMapMobile } from './WorldMapMobile';

interface WorldMapProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

// ─── Mobile router — picks desktop or mobile view ────────────────────────────

const WorldMapContent: React.FC<WorldMapProps> = ({ kingdom, onBack }) => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (isMobile) {
    return <WorldMapMobile kingdom={kingdom} onBack={onBack} />;
  }
  return <WorldMapDesktop kingdom={kingdom} onBack={onBack} />;
};

// ─── Desktop (ReactFlow) component ───────────────────────────────────────────

const WorldMapDesktop: React.FC<WorldMapProps> = ({ kingdom, onBack }) => {
  const navigate = useNavigate();
  const ownedTerritories = useTerritoryStore((s) => s.ownedTerritories);
  const pendingSettlements = useTerritoryStore((s) => s.pendingSettlements);
  const aiKingdoms = useAIKingdomStore((s) => s.aiKingdoms);
  const resources = useKingdomStore((s) => s.resources);
  const addGold = useKingdomStore((s) => s.addGold);
  const addTurns = useKingdomStore((s) => s.addTurns);

  // ── Build ownership map ──────────────────────────────────────────────────

  /**
   * Assign Region slots to owners using regionId for accurate player detection:
   *  - Player owns slots where a Territory record has a matching regionId.
   *  - Fallback: demo territories without regionId are assigned to capital slots
   *    by index for backwards compatibility.
   *  - Each AI kingdom claims 1-3 consecutive slots starting at a hash offset.
   *  - Everything else is neutral.
   */
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

  // ── Alliance-controlled regions ──────────────────────────────────────────

  const allianceControlledRegions = useMemo((): Record<string, string> => {
    const playerGuildId = (kingdom as unknown as { guildId?: string }).guildId;
    if (!playerGuildId) return {};

    const playerOwnedRegions = WORLD_REGIONS.filter(r => territoryOwnership[r.id] === 'player');

    const controlled: Record<string, string> = {};
    for (const region of playerOwnedRegions) {
      const cluster = playerOwnedRegions.filter(
        r => dist(r.position, region.position) <= CLAIM_ADJACENCY_RADIUS
      );
      if (cluster.length >= 3) {
        for (const r of cluster) {
          controlled[r.id] = playerGuildId;
        }
      }
    }
    return controlled;
  }, [kingdom, territoryOwnership]);

  /**
   * Reverse map: which AI kingdom owns which world-territory slot?
   */
  const aiOwnerMap = useMemo((): Record<string, string> => {
    const map: Record<string, string> = {};
    aiKingdoms.forEach((k) => {
      const h = hashId(k.id);
      const slotCount = 1 + (h % 3);
      const startIdx = h % WORLD_REGIONS.length;
      const tempNeutral = { ...territoryOwnership };
      let claimed = 0;
      for (let offset = 0; offset < WORLD_REGIONS.length && claimed < slotCount; offset++) {
        const idx = (startIdx + offset) % WORLD_REGIONS.length;
        const wt = WORLD_REGIONS[idx];
        if (tempNeutral[wt.id] === 'enemy' && !map[wt.id]) {
          map[wt.id] = k.id;
          claimed++;
        }
      }
    });
    return map;
  }, [aiKingdoms, territoryOwnership]);

  // Player positions for fog-of-war calculations
  const playerPositions = useMemo((): { x: number; y: number }[] => {
    return WORLD_REGIONS
      .filter((wt) => territoryOwnership[wt.id] === 'player')
      .map((wt) => wt.position);
  }, [territoryOwnership]);

  // ── Build React Flow nodes from WORLD_REGIONS ────────────────────────

  const worldNodes = useMemo((): TerritoryNode[] => {
    return WORLD_REGIONS.map((wt) => {
      const ownership = territoryOwnership[wt.id] ?? 'neutral';
      const inFog = isInFogOfWar(wt.position, playerPositions);

      const settling = pendingSettlements.find(ps => ps.regionId === wt.id && ps.kingdomId === 'current-player');
      const enemySettling = pendingSettlements.find(ps => ps.regionId === wt.id && ps.kingdomId !== 'current-player');
      const contested = ownership === 'neutral' && isContested(wt, territoryOwnership);

      let label: string;
      let aiKingdom: (typeof aiKingdoms)[number] | undefined;

      if (inFog && (ownership === 'neutral' || ownership === 'enemy')) {
        label = '???';
        aiKingdom = undefined; // suppress kingdom details for fogged enemies
      } else if (ownership === 'enemy') {
        const ownerId = aiOwnerMap[wt.id];
        aiKingdom = aiKingdoms.find((k) => k.id === ownerId);
        label = aiKingdom ? aiKingdom.name : wt.name;
      } else if (ownership === 'player') {
        label = wt.type === 'capital' ? `\u265a ${wt.name}` : wt.name;
      } else if (settling) {
        label = `\u2691 ${wt.name} (${settling.turnsRemaining}t)`;
      } else if (enemySettling) {
        label = `\u2694 ${wt.name}`;
      } else if (contested) {
        label = `\u2694 ${wt.name}`;
      } else {
        label = wt.name;
      }

      const aiTerrainRaw =
        (aiKingdom as (typeof aiKingdom) & { terrain?: string; terrainType?: string } | undefined)?.terrain ??
        (aiKingdom as (typeof aiKingdom) & { terrain?: string; terrainType?: string } | undefined)?.terrainType;
      const terrain = getRegionTerrain(wt.id, aiTerrainRaw);

      const isFogNode = inFog && (ownership === 'neutral' || ownership === 'enemy');
      const labelWithTerrain = isFogNode ? label : `${label} ${terrainEmoji(terrain)}`;

      const style = buildNodeStyle(
        wt.type,
        ownership,
        aiKingdom?.difficulty,
        inFog && ownership === 'neutral',
        !!settling,
        !!enemySettling,
        contested,
        wt.id in allianceControlledRegions,
      );

      return {
        id: wt.id,
        position: wt.position,
        draggable: false,
        data: {
          label: labelWithTerrain,
          kingdomName:
            ownership === 'player'
              ? (kingdom.name || 'Your Kingdom')
              : ownership === 'enemy'
              ? (aiKingdom?.name ?? wt.name)
              : wt.name,
          race:
            ownership === 'player'
              ? ((kingdom.race as string) || 'Human')
              : (aiKingdom?.race ?? 'Unknown'),
          power:
            ownership === 'player'
              ? (ownedTerritories.find((t) =>
                  t.name.toLowerCase() === wt.name.toLowerCase(),
                )?.resources.land ?? 0) * 10
              : (aiKingdom?.networth ?? 0),
          isOwned: ownership === 'player',
          visibility: (ownership === 'player' ? 'full' : 'partial') as 'full' | 'partial' | 'hidden',
          resources: { gold: 0, population: 0 },
          landCategory: aiKingdom
            ? getLandCategory(aiKingdom.resources.land)
            : undefined,
          worldTerritoryId: wt.id,
          territoryType: wt.type,
          ownership,
          inFog: isFogNode,
          terrainType: terrain,
        },
        style,
      } as TerritoryNode;
    });
  }, [territoryOwnership, playerPositions, aiKingdoms, aiOwnerMap, ownedTerritories, kingdom, pendingSettlements, allianceControlledRegions]);

  const worldEdges: Edge[] = [];

  const [nodes, setNodes, onNodesChange] = useNodesState<TerritoryNode>(
    [MAP_BG_NODE as unknown as TerritoryNode, ...worldNodes],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(worldEdges);

  useEffect(() => {
    setNodes([MAP_BG_NODE as unknown as TerritoryNode, ...worldNodes]);
  }, [worldNodes, setNodes]);

  useEffect(() => {
    setEdges(worldEdges);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount; worldEdges is the initial static edge set; setEdges is a stable React Flow setter
  }, [setEdges]);

  // ── Selection state ───────────────────────────────────────────────────────

  const [selectedTerritoryNode, setSelectedTerritoryNode] = useState<TerritoryNode | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<SelectedTerritoryInfo | null>(null);

  const [_worldState, setWorldState] = useState<WorldStateResult | null>(null);

  useEffect(() => {
    const fetchWorldState = async () => {
      try {
        const seasonId = (kingdom as unknown as { seasonId?: string }).seasonId ?? '';
        if (!kingdom.id || !seasonId) return;

        const result = await WorldStateService.getWorldState(kingdom.id, seasonId);
        if (result && typeof result === 'object') {
          setWorldState(result as unknown as WorldStateResult);
        }
      } catch (err) {
        console.warn('WorldState fetch failed (using client-side visibility):', err);
      }
    };

    fetchWorldState();
  }, [kingdom]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  // ── Node click handler ────────────────────────────────────────────────────

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: { id: string; data?: unknown }) => {
    if (node.id === 'map-bg') return;

    const territory = node as TerritoryNode;
    const inFog = territory.data?.inFog ?? false;

    if (inFog) {
      setSelectedTerritoryNode(null);
      setSelectedTerritory(null);
      return;
    }

    const ownership: 'player' | 'enemy' | 'neutral' =
      territory.data?.ownership ?? (territory.data?.isOwned ? 'player' : 'neutral');

    setSelectedTerritoryNode(territory);
    setSelectedTerritory({
      id: node.id,
      label: territory.data?.label || node.id,
      type: territory.data?.territoryType || territory.data?.landCategory || 'settlement',
      isOwned: territory.data?.isOwned || false,
      ownership,
      kingdomName: territory.data?.kingdomName,
      inFog: false,
      terrainType: territory.data?.terrainType,
    });
  }, []);

  // ── Claim handler (settler dispatch) ──────────────────────────────────────

  const handleClaimTerritory = useCallback(async () => {
    if (!selectedTerritoryNode) return;
    if (selectedTerritory?.ownership !== 'neutral') return;

    const wtId = selectedTerritoryNode.data?.worldTerritoryId ?? selectedTerritoryNode.id;
    const region = WORLD_REGIONS.find(r => r.id === wtId);
    if (!region) return;

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

    setSelectedTerritoryNode(null);
    setSelectedTerritory(null);
  }, [selectedTerritoryNode, selectedTerritory, resources, addGold, addTurns, playerPositions, territoryOwnership, kingdom.id]);

  // ── Raid settlers handler ─────────────────────────────────────────────────

  const handleRaidSettlers = useCallback(() => {
    const currentTurns = resources.turns ?? 0;
    if (currentTurns < 2) {
      ToastService.error('Not enough turns to raid! Need 2 turns.');
      return;
    }
    const wtId = selectedTerritoryNode?.data?.worldTerritoryId ?? selectedTerritoryNode?.id;
    if (!wtId) return;

    addTurns(-2);
    const result = useTerritoryStore.getState().raidSettlement(wtId);
    if (result) {
      ToastService.success(`Enemy settlers routed! The region remains unclaimed.`);
    } else {
      addTurns(2);
      ToastService.error('No enemy settlers found in this region.');
    }
    setSelectedTerritoryNode(null);
    setSelectedTerritory(null);
  }, [selectedTerritoryNode, resources.turns, addTurns]);

  const handleClosePanel = useCallback(() => {
    setSelectedTerritoryNode(null);
    setSelectedTerritory(null);
  }, []);

  const handleAttackTerritory = useCallback((_territoryId: string) => {
    navigate(`/kingdom/${kingdom.id}/combat`);
  }, [navigate, kingdom.id]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="world-map">
      <TopNavigation
        title="World Map"
        onBack={onBack}
        backLabel="← Back to Kingdom"
        kingdomId={kingdom.id}
      />

      <div className="map-container">
        <MapLegend allianceControlledRegions={allianceControlledRegions} />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 560, y: 420, zoom: 0.09 }}
          attributionPosition="bottom-left"
          style={{ background: 'var(--gm-bg-page)' }}
        >
          <Controls style={{ backgroundColor: 'rgba(15,22,41,0.92)', border: '1px solid rgba(255,255,255,0.12)' }} />
          <MiniMap
            nodeColor={(node) => {
              if (node.id === 'map-bg') return 'transparent';
              const t = node as TerritoryNode;
              if (t.data.inFog) return '#111';
              const settling = pendingSettlements.find(ps => ps.regionId === t.id);
              if (settling?.kingdomId === 'current-player') return '#b45309';
              if (settling) return '#c2410c';
              if (t.data.ownership === 'player') return '#4ade80';
              if (t.data.ownership === 'enemy') return '#dc2626';
              return '#374151';
            }}
            position="top-right"
            style={{ backgroundColor: 'rgba(15,22,41,0.92)', border: '1px solid rgba(255,255,255,0.12)' }}
          />
          <Panel
            position="top-left"
            style={{ background: 'transparent' }}
          >
            <div className="map-stats">
              <h3>Kingdom Stats</h3>
              <p>Territories: {nodes.filter((n) => n.id !== 'map-bg' && (n as TerritoryNode).data.ownership === 'player').length}</p>
              <p>
                Total Power:{' '}
                {nodes
                  .filter((n) => n.id !== 'map-bg' && (n as TerritoryNode).data.isOwned)
                  .reduce((sum, n) => sum + ((n as TerritoryNode).data.power || 0), 0)}
              </p>
            </div>
          </Panel>
        </ReactFlow>

        <MapControls
          selectedTerritory={selectedTerritory}
          selectedTerritoryNode={selectedTerritoryNode}
          allianceControlledRegions={allianceControlledRegions}
          pendingSettlements={pendingSettlements}
          resources={resources}
          playerPositions={playerPositions}
          territoryOwnership={territoryOwnership}
          handleClaimTerritory={handleClaimTerritory}
          handleRaidSettlers={handleRaidSettlers}
          onClose={handleClosePanel}
          onAttack={handleAttackTerritory}
        />
      </div>
    </div>
  );
};

const WorldMap: React.FC<WorldMapProps> = (props) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="world-map-error">
          <h2>World Map Temporarily Unavailable</h2>
          <p>We're working on getting the world map back online.</p>
          <button onClick={props.onBack}>Back to Kingdom</button>
        </div>
      }
    >
      <WorldMapContent {...props} />
    </ErrorBoundary>
  );
};

export default WorldMap;
