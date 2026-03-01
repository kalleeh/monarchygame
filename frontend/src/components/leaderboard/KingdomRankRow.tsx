import React from 'react';
import type { Kingdom } from '../../types/kingdom';
import { calculateNetworth, getTargetIndicator } from './leaderboardHelpers';

interface KingdomRankRowProps {
  kingdom: Kingdom;
  rankNumber: number;
  currentKingdom: Kingdom;
  currentNetworth: number;
  onSendMessage?: (target: { id: string; name: string }) => void;
}

function getRankDelta(kingdom: Kingdom, currentRank: number): React.ReactNode {
  const prev = kingdom.stats.previousSeasonRank;
  if (prev == null) {
    return <span className="lb-rank-new">NEW</span>;
  }
  const delta = prev - currentRank; // positive = improved
  if (delta === 0) return null;
  if (delta > 0) return <span className="lb-rank-up">▲{delta}</span>;
  return <span className="lb-rank-down">▼{Math.abs(delta)}</span>;
}

const KingdomRankRow: React.FC<KingdomRankRowProps> = ({
  kingdom,
  rankNumber,
  currentKingdom,
  currentNetworth,
  onSendMessage,
}) => {
  const networth = calculateNetworth(kingdom);
  const indicator = getTargetIndicator(currentNetworth, networth);
  const baseTurnCost = 4;
  const totalTurnCost = Math.round(baseTurnCost * indicator.turnCostModifier);
  const isCurrentKingdom = kingdom.id === currentKingdom.id;

  return (
    <div className={`kingdom-card ${isCurrentKingdom ? 'owned' : ''}`}>
      <div className="territory-header">
        <span className="territory-icon">{isCurrentKingdom ? '⭐' : '👑'}</span>
        <div className="territory-info">
          <h4 style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
            {/* Online presence dot */}
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: kingdom.isOnline ? '#22c55e' : '#64748b',
                boxShadow: kingdom.isOnline ? '0 0 4px #22c55e' : 'none',
                marginRight: '2px',
                verticalAlign: 'middle',
                flexShrink: 0,
              }}
              title={kingdom.isOnline ? 'Online' : 'Offline'}
            />

            {/* Rank with delta */}
            <span className="lb-rank-badge">
              #{rankNumber}
              {getRankDelta(kingdom, rankNumber)}
            </span>
            {' '}{kingdom.name}{isCurrentKingdom ? ' (You)' : ''}

            {/* Diplomatic message button — not shown for current player's own kingdom */}
            {!isCurrentKingdom && onSendMessage && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSendMessage({ id: kingdom.id, name: kingdom.name });
                }}
                title={`Send diplomatic message to ${kingdom.name}`}
                aria-label={`Send diplomatic message to ${kingdom.name}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(139, 92, 246, 0.14)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  borderRadius: '6px',
                  color: '#c4b5fd',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  lineHeight: 1,
                  padding: '2px 6px',
                  marginLeft: '4px',
                  transition: 'background 0.15s, box-shadow 0.15s',
                  verticalAlign: 'middle',
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139, 92, 246, 0.28)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 6px rgba(139, 92, 246, 0.4)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139, 92, 246, 0.14)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                &#9993;
              </button>
            )}
          </h4>
          <span className="territory-type">{kingdom.race}</span>
        </div>
      </div>

      <div className="territory-production">
        <div className="production-label">Networth</div>
        <div className="production-items">
          <span className="production-item">{(networth / 1_000_000).toFixed(2)}M</span>
        </div>
      </div>

      <div className="territory-production">
        <div className="production-label">Target Difficulty</div>
        <div className="production-items">
          <span className="production-item">
            {indicator.emoji} {indicator.indicator.charAt(0).toUpperCase() + indicator.indicator.slice(1)} ({totalTurnCost} turns)
          </span>
        </div>
      </div>

      {kingdom.stats.previousSeasonRank != null && (
        <div className="territory-production">
          <div className="production-label">
            Last Season{kingdom.stats.previousSeasonNumber != null ? ` #${kingdom.stats.previousSeasonNumber}` : ''}
          </div>
          <div className="production-items">
            <span className="production-item">
              Rank #{kingdom.stats.previousSeasonRank}
              {kingdom.stats.previousSeasonNetworth != null && (
                <> &mdash; {(kingdom.stats.previousSeasonNetworth / 1_000_000).toFixed(2)}M NW</>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default KingdomRankRow;
