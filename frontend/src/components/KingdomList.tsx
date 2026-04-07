import { useNavigate } from 'react-router-dom';
import type { Schema } from '../../../amplify/data/resource';
import { isDemoMode } from '../utils/authMode';
import { GoldIcon, PopulationIcon, LandIcon, TurnsIcon, InfoIcon } from './ui/MenuIcons';
import './KingdomList.css';

function KingdomList({ kingdoms: propKingdoms }: { kingdoms: Schema['Kingdom']['type'][] }) {
  const navigate = useNavigate();

  // Use kingdoms from App.tsx (already filtered by owner, with limit:1000)
  const kingdoms = propKingdoms;

  const getKingdomResources = (kingdom: Schema['Kingdom']['type']) => {
    // In auth mode prefer server-side resources stored on the kingdom record
    if (!isDemoMode()) {
      if (typeof kingdom.resources === 'string') {
        try { return JSON.parse(kingdom.resources); } catch { /* fall through */ }
      } else if (kingdom.resources && typeof kingdom.resources === 'object') {
        return kingdom.resources as { gold: number; population: number; land: number; turns: number };
      }
    }
    // Demo mode (or auth mode with no server resources): read from localStorage
    const stored = localStorage.getItem(`kingdom-${kingdom.id}`);
    if (stored) {
      try { return JSON.parse(stored).resources ?? {}; } catch { /* fall through */ }
    }
    return { gold: 0, population: 0, land: 0, turns: 0 };
  };

  return (
    <div className="kingdom-management">
      <div className="kingdoms-header">
        <div>
          <h2>Your Kingdoms</h2>
          <p style={{margin:'0.25rem 0 0 0',fontSize:'0.9rem',color:'#9ca3af',fontStyle:'italic'}}>Rule wisely. Conquer boldly.</p>
        </div>
        <button className="create-new-btn" onClick={() => navigate('/creation')}>
          Create New Kingdom
        </button>
      </div>

      {kingdoms.length === 0 ? (
        <div className="no-kingdoms">
          <p>You haven't created any kingdoms yet.</p>
          <button className="create-first-btn" onClick={() => navigate('/creation')}>
            Create Your First Kingdom
          </button>
        </div>
      ) : (
        <div className="kingdoms-grid">
          {kingdoms.map((kingdom) => {
            const resources = getKingdomResources(kingdom);
            return (
              <div key={kingdom.id} className="kingdom-card">
                <h3 style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                  <img src="/logo.png" style={{width:'24px',height:'24px',objectFit:'contain',flexShrink:0}} alt="" />
                  {kingdom.name}
                </h3>
                <div className="kingdom-info">
                  <p><strong>Race:</strong> {kingdom.race}</p>
                  <p><strong><GoldIcon /> Gold:</strong> {resources?.gold?.toLocaleString() || 0}</p>
                  <p><strong><PopulationIcon /> Population:</strong> {resources?.population?.toLocaleString() || 0}</p>
                  <p><strong><LandIcon /> Land:</strong> {resources?.land?.toLocaleString() || 0}</p>
                  <p><strong><TurnsIcon /> Turns:</strong> {resources?.turns || 0}</p>
                </div>
                <div className="kingdom-actions">
                  <button 
                    className="enter-kingdom-btn"
                    onClick={() => navigate(`/kingdom/${kingdom.id}`)}
                  >
                    Enter Kingdom
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {kingdoms.length > 0 && (
        <div style={{
          marginTop:'2rem',
          padding:'0.875rem 1rem',
          border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:'8px',
          background:'rgba(255,255,255,0.03)'
        }}>
          <p style={{margin:0,fontSize:'0.85rem',color:'#9ca3af'}}>
            <InfoIcon /> Tip: Claim territories to increase your income each turn.
          </p>
        </div>
      )}
    </div>
  );
}

export default KingdomList;
