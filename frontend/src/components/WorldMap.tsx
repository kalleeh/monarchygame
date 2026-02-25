import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ErrorBoundary } from './ErrorBoundary';
import type { Schema } from '../../../amplify/data/resource';
import { AmplifyFunctionService } from '../services/amplifyFunctionService';
import { useTerritoryStore } from '../stores/territoryStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';

interface Node {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: unknown;
  style?: Record<string, unknown>;
  draggable?: boolean;
  selectable?: boolean;
  focusable?: boolean;
  zIndex?: number;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

interface WorldMapProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
}

// Fog of war visibility level for a kingdom node
type VisibilityLevel = 'full' | 'partial' | 'hidden';

interface TerritoryNode extends Node {
  data: {
    label: string;
    kingdomName: string;
    race: string;
    power: number;
    isOwned: boolean;
    visibility: VisibilityLevel;
    // Only populated for full visibility
    resources: {
      gold: number;
      population: number;
    };
    // Populated for partial visibility
    landCategory?: string;
    // World territory slot data
    worldTerritoryId?: string;
    territoryType?: string;
    ownership?: 'player' | 'enemy' | 'neutral';
    inFog?: boolean;
  };
}

// WorldState shape returned by the getWorldState query
interface WorldStateResult {
  visibleKingdoms?: string[];
  fogOfWar?: Record<string, unknown>;
}

// Detail panel state shape
interface SelectedTerritoryInfo {
  id: string;
  label: string;
  type: string;
  isOwned: boolean;
  ownership: 'player' | 'enemy' | 'neutral';
  kingdomName?: string;
  inFog?: boolean;
}

// ─── World Territory Grid ────────────────────────────────────────────────────

interface WorldTerritory {
  id: string;
  name: string;
  position: { x: number; y: number };
  type: 'capital' | 'settlement' | 'outpost' | 'fortress';
}

/**
 * 50 named territory slots mapped to the actual terrain features visible
 * on world-map-world.jpg.
 *
 * Key terrain zones:
 *  WESTERN MAINLAND  x: -7500 → +700        (large green continent, mountains, forest)
 *  CENTRAL BAY       x: +800  → +4400, y: -2000 → +1800  ← WATER — no territories here
 *  EASTERN PENINSULA x: +4500 → +6500, y: -2000 → +1800
 *  SMALL ISLAND      x: +5800 → +7000, y: +2500 → +4000
 */
