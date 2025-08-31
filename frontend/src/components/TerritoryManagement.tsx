import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

interface TerritoryManagementProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
}

interface TerritoryFormData {
  name: string;
  terrainType: string;
  coordinates: { x: number; y: number };
}

export function TerritoryManagement({ kingdom, onBack }: TerritoryManagementProps) {
  const [territories, setTerritories] = useState<Schema['Territory']['type'][]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<TerritoryFormData>({
    name: '',
    terrainType: 'plains',
    coordinates: { x: 0, y: 0 }
  });

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

  const handleCreateTerritory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await client.models.Territory.create({
        name: formData.name,
        terrainType: formData.terrainType,
        coordinates: formData.coordinates,
        buildings: {},
        units: {},
        fortifications: 0,
        kingdomId: kingdom.id!
      });

      setShowCreateForm(false);
      setFormData({ name: '', terrainType: 'plains', coordinates: { x: 0, y: 0 } });
      fetchTerritories();
    } catch (error) {
      console.error('Failed to create territory:', error);
      alert('Failed to create territory. Please try again.');
    }
  };

  const terrainTypes = [
    'plains', 'forest', 'mountains', 'desert', 'swamp', 'coastal'
  ];

  return (
    <div className="territory-management">
      <header className="territory-header">
        <button onClick={onBack} className="back-btn">← Back to Dashboard</button>
        <h1>Territory Management</h1>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="create-territory-btn"
        >
          + Claim Territory
        </button>
      </header>

      {showCreateForm && (
        <div className="create-form-overlay">
          <form onSubmit={handleCreateTerritory} className="create-territory-form">
            <h2>Claim New Territory</h2>
            
            <div className="form-group">
              <label htmlFor="territory-name">Territory Name:</label>
              <input
                id="territory-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label htmlFor="terrain-type">Terrain Type:</label>
              <select
                id="terrain-type"
                value={formData.terrainType}
                onChange={(e) => setFormData({ ...formData, terrainType: e.target.value })}
              >
                {terrainTypes.map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="coordinates-group">
              <label>Coordinates:</label>
              <div className="coordinates-inputs">
                <input
                  type="number"
                  placeholder="X"
                  value={formData.coordinates.x}
                  onChange={(e) => setFormData({
                    ...formData,
                    coordinates: { ...formData.coordinates, x: parseInt(e.target.value) || 0 }
                  })}
                />
                <input
                  type="number"
                  placeholder="Y"
                  value={formData.coordinates.y}
                  onChange={(e) => setFormData({
                    ...formData,
                    coordinates: { ...formData.coordinates, y: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn">Claim Territory</button>
              <button 
                type="button" 
                onClick={() => setShowCreateForm(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="territories-content">
        {loading ? (
          <div className="loading">Loading territories...</div>
        ) : territories.length === 0 ? (
          <div className="no-territories">
            <h2>No Territories Claimed</h2>
            <p>Your kingdom needs territories to grow and prosper.</p>
            <button 
              onClick={() => setShowCreateForm(true)}
              className="claim-first-btn"
            >
              Claim Your First Territory
            </button>
          </div>
        ) : (
          <div className="territories-grid">
            {territories.map((territory) => (
              <div key={territory.id} className="territory-card">
                <div className="territory-header-card">
                  <h3>{territory.name}</h3>
                  <span className="terrain-badge">{territory.terrainType}</span>
                </div>
                
                <div className="territory-info">
                  <p><strong>Coordinates:</strong> ({territory.coordinates?.x}, {territory.coordinates?.y})</p>
                  <p><strong>Fortifications:</strong> Level {territory.fortifications}</p>
                </div>

                <div className="territory-actions">
                  <button className="manage-btn">Manage</button>
                  <button className="build-btn">Build</button>
                  <button className="fortify-btn">Fortify</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
