import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  MiniMap,
  Panel,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ErrorBoundary } from './ErrorBoundary';
import type { Schema } from '../../../amplify/data/resource';
import { AmplifyFunctionService } from '../services/amplifyFunctionService';

interface Node {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: unknown;
  style?: Record<string, unknown>;
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

// Demo territory data
const generateDemoTerritories = (
  playerKingdom: Schema['Kingdom']['type'],
  currentGuildId: string | null | undefined,
): TerritoryNode[] => {
  // Parse the player's guildId from the Amplify Schema type
  const playerGuildId = (playerKingdom as unknown as { guildId?: string }).guildId ?? null;

  const territories: Array<{
    id: string;
    position: { x: number; y: number };
    kingdomName: string;
    race: string;
    power: number;
    isOwned: boolean;
    label: string;
    baseStyle: Record<string, unknown>;
    guildId?: string;
    land: number;
    resources: { gold: number; population: number };
  }> = [
    {
      id: 'territory-1',
      position: { x: 250, y: 100 },
      label: 'Capital City',
      kingdomName: playerKingdom.name,
      race: (playerKingdom.race as string) || 'Human',
      power: 1500,
      isOwned: true,
      land: 3200,
      resources: { gold: 1000, population: 500 },
      guildId: playerGuildId ?? undefined,
      baseStyle: {
        background: '#4ade80',
        border: '2px solid #16a34a',
        borderRadius: '8px',
        padding: '10px',
      },
    },
    {
      id: 'territory-2',
      position: { x: 100, y: 200 },
      label: 'Iron Mines',
      kingdomName: 'Neutral',
      race: 'Neutral',
      power: 800,
      isOwned: false,
      land: 900,
      resources: { gold: 500, population: 200 },
      baseStyle: {
        background: '#94a3b8',
        border: '2px solid #64748b',
        borderRadius: '8px',
        padding: '10px',
      },
    },
    {
      id: 'territory-3',
      position: { x: 400, y: 150 },
      label: 'Forest Outpost',
      kingdomName: 'Elven Alliance',
      race: 'Elven',
      power: 1200,
      isOwned: false,
      land: 4200,
      resources: { gold: 800, population: 300 },
      // Same guild as the player (demo: use playerGuildId so alliance is shown full)
      guildId: playerGuildId ?? undefined,
      baseStyle: {
        background: '#f87171',
        border: '2px solid #dc2626',
        borderRadius: '8px',
        padding: '10px',
      },
    },
    {
      id: 'territory-4',
      position: { x: 200, y: 300 },
      label: 'Trading Post',
      kingdomName: playerKingdom.name,
      race: (playerKingdom.race as string) || 'Human',
      power: 600,
      isOwned: true,
      land: 1800,
      resources: { gold: 1200, population: 150 },
      guildId: playerGuildId ?? undefined,
      baseStyle: {
        background: '#4ade80',
        border: '2px solid #16a34a',
        borderRadius: '8px',
        padding: '10px',
      },
    },
    {
      id: 'territory-5',
      position: { x: 350, y: 280 },
      label: 'Ancient Ruins',
      kingdomName: 'Vampire Lords',
      race: 'Vampire',
      power: 2000,
      isOwned: false,
      land: 18500,
      resources: { gold: 1500, population: 400 },
      baseStyle: {
        background: '#a855f7',
        border: '2px solid #7c3aed',
        borderRadius: '8px',
        padding: '10px',
      },
    },
  ];

  return territories.map((t) => {
    const visibility = getKingdomVisibility(t.guildId, t.isOwned, currentGuildId);

    // Apply fog-of-war styling for partial visibility
    const fogStyle: Record<string, unknown> =
      visibility === 'partial'
        ? {
            opacity: 0.55,
            filter: 'grayscale(60%)',
            border: '2px dashed #6b7280',
            background: '#374151',
          }
        : {};

    return {
      id: t.id,
      position: t.position,
      data: {
        label: visibility === 'hidden' ? '???' : t.label,
        kingdomName: visibility === 'hidden' ? 'Unknown' : t.kingdomName,
        race: visibility === 'full' ? t.race : '???',
        power: visibility === 'full' ? t.power : 0,
        isOwned: t.isOwned,
        visibility,
        resources: visibility === 'full' ? t.resources : { gold: 0, population: 0 },
        landCategory: visibility !== 'full' ? getLandCategory(t.land) : undefined,
      },
      style: {
        ...t.baseStyle,
        ...fogStyle,
      },
    } as TerritoryNode;
  });
};

const generateDemoConnections = (): Edge[] => [
  {
    id: 'e1-2',
    source: 'territory-1',
    target: 'territory-2',
    animated: false,
  },
  {
    id: 'e1-4',
    source: 'territory-1',
    target: 'territory-4',
    animated: true,
  },
  {
    id: 'e2-4',
    source: 'territory-2',
    target: 'territory-4',
    animated: false,
  },
  {
    id: 'e3-5',
    source: 'territory-3',
    target: 'territory-5',
    animated: false,
  },
];

const WorldMapContent: React.FC<WorldMapProps> = ({ kingdom, onBack }) => {
  // Resolve the player's guildId from the Amplify Schema type (stored as JSON field)
  const currentGuildId =
    (kingdom as unknown as { guildId?: string }).guildId ?? null;

  const [nodes, setNodes, onNodesChange] = useNodesState<TerritoryNode>(
    generateDemoTerritories(kingdom, currentGuildId),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(generateDemoConnections());
  const [selectedTerritory, setSelectedTerritory] = useState<TerritoryNode | null>(null);

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

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedTerritory(node as TerritoryNode);
  }, []);

