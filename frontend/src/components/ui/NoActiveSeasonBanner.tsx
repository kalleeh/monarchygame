import React from 'react';

interface NoActiveSeasonBannerProps {
  onStartSeason: () => void;
  isLoading: boolean;
}

export function NoActiveSeasonBanner({ onStartSeason, isLoading }: NoActiveSeasonBannerProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      padding: '0.75rem 1.25rem',
      marginBottom: '1rem',
      background: 'rgba(99, 102, 241, 0.12)',
      border: '1px solid rgba(99, 102, 241, 0.4)',
      borderRadius: '8px',
      color: '#a5b4fc',
      fontSize: '0.9rem',
      flexWrap: 'wrap',
    }}>
      <span>No active season — the game world is dormant.</span>
      <button
        onClick={onStartSeason}
        disabled={isLoading}
        style={{
          background: 'rgba(99, 102, 241, 0.25)',
          border: '1px solid rgba(99, 102, 241, 0.6)',
          borderRadius: '6px',
          color: '#c7d2fe',
          padding: '0.35rem 0.9rem',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontSize: '0.85rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {isLoading ? 'Starting...' : 'Start New Season'}
      </button>
    </div>
  );
}
