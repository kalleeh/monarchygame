/* eslint-disable react-refresh/only-export-components */
/**
 * KingdomNode.tsx
 *
 * Shared types, world-map data constants, pure helper functions, and the
 * custom ReactFlow background node used by WorldMap.
 *
 * Extracted from WorldMap.tsx to keep the orchestrator under 800 lines.
 */

import React from 'react';
import { TERRAINS } from '../../data/terrains';
import {
  PlainsIcon, ForestIcon, MountainIcon, SwampIcon, DesertIcon, CoastalIcon,
  RaceHumanIcon, RaceElvenIcon, RaceGoblinIcon, RaceDrobenIcon, RaceVampireIcon,
  RaceElementalIcon, RaceCentaurIcon, RaceSidheIcon, RaceDwarvenIcon, RaceFaeIcon,
} from '../ui/MenuIcons';

// ─── Core types ──────────────────────────────────────────────────────────────

export interface Node {
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

export interface Edge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

// Fog of war visibility level for a kingdom node
export type VisibilityLevel = 'full' | 'partial' | 'hidden';

export interface TerritoryNode extends Node {
  data: {
    label: string;
    kingdomName: string;
    race: string;
    power: number;
    isOwned: boolean;
    visibility: VisibilityLevel;
    resources: {
      gold: number;
      population: number;
    };
    landCategory?: string;
    worldTerritoryId?: string;
    territoryType?: string;
    ownership?: 'player' | 'enemy' | 'neutral';
    inFog?: boolean;
    terrainType?: string;
  };
}

// WorldState shape returned by the getWorldState query
export interface WorldStateResult {
  visibleKingdoms?: string[];
  fogOfWar?: Record<string, unknown>;
}

// Detail panel state shape
export interface SelectedTerritoryInfo {
  id: string;
  label: string;
  type: string;
  isOwned: boolean;
  ownership: 'player' | 'enemy' | 'neutral';
  kingdomName?: string;
  inFog?: boolean;
  terrainType?: string;
}

// ─── World Region Grid ───────────────────────────────────────────────────────

export interface RegionSlot {
  id: string;
  name: string;
  position: { x: number; y: number };
  type: 'capital' | 'settlement' | 'outpost' | 'fortress';
}

/**
 * WORLD_REGIONS — 50 named Region slots mapped to the actual terrain features
 * visible on world-map-world.jpg.
 */
export const WORLD_REGIONS: RegionSlot[] = [
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

export const FOG_RADIUS = 5000;

// ─── Claim costs & adjacency ─────────────────────────────────────────────────

export const BASE_GOLD: Record<string, number>  = { capital: 1000, settlement: 500, outpost: 300, fortress: 800 };
export const BASE_TURNS: Record<string, number> = { capital: 5,    settlement: 3,   outpost: 2,   fortress: 4   };

export function dist(a: {x:number;y:number}, b: {x:number;y:number}): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function claimCost(
  region: RegionSlot,
  playerPositions: {x:number;y:number}[],
): { gold: number; turns: number; settlingTurns: number } {
  const nearest = playerPositions.length === 0 ? 0
    : Math.min(...playerPositions.map(p => dist(region.position, p)));
  const distFactor = 1 + nearest / 3000;
  return {
    gold:          Math.round(BASE_GOLD[region.type]  * distFactor / 50) * 50,
    turns:         Math.ceil(BASE_TURNS[region.type]  * distFactor),
    settlingTurns: Math.max(2, Math.round(2 + nearest / 1500)),
  };
}

export const CLAIM_ADJACENCY_RADIUS = 3500;

export function isAdjacentToPlayer(
  target: { x: number; y: number },
  playerPositions: { x: number; y: number }[],
): boolean {
  if (playerPositions.length === 0) return true;
  return playerPositions.some(
    (p) => Math.sqrt((target.x - p.x) ** 2 + (target.y - p.y) ** 2) <= CLAIM_ADJACENCY_RADIUS,
  );
}

export function isContested(
  region: RegionSlot,
  ownership: Record<string, 'player'|'enemy'|'neutral'>,
): boolean {
  const neighbours = WORLD_REGIONS.filter(
    r => r.id !== region.id && dist(r.position, region.position) <= CLAIM_ADJACENCY_RADIUS
  );
  const hasPlayer = neighbours.some(r => ownership[r.id] === 'player');
  const hasEnemy  = neighbours.some(r => ownership[r.id] === 'enemy');
  return hasPlayer && hasEnemy;
}

export function isInFogOfWar(
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

export const TERRITORY_TYPE_IMAGES: Record<string, string> = {
  capital:    '/territory-capital.png',
  settlement: '/territory-trading-post.png',
  outpost:    '/territory-forest-outpost.png',
  fortress:   '/territory-iron-mines.png',
};

export const TERRITORY_IMAGES: Record<string, string> = {
  'Capital City':    '/territory-capital.png',
  'Royal Capital':   '/territory-capital.png',
  'Trading Post':    '/territory-trading-post.png',
  'Iron Mines':      '/territory-iron-mines.png',
  'Forest Outpost':  '/territory-forest-outpost.png',
  'Ancient Ruins':   '/territory-ancient-ruins.png',
};

export function getTerritoryImage(label: string, type: string): string {
  return TERRITORY_IMAGES[label] ?? TERRITORY_TYPE_IMAGES[type] ?? '/territories-icon.png';
}

// ─── Deterministic hash helper ───────────────────────────────────────────────

export function hashId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h) + id.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h);
}

