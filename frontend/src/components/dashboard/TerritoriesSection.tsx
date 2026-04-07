import React from 'react';
import type { Schema } from '../../../../amplify/data/resource';
import { GoldIcon, PopulationIcon, LandIcon } from '../ui/MenuIcons';

interface Territory {
  id: string;
  name: string;
  type: string;
  resources?: {
    gold?: number;
    population?: number;
    land?: number;
  };
}

interface PendingSettlementsProps {
  kingdomStats: Schema['Kingdom']['type']['stats'];
}

const PendingSettlements = React.memo(function PendingSettlements({ kingdomStats }: PendingSettlementsProps) {
  const pendingSettlements = (() => {
    try {
      const stats = typeof kingdomStats === 'string' ? JSON.parse(kingdomStats) : (kingdomStats ?? {});
      return (stats.pendingSettlements as Array<{ name: string; regionId: string | null; completesAt: string }>) ?? [];
    } catch { return []; }
  })();
  const now = Date.now();
  const activeSettlements = pendingSettlements.filter(ps => new Date(ps.completesAt).getTime() > now);
  if (activeSettlements.length === 0) return null;
  return (
    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px' }}>
      <strong>⏳ Settlers en route ({activeSettlements.length})</strong>
      {activeSettlements.map((ps, i) => {
        const msLeft = new Date(ps.completesAt).getTime() - now;
        const h = Math.floor(msLeft / 3600000);
        const m = Math.floor((msLeft % 3600000) / 60000);
        return <div key={i} style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>• {ps.name} — arrives in {h}h {m}min</div>;
      })}
    </div>
  );
});

interface TerritoriesSectionProps {
  ownedTerritories: Territory[];
  loading: boolean;
  kingdomStats: Schema['Kingdom']['type']['stats'];
  onManageTerritories?: () => void;
}

export function TerritoriesSection({
  ownedTerritories,
  loading,
  kingdomStats,
  onManageTerritories,
}: TerritoriesSectionProps) {
  return (
    <div className="territories-panel">
      <h2>Territories ({ownedTerritories.length})</h2>
      <PendingSettlements kingdomStats={kingdomStats} />
      {loading ? (
        <p>Loading territories...</p>
      ) : ownedTerritories.length === 0 ? (
        <div className="no-territories">
          <p>No territories claimed yet.</p>
          <button
            className="claim-territory-btn"
            onClick={onManageTerritories}
          >
            Claim First Territory
          </button>
        </div>
      ) : (
        <div className="territories-list">
          {ownedTerritories.map((territory) => (
            <div key={territory.id} className="territory-item">
              <h4>{territory.name}</h4>
              <p>Type: {territory.type}</p>
              <div className="territory-resources">
                <span><GoldIcon /> {territory.resources?.gold || 0}</span>
                <span><PopulationIcon /> {territory.resources?.population || 0}</span>
                <span><LandIcon /> {territory.resources?.land || 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
