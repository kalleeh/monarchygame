import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { KingdomResources } from '../types/amplify';
import { RACES } from '../../../game-data/races';

const client = generateClient<Schema>();

interface KingdomDashboardProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
}

export function KingdomDashboard({ kingdom, onBack }: KingdomDashboardProps) {
  const [territories, setTerritories] = useState<Schema['Territory']['type'][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTerritories();
  }, [kingdom.id]);

  const fetchTerritories = async () => {
    try {
      const { data } = await client.models.Territory.list({
        filter: { kingdomId: { eq: kingdom.id } }
      });
      setTerritories(data);
    } catch (error) {
      console.error('Failed to fetch territories:', error);
    } finally {
      setLoading(false);
    }
  };

  const resources = kingdom.resources as KingdomResources;
  const raceData = RACES[kingdom.race as keyof typeof RACES];

  return (
    <div className="kingdom-dashboard">
      <header className="dashboard-header">
        <button onClick={onBack} className="back-btn">← Back to Kingdoms</button>
        <h1>{kingdom.name}</h1>
        <div className="kingdom-race">
          <span className="race-badge">{kingdom.race}</span>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="resources-panel">
          <h2>Resources</h2>
          <div className="resources-grid">
            <div className="resource-item">
              <span className="resource-icon">💰</span>
              <div>
                <div className="resource-value">{resources?.gold || 0}</div>
                <div className="resource-label">Gold</div>
              </div>
            </div>
            <div className="resource-item">
              <span className="resource-icon">👥</span>
              <div>
                <div className="resource-value">{resources?.population || 0}</div>
                <div className="resource-label">Population</div>
              </div>
            </div>
            <div className="resource-item">
              <span className="resource-icon">🏞️</span>
              <div>
                <div className="resource-value">{resources?.land || 0}</div>
                <div className="resource-label">Land</div>
              </div>
            </div>
            <div className="resource-item">
              <span className="resource-icon">⏰</span>
              <div>
                <div className="resource-value">{resources?.turns || 0}</div>
                <div className="resource-label">Turns</div>
              </div>
            </div>
          </div>
        </div>

        <div className="race-stats-panel">
          <h2>Race Abilities</h2>
          <div className="race-info">
            <p className="special-ability">
              <strong>Special:</strong> {raceData?.specialAbility}
            </p>
            <div className="stats-mini">
              {raceData && Object.entries(raceData.stats).slice(0, 4).map(([stat, value]) => (
                <div key={stat} className="stat-mini">
                  <span className="stat-name">{stat}</span>
                  <div className="stat-bar-mini">
                    <div 
                      className="stat-fill-mini" 
                      style={{ width: `${value * 20}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="territories-panel">
          <h2>Territories ({territories.length})</h2>
          {loading ? (
            <p>Loading territories...</p>
          ) : territories.length === 0 ? (
            <div className="no-territories">
              <p>No territories claimed yet.</p>
              <button className="claim-territory-btn">Claim First Territory</button>
            </div>
          ) : (
            <div className="territories-list">
              {territories.map((territory) => (
                <div key={territory.id} className="territory-item">
                  <h4>{territory.name}</h4>
                  <p>Type: {territory.terrainType}</p>
                  <p>Fortifications: {territory.fortifications}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="actions-panel">
          <h2>Kingdom Actions</h2>
          <div className="action-buttons">
            <button 
              className="action-btn primary"
              onClick={() => window.location.hash = 'territories'}
            >
              Manage Territories
            </button>
            <button className="action-btn">Train Units</button>
            <button className="action-btn">Cast Spells</button>
            <button className="action-btn">Diplomacy</button>
            <button className="action-btn">Trade</button>
            <button className="action-btn danger">Battle Reports</button>
          </div>
        </div>
      </div>
    </div>
  );
}