// ─── Terrain assignment & display helpers ────────────────────────────────────

export const TERRAIN_POOL = ['plains', 'forest', 'mountains', 'swamp', 'desert', 'coastal'] as const;

export function getRegionTerrain(regionId: string, aiTerrainOverride?: string): string {
  if (aiTerrainOverride) return aiTerrainOverride.toLowerCase();
  const h = hashId(regionId);
  return TERRAIN_POOL[h % TERRAIN_POOL.length];
}

export function terrainEmoji(terrain: string): React.ReactNode {
  switch (terrain.toLowerCase()) {
    case 'plains':    return <PlainsIcon />;
    case 'forest':    return <ForestIcon />;
    case 'mountains': return <MountainIcon />;
    case 'swamp':     return <SwampIcon />;
    case 'desert':    return <DesertIcon />;
    case 'coastal':   return <CoastalIcon />;
    default:          return <PlainsIcon />;
  }
}

export function terrainModSummary(terrain: string): string {
  const terrainDef = TERRAINS.find(t => t.type.toLowerCase() === terrain.toLowerCase());
  if (!terrainDef) return terrain.charAt(0).toUpperCase() + terrain.slice(1) + ': no modifiers';
  const parts: string[] = [];
  const m = terrainDef.modifiers;
  if (m.defense  != null && m.defense  !== 0) parts.push(`${m.defense  > 0 ? '+' : ''}${Math.round(m.defense  * 100)}% def`);
  if (m.offense  != null && m.offense  !== 0) parts.push(`${m.offense  > 0 ? '+' : ''}${Math.round(m.offense  * 100)}% offense`);
  if (m.cavalry  != null && m.cavalry  !== 0) parts.push(`${m.cavalry  > 0 ? '+' : ''}${Math.round(m.cavalry  * 100)}% cavalry`);
  if (m.infantry != null && m.infantry !== 0) parts.push(`${m.infantry > 0 ? '+' : ''}${Math.round(m.infantry * 100)}% infantry`);
  if (m.siege    != null && m.siege    !== 0) parts.push(`${m.siege    > 0 ? '+' : ''}${Math.round(m.siege    * 100)}% siege`);
  if (parts.length === 0) return terrainDef.name + ': no modifiers';
  return terrainDef.name + ': ' + parts.join(', ');
}

// ─── Legacy helpers ───────────────────────────────────────────────────────────

export const RACE_COLORS: Record<string, string> = {
  Human: '#3b82f6', Elven: '#22c55e', Goblin: '#84cc16',
  Droben: '#ef4444', Vampire: '#7c3aed', Elemental: '#06b6d4',
  Centaur: '#f59e0b', Sidhe: '#a855f7', Dwarven: '#d97706',
  Fae: '#ec4899',
};

