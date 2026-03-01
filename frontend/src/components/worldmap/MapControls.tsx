/**
 * MapControls.tsx
 *
 * Territory detail panels for WorldMap:
 *  - Slide-in territory info panel (shown when a node is clicked)
 *  - Legacy territory panel (fog-of-war detail view)
 *
 * Extracted from WorldMap.tsx.
 */

import React from 'react';
import type { PendingSettlement } from '../../stores/territoryStore';
import {
  WORLD_REGIONS,
  TerritoryNode,
  SelectedTerritoryInfo,
  getTerritoryImage,
  terrainEmoji,
  terrainModSummary,
  claimCost,
  isAdjacentToPlayer,
  isContested,
} from './KingdomNode';

interface MapControlsProps {
  selectedTerritory: SelectedTerritoryInfo | null;
  selectedTerritoryNode: TerritoryNode | null;
  allianceControlledRegions: Record<string, string>;
  pendingSettlements: PendingSettlement[];
  resources: { gold?: number; turns?: number };
  playerPositions: { x: number; y: number }[];
  territoryOwnership: Record<string, 'player' | 'enemy' | 'neutral'>;
  handleClaimTerritory: () => Promise<void>;
  handleRaidSettlers: () => void;
  onClose: () => void;
}

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

export const MapControls: React.FC<MapControlsProps> = ({
  selectedTerritory,
  selectedTerritoryNode,
  allianceControlledRegions,
  pendingSettlements,
  resources,
  playerPositions,
  territoryOwnership,
  handleClaimTerritory,
  handleRaidSettlers,
  onClose,
}) => {
  return (
    <>
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
              {/* Strip crown/flag/swords prefix from display if present */}
              {selectedTerritory.label.replace(/^[\u265a\u2691\u2694]\s*/, '')}
            </h2>

            {/* Ownership badge */}
            {ownershipBadge(selectedTerritory.ownership)}

            {/* Alliance control banner */}
            {selectedTerritory.id in allianceControlledRegions && (
              <div
                title="+15% income from alliance territory control"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'rgba(251,191,36,0.12)',
                  border: '1px solid rgba(251,191,36,0.45)',
                  borderRadius: 6,
                  padding: '0.35rem 0.65rem',
                  marginBottom: '0.75rem',
                  fontSize: '0.78rem',
                  color: '#fbbf24',
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                }}
              >
                <span style={{ fontSize: '1rem' }}>&#x269C;</span>
                You control this region
                <span style={{
                  marginLeft: 'auto',
                  background: 'rgba(251,191,36,0.2)',
                  borderRadius: 4,
                  padding: '0.1rem 0.4rem',
                  fontSize: '0.72rem',
                }}>
                  +15% alliance bonus
                </span>
              </div>
            )}

            {/* Region info */}
            {(() => {
              const region = WORLD_REGIONS.find(r => r.id === selectedTerritory.id);
              return (
                <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  {region?.type === 'capital' ? '5 slots' : region?.type === 'fortress' ? '4 slots' : region?.type === 'settlement' ? '3 slots' : '2 slots'}
                  {' · '}
                  {selectedTerritory.type} region
                </p>
              );
            })()}

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

            {/* Terrain badge with combat modifier summary */}
            {selectedTerritory.terrainType && (
              <div style={{
                marginTop: '0.5rem',
                marginBottom: '0.75rem',
                padding: '0.5rem 0.75rem',
                background: '#111827',
                border: '1px solid #374151',
                borderRadius: 6,
                fontSize: '0.78rem',
              }}>
                <span style={{ fontSize: '1rem', marginRight: '0.4rem' }}>
                  {terrainEmoji(selectedTerritory.terrainType)}
                </span>
                <span style={{ color: '#d1d5db', fontWeight: 600 }}>
                  {terrainModSummary(selectedTerritory.terrainType)}
                </span>
              </div>
            )}

            {/* Kingdom name for enemy territories */}
            {selectedTerritory.ownership === 'enemy' && selectedTerritory.kingdomName && (
              <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Ruled by: <strong style={{ color: '#f87171' }}>{selectedTerritory.kingdomName}</strong>
              </p>
            )}

            {/* Neutral territory — richer claim / state panel */}
            {selectedTerritory.ownership === 'neutral' && (() => {
              const region = WORLD_REGIONS.find(r => r.id === selectedTerritory.id);
              if (!region) return null;

              const contested = isContested(region, territoryOwnership);
              const settling = pendingSettlements.find(
                ps => ps.regionId === region.id && ps.kingdomId === 'current-player'
              );
              const enemySettling = pendingSettlements.find(
                ps => ps.regionId === region.id && ps.kingdomId !== 'current-player'
              );

              if (contested) {
                return (
                  <div style={{marginTop:'1rem', padding:'0.75rem', background:'#450a0a', borderRadius:6, border:'1px solid #7f1d1d'}}>
                    <p style={{color:'#fca5a5', fontSize:'0.8rem', margin:0}}>⚔ Contested Region</p>
                    <p style={{color:'#9ca3af', fontSize:'0.75rem', margin:'0.25rem 0 0'}}>This region lies between kingdoms. It can only be taken through combat.</p>
                  </div>
                );
              }

              if (settling) {
                return (
                  <div style={{marginTop:'1rem', padding:'0.75rem', background:'#1c1917', borderRadius:6, border:'1px solid #b45309'}}>
                    <p style={{color:'#fcd34d', fontSize:'0.8rem', margin:0}}>⚑ Settlers En Route</p>
                    <p style={{color:'#9ca3af', fontSize:'0.75rem', margin:'0.25rem 0 0'}}>Arrives in {settling.turnsRemaining} turns. Enemies can raid to cancel.</p>
                  </div>
                );
              }

              if (enemySettling) {
                return (
                  <button onClick={handleRaidSettlers} style={{marginTop:'1rem', width:'100%', padding:'0.6rem', background:'#7f1d1d', border:'1px solid #dc2626', color:'#fca5a5', cursor:'pointer', borderRadius:6, fontFamily:'var(--font-display,Cinzel,serif)', fontSize:'0.85rem'}}>
                    ⚔ Raid Settlers (costs 2 turns)
                  </button>
                );
              }

              const cost = claimCost(region, playerPositions);
              const canAffordGold  = (resources.gold ?? 0) >= cost.gold;
              const canAffordTurns = (resources.turns ?? 0) >= cost.turns;
              const canAfford = canAffordGold && canAffordTurns;
              const adjacent = isAdjacentToPlayer(region.position, playerPositions);
              const blocked = !adjacent || !canAfford;

              return (
                <div style={{ marginTop: '1rem' }}>
                  <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.4rem', textAlign: 'center' }}>
                    Cost:{' '}
                    <strong style={{ color: canAffordGold ? '#d4a017' : '#f87171' }}>
                      {cost.gold.toLocaleString()}g
                    </strong>
                    {' · '}
                    <strong style={{ color: canAffordTurns ? '#d4a017' : '#f87171' }}>
                      {cost.turns} turns
                    </strong>
                    {'  |  Settles in: '}
                    <strong style={{ color: '#d4a017' }}>{cost.settlingTurns} turns</strong>
                    {!adjacent && <span style={{ color: '#f87171', display: 'block', marginTop: '0.2rem' }}>⚠ Too far from your territory</span>}
                  </p>
                  <button
                    onClick={handleClaimTerritory}
                    disabled={blocked}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      background: blocked ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                      border: blocked ? '1px solid rgba(99,102,241,0.3)' : 'none',
                      color: blocked ? '#64748b' : '#1a1a2e',
                      cursor: blocked ? 'not-allowed' : 'pointer',
                      borderRadius: 6,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      opacity: blocked ? 0.6 : 1,
                    }}
                  >
                    {blocked ? 'Cannot Claim' : 'Dispatch Settlers'}
                  </button>
                </div>
              );
            })()}

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
            onClick={onClose}
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
            onClick={onClose}
            className="close-button"
          >
            Close
          </button>
        </div>
      )}
    </>
  );
};
