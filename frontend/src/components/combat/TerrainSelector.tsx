import { useState } from 'react';
import { TerrainType } from '../../types/combat';
import { TERRAINS } from '../../data/terrains';
import './CombatEnhancements.css';

interface TerrainSelectorProps {
  selectedTerrain: TerrainType;
  onTerrainChange: (terrain: TerrainType) => void;
}

export const TerrainSelector = ({ selectedTerrain, onTerrainChange }: TerrainSelectorProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const selectedTerrainData = TERRAINS.find((t) => t.type === selectedTerrain);

  return (
    <div className="terrain-selector">
      <h3>🗺️ Battle Terrain</h3>
      
      <div className="terrain-grid">
        {TERRAINS.map((terrain) => (
          <button
            key={terrain.type}
            className={`terrain-option ${selectedTerrain === terrain.type ? 'selected' : ''}`}
            onClick={() => onTerrainChange(terrain.type)}
            title={terrain.description}
          >
            <span className="terrain-icon">{terrain.icon}</span>
            <span className="terrain-name">{terrain.name}</span>
          </button>
        ))}
      </div>

      {selectedTerrainData && (
        <div className="terrain-details">
          <button 
            className="details-toggle"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '▼' : '▶'} Terrain Effects
          </button>
          
          {showDetails && (
            <div className="modifier-list">
              <p className="terrain-description">{selectedTerrainData.description}</p>
              {Object.entries(selectedTerrainData.modifiers).map(([key, value]) => (
                <div key={key} className={`modifier ${value > 0 ? 'positive' : 'negative'}`}>
                  <span className="modifier-name">{key}:</span>
                  <span className="modifier-value">
                    {value > 0 ? '+' : ''}{(value * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