const WORLD_TERRITORIES: WorldTerritory[] = [
  // ── WESTERN MAINLAND — far north, mountains (y ≈ -3500..−2800) ───────────
  { id: 'wt-01', name: 'Frostwall Keep',    position: { x: -7000, y: -3700 }, type: 'fortress'   },
  { id: 'wt-02', name: 'Ashfen Marsh',      position: { x: -5500, y: -3800 }, type: 'outpost'    },
  { id: 'wt-03', name: 'Crystalpeak',       position: { x: -3800, y: -3700 }, type: 'capital'    },
  { id: 'wt-04', name: 'Thornwood',         position: { x: -2000, y: -3600 }, type: 'settlement' },
  { id: 'wt-05', name: 'Duskwall Fortress', position: { x:  -600, y: -3500 }, type: 'fortress'   },

  // ── WESTERN MAINLAND — upper band (y ≈ -2600..−2000) ─────────────────────
  { id: 'wt-06', name: 'Rimstone Outpost',  position: { x: -6800, y: -2700 }, type: 'outpost'    },
  { id: 'wt-07', name: 'Ironhold Keep',     position: { x: -5200, y: -2500 }, type: 'capital'    },
  { id: 'wt-08', name: 'Embervale',         position: { x: -3500, y: -2600 }, type: 'settlement' },
  { id: 'wt-09', name: 'Silvergate',        position: { x: -2200, y: -2400 }, type: 'capital'    },
  { id: 'wt-10', name: 'Coldbrook Pass',    position: { x:  -800, y: -2500 }, type: 'outpost'    },

  // ── EASTERN PENINSULA — northern tip (y ≈ -2000..−1200) ──────────────────
  { id: 'wt-11', name: 'Stormhaven',        position: { x:  4800, y: -1800 }, type: 'settlement' },
  { id: 'wt-12', name: 'Galewatch Tower',   position: { x:  6000, y: -1600 }, type: 'outpost'    },

  // ── WESTERN MAINLAND — middle band (y ≈ -1400..−600) ─────────────────────
  { id: 'wt-13', name: 'Highreach Citadel', position: { x: -7200, y: -1400 }, type: 'fortress'   },
  { id: 'wt-14', name: 'Mosswick',          position: { x: -6000, y: -1100 }, type: 'outpost'    },
  { id: 'wt-15', name: 'Dunmere',           position: { x: -4500, y: -1400 }, type: 'settlement' },
  { id: 'wt-16', name: 'Amberveil',         position: { x: -3000, y: -1000 }, type: 'capital'    },
  { id: 'wt-17', name: 'Greywater Ford',    position: { x: -1500, y: -1300 }, type: 'outpost'    },
  { id: 'wt-18', name: 'Ashwood Grove',     position: { x:  -400, y:  -900 }, type: 'settlement' },

  // ── EASTERN PENINSULA — mid (y ≈ -900..0) ────────────────────────────────
  { id: 'wt-19', name: 'Redstone Crossing', position: { x:  4600, y:  -800 }, type: 'settlement' },
  { id: 'wt-20', name: 'Kindlegate',        position: { x:  5900, y:  -600 }, type: 'capital'    },

  // ── WESTERN MAINLAND — centre (y ≈ -300..+700) ───────────────────────────
  { id: 'wt-21', name: 'Ravenspire',        position: { x: -7000, y:  -300 }, type: 'outpost'    },
  { id: 'wt-22', name: 'Thornwall',         position: { x: -5500, y:  -500 }, type: 'capital'    },
  { id: 'wt-23', name: 'Ironvale',          position: { x: -4000, y:  -200 }, type: 'settlement' },
  { id: 'wt-24', name: 'Goldenfield',       position: { x: -2500, y:  -500 }, type: 'outpost'    },
  { id: 'wt-25', name: 'Crownsreach',       position: { x: -1200, y:  -200 }, type: 'capital'    },
  { id: 'wt-26', name: 'Brackenmoor',       position: { x:  -300, y:  -600 }, type: 'outpost'    },

  // ── EASTERN PENINSULA — centre (y ≈ +200..+800) ──────────────────────────
  { id: 'wt-27', name: 'Emberthorn',        position: { x:  4800, y:   400 }, type: 'capital'    },
  { id: 'wt-28', name: 'Stonemarsh Hold',   position: { x:  6000, y:   700 }, type: 'settlement' },

  // ── WESTERN MAINLAND — lower-centre (y ≈ +600..+1800) ────────────────────
  { id: 'wt-29', name: 'Fernveil',          position: { x: -7000, y:   700 }, type: 'outpost'    },
  { id: 'wt-30', name: 'Cinderport',        position: { x: -5500, y:   500 }, type: 'capital'    },
  { id: 'wt-31', name: 'Oldstone March',    position: { x: -4000, y:   800 }, type: 'settlement' },
  { id: 'wt-32', name: 'Dusthaven',         position: { x: -2600, y:   600 }, type: 'outpost'    },
  { id: 'wt-33', name: 'Mudbrook',          position: { x: -1200, y:   900 }, type: 'outpost'    },
  { id: 'wt-34', name: 'Silvershard',       position: { x:  -300, y:   600 }, type: 'settlement' },

  // ── EASTERN PENINSULA — south (y ≈ +1000..+1800) ─────────────────────────
  { id: 'wt-35', name: 'Dawnpost',          position: { x:  4600, y:  1500 }, type: 'outpost'    },
  { id: 'wt-36', name: 'Wintermere',        position: { x:  5800, y:  1500 }, type: 'settlement' },

  // ── WESTERN MAINLAND — south (y ≈ +1800..+2800) ──────────────────────────
  { id: 'wt-37', name: 'Shadowfen',         position: { x: -6600, y:  1900 }, type: 'outpost'    },
  { id: 'wt-38', name: 'Bouldercrag',       position: { x: -5200, y:  2100 }, type: 'settlement' },
  { id: 'wt-39', name: 'Saltmere',          position: { x: -3800, y:  1900 }, type: 'outpost'    },
  { id: 'wt-40', name: 'Nightfall Bastion', position: { x: -2400, y:  2200 }, type: 'fortress'   },
  { id: 'wt-41', name: 'Gildenmoor',        position: { x: -1100, y:  2000 }, type: 'capital'    },
  { id: 'wt-42', name: 'Clearwater',        position: { x:  -300, y:  2400 }, type: 'settlement' },

  // ── WESTERN MAINLAND — far south (y ≈ +2800..+4000) ──────────────────────
  { id: 'wt-43', name: 'Stonebreach',       position: { x: -6500, y:  3000 }, type: 'settlement' },
  { id: 'wt-44', name: 'Mistveil',          position: { x: -5000, y:  3200 }, type: 'outpost'    },
  { id: 'wt-45', name: 'Flamehearth',       position: { x: -3500, y:  3000 }, type: 'settlement' },
  { id: 'wt-46', name: 'Deepwatch',         position: { x: -2000, y:  3500 }, type: 'outpost'    },
  { id: 'wt-47', name: 'Irongate',          position: { x:  -500, y:  3200 }, type: 'settlement' },
  { id: 'wt-48', name: 'Cinderfall Fortress',position:{ x: -1000, y:  3900 }, type: 'fortress'   },

  // ── SMALL ISLAND — bottom right ───────────────────────────────────────────
  { id: 'wt-49', name: 'Stormveil Hold',    position: { x:  6000, y:  2900 }, type: 'capital'    },
  { id: 'wt-50', name: 'Rimfire Outpost',   position: { x:  6500, y:  3700 }, type: 'outpost'    },
];

