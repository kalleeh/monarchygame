/**
 * Unit Summon Interface Component
 * Uses authentic Monarchy summon mechanics (networth-based)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSummonStore } from '../stores/useSummonStore';
import { useKingdomStore } from '../stores/kingdomStore';
import { ErrorBoundary } from './ErrorBoundary';
import { TopNavigation } from './TopNavigation';
import { ToastService } from '../services/toastService';
import './UnitSummonInterface.css';

interface UnitSummonInterfaceProps {
  kingdomId: string;
  race: string;
  onBack: () => void;
}

type SummonView = 'dashboard' | 'summon';

// Helper to get race-specific image for universal units
const getUnitImagePath = (unitId: string, race: string): string => {
  const universalUnits: Record<string, string> = {
    'peasant': 'peasants',
    'assassins': 'assassins', 
    'scouts': 'scouts'
  };
  
  // If it's a universal unit, try race-specific image first
  if (universalUnits[unitId]) {
    const raceLower = race.toLowerCase();
    const unitName = universalUnits[unitId];
    // Try race-specific, fallback to generic
    return `/units/output/${raceLower}-${unitName}-icon.png`;
  }
  
  // Otherwise use the unit's own ID
  return `/units/output/${unitId.replace(/_/g, '-')}-icon.png`;
};

const UnitSummonContent: React.FC<UnitSummonInterfaceProps> = ({ 
  kingdomId,
  race,
  onBack 
}) => {
  const [currentView, setCurrentView] = useState<SummonView>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    availableUnits,
    accumulatedGoldSpent,
    summonUnits,
    calculateRemainingCapacity,
    calculateMaxAffordable,
    getTotalUpkeep,
    loadSummonData,
    error: storeError
  } = useSummonStore();

  // Get current units from kingdom store (single source of truth)
  const currentUnits = useKingdomStore((state) => state.units);
  const resources = useKingdomStore((state) => state.resources);
  
  // Calculate troop cap info
  const remainingCapacity = calculateRemainingCapacity();
  const totalUpkeep = getTotalUpkeep();
  const TROOP_CAP_GOLD = 10_000_000;

  useEffect(() => {
    loadSummonData(kingdomId, race);
  }, [kingdomId, race, loadSummonData]);

  const handleSummonUnit = useCallback(async (unitType: string, quantity: number) => {
    try {
      setLoading(true);
      setError(null);
      await summonUnits(kingdomId, unitType, quantity);
      
      // Show success toast
      if (!storeError) {
        ToastService.success(`✅ Summoned ${quantity} ${unitType}!`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Summon failed';
      setError(errorMsg);
      ToastService.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [summonUnits, kingdomId, storeError]);

  const renderSummonDashboard = () => (
    <div className="summon-dashboard">
      <div className="summon-stats">
        <div className="stat-card">
          <h4>Current Army</h4>
          <span className="stat-value">{currentUnits.reduce((sum, u) => sum + u.count, 0)}</span>
        </div>
        <div className="stat-card">
          <h4>Gold Spent on Troops</h4>
          <span className="stat-value">{accumulatedGoldSpent.toLocaleString()}g</span>
          <small>of {TROOP_CAP_GOLD.toLocaleString()}g cap</small>
        </div>
        <div className="stat-card">
          <h4>Remaining Capacity</h4>
          <span className="stat-value">{remainingCapacity.toLocaleString()}g</span>
          <small>{Math.round((remainingCapacity / TROOP_CAP_GOLD) * 100)}% available</small>
        </div>
        <div className="stat-card">
          <h4>Total Upkeep</h4>
          <span className="stat-value">{totalUpkeep}g/turn</span>
          {totalUpkeep > (resources.gold || 0) * 0.1 && (
            <small style={{ color: '#ff6b6b' }}>⚠️ High upkeep!</small>
          )}
        </div>
      </div>

      <div className="current-units">
        <h3>Current Units</h3>
        {currentUnits.length === 0 ? (
          <p className="empty-state">No units summoned yet. Summon troops to build your army!</p>
        ) : (
          <div className="units-grid">
            {currentUnits.map(unit => {
              const unitData = availableUnits.find(u => u.id === unit.type);
              return (
                <div key={unit.id} className="unit-card">
                  <img 
                    src={getUnitImagePath(unit.type, race)} 
                    alt={unit.type} 
                    className="unit-icon"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target.src.includes(`${race.toLowerCase()}-`)) {
                        target.src = `/units/output/${unit.type.replace(/_/g, '-')}-icon.png`;
                      }
                    }}
                  />
                  <div className="unit-info">
                    <h4>{unit.type}</h4>
                    <p>Count: {unit.count}</p>
                    <p>⚔️ {unit.attack} | 🛡️ {unit.defense}</p>
                    {unitData && unitData.upkeep && (
                      <p style={{ fontSize: '0.85em', color: '#888' }}>
                        Upkeep: {unitData.upkeep * unit.count}g/turn
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderUnitSummon = () => {
    return (
      <div className="unit-summon">
        <h3>Summon Units</h3>
        <div className="resource-display">
          <span>💰 Gold: {resources.gold?.toLocaleString() || 0}</span>
          <span>👥 Population: {resources.population?.toLocaleString() || 0}</span>
          <span>⏱️ Turns: {resources.turns || 0}</span>
          <span>🛡️ Capacity: {remainingCapacity.toLocaleString()}g remaining</span>
        </div>
        <p className="summon-info">
          💡 Remaining capacity: <strong>{remainingCapacity.toLocaleString()}g</strong>
        </p>
        <div className="units-grid">
          {availableUnits.map(unitType => {
            const maxAffordable = calculateMaxAffordable(unitType.goldCost);
            const canAfford = maxAffordable > 0 && (resources.turns || 0) >= 1;
            
            return (
              <div key={unitType.id} className="unit-type-card">
                <img 
                  src={getUnitImagePath(unitType.id, race)} 
                  alt={unitType.type} 
                  className="unit-icon"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src.includes(`${race.toLowerCase()}-`)) {
                      target.src = `/units/output/${unitType.id.replace(/_/g, '-')}-icon.png`;
                    }
                  }}
                />
                <div className="unit-details">
                  <h4>{unitType.name} (T{unitType.tier})</h4>
                  <p>{unitType.description}</p>
                  <div className="unit-costs">
                    <span>💰 {unitType.goldCost.toLocaleString()}</span>
                    <span>👥 {unitType.populationCost.toLocaleString()}</span>
                    <span>⏱️ 1 turn</span>
                    {unitType.upkeep && (
                      <span title="Upkeep per turn">🔧 {unitType.upkeep}g/turn</span>
                    )}
                  </div>
                  <div className="max-info">
                    <small>Max: {maxAffordable.toLocaleString()}</small>
                    {unitType.upkeep && maxAffordable > 0 && (
                      <small style={{ color: '#888', display: 'block' }}>
                        +{(unitType.upkeep * maxAffordable).toLocaleString()}g/turn upkeep
                      </small>
                    )}
                  </div>
                  <div className="summon-controls">
                    <input 
                      type="number" 
                      min="1" 
                      max={maxAffordable}
                      defaultValue="1"
                      className="quantity-input"
                      id={`quantity-${unitType.id}`}
                      disabled={!canAfford}
                    />
                    <button 
                      className="summon-btn-small"
                      onClick={() => {
                        const input = document.getElementById(`quantity-${unitType.id}`) as HTMLInputElement;
                        input.value = String(maxAffordable);
                      }}
                      disabled={!canAfford}
                      title="Set to maximum affordable"
                    >
                      Max
                    </button>
                    <button 
                      className="summon-btn"
                      onClick={() => {
                        const input = document.getElementById(`quantity-${unitType.id}`) as HTMLInputElement;
                        const quantity = parseInt(input.value) || 1;
                        handleSummonUnit(unitType.type, quantity);
                      }}
                      disabled={loading || !canAfford}
                    >
                      Summon
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (currentView) {
      case 'summon':
        return renderUnitSummon();
      default:
        return renderSummonDashboard();
    }
  };

  if (error || storeError) {
    return (
      <div style={{ background: 'var(--color-bg-deep, #0f1629)', minHeight: '100vh' }}>
        <div className="summon-error" role="alert">
          <h3>Summon Error</h3>
          <p>{error || storeError}</p>
          <button onClick={() => { setError(null); }}>Dismiss</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--color-bg-deep, #0f1629)', minHeight: '100vh' }}>
      <TopNavigation
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src="/train-units-icon.png" alt="" style={{ width: '1.5rem', height: '1.5rem', objectFit: 'contain' }} />
            Summon Units
          </span>
        }
        onBack={onBack}
        backLabel="← Back to Kingdom"
        subtitle={`${race} Army`}
      />

      <div className="unit-summon-interface">
        <nav className="summon-navigation" role="navigation">
          <button
            className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            Army Overview
          </button>
          <button
            className={`nav-btn ${currentView === 'summon' ? 'active' : ''}`}
            onClick={() => setCurrentView('summon')}
          >
            Summon Units
          </button>
        </nav>

        <main className="summon-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

const UnitSummonInterface: React.FC<UnitSummonInterfaceProps> = (props) => (
  <ErrorBoundary>
    <UnitSummonContent {...props} />
  </ErrorBoundary>
);

export default UnitSummonInterface;
