import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { KingdomResources } from '../types/amplify';

// Minimal RACES data - TODO: Fix import from game-data  
const RACES = {
  human: {
    id: 'human',
    name: 'Human',
    description: 'Balanced race with strong economic focus',
    stats: { warOffense: 3, warDefense: 3, sorcery: 3, economy: 5 }
  },
  elven: {
    id: 'elven',
    name: 'Elven',
    description: 'Skilled warriors and mages', 
    stats: { warOffense: 4, warDefense: 3, sorcery: 4, economy: 3 }
  }
};

const client = generateClient<Schema>();

interface KingdomDashboardProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
  onManageTerritories?: () => void;
  onManageCombat?: () => void;
  onManageAlliance?: () => void;
  onViewWorldMap?: () => void;
  onCastSpells?: () => void;
  onManageTrade?: () => void;
}

export function KingdomDashboard({ kingdom, onBack, onManageTerritories, onManageCombat, onManageAlliance, onViewWorldMap, onCastSpells, onManageTrade }: KingdomDashboardProps) {
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
              <img src="/gold-resource-icon.png" alt="Gold" className="resource-icon-img" />
              <div>
                <div className="resource-value">{resources?.gold || 0}</div>
                <div className="resource-label">Gold</div>
              </div>
            </div>
            <div className="resource-item">
              <img src="/population-resource-icon.png" alt="Population" className="resource-icon-img" />
              <div>
                <div className="resource-value">{resources?.population || 0}</div>
                <div className="resource-label">Population</div>
              </div>
            </div>
            <div className="resource-item">
              <img src="/land-resource-icon.png" alt="Land" className="resource-icon-img" />
              <div>
                <div className="resource-value">{resources?.land || 0}</div>
                <div className="resource-label">Land</div>
              </div>
            </div>
            <div className="resource-item">
              <img src="/time-turns-icon.png" alt="Turns" className="resource-icon-img" />
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
              onClick={onManageTerritories}
            >
              <img src="/territories-icon.png" alt="Territories" className="action-icon" />
              Manage Territories
            </button>
            <button 
              className="action-btn primary"
              onClick={onViewWorldMap}
            >
              <img src="/world-map-icon.png" alt="World Map" className="action-icon" />
              World Map
            </button>
            <button 
              className="action-btn"
              onClick={onManageCombat}
            >
              <img src="/combat-icon.png" alt="Combat" className="action-icon" />
              Combat Operations
            </button>
            <button 
              className="action-btn"
              onClick={onManageAlliance}
            >
              <img src="/alliance-icon.png" alt="Alliance" className="action-icon" />
              Alliance Management
            </button>
            <button 
              className="action-btn"
              onClick={onCastSpells}
            >
              <img src="/magic-spells-icon.png" alt="Magic" className="action-icon" />
              Cast Spells
            </button>
            <button className="action-btn">
              <img src="/train-units-icon.png" alt="Train Units" className="action-icon" />
              Train Units
            </button>
            <button 
              className="action-btn trade-btn"
              onClick={onManageTrade}
            >
              <img src="/trade-economy-icon.png" alt="Trade" className="action-icon" />
              Trade
            </button>
            <button className="action-btn">
              <img src="/diplomacy-icon.png" alt="Diplomacy" className="action-icon" />
              Diplomacy
            </button>
            <button className="action-btn danger">
              <img src="/battle-reports-icon.png" alt="Battle Reports" className="action-icon" />
              Battle Reports
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