// ─── Fog-of-war helper ───────────────────────────────────────────────────────

const FOG_RADIUS = 5000;

function isInFogOfWar(
  pos: { x: number; y: number },
  playerPositions: { x: number; y: number }[],
): boolean {
  if (playerPositions.length === 0) return false;
  return !playerPositions.some(
    (pp) =>
      Math.sqrt((pos.x - pp.x) ** 2 + (pos.y - pp.y) ** 2) < FOG_RADIUS,
  );
}

// ─── Map territory type → detail image ──────────────────────────────────────

const TERRITORY_TYPE_IMAGES: Record<string, string> = {
  capital:    '/territory-capital.png',
  settlement: '/territory-trading-post.png',
  outpost:    '/territory-forest-outpost.png',
  fortress:   '/territory-iron-mines.png',
};
const TERRITORY_IMAGES: Record<string, string> = {
  'Capital City':    '/territory-capital.png',
  'Royal Capital':   '/territory-capital.png',
  'Trading Post':    '/territory-trading-post.png',
  'Iron Mines':      '/territory-iron-mines.png',
  'Forest Outpost':  '/territory-forest-outpost.png',
  'Ancient Ruins':   '/territory-ancient-ruins.png',
};
function getTerritoryImage(label: string, type: string): string {
  return TERRITORY_IMAGES[label] ?? TERRITORY_TYPE_IMAGES[type] ?? '/territories-icon.png';
}

// ─── Deterministic hash helper ───────────────────────────────────────────────

function hashId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h) + id.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h);
}

// ─── Custom map background node ─────────────────────────────────────────────

const MapBackgroundNode = () => (
  <img
    src="/world-map-world.jpg"
    style={{
      width: '100%',
      height: '100%',
      display: 'block',
      objectFit: 'cover',
      pointerEvents: 'none',
      userSelect: 'none',
    }}
    alt="World Map"
    draggable={false}
  />
);

const nodeTypes = {
  mapBackground: MapBackgroundNode,
};

// World-scale background node — 16000×9000 units, centred at origin
const MAP_BG_NODE: Node = {
  id: 'map-bg',
  type: 'mapBackground',
  position: { x: -8000, y: -4500 },
  data: {},
  draggable: false,
  selectable: false,
  focusable: false,
  zIndex: -10,
  style: {
    width: 16000,
    height: 9000,
    pointerEvents: 'none',
    border: 'none',
    background: 'none',
    borderRadius: 0,
  },
};

// ─── Legacy helpers (retained for the existing territory-panel) ───────────────


