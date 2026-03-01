import React from 'react';

interface LeaderboardFilterState {
  showOnlyFairTargets: boolean;
  hideNPPKingdoms: boolean;
  showOnlyYourFaith: boolean;
}

interface LeaderboardFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filters: LeaderboardFilterState;
  onFiltersChange: (filters: LeaderboardFilterState) => void;
}

const TOGGLE_ITEMS = [
  { key: 'showOnlyFairTargets', label: 'Show fair targets only' },
  { key: 'hideNPPKingdoms',     label: 'Hide protected players' },
  { key: 'showOnlyYourFaith',   label: 'Show guild-eligible'    },
] as const;

const LeaderboardFilters: React.FC<LeaderboardFiltersProps> = ({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
}) => {
  return (
    <>
      {/* Search input */}
      <div className="lb-search-wrapper">
        <input
          type="search"
          placeholder="Search kingdoms…"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="lb-search-input"
          aria-label="Search kingdoms by name"
        />
      </div>

      {/* Toggle filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '1rem' }}>
        {TOGGLE_ITEMS.map(({ key, label }) => {
          const checked = filters[key];
          return (
            <label
              key={key}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', userSelect: 'none', color: '#d1d5db' }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onFiltersChange({ ...filters, [key]: e.target.checked })}
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
              />
              {/* Toggle track */}
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  position: 'relative',
                  width: '40px',
                  height: '22px',
                  borderRadius: '11px',
                  background: checked ? '#14b8a6' : '#374151',
                  transition: 'background 0.2s ease',
                  flexShrink: 0,
                  boxShadow: checked ? '0 0 6px rgba(20,184,166,0.5)' : 'none',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: checked ? '21px' : '3px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  }}
                />
              </span>
              {label}
            </label>
          );
        })}
      </div>
    </>
  );
};

export default LeaderboardFilters;
