/**
 * SeasonResults — Modal ceremony displayed when a season ends.
 * Shows the three alliance victory tracks and the top-5 individual rankings.
 * Works in both demo (mock data) and auth modes.
 */

import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SeasonResultsProps {
  seasonNumber: number;
  topKingdoms: Array<{ name: string; race: string; networth: number; rank: number }>;
  victoryTracks?: {
    militaryChampion?: { allianceName: string; totalLandGained: number };
    economicPowerhouse?: { allianceName: string; totalNetworth: number };
    strategistGuild?: { allianceName: string; territoriesControlled: number };
  };
  onClose: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TrophyCardProps {
  icon: string;
  title: string;
  winner?: string;
  subtitle: string;
  accentColor: string;
}

function TrophyCard({ icon, title, winner, subtitle, accentColor }: TrophyCardProps) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${accentColor}44`,
        borderRadius: 10,
        padding: '1.1rem 1.25rem',
        minWidth: 0,
        flex: '1 1 200px',
      }}
    >
      <div style={{ fontSize: '1.6rem', marginBottom: '0.3rem' }}>{icon}</div>
      <div style={{ color: accentColor, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
        {title}
      </div>
      {winner ? (
        <>
          <div style={{ color: '#f0e6cc', fontWeight: 700, fontSize: '1rem', marginBottom: '0.2rem', fontFamily: 'var(--font-display, Cinzel, serif)' }}>
            {winner}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{subtitle}</div>
        </>
      ) : (
        <div style={{ color: '#4b5563', fontSize: '0.85rem', fontStyle: 'italic' }}>No data</div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const SeasonResults: React.FC<SeasonResultsProps> = ({
  seasonNumber,
  topKingdoms,
  victoryTracks,
  onClose,
}) => {
  const top5 = topKingdoms.slice(0, 5);

  // Rank medal helper
  const medal = (rank: number) => {
    if (rank === 1) return { icon: '&#x1F947;', color: '#fbbf24' }; // gold
    if (rank === 2) return { icon: '&#x1F948;', color: '#9ca3af' }; // silver
    if (rank === 3) return { icon: '&#x1F949;', color: '#b45309' }; // bronze
    return { icon: `#${rank}`, color: '#6b7280' };
  };

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
        padding: '1rem',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #0f1629 0%, #1a0a2e 50%, #0f1629 100%)',
          border: '1px solid rgba(212,160,23,0.4)',
          borderRadius: 16,
          padding: '2rem',
          maxWidth: 620,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 0 60px rgba(139,92,246,0.25), 0 0 30px rgba(212,160,23,0.15)',
          fontFamily: 'var(--font-display, Cinzel, serif)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>&#x1F3C6;</div>
          <h1 style={{
            margin: 0,
            fontSize: 'clamp(1.4rem, 5vw, 2rem)',
            background: 'linear-gradient(135deg, #d4a017 0%, #a855f7 60%, #d4a017 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '0.06em',
          }}>
            Season {seasonNumber} Complete!
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.5rem 0 0', letterSpacing: '0.04em' }}>
            The chronicles of this age are sealed for eternity.
          </p>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid rgba(212,160,23,0.2)', marginBottom: '1.5rem' }} />

        {/* Victory Tracks */}
        <h2 style={{ color: '#a855f7', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.85rem', marginTop: 0 }}>
          Alliance Honours
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.75rem' }}>
          <TrophyCard
            icon="&#x2694;"
            title="Military Champion"
            winner={victoryTracks?.militaryChampion?.allianceName}
            subtitle={
              victoryTracks?.militaryChampion
                ? `${victoryTracks.militaryChampion.totalLandGained.toLocaleString()} land conquered`
                : ''
            }
            accentColor="#ef4444"
          />
          <TrophyCard
            icon="&#x1F4B0;"
            title="Economic Powerhouse"
            winner={victoryTracks?.economicPowerhouse?.allianceName}
            subtitle={
              victoryTracks?.economicPowerhouse
                ? `${(victoryTracks.economicPowerhouse.totalNetworth / 1_000_000).toFixed(2)}M combined NW`
                : ''
            }
            accentColor="#fbbf24"
          />
          <TrophyCard
            icon="&#x1F5FA;"
            title="Strategist Guild"
            winner={victoryTracks?.strategistGuild?.allianceName}
            subtitle={
              victoryTracks?.strategistGuild
                ? `${victoryTracks.strategistGuild.territoriesControlled} region${victoryTracks.strategistGuild.territoriesControlled !== 1 ? 's' : ''} dominated`
                : ''
            }
            accentColor="#22d3ee"
          />
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid rgba(212,160,23,0.2)', marginBottom: '1.5rem' }} />

        {/* Top 5 Kingdoms */}
        <h2 style={{ color: '#a855f7', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.85rem', marginTop: 0 }}>
          Hall of Kings — Top 5
        </h2>

        {top5.length === 0 ? (
          <p style={{ color: '#4b5563', fontStyle: 'italic', fontSize: '0.85rem' }}>No rankings recorded.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.75rem' }}>
            {top5.map((k) => {
              const { icon, color } = medal(k.rank);
              return (
                <div
                  key={k.rank}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: k.rank === 1 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)',
                    border: k.rank === 1 ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 8,
                    padding: '0.6rem 0.9rem',
                  }}
                >
                  <span
                    style={{ color, fontWeight: 700, fontSize: '1rem', minWidth: '2rem', textAlign: 'center' }}
                    dangerouslySetInnerHTML={{ __html: icon }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#f0e6cc', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {k.name}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.72rem' }}>{k.race}</div>
                  </div>
                  <div style={{ color: '#d4a017', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {(k.networth / 1_000_000).toFixed(2)}M NW
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Divider */}
        <div style={{ borderTop: '1px solid rgba(212,160,23,0.2)', marginBottom: '1.25rem' }} />

        {/* Footer */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <p style={{ color: '#6b7280', fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
            A new age is about to dawn. The next season begins soon.
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            display: 'block',
            width: '100%',
            padding: '0.65rem',
            background: 'linear-gradient(90deg, #7c3aed, #4f46e5)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontFamily: 'var(--font-display, Cinzel, serif)',
            fontSize: '0.9rem',
            letterSpacing: '0.06em',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.opacity = '0.85'; }}
          onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.opacity = '1'; }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default SeasonResults;
