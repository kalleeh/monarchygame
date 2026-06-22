/**
 * TargetPicker — unified target-kingdom selection control.
 *
 * Wraps useKingdomTargets and renders a debounced search box plus results in one
 * of three variants: 'cards' (scrollable card grid, default), 'list' (compact
 * selectable rows), or 'dropdown' (combobox-style select for inline use).
 *
 * Always excludes the current kingdom; consumers may pass an additional
 * excludeFilter (e.g. to hide allies or kingdoms already at war) and a
 * metadataRenderer to inject per-action info into each item.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useKingdomTargets, type TargetKingdom } from '../../hooks/useKingdomTargets';
import './TargetPicker.css';

export interface TargetPickerProps {
  currentKingdomId: string;
  range?: [number, number];
  /** Additional excludes (ally / at-war). Self is always excluded. Return true to HIDE. */
  excludeFilter?: (t: TargetKingdom) => boolean;
  /** Per-action extra info rendered inside each item. */
  metadataRenderer?: (t: TargetKingdom) => React.ReactNode;
  onSelect: (t: TargetKingdom) => void;
  selectedId?: string;
  variant?: 'list' | 'dropdown' | 'cards';
  placeholder?: string;
  raceFilter?: string;
}

function formatNetworth(nw: number): string {
  if (nw >= 1_000_000) return `${(nw / 1_000_000).toFixed(1)}M NW`;
  if (nw >= 1_000) return `${(nw / 1_000).toFixed(0)}k NW`;
  return `${nw.toLocaleString()} NW`;
}

export const TargetPicker: React.FC<TargetPickerProps> = ({
  currentKingdomId,
  range,
  excludeFilter,
  metadataRenderer,
  onSelect,
  selectedId,
  variant = 'cards',
  placeholder = 'Search kingdoms by name...',
  raceFilter,
}) => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { targets, loading, hasMore, loadMore } = useKingdomTargets({
    range,
    nameSearch: debouncedSearch || undefined,
    race: raceFilter,
  });

  // Debounce name search input (300ms)
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  const visibleTargets = useMemo(
    () => targets.filter(t => t.id !== currentKingdomId && !(excludeFilter?.(t) ?? false)),
    [targets, currentKingdomId, excludeFilter]
  );

  const loadMoreButton = hasMore ? (
    <button
      type="button"
      className="target-picker__load-more"
      onClick={loadMore}
      disabled={loading}
    >
      {loading ? 'Loading...' : 'Load more'}
    </button>
  ) : null;

  const emptyMessage = loading && visibleTargets.length === 0
    ? 'Loading targets...'
    : 'No kingdoms found matching your search.';

  // ── Dropdown variant ──────────────────────────────────────────────────
  if (variant === 'dropdown') {
    return (
      <div className="target-picker target-picker--dropdown">
        <input
          type="text"
          className="target-picker__search"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="target-picker__select"
          value={selectedId ?? ''}
          onChange={(e) => {
            const t = visibleTargets.find(k => k.id === e.target.value);
            if (t) onSelect(t);
          }}
        >
          <option value="" disabled>
            {visibleTargets.length === 0 ? emptyMessage : 'Select a kingdom...'}
          </option>
          {visibleTargets.map(t => (
            <option key={t.id} value={t.id}>
              {t.name} — {t.race} · {formatNetworth(t.networth)}{t.isOnline ? ' · online' : ''}
            </option>
          ))}
        </select>
        {loadMoreButton}
      </div>
    );
  }

  // ── List variant ──────────────────────────────────────────────────────
  if (variant === 'list') {
    return (
      <div className="target-picker target-picker--list">
        <input
          type="text"
          className="target-picker__search"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {visibleTargets.length === 0 ? (
          <p className="gm-empty-state">{emptyMessage}</p>
        ) : (
          <ul className="target-picker__list" role="listbox" aria-label="Target kingdoms">
            {visibleTargets.map(t => (
              <li
                key={t.id}
                role="option"
                aria-selected={selectedId === t.id}
                className={`target-picker__row ${selectedId === t.id ? 'selected' : ''}`}
                onClick={() => onSelect(t)}
              >
                <span className="target-picker__row-name">{t.name}</span>
                <span className="target-picker__row-meta">
                  {t.race} · {formatNetworth(t.networth)}
                  {t.isOnline && <span className="target-picker__online"> · online</span>}
                </span>
                {metadataRenderer && (
                  <span className="target-picker__row-extra">{metadataRenderer(t)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {loadMoreButton}
      </div>
    );
  }

  // ── Cards variant (default) ───────────────────────────────────────────
  return (
    <div className="target-picker target-picker--cards">
      <input
        type="text"
        className="target-picker__search"
        placeholder={placeholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {visibleTargets.length === 0 ? (
        <p className="gm-empty-state">{emptyMessage}</p>
      ) : (
        <div className="target-picker__grid">
          {visibleTargets.map(t => (
            <button
              type="button"
              key={t.id}
              className={`target-picker__card ${selectedId === t.id ? 'selected' : ''}`}
              onClick={() => onSelect(t)}
            >
              <div className="target-picker__card-header">
                <h4>{t.name}</h4>
                {t.isOnline && <span className="target-picker__online-dot" title="Online" />}
              </div>
              <p className="target-picker__card-race">{t.race}</p>
              {t.difficulty && <p className="target-picker__card-difficulty">{t.difficulty}</p>}
              <p className="target-picker__card-networth">{formatNetworth(t.networth)}</p>
              {metadataRenderer && (
                <div className="target-picker__card-extra">{metadataRenderer(t)}</div>
              )}
            </button>
          ))}
        </div>
      )}
      {loadMoreButton}
    </div>
  );
};

export default TargetPicker;