function getLandCategory(land: number): string {
  if (land < 2000) return 'Small Kingdom';
  if (land < 5000) return 'Medium Kingdom';
  if (land < 15000) return 'Large Kingdom';
  return 'Massive Kingdom';
}

// ─── Node style builders ─────────────────────────────────────────────────────

function buildNodeStyle(
  wtType: 'capital' | 'settlement' | 'outpost' | 'fortress',
  ownership: 'player' | 'enemy' | 'neutral',
  difficulty: 'easy' | 'medium' | 'hard' | undefined,
  inFog: boolean,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    borderRadius: '8px',
    padding: '10px',
    fontSize: '11px',
    minWidth: 100,
    textAlign: 'center',
    cursor: 'pointer',
  };

  if (inFog) {
    return {
      ...base,
      background: '#000',
      border: '1px dashed #374151',
      color: '#374151',
      opacity: 0.25,
      filter: 'blur(1px)',
    };
  }

  if (ownership === 'player') {
    if (wtType === 'capital') {
      return {
        ...base,
        background: '#d4a017',
        border: '2px solid #f0c040',
        color: '#000',
        fontWeight: 700,
        padding: '12px',
      };
    }
    return {
      ...base,
      background: '#4ade80',
      border: '2px solid #16a34a',
      color: '#000',
    };
  }

  if (ownership === 'enemy') {
    const diffMap: Record<string, { bg: string; border: string }> = {
      hard:   { bg: '#dc2626', border: '2px dashed #dc2626' },
      medium: { bg: '#7c3aed', border: '2px dashed #7c3aed' },
      easy:   { bg: '#475569', border: '2px dashed #6b7280' },
    };
    const colours = diffMap[difficulty ?? 'medium'] ?? diffMap.medium;
    return {
      ...base,
      background: colours.bg,
      border: colours.border,
      color: '#fff',
      opacity: 0.85,
    };
  }

  // neutral
  return {
    ...base,
    background: '#1f2937',
    border: '1px dashed #4b5563',
    color: '#9ca3af',
    opacity: 0.75,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

const WorldMapContent: React.FC<WorldMapProps> = ({ kingdom, onBack }) => {
  const ownedTerritories = useTerritoryStore((s) => s.ownedTerritories);
  const aiKingdoms = useAIKingdomStore((s) => s.aiKingdoms);

  // ── Build ownership map ──────────────────────────────────────────────────

  /**
   * Assign world-territory slots to owners:
   *  - Player owns the first N slots (matching by name, then by index).
   *  - Each AI kingdom claims 1-3 consecutive slots starting at a hash offset.
   *  - Everything else is neutral.
   */
  const territoryOwnership = useMemo((): Record<string, 'player' | 'enemy' | 'neutral'> => {
    const ownership: Record<string, 'player' | 'enemy' | 'neutral'> = {};

    // Default everything to neutral
    WORLD_TERRITORIES.forEach((wt) => {
      ownership[wt.id] = 'neutral';
    });

    // Player territories — try name match first, then fall back to first-N index assignment
    const playerSlotIds = new Set<string>();
    ownedTerritories.forEach((ot, i) => {
      const byName = WORLD_TERRITORIES.find(
        (wt) => wt.name.toLowerCase() === ot.name.toLowerCase(),
      );
      if (byName && !playerSlotIds.has(byName.id)) {
        ownership[byName.id] = 'player';
        playerSlotIds.add(byName.id);
      } else {
        // fall back to index-based assignment (skip slots already taken)
        let assigned = 0;
        for (const wt of WORLD_TERRITORIES) {
          if (playerSlotIds.has(wt.id)) continue;
          if (assigned === i) {
            ownership[wt.id] = 'player';
            playerSlotIds.add(wt.id);
            break;
          }
          assigned++;
        }
      }
    });

    // AI kingdoms — each gets 1-3 slots deterministically
    aiKingdoms.forEach((k) => {
      const h = hashId(k.id);
      const slotCount = 1 + (h % 3); // 1, 2, or 3
      const startIdx = h % WORLD_TERRITORIES.length;
      let claimed = 0;
      for (let offset = 0; offset < WORLD_TERRITORIES.length && claimed < slotCount; offset++) {
        const idx = (startIdx + offset) % WORLD_TERRITORIES.length;
        const wt = WORLD_TERRITORIES[idx];
        if (ownership[wt.id] === 'neutral') {
          ownership[wt.id] = 'enemy';
          claimed++;
        }
      }
    });

    return ownership;
  }, [ownedTerritories, aiKingdoms]);

  /**
   * Reverse map: which AI kingdom owns which world-territory slot?
   */
  const aiOwnerMap = useMemo((): Record<string, string> => {
    const map: Record<string, string> = {};
    aiKingdoms.forEach((k) => {
      const h = hashId(k.id);
      const slotCount = 1 + (h % 3);
      const startIdx = h % WORLD_TERRITORIES.length;
      // Re-simulate the same logic to build the reverse map
      const tempNeutral = { ...territoryOwnership };
      let claimed = 0;
      for (let offset = 0; offset < WORLD_TERRITORIES.length && claimed < slotCount; offset++) {
        const idx = (startIdx + offset) % WORLD_TERRITORIES.length;
        const wt = WORLD_TERRITORIES[idx];
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
    return WORLD_TERRITORIES
      .filter((wt) => territoryOwnership[wt.id] === 'player')
      .map((wt) => wt.position);
  }, [territoryOwnership]);

  // ── Build React Flow nodes from WORLD_TERRITORIES ────────────────────────

  const worldNodes = useMemo((): TerritoryNode[] => {
    return WORLD_TERRITORIES.map((wt) => {
      const ownership = territoryOwnership[wt.id] ?? 'neutral';
      const inFog = isInFogOfWar(wt.position, playerPositions);

      // Determine the node label
      let label: string;
      let aiKingdom: (typeof aiKingdoms)[number] | undefined;

      if (inFog && ownership === 'neutral') {
        label = '???';
      } else if (ownership === 'enemy') {
        const ownerId = aiOwnerMap[wt.id];
        aiKingdom = aiKingdoms.find((k) => k.id === ownerId);
        label = aiKingdom ? aiKingdom.name : wt.name;
      } else if (ownership === 'player') {
        // Prefix capitals with a crown character
        label = wt.type === 'capital' ? `\u265a ${wt.name}` : wt.name;
      } else {
        label = wt.name;
      }

      const style = buildNodeStyle(
        wt.type,
        ownership,
        aiKingdom?.difficulty,
        inFog && ownership === 'neutral',
      );

      return {
        id: wt.id,
        position: wt.position,
        draggable: false,
        data: {
          label,
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
          visibility: (ownership === 'player' ? 'full' : 'partial') as VisibilityLevel,
          resources: { gold: 0, population: 0 },
          landCategory: aiKingdom
            ? getLandCategory(aiKingdom.resources.land)
            : undefined,
          worldTerritoryId: wt.id,
          territoryType: wt.type,
          ownership,
          inFog: inFog && ownership === 'neutral',
        },
        style,
      } as TerritoryNode;
    });
  }, [territoryOwnership, playerPositions, aiKingdoms, aiOwnerMap, ownedTerritories, kingdom]);

  // No edges needed — territory slots are independent
  const worldEdges: Edge[] = [];

  const [nodes, setNodes, onNodesChange] = useNodesState<TerritoryNode>(
    [MAP_BG_NODE as unknown as TerritoryNode, ...worldNodes],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(worldEdges);

  // Keep nodes in sync when store data changes
  useEffect(() => {
    setNodes([MAP_BG_NODE as unknown as TerritoryNode, ...worldNodes]);
  }, [worldNodes, setNodes]);

  useEffect(() => {
    setEdges(worldEdges);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setEdges]);

  // ── Selection state ───────────────────────────────────────────────────────

  const [selectedTerritoryNode, setSelectedTerritoryNode] = useState<TerritoryNode | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<SelectedTerritoryInfo | null>(null);

  // WorldState from the backend (non-critical, fog-of-war future use)
  const [_worldState, setWorldState] = useState<WorldStateResult | null>(null);

  useEffect(() => {
    const fetchWorldState = async () => {
      try {
        const seasonId = (kingdom as unknown as { seasonId?: string }).seasonId ?? '';
        if (!kingdom.id || !seasonId) return;

        const result = await AmplifyFunctionService.callFunction('season-manager', {
          kingdomId: kingdom.id,
          seasonId,
          action: 'getWorldState',
        });

        const parsed =
          typeof result === 'string' ? JSON.parse(result) : result;
        if (parsed && typeof parsed === 'object') {
          setWorldState(parsed as WorldStateResult);
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

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.id === 'map-bg') return;

    const territory = node as TerritoryNode;
    const inFog = territory.data?.inFog ?? false;

    // Fog-of-war: no panel for hidden neutral territories
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
    });
  }, []);

  // ── Claim handler ─────────────────────────────────────────────────────────

  const handleClaimTerritory = useCallback(() => {
    if (!selectedTerritoryNode) return;
    if (selectedTerritory?.ownership !== 'neutral') return;

    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedTerritoryNode.id
          ? {
              ...n,
              data: {
                ...n.data,
                isOwned: true,
                kingdomName: kingdom.name,
                race: (kingdom.race as string) || 'Human',
                visibility: 'full' as VisibilityLevel,
                ownership: 'player' as const,
                inFog: false,
                landCategory: undefined,
              },
              style: {
                ...n.style,
                background: '#4ade80',
                border: '2px solid #16a34a',
                opacity: 1,
                filter: 'none',
                color: '#000',
              },
            }
          : n,
      ),
    );
    setSelectedTerritoryNode(null);
    setSelectedTerritory(null);
  }, [selectedTerritoryNode, selectedTerritory, kingdom, setNodes]);

  // ── Ownership badge helper ────────────────────────────────────────────────

  function ownershipBadge(ownership: 'player' | 'enemy' | 'neutral') {
    if (ownership === 'player') {
      return (
        <span style={{
          display: 'inline-block',
          background: '#0f766e',
          color: '#99f6e4',
          fontSize: '0.75rem',
          fontWeight: 600,
          padding: '0.2rem 0.6rem',
          borderRadius: 9999,
          marginBottom: '0.75rem',
        }}>
          ✓ Your Territory
        </span>
      );
    }
    if (ownership === 'enemy') {
      return (
        <span style={{
          display: 'inline-block',
          background: '#7f1d1d',
          color: '#fca5a5',
          fontSize: '0.75rem',
          fontWeight: 600,
          padding: '0.2rem 0.6rem',
          borderRadius: 9999,
          marginBottom: '0.75rem',
        }}>
          ⚔ Enemy Territory
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-block',
        background: '#374151',
        color: '#9ca3af',
        fontSize: '0.75rem',
        fontWeight: 600,
        padding: '0.2rem 0.6rem',
        borderRadius: 9999,
        marginBottom: '0.75rem',
      }}>
        ○ Unclaimed
      </span>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="world-map"
      style={{
        backgroundColor: 'var(--color-bg-deep, #0f1629)',
        color: 'var(--text-primary)',
        minHeight: '100vh',
      }}
    >
      <div
        className="world-map-header"
        style={{
          backgroundColor: 'var(--color-bg-deep, #0f1629)',
          padding: '1rem',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <button
          onClick={onBack}
          className="back-button"
          style={{
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-primary)',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            cursor: 'pointer',
          }}
        >
          Back to Kingdom
        </button>
        <h1 style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display, Cinzel, serif)' }}>World Map</h1>
        <div className="map-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#4ade80' }}></div>
            <span>Your Territory</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#1f2937', border: '1px dashed #4b5563' }}></div>
            <span>Neutral</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#dc2626' }}></div>
            <span>Enemy</span>
          </div>
          <div className="legend-item">
            <div
              className="legend-color fog-legend"
              style={{
                background: '#000',
                border: '1px dashed #374151',
                opacity: 0.4,
              }}
            ></div>
            <span>Fog of War</span>
          </div>
        </div>
      </div>

      <div
        className="map-container"
        style={{
          height: '80vh',
          backgroundColor: 'var(--color-bg-deep, #0f1629)',
          border: '1px solid var(--border-primary)',
          borderRadius: '0.5rem',
          position: 'relative',
        }}
      >
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
          style={{ backgroundColor: 'var(--color-bg-deep, #0f1629)' }}
        >
          <Controls style={{ backgroundColor: 'rgba(15,22,41,0.92)', border: '1px solid rgba(255,255,255,0.12)' }} />
          <MiniMap
            nodeColor={(node) => {
              if (node.id === 'map-bg') return 'transparent';
              const t = node as TerritoryNode;
              if (t.data.inFog) return '#111';
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

        {/* Slide-in territory detail panel */}
        {selectedTerritory && (
          <div style={{
            position: 'absolute', top: 0, right: 0, width: 320, height: '100%',
            background: 'rgba(15,22,41,0.97)', borderLeft: '1px solid rgba(255,255,255,0.12)',
            display: 'flex', flexDirection: 'column', zIndex: 100,
            fontFamily: 'var(--font-display, Cinzel, serif)',
            animation: 'slideInRight 0.25s ease-out',
          }}>
            <img
              src={getTerritoryImage(selectedTerritory.label, selectedTerritory.type)}
              style={{ width: '100%', height: 220, objectFit: 'cover' }}
              alt={selectedTerritory.label}
            />
            <div style={{ padding: '1.25rem', flex: 1 }}>
              <h2 style={{ color: '#d4a017', marginBottom: '0.5rem', fontSize: '1.1rem', letterSpacing: '0.05em' }}>
                {/* Strip crown prefix from display if present */}
                {selectedTerritory.label.replace(/^\u265a\s*/, '')}
              </h2>

              {/* Ownership badge */}
              {ownershipBadge(selectedTerritory.ownership)}

              {/* Type badge */}
              <p style={{
                display: 'inline-block',
                background: '#1f2937',
                color: '#6b7280',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '0.2rem 0.6rem',
                borderRadius: 9999,
                marginLeft: '0.4rem',
                marginBottom: '0.75rem',
              }}>
                {selectedTerritory.type}
              </p>

              {/* Kingdom name for enemy territories */}
              {selectedTerritory.ownership === 'enemy' && selectedTerritory.kingdomName && (
                <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Ruled by: <strong style={{ color: '#f87171' }}>{selectedTerritory.kingdomName}</strong>
                </p>
              )}

              {/* Claim button — only for neutral territories */}
              {selectedTerritory.ownership === 'neutral' && (
                <button
                  onClick={handleClaimTerritory}
                  style={{
                    marginTop: '1rem',
                    width: '100%',
                    padding: '0.6rem',
                    background: '#16a34a',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    borderRadius: 6,
                    fontFamily: 'var(--font-display, Cinzel, serif)',
                    fontSize: '0.85rem',
                    letterSpacing: '0.05em',
                  }}
                >
                  Claim Territory
                </button>
              )}

              {/* Greyed-out Claim button for enemy territories */}
              {selectedTerritory.ownership === 'enemy' && (
                <button
                  disabled
                  style={{
                    marginTop: '1rem',
                    width: '100%',
                    padding: '0.6rem',
                    background: '#374151',
                    border: '1px solid #4b5563',
                    color: '#6b7280',
                    cursor: 'not-allowed',
                    borderRadius: 6,
                    fontFamily: 'var(--font-display, Cinzel, serif)',
                    fontSize: '0.85rem',
                    letterSpacing: '0.05em',
                  }}
                >
                  Claim Territory
                </button>
              )}
            </div>
            <button
              onClick={() => setSelectedTerritory(null)}
              style={{
                margin: '0 1.25rem 1.25rem', padding: '0.6rem',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                color: '#9ca3af', cursor: 'pointer', borderRadius: 6,
                fontFamily: 'var(--font-display, Cinzel, serif)', fontSize: '0.8rem'
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Legacy territory detail panel — retained for fog-of-war detail, actions */}
      {selectedTerritoryNode && (
        <div className="territory-panel">
          <h3>{selectedTerritoryNode.data.label}</h3>

          {selectedTerritoryNode.data.visibility === 'partial' && (
            <div className="fog-badge">Partial Visibility</div>
          )}

          <p>
            <strong>Owner:</strong> {selectedTerritoryNode.data.kingdomName}
          </p>

          {selectedTerritoryNode.data.visibility === 'full' ? (
            <>
              <p>
                <strong>Race:</strong> {selectedTerritoryNode.data.race}
              </p>
              <p>
                <strong>Power:</strong> {selectedTerritoryNode.data.power}
              </p>
              <p>
                <strong>Gold:</strong> {selectedTerritoryNode.data.resources.gold}
              </p>
              <p>
                <strong>Population:</strong>{' '}
                {selectedTerritoryNode.data.resources.population}
              </p>
            </>
          ) : (
            <>
              <p>
                <strong>Size:</strong>{' '}
                {selectedTerritoryNode.data.landCategory ?? 'Unknown'}
              </p>
              <p className="fog-info">
                Exact details hidden by Fog of War. Scout this territory to reveal
                more.
              </p>
            </>
          )}

          {!selectedTerritoryNode.data.isOwned && (
            <div className="territory-actions">
              <button
                onClick={handleClaimTerritory}
                className="claim-button"
                disabled={selectedTerritoryNode.data.ownership === 'enemy'}
                style={
                  selectedTerritoryNode.data.ownership === 'enemy'
                    ? { opacity: 0.4, cursor: 'not-allowed' }
                    : undefined
                }
              >
                Claim Territory
              </button>
              <button className="attack-button">Attack</button>
            </div>
          )}

          <button
            onClick={() => {
              setSelectedTerritoryNode(null);
              setSelectedTerritory(null);
            }}
            className="close-button"
          >
            Close
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }

        .world-map {
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .world-map-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background: var(--color-bg-deep, #0f1629);
          color: white;
          border-bottom: 2px solid #374151;
        }

        .back-button {
          background: #374151;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .back-button:hover {
          background: #4b5563;
        }

        .map-legend {
          display: flex;
          gap: 1rem;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .legend-color {
          width: 1rem;
          height: 1rem;
          border-radius: 0.25rem;
          border: 1px solid #374151;
        }

        .map-container {
          flex: 1;
          position: relative;
        }

        .map-stats {
          background: rgba(15, 22, 41, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          padding: 1rem;
          border-radius: 0.5rem;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }

        .map-stats h3 {
          margin: 0 0 0.5rem 0;
          color: #d4a017;
          font-family: var(--font-display, 'Cinzel', serif);
          font-size: 0.85rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .map-stats p {
          margin: 0.25rem 0;
          color: #d1d5db;
          font-size: 0.85rem;
        }

        .territory-panel {
          position: absolute;
          top: 50%;
          left: 1rem;
          transform: translateY(-50%);
          background: rgba(15, 22, 41, 0.97);
          border: 1px solid rgba(255,255,255,0.12);
          padding: 1.5rem;
          border-radius: 0.5rem;
          box-shadow: 0 10px 40px rgba(0,0,0,0.6);
          min-width: 250px;
          z-index: 1000;
          color: #f0e6cc;
        }

        .territory-panel h3 {
          margin: 0 0 1rem 0;
          color: #d4a017;
          font-family: var(--font-display, 'Cinzel', serif);
          font-size: 1.1rem;
          letter-spacing: 0.04em;
        }

        .territory-panel p {
          margin: 0.5rem 0;
          color: #d1d5db;
          font-size: 0.9rem;
        }

        .fog-badge {
          display: inline-block;
          background: #4b5563;
          color: #d1d5db;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.2rem 0.6rem;
          border-radius: 9999px;
          margin-bottom: 0.75rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .fog-info {
          font-size: 0.875rem;
          color: #6b7280 !important;
          font-style: italic;
          margin-top: 0.75rem !important;
        }

        .territory-actions {
          margin: 1rem 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .claim-button {
          background: #16a34a;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .claim-button:hover:not(:disabled) {
          background: #15803d;
        }

        .attack-button {
          background: #dc2626;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .attack-button:hover {
          background: #b91c1c;
        }

        .close-button {
          background: transparent;
          color: #9ca3af;
          border: 1px solid rgba(255,255,255,0.15);
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          cursor: pointer;
          margin-top: 1rem;
          width: 100%;
          font-family: var(--font-display, 'Cinzel', serif);
          font-size: 0.8rem;
          letter-spacing: 0.05em;
        }

        .close-button:hover {
          background: rgba(255,255,255,0.08);
          color: #f0e6cc;
        }
      `}</style>
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
