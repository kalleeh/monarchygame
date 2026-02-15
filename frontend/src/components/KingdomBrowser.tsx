import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { isDemoMode } from '../utils/authMode';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import './KingdomBrowser.css';

const client = generateClient<Schema>();

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

const KingdomBrowser: React.FC<KingdomBrowserProps> = ({
  kingdomId,
  onBack,
  onAttack,
  onTrade,
  onDiplomacy
}) => {
  const [kingdoms, setKingdoms] = useState<BrowsableKingdom[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const aiKingdoms = useAIKingdomStore(state => state.aiKingdoms);

  useEffect(() => {
    loadKingdoms();
  }, []);

  const loadKingdoms = async () => {
    setLoading(true);
    try {
      if (isDemoMode()) {
        // Use AI kingdoms in demo mode
        const mapped = aiKingdoms.map(k => ({
          id: k.id,
          name: k.name,
          race: k.race,
          land: k.resources.land,
          networth: k.networth || 0,
          isOnline: false
        }));
        setKingdoms(mapped);
      } else {
        // Auth mode: query real kingdoms
        const { data } = await client.models.Kingdom.list({
          filter: { isActive: { eq: true } }
        });

        const mapped = (data || [])
          .filter(k => k.id !== kingdomId)
          .map(k => {
            const resources = (k.resources ?? {}) as Record<string, number>;
            return {
              id: k.id,
              name: k.name,
              race: (k.race as string) || 'Unknown',
              land: resources.land ?? 0,
              networth: (resources.land ?? 0) * 1000 + (resources.gold ?? 0),
              isOnline: k.isOnline ?? false
            };
          });
        setKingdoms(mapped);
      }
    } catch (err) {
      console.error('Failed to load kingdoms:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = kingdoms.filter(k =>
    k.name.toLowerCase().includes(search.toLowerCase()) ||
    k.race.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="kingdom-browser">
      <div className="browser-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h1>Kingdom Browser</h1>
      </div>

      <div className="browser-search">
        <input
          type="text"
          placeholder="Search by name or race..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <span className="result-count">{filtered.length} kingdoms</span>
      </div>

      {loading && <div className="browser-loading">Scouting the realm...</div>}

      <div className="kingdoms-list">
        {filtered.map(kingdom => (
          <div key={kingdom.id} className="browser-kingdom-card">
            <div className="kingdom-main-info">
              <h3>{kingdom.name}</h3>
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
    </div>
  );
};

export default KingdomBrowser;