  const handleClaimTerritory = useCallback(() => {
    if (!selectedTerritory || selectedTerritory.data.isOwned) return;

    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedTerritory.id
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
    setSelectedTerritory(null);
  }, [selectedTerritory, kingdom, setNodes]);

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
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
          attributionPosition="bottom-left"
          style={{ backgroundColor: 'var(--color-bg-deep, #0f1629)' }}
        >
          <Background color="#1e2a45" style={{ backgroundColor: '#0f1629' }} />
          <Controls style={{ backgroundColor: 'var(--bg-card)' }} />
          <MiniMap
            nodeColor={(node) => {
              const t = node as TerritoryNode;
              if (t.data.isOwned) return '#4ade80';
              if (t.data.visibility === 'partial') return '#4b5563';
              return '#94a3b8';
            }}
            position="top-right"
            style={{ backgroundColor: 'var(--bg-card)' }}
          />
          <Panel
            position="top-left"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
          >
            <div className="map-stats">
              <h3>Kingdom Stats</h3>
              <p>Territories: {nodes.filter((n) => n.data.isOwned).length}</p>
              <p>
                Total Power:{' '}
                {nodes
                  .filter((n) => n.data.isOwned)
                  .reduce((sum, n) => sum + n.data.power, 0)}
              </p>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {selectedTerritory && (
        <div className="territory-panel">
          <h3>{selectedTerritory.data.label}</h3>

          {/* Fog of War badge */}
          {selectedTerritory.data.visibility === 'partial' && (
            <div className="fog-badge">Partial Visibility</div>
          )}

          <p>
            <strong>Owner:</strong> {selectedTerritory.data.kingdomName}
          </p>

          {selectedTerritory.data.visibility === 'full' ? (
            <>
              <p>
                <strong>Race:</strong> {selectedTerritory.data.race}
              </p>
              <p>
                <strong>Power:</strong> {selectedTerritory.data.power}
              </p>
              <p>
                <strong>Gold:</strong> {selectedTerritory.data.resources.gold}
              </p>
              <p>
                <strong>Population:</strong>{' '}
                {selectedTerritory.data.resources.population}
              </p>
            </>
          ) : (
            <>
              <p>
                <strong>Size:</strong>{' '}
                {selectedTerritory.data.landCategory ?? 'Unknown'}
              </p>
              <p className="fog-info">
                Exact details hidden by Fog of War. Scout this territory to reveal
                more.
              </p>
            </>
          )}

          {!selectedTerritory.data.isOwned && (
            <div className="territory-actions">
              <button onClick={handleClaimTerritory} className="claim-button">
                Claim Territory
              </button>
              <button className="attack-button">Attack</button>
            </div>
          )}

          <button
            onClick={() => setSelectedTerritory(null)}
            className="close-button"
          >
            Close
          </button>
        </div>
      )}

      <style>{`
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
          background: rgba(255, 255, 255, 0.9);
          padding: 1rem;
          border-radius: 0.5rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .map-stats h3 {
          margin: 0 0 0.5rem 0;
          color: #1f2937;
        }

        .map-stats p {
          margin: 0.25rem 0;
          color: #374151;
        }

        .territory-panel {
          position: absolute;
          top: 50%;
          right: 1rem;
          transform: translateY(-50%);
          background: white;
          padding: 1.5rem;
          border-radius: 0.5rem;
          box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1);
          min-width: 250px;
          z-index: 1000;
        }

        .territory-panel h3 {
          margin: 0 0 1rem 0;
          color: #1f2937;
        }

        .territory-panel p {
          margin: 0.5rem 0;
          color: #374151;
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
          background: #6b7280;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          cursor: pointer;
          margin-top: 1rem;
          width: 100%;
        }

        .close-button:hover {
          background: #4b5563;
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
