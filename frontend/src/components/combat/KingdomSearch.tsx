/**
 * Kingdom Search Component
 * Search and select target kingdoms for attacks
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Kingdom } from '../../types/combat';
import type { RaceType } from '../../types/amplify';

interface KingdomSearchProps {
  currentKingdomId: string;
  onKingdomSelect: (kingdom: Kingdom | null) => void;
  selectedKingdom: Kingdom | null;
  className?: string;
}

export const KingdomSearch: React.FC<KingdomSearchProps> = ({
  currentKingdomId,
  onKingdomSelect,
  selectedKingdom,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Mock kingdoms data - in real app this would come from API/context
  const mockKingdoms: Kingdom[] = useMemo(() => [
    {
      id: 'kingdom1',
      name: 'Dark Empire',
      race: 'Vampire',
      owner: 'player1',
      resources: { gold: 50000, population: 1200, land: 150, turns: 45 },
      stats: {
        warOffense: 7, warDefense: 6, sorcery: 8, scum: 9, forts: 5,
        tithe: 3, training: 6, siege: 7, economy: 4, building: 5
      },
      territories: [
        {
          id: 'territory1',
          name: 'Shadow Keep',
          coordinates: { x: 25, y: 30 },
          kingdomId: 'kingdom1',
          kingdomName: 'Dark Empire',
          fortificationLevel: 3,
          buildings: { barracks: 2, towers: 1 },
          units: { peasants: 200, militia: 100, knights: 50, cavalry: 25 },
          isCapital: true
        }
      ],
      totalUnits: { peasants: 200, militia: 100, knights: 50, cavalry: 25 },
      isOnline: true,
      lastActive: new Date(Date.now() - 300000)
    },
    {
      id: 'kingdom2',
      name: 'Golden Realm',
      race: 'Human',
      owner: 'player2',
      resources: { gold: 75000, population: 1500, land: 200, turns: 38 },
      stats: {
        warOffense: 5, warDefense: 5, sorcery: 4, scum: 3, forts: 4,
        tithe: 8, training: 5, siege: 4, economy: 9, building: 6
      },
      territories: [
        {
          id: 'territory2',
          name: 'Golden City',
          coordinates: { x: 45, y: 55 },
          kingdomId: 'kingdom2',
          kingdomName: 'Golden Realm',
          fortificationLevel: 2,
          buildings: { barracks: 1, towers: 2, markets: 3 },
          units: { peasants: 300, militia: 80, knights: 40, cavalry: 20 },
          isCapital: true
        }
      ],
      totalUnits: { peasants: 300, militia: 80, knights: 40, cavalry: 20 },
      isOnline: false,
      lastActive: new Date(Date.now() - 7200000)
    },
    {
      id: 'kingdom3',
      name: 'Forest Haven',
      race: 'Elven',
      owner: 'player3',
      resources: { gold: 35000, population: 900, land: 120, turns: 52 },
      stats: {
        warOffense: 6, warDefense: 7, sorcery: 9, scum: 2, forts: 6,
        tithe: 5, training: 7, siege: 3, economy: 6, building: 8
      },
      territories: [
        {
          id: 'territory3',
          name: 'Silverleaf Grove',
          coordinates: { x: 15, y: 70 },
          kingdomId: 'kingdom3',
          kingdomName: 'Forest Haven',
          fortificationLevel: 4,
          buildings: { barracks: 1, towers: 3, temples: 2 },
          units: { peasants: 150, militia: 120, knights: 60, cavalry: 30, archers: 80 },
          isCapital: true
        }
      ],
      totalUnits: { peasants: 150, militia: 120, knights: 60, cavalry: 30, archers: 80 },
      isOnline: true,
      lastActive: new Date(Date.now() - 600000)
    }
  ], []);

  const filteredKingdoms = useMemo(() => {
    return mockKingdoms
      .filter(kingdom => 
        kingdom.id !== currentKingdomId &&
        (searchTerm === '' || 
         kingdom.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         kingdom.race.toLowerCase().includes(searchTerm.toLowerCase()) ||
         (kingdom.owner ?? '').toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .sort((a, b) => {
        // Sort by online status first, then by name
        if (a.isOnline !== b.isOnline) {
          return a.isOnline ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  }, [mockKingdoms, currentKingdomId, searchTerm]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    setFocusedIndex(-1);
  }, []);

  const handleInputFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleInputBlur = useCallback((e: React.FocusEvent) => {
    // Delay closing to allow for clicks on list items
    setTimeout(() => {
      if (!listRef.current?.contains(e.relatedTarget as Node)) {
        setIsOpen(false);
      }
    }, 150);
  }, []);

  const handleKingdomSelect = useCallback((kingdom: Kingdom) => {
    onKingdomSelect(kingdom);
    setSearchTerm(kingdom.name);
    setIsOpen(false);
    setFocusedIndex(-1);
  }, [onKingdomSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev < filteredKingdoms.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev > 0 ? prev - 1 : filteredKingdoms.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && filteredKingdoms[focusedIndex]) {
          handleKingdomSelect(filteredKingdoms[focusedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        searchInputRef.current?.blur();
        break;
    }
  }, [isOpen, filteredKingdoms, focusedIndex, handleKingdomSelect]);

  const clearSelection = useCallback(() => {
    setSearchTerm('');
    onKingdomSelect(null);
    setIsOpen(false);
    searchInputRef.current?.focus();
  }, [onKingdomSelect]);

  const getRaceIcon = useCallback((race: RaceType): string => {
    const raceIcons: Record<RaceType, string> = {
      Human: '👤',
      Elven: '🧝',
      Goblin: '👹',
      Droben: '🐉',
      Vampire: '🧛',
      Elemental: '🔥',
      Centaur: '🐎',
      Sidhe: '🧚',
      Dwarven: '⛏️',
      Fae: '✨'
    };
    return raceIcons[race] || '👤';
  }, []);

  const formatLastActive = useCallback((lastActive: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - lastActive.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  }, []);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex] as HTMLElement;
      focusedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  return (
    <div className={`kingdom-search ${className}`}>
      <div className="search-input-container">
        <input
          ref={searchInputRef}
          type="text"
          className="search-input"
          placeholder="Search kingdoms by name, race, or player..."
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          aria-label="Search for target kingdom"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          role="combobox"
        />
        
        {selectedKingdom && (
          <button
            type="button"
            className="clear-button"
            onClick={clearSelection}
            aria-label="Clear selection"
          >
            ✕
          </button>
        )}
        
        <span className="search-icon">🔍</span>
      </div>

      {isOpen && (
        <ul
          ref={listRef}
          className="kingdom-list"
          role="listbox"
          aria-label="Available kingdoms"
        >
          {filteredKingdoms.length === 0 ? (
            <li className="no-results" role="option" aria-selected="false">
              No kingdoms found matching "{searchTerm}"
            </li>
          ) : (
            filteredKingdoms.map((kingdom, index) => (
              <li
                key={kingdom.id}
                className={`kingdom-item ${index === focusedIndex ? 'focused' : ''} ${kingdom.isOnline ? 'online' : 'offline'}`}
                role="option"
                aria-selected={selectedKingdom?.id === kingdom.id}
                onClick={() => handleKingdomSelect(kingdom)}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                <div className="kingdom-header">
                  <div className="kingdom-name-race">
                    <span className="race-icon">{getRaceIcon(kingdom.race as RaceType)}</span>
                    <span className="kingdom-name">{kingdom.name}</span>
                    <span className="kingdom-race">({kingdom.race})</span>
                  </div>
                  <div className="kingdom-status">
                    <span className={`status-indicator ${kingdom.isOnline ? 'online' : 'offline'}`}>
                      {kingdom.isOnline ? '🟢' : '🔴'}
                    </span>
                    <span className="last-active">{formatLastActive(kingdom.lastActive ?? new Date())}</span>
                  </div>
                </div>
                
                <div className="kingdom-stats">
                  <div className="stat-group">
                    <span className="stat-label">Power:</span>
                    <span className="stat-value">
                      {kingdom.stats.warOffense + kingdom.stats.warDefense}/20
                    </span>
                  </div>
                  <div className="stat-group">
                    <span className="stat-label">Forces:</span>
                    <span className="stat-value">
                      {Object.values(kingdom.totalUnits || {}).reduce((sum, count) => (sum || 0) + (count || 0), 0)} units
                    </span>
                  </div>
                  <div className="stat-group">
                    <span className="stat-label">Land:</span>
                    <span className="stat-value">{kingdom.resources.land} acres</span>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default KingdomSearch;
