/**
 * MapSection.tsx
 *
 * Section wrapper grouping a list of TerritoryCards under a heading for the
 * mobile world-map view. Extracted verbatim from WorldMapMobile.tsx
 * (behavior-preserving).
 */

import React from 'react';
import type { RegionSlot } from './KingdomNode';
import { TerritoryCard } from './TerritoryCard';
import type { CategorisedRegion } from './territoryTypes';

export interface SectionProps {
  title: string;
  variant: 'yours' | 'available' | 'contested' | 'fog';
  items: CategorisedRegion[];
  playerPositions: { x: number; y: number }[];
  resources: { gold: number; turns: number };
  onSendSettlers: (region: RegionSlot) => void;
  onAttack: (item: CategorisedRegion) => void;
  seasonAge?: 'early' | 'middle' | 'late';
}

const SEASON_HEADING_COLORS: Record<string, string> = {
  early: '#22c55e',
  middle: '#f59e0b',
  late: '#ef4444',
};

export const MapSection: React.FC<SectionProps> = ({
  title, variant, items, playerPositions, resources, onSendSettlers, onAttack, seasonAge,
}) => (
  <div className="wm-mobile-section">
    <div
      className={`wm-mobile-section-heading ${variant}`}
      style={seasonAge ? { borderLeftColor: SEASON_HEADING_COLORS[seasonAge] } : undefined}
    >
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