export const RACE_ICON_COMPONENTS: Record<string, React.ReactNode> = {
  Human: <RaceHumanIcon />, Elven: <RaceElvenIcon />, Goblin: <RaceGoblinIcon />,
  Droben: <RaceDrobenIcon />, Vampire: <RaceVampireIcon />, Elemental: <RaceElementalIcon />,
  Centaur: <RaceCentaurIcon />, Sidhe: <RaceSidheIcon />, Dwarven: <RaceDwarvenIcon />,
  Fae: <RaceFaeIcon />,
};

/** @deprecated Use RACE_ICON_COMPONENTS for JSX contexts */
export const RACE_ICONS: Record<string, string> = {
  Human: '👤', Elven: '🧝', Goblin: '👹', Droben: '🐉', Vampire: '🧛',
  Elemental: '🔥', Centaur: '🐎', Sidhe: '🧚', Dwarven: '⛏️', Fae: '✨',
};

export function getLandCategory(land: number): string {
  if (land < 2000) return 'Small Kingdom';
  if (land < 5000) return 'Medium Kingdom';
  if (land < 15000) return 'Large Kingdom';
  return 'Massive Kingdom';
}

// ─── Node style builder ───────────────────────────────────────────────────────

export function buildNodeStyle(
  wtType: 'capital' | 'settlement' | 'outpost' | 'fortress',
  ownership: 'player' | 'enemy' | 'neutral',
  difficulty: 'easy' | 'medium' | 'hard' | undefined,
  inFog: boolean,
  settling: boolean,
  enemySettling: boolean,
  contested: boolean,
  allianceControlled: boolean,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    borderRadius: '12px',
    padding: '18px 22px',
    fontSize: '32px',
    fontWeight: 600,
    minWidth: 280,
    textAlign: 'center',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    lineHeight: 1.4,
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
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
        background: 'linear-gradient(135deg, #d4a017, #b8860b)',
        border: allianceControlled ? '4px solid #fbbf24' : '3px solid #f0c040',
        boxShadow: allianceControlled ? '0 0 16px 4px rgba(251,191,36,0.55)' : '0 4px 24px rgba(212,160,23,0.4)',
        color: '#000',
        fontWeight: 700,
        padding: '22px 26px',
        fontSize: '36px',
      };
    }
    return {
      ...base,
      background: 'linear-gradient(135deg, #4ade80, #16a34a)',
      border: allianceControlled ? '4px solid #fbbf24' : '3px solid #22c55e',
      boxShadow: allianceControlled ? '0 0 16px 4px rgba(251,191,36,0.55)' : '0 4px 20px rgba(74,222,128,0.3)',
      color: '#000',
    };
  }

  if (ownership === 'enemy') {
    const diffMap: Record<string, { bg: string; border: string }> = {
      hard:   { bg: 'linear-gradient(135deg, #dc2626, #991b1b)', border: '3px solid #ef4444' },
      medium: { bg: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: '3px solid #8b5cf6' },
      easy:   { bg: 'linear-gradient(135deg, #475569, #334155)', border: '3px solid #64748b' },
    };
    const colours = diffMap[difficulty ?? 'medium'] ?? diffMap.medium;
    return {
      ...base,
      background: colours.bg,
      border: colours.border,
      color: '#fff',
    };
  }

  if (settling) {
    return {
      ...base,
      background: 'linear-gradient(135deg, #b45309, #92400e)',
      border: '3px dashed #fcd34d',
      color: '#fcd34d',
    };
  }

  if (enemySettling) {
    return {
      ...base,
      background: 'linear-gradient(135deg, #c2410c, #9a3412)',
      border: '3px dashed #fb923c',
      color: '#fed7aa',
    };
  }

  if (contested) {
    return {
      ...base,
      background: 'linear-gradient(135deg, #7f1d1d, #991b1b)',
      border: '3px dashed #ef4444',
      color: '#fca5a5',
    };
  }

  return {
    ...base,
    background: 'linear-gradient(135deg, #1f2937, #111827)',
    border: '2px dashed #4b5563',
    color: '#9ca3af',
    opacity: 0.8,
  };
}

// ─── Custom map background node ───────────────────────────────────────────────

export const MapBackgroundNode = () => (
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

export const nodeTypes = {
  mapBackground: MapBackgroundNode,
};

// World-scale background node — 16000×9000 units, centred at origin
export const MAP_BG_NODE: Node = {
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
