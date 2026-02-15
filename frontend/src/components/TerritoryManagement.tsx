import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { Territory } from '../types/territory';
import { AmplifyFunctionService } from '../services/amplifyFunctionService';
import { ToastService } from '../services/toastService';
import { TopNavigation } from './TopNavigation';
import { LoadingButton } from './ui/loading/LoadingButton';
import { SkeletonCard } from './ui/loading/Skeleton';

const client = generateClient<Schema>();

interface TerritoryManagementProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
}

interface TerritoryFormData {
  name: string;
  terrainType: string;
  coordinates: { x: number; y: number };
  buildings: Record<string, number>;
}

export function TerritoryManagement({ kingdom, onBack }: TerritoryManagementProps) {
  const [territories, setTerritories] = useState<Schema['Territory']['type'][]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [buildingLoading, setBuildingLoading] = useState(false);
  const [formData, setFormData] = useState<TerritoryFormData>({
    name: '',
    terrainType: 'plains',
    coordinates: { x: 0, y: 0 },
    buildings: {}
  });

  const fetchTerritories = useCallback(async () => {
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
  }, [kingdom.id]);

  useEffect(() => {
    fetchTerritories();
  }, [fetchTerritories]);

  const handleCreateTerritory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const result = await ToastService.promise(
        AmplifyFunctionService.claimTerritory({
          kingdomId: kingdom.id,
          name: formData.name,
          terrainType: formData.terrainType,
          coordinates: formData.coordinates
        }),
        {
          loading: 'Claiming territory...',
          success: 'Territory claimed successfully!',
          error: (error) => `Failed to claim territory: ${error.message}`
        }
      ) as { success: boolean };

      if (result && result.success) {
        setShowCreateForm(false);
        setFormData({ 
          name: '', 
          terrainType: 'plains', 
          coordinates: { x: 0, y: 0 },
          buildings: {}
        });
        fetchTerritories();
      }
    } catch (error) {
      console.error('Failed to create territory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuildConstruction = async (territoryId: string, buildingType: string, quantity: number) => {
    setBuildingLoading(true);
    
    try {
      const result = await ToastService.promise(
        AmplifyFunctionService.constructBuildings({
          kingdomId: kingdom.id,
          territoryId,
          buildingType,
          quantity
        }),
        {
          loading: `Constructing ${quantity} ${buildingType}...`,
          success: `Successfully constructed ${quantity} ${buildingType}!`,
          error: (error) => `Construction failed: ${error.message}`
        }
      ) as { success: boolean };

      if (result && result.success) {
        fetchTerritories();
      }
    } catch (error) {
      console.error('Failed to construct buildings:', error);
    } finally {
      setBuildingLoading(false);
    }
  };

  const terrainTypes = [
    'plains', 'forest', 'mountains', 'desert', 'swamp', 'coastal'
  ];

  return (
    <div className="territory-management">
      <TopNavigation
        title="Territory Management"
        onBack={onBack}
        backLabel="← Back to Dashboard"
        actions={
          <button 
            onClick={() => setShowCreateForm(true)}
            className="create-territory-btn"
          >
            + Claim Territory
          </button>
        }
      />

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
              <LoadingButton 
                type="submit" 
                loading={loading}
                className="submit-btn"
              >
                Claim Territory
              </LoadingButton>
              <button 
                type="button" 
                onClick={() => setShowCreateForm(false)}
                className="cancel-btn"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="territories-content">
        {loading ? (
          <div className="territories-grid">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
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
                  <p><strong>Coordinates:</strong> ({(territory.coordinates as { x?: number; y?: number })?.x || 0}, {(territory.coordinates as { x?: number; y?: number })?.y || 0})</p>
                  <p><strong>Fortifications:</strong> Level {(territory as Territory & { fortifications?: number }).fortifications || 0}</p>
                </div>

                <div className="territory-actions">
                  <button className="manage-btn" onClick={() => ToastService.info(`Managing territory: ${territory.name}`)}>Manage</button>
                  <LoadingButton
                    onClick={() => handleBuildConstruction(territory.id!, 'quarries', 1)}
                    loading={buildingLoading}
                    className="build-btn"
                  >
                    Build
                  </LoadingButton>
                  <button className="fortify-btn" onClick={() => handleBuildConstruction(territory.id!, 'forts', 1)}>Fortify</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
