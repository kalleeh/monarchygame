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
}

// Map territory type → detail image
const TERRITORY_TYPE_IMAGES: Record<string, string> = {
  capital:    '/territory-capital.png',
  settlement: '/territory-trading-post.png',
  outpost:    '/territory-forest-outpost.png',
  fortress:   '/territory-iron-mines.png',
};
// Also accept legacy name-based lookups for backwards compat
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

// Deterministic position hash for AI kingdoms
function hashId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h) + id.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h);
}
function aiKingdomMapPosition(id: string): { x: number; y: number } {
  const h = hashId(id);
  const angle = ((h % 1000) / 1000) * 2 * Math.PI;
  const radius = 2200 + (h % 3500);
  return {
    x: Math.cos(angle) * radius * 1.78, // wider for 16:9
    y: Math.sin(angle) * radius,
  };
}

// Custom node that renders the world map image inside the React Flow viewport
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

/**
 * Determine what level of visibility the current kingdom has over another.
 *
 * Rules (in priority order):
 *   full    — own kingdom, or alliance member (same guildId)
 *   partial — everyone else (all other kingdoms are partially visible for now;
 *             hidden is reserved for future scouting mechanics)
 */
function getKingdomVisibility(
  kingdomGuildId: string | null | undefined,
  isOwned: boolean,
  currentKingdomGuildId: string | null | undefined,
): VisibilityLevel {
  if (isOwned) return 'full';
  if (
    currentKingdomGuildId &&
    kingdomGuildId &&
    kingdomGuildId === currentKingdomGuildId
  ) {
    return 'full'; // Same alliance
  }
  return 'partial';
}

/**
 * Convert a land amount to a human-readable category shown under fog of war.
 */
function getLandCategory(land: number): string {
  if (land < 2000) return 'Small Kingdom';
  if (land < 5000) return 'Medium Kingdom';
  if (land < 15000) return 'Large Kingdom';
  return 'Massive Kingdom';
}

// World-scale background — 16000×9000 units, centred at origin
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

// Node style by territory type
const TERRITORY_TYPE_STYLE: Record<string, Record<string, unknown>> = {
  capital:    { background: '#d4a017', border: '2px solid #f0c040', borderRadius: '8px', padding: '10px', color: '#000', fontWeight: 700 },
  settlement: { background: '#4ade80', border: '2px solid #16a34a', borderRadius: '8px', padding: '10px' },
  outpost:    { background: '#94a3b8', border: '2px solid #64748b', borderRadius: '8px', padding: '10px' },
  fortress:   { background: '#f87171', border: '2px solid #dc2626', borderRadius: '8px', padding: '10px' },
};
// AI kingdom node style by difficulty
const AI_KINGDOM_STYLE: Record<string, Record<string, unknown>> = {
  easy:   { background: '#374151', border: '2px dashed #6b7280', borderRadius: '8px', padding: '10px', opacity: 0.7 },
  medium: { background: '#7c3aed', border: '2px dashed #a78bfa', borderRadius: '8px', padding: '10px', opacity: 0.75 },
  hard:   { background: '#dc2626', border: '2px dashed #f87171', borderRadius: '8px', padding: '10px', opacity: 0.8 },
};

