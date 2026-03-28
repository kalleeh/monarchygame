import React, { useState, useEffect, useCallback } from 'react';
import { isDemoMode } from '../utils/authMode';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { KingdomSearchService } from '../services/KingdomSearchService';
import { TopNavigation } from './TopNavigation';
import './KingdomBrowser.css';

interface BrowsableKingdom {
  id: string;
  name: string;
  race: string;
  land: number;
  networth: number;
  isOnline: boolean;
}

interface KingdomBrowserProps {
  kingdomId: string;
  onBack: () => void;
  onAttack?: (targetId: string) => void;
  onTrade?: (targetId: string) => void;
  onDiplomacy?: (targetId: string) => void;
}

const RACE_OPTIONS = ['', 'Human', 'Elf', 'Dwarf', 'Orc', 'Undead', 'Halfling', 'Gnome', 'Troll', 'Vampire', 'Sidhe', 'Centaur', 'Faerie', 'Lizardman', 'Minotaur'];

const KingdomBrowser: React.FC<KingdomBrowserProps> = ({
  kingdomId,
  onBack,
  onAttack,
  onTrade,
  onDiplomacy
}) => {
  const [kingdoms, setKingdoms] = useState<BrowsableKingdom[]>([]);
  const [search, setSearch] = useState('');
  const [raceFilter, setRaceFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const aiKingdoms = useAIKingdomStore(state => state.aiKingdoms);

  const loadKingdoms = useCallback(async (append: boolean, token: string | null, nameSearch: string, race: string) => {
    setLoading(true);
    try {
      if (isDemoMode()) {
        const filtered = aiKingdoms
          .filter(k => {
            const nameMatch = !nameSearch || k.name.toLowerCase().includes(nameSearch.toLowerCase()) || k.race.toLowerCase().includes(nameSearch.toLowerCase());
            const raceMatch = !race || k.race === race;
            return nameMatch && raceMatch;
          })
          .map(k => ({
            id: k.id,
            name: k.name,
            race: k.race,
            land: k.resources.land,
            networth: k.networth || 0,
            isOnline: false,
          }));
        setKingdoms(filtered);
        setHasMore(false);
      } else {
        const result = await KingdomSearchService.listByNetworth({
          nameSearch: nameSearch || undefined,
          race: race || undefined,
          limit: 50,
          nextToken: append ? token : null,
        });
        if (result) {
          const mapped = result.kingdoms
            .filter(k => k.id !== kingdomId)
            .map(k => ({
              id: k.id,
              name: k.name,
              race: k.race,
              land: k.resources.land,
              networth: k.networth,
              isOnline: k.isOnline,
            }));
          setKingdoms(prev => append ? [...prev, ...mapped] : mapped);
          setNextToken(result.nextToken);
          setHasMore(!!result.nextToken);
        }
      }
    } catch (err) {
      console.error('Failed to load kingdoms:', err);
    } finally {
      setLoading(false);
    }
  }, [aiKingdoms, kingdomId]);

  useEffect(() => {
    setNextToken(null);
    setHasMore(false);
    void loadKingdoms(false, null, search, raceFilter);
  }, [search, raceFilter]);

  // Initial load
  useEffect(() => {
    void loadKingdoms(false, null, '', '');
  }, []);

  const handleLoadMore = () => {
    if (hasMore && !loading) void loadKingdoms(true, nextToken, search, raceFilter);
  };

  return (
    <div className="kingdom-browser">
      <TopNavigation
        title="Kingdom Browser"
        onBack={onBack}
        backLabel="← Back to Kingdom"
        kingdomId={kingdomId}
      />

      <div className="browser-search">
        <input
          type="text"
          placeholder="Search by name or race..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          value={raceFilter}
          onChange={(e) => setRaceFilter(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '0.9rem',
            marginLeft: '0.5rem',
          }}
        >
          {RACE_OPTIONS.map(r => (
            <option key={r} value={r}>{r || 'All Races'}</option>
          ))}
        </select>
        <span className="result-count">{kingdoms.length} kingdoms{hasMore ? '+' : ''}</span>
      </div>

      {loading && kingdoms.length === 0 && <div className="browser-loading">Scouting the realm...</div>}

      {!loading && kingdoms.length === 0 && (
        <div style={{ padding: '1rem', color: '#a0a0a0', textAlign: 'center' }}>
          No kingdoms found matching your search.
        </div>
      )}

      <div className="kingdoms-list">
        {kingdoms.map(kingdom => (
          <div key={kingdom.id} className="browser-kingdom-card">
            <div className="kingdom-main-info">
              <h3>
                <span
                  className={kingdom.isOnline ? 'presence-dot presence-dot--online' : 'presence-dot presence-dot--offline'}
                  title={kingdom.isOnline ? 'Online' : 'Offline'}
                />
                {kingdom.name}
              </h3>
              <span className="kingdom-race">{kingdom.race}</span>
              {kingdom.isOnline && <span className="online-badge">Online</span>}
            </div>
            <div className="kingdom-stats-row">
              <span>Land: {kingdom.land.toLocaleString()}</span>
              <span>Networth: {kingdom.networth.toLocaleString()}</span>
            </div>
            <div className="kingdom-action-buttons">
              {onAttack && <button className="action-btn attack-btn" onClick={() => onAttack(kingdom.id)}>Attack</button>}
              {onTrade && <button className="action-btn trade-btn" onClick={() => onTrade(kingdom.id)}>Trade</button>}
              {onDiplomacy && <button className="action-btn diplomacy-btn" onClick={() => onDiplomacy(kingdom.id)}>Diplomacy</button>}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <button
            onClick={handleLoadMore}
            disabled={loading}
            style={{
              padding: '0.5rem 1.5rem',
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.4)',
              borderRadius: '6px',
              color: '#a78bfa',
              fontSize: '0.9rem',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Loading...' : 'Load more kingdoms'}
          </button>
        </div>
      )}
    </div>
  );
};

export default KingdomBrowser;
