/**
 * TerritoryCard.tsx
 *
 * Individual territory card for the mobile world-map view.
 * Extracted verbatim from WorldMapMobile.tsx (behavior-preserving).
 */

import React from 'react';
import { useTerritoryStore } from '../../stores/territoryStore';
import {
  type RegionSlot,
  terrainEmoji,
  terrainModSummary,
  getTerritoryImage,
  claimCost,
  RACE_COLORS,
  RACE_ICON_COMPONENTS,
} from './KingdomNode';
import { AIBotIcon, GoldIcon, PopulationIcon, LandIcon } from '../ui/MenuIcons';
import {
  type CategorisedRegion,
  PRODUCTION_BY_TYPE,
  typeLabel,
  settlingCountdown,
} from './territoryTypes';

export interface CardProps {
  item: CategorisedRegion;
  playerPositions: { x: number; y: number }[];
  resources: { gold: number; turns: number };
  onSendSettlers: (region: RegionSlot) => void;
  onAttack: (item: CategorisedRegion) => void;
}

export const TerritoryCard: React.FC<CardProps> = ({
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

  // Race-colored left border for enemy/contested territories
  const raceColor = item.race ? RACE_COLORS[item.race] ?? '#6b7280' : undefined;
  const raceIconNode = item.race ? RACE_ICON_COMPONENTS[item.race] ?? null : null;
  const cardStyle: React.CSSProperties = raceColor && (category === 'contested' || category === 'owned')
    ? { borderLeft: `3px solid ${raceColor}` }
    : {};

  // Status badge
  let statusBadgeClass = 'wm-badge ';
  let statusText = '';
  if (category === 'owned') {
    statusBadgeClass += 'wm-badge-owned';
    statusText = '♚ Owned';
  } else if (isSettling) {
    statusBadgeClass += 'wm-badge-settling';
    statusText = completesAt
      ? `⚑ Settling — ${settlingCountdown(completesAt)}`
      : `⚑ Settling (${turnsRemaining}t)`;
  } else if (category === 'available') {
    statusBadgeClass += 'wm-badge-unclaimed';
    statusText = '○ Unclaimed';
  } else if (category === 'contested') {
    statusBadgeClass += 'wm-badge-contested';
    statusText = '⚔ Contested';
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
            ? <>Upgrade to Lv.{(territory.defenseLevel ?? 0) + 1} · <GoldIcon />{Math.floor(upgradeCost.gold).toLocaleString()}</>
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
      <button className="wm-territory-action wm-action-attack" onClick={() => onAttack(item)}>
        Attack
      </button>
    );
  }

  return (
    <div className={cardClass} style={cardStyle}>
      {/* Name row */}
      <div className="wm-territory-name-row">
        <span className="wm-territory-name">
          {emoji} {region.name}
        </span>
        {raceIconNode && category === 'contested' && (
          <span style={{ fontSize: '1.2rem', marginRight: 4, display: 'inline-flex' }} title={item.race}>
            {item.isAI ? <AIBotIcon /> : raceIconNode}
          </span>
        )}
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
          <span className="wm-stat"><GoldIcon /> {prod.gold}/tick</span>
          <span className="wm-stat"><PopulationIcon /> {prod.pop}/tick</span>
          <span className="wm-stat"><LandIcon /> {prod.land}/tick</span>
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