const WorldMapContent: React.FC<WorldMapProps> = ({ kingdom, onBack }) => {
  const currentGuildId = (kingdom as unknown as { guildId?: string }).guildId ?? null;

  // Real data sources
  const ownedTerritories = useTerritoryStore((s) => s.ownedTerritories);
  const aiKingdoms = useAIKingdomStore((s) => s.aiKingdoms);

  // Build world nodes from real data
  const worldNodes = useMemo((): TerritoryNode[] => {
    const result: TerritoryNode[] = [];

    // Player's owned territories — clustered near centre
    ownedTerritories.forEach((t, i) => {
      const total = Math.max(ownedTerritories.length, 1);
      const angle = (i / total) * 2 * Math.PI;
      const r = total === 1 ? 0 : 350 + i * 80;
      const pos = total === 1
        ? { x: 0, y: 0 }
        : { x: Math.cos(angle) * r * 1.78, y: Math.sin(angle) * r };

      result.push({
        id: `player-${t.id}`,
        position: pos,
        draggable: false,
        data: {
          label: t.name,
          kingdomName: kingdom.name || 'Your Kingdom',
          race: (kingdom.race as string) || 'Human',
          power: t.resources.land * 10,
          isOwned: true,
          visibility: 'full' as VisibilityLevel,
          resources: { gold: t.resources.gold, population: t.resources.population },
          landCategory: getLandCategory(t.resources.land),
          territoryType: t.type,
        },
        style: TERRITORY_TYPE_STYLE[t.type] ?? TERRITORY_TYPE_STYLE.settlement,
      } as TerritoryNode);
    });

    // AI kingdoms — spread deterministically around the world
    aiKingdoms.forEach((k) => {
      const pos = aiKingdomMapPosition(k.id);
      result.push({
        id: `ai-${k.id}`,
        position: pos,
        draggable: false,
        data: {
          label: k.name,
          kingdomName: k.name,
          race: k.race,
          power: k.networth,
          isOwned: false,
          visibility: 'partial' as VisibilityLevel,
          resources: { gold: k.resources.gold, population: k.resources.population },
          landCategory: getLandCategory(k.resources.land),
          territoryType: 'settlement',
        },
        style: AI_KINGDOM_STYLE[k.difficulty] ?? AI_KINGDOM_STYLE.medium,
      } as TerritoryNode);
    });

    return result;
  }, [ownedTerritories, aiKingdoms, kingdom, currentGuildId]);

  // Edges: connect each player territory back to the capital (first owned)
  const worldEdges = useMemo((): Edge[] => {
    if (ownedTerritories.length < 2) return [];
    return ownedTerritories.slice(1).map((t, i) => ({
      id: `e-cap-${i}`,
      source: `player-${ownedTerritories[0].id}`,
      target: `player-${t.id}`,
      animated: true,
    }));
  }, [ownedTerritories]);

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
  }, [worldEdges, setEdges]);

  // Full TerritoryNode used for the existing territory-panel (fog of war details etc.)
  const [selectedTerritoryNode, setSelectedTerritoryNode] = useState<TerritoryNode | null>(null);

  // Slim shape used for the new slide-in detail panel
  const [selectedTerritory, setSelectedTerritory] = useState<SelectedTerritoryInfo | null>(null);

  // WorldState from the backend (used in future to refine visibility)
  const [_worldState, setWorldState] = useState<WorldStateResult | null>(null);

  // Fetch WorldState on mount so visibility can be driven by server data
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
        // Non-fatal: fog of war falls back to client-side rules
        console.warn('WorldState fetch failed (using client-side visibility):', err);
      }
    };

    fetchWorldState();
  }, [kingdom]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.id === 'map-bg') return;
    const territory = node as TerritoryNode;
    // Update both state slices
    setSelectedTerritoryNode(territory);
    setSelectedTerritory({
      id: node.id,
      label: territory.data?.label || node.id,
      type: territory.data?.landCategory || 'settlement',
      isOwned: territory.data?.isOwned || false,
    });
  }, []);

  const handleClaimTerritory = useCallback(() => {
    if (!selectedTerritoryNode || selectedTerritoryNode.data.isOwned) return;

    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedTerritoryNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                isOwned: true,
                kingdomName: kingdom.name,
                race: (kingdom.race as string) || 'Human',
                visibility: 'full' as VisibilityLevel,
                landCategory: undefined,
              },
              style: {
                ...node.style,
                background: '#4ade80',
                border: '2px solid #16a34a',
                opacity: 1,
                filter: 'none',
              },
            }
          : node,
      ),
    );
    setSelectedTerritoryNode(null);
    setSelectedTerritory(null);
  }, [selectedTerritoryNode, kingdom, setNodes]);

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
            <div className="legend-color" style={{ background: '#94a3b8' }}></div>
            <span>Neutral</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#f87171' }}></div>
            <span>Enemy</span>
          </div>
          <div className="legend-item">
            <div
              className="legend-color fog-legend"
              style={{
                background: '#374151',
                border: '2px dashed #6b7280',
                opacity: 0.7,
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
              if (t.data.isOwned) return '#4ade80';
              if (t.data.visibility === 'partial') return '#4b5563';
              return '#94a3b8';
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
              <p>Territories: {nodes.filter((n) => n.id !== 'map-bg' && n.data.isOwned).length}</p>
              <p>
                Total Power:{' '}
                {nodes
                  .filter((n) => n.id !== 'map-bg' && n.data.isOwned)
                  .reduce((sum, n) => sum + n.data.power, 0)}
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
              src={TERRITORY_IMAGES[selectedTerritory.label] || '/territories-icon.png'}
              style={{ width: '100%', height: 220, objectFit: 'cover' }}
              alt={selectedTerritory.label}
            />
            <div style={{ padding: '1.25rem', flex: 1 }}>
              <h2 style={{ color: '#d4a017', marginBottom: '0.5rem', fontSize: '1.1rem', letterSpacing: '0.05em' }}>
                {selectedTerritory.label}
              </h2>
              <p style={{ color: selectedTerritory.isOwned ? '#14b8a6' : '#9ca3af', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {selectedTerritory.isOwned ? '✓ Your Territory' : 'Unclaimed Territory'}
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Type: {selectedTerritory.type}
              </p>
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

      {/* Legacy territory detail panel (fog-of-war detail, claim/attack actions) */}
      {selectedTerritoryNode && (
        <div className="territory-panel">
          <h3>{selectedTerritoryNode.data.label}</h3>

          {/* Fog of War badge */}
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
              <button onClick={handleClaimTerritory} className="claim-button">
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

        .claim-button:hover {
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
