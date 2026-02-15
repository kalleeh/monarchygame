/**
 * Territory Expansion Component
 * IQC Compliant: Integrity (validation), Quality (animations), Consistency (patterns)
 */

import React, { useEffect, useMemo } from 'react';
import { useSpring, useTransition, animated, config } from '@react-spring/web';
import { useTerritoryStore, type Territory } from '../stores/territoryStore';
import { useKingdomStore } from '../stores/kingdomStore';

interface TerritoryExpansionProps {
  kingdomId: string;
  onBack?: () => void;
}

const TerritoryExpansion: React.FC<TerritoryExpansionProps> = ({ onBack }) => {
  const [showInfo, setShowInfo] = React.useState(false);
  
  // Get resources from centralized kingdom store
  const kingdomResources = useKingdomStore((state) => state.resources);
  
  const {
    territories,
    ownedTerritories,
    selectedTerritory,
    availableExpansions,
    expansionHistory,
    loading,
    error,
    selectTerritory,
    claimTerritory,
    upgradeTerritory,
    canClaimTerritory,
    getTerritoryById,
    getOwnedTerritories,
    getUpgradeCost,
    getClaimCost,
    canAffordUpgrade,
    clearError,
    initializeTerritories
  } = useTerritoryStore();

  // Initialize territories on mount
  useEffect(() => {
    initializeTerritories();
  }, [initializeTerritories]);

  // Territory grid animation
  const gridSpring = useSpring({
    opacity: loading ? 0.6 : 1,
    transform: loading ? 'scale(0.98)' : 'scale(1)',
    config: config.gentle
  });

  // Territory card transitions
  const territoryTransitions = useTransition(territories, {
    from: { opacity: 0, scale: 0.8, y: 20 },
    enter: { opacity: 1, scale: 1, y: 0 },
    leave: { opacity: 0, scale: 0.8, y: -20 },
    config: config.wobbly
  });

  // Expansion history transitions
  const historyTransitions = useTransition(expansionHistory.slice(0, 5), {
    from: { opacity: 0, x: -50 },
    enter: { opacity: 1, x: 0 },
    leave: { opacity: 0, x: 50 },
    config: config.gentle
  });

  const ownedTerritoriesData = useMemo(() => getOwnedTerritories(), [getOwnedTerritories]);

  const handleClaimTerritory = async (territoryId: string) => {
    if (canClaimTerritory(territoryId)) {
      await claimTerritory(territoryId);
    }
  };

  const handleUpgradeTerritory = async (territoryId: string) => {
    await upgradeTerritory(territoryId);
  };

  return (
    <div className="territory-expansion">
      {/* Header with Back Navigation */}
      <div className="territory-header">
        {onBack && (
          <button className="back-btn" onClick={onBack}>
            ← Back to Kingdom
          </button>
        )}
        <h1>🏰 Territory Expansion</h1>
        <button 
          className="info-btn"
          onClick={() => setShowInfo(!showInfo)}
          aria-label="Toggle territory information"
        >
          ℹ️ {showInfo ? 'Hide' : 'What are territories?'}
        </button>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="info-panel">
          <h3>📚 About Territories</h3>
          <div className="info-content">
            <div className="info-section">
              <h4>🏰 What are Territories?</h4>
              <p>
                Territories are the foundation of your kingdom's power. Each territory you control 
                generates resources every turn and contributes to your overall strength.
              </p>
            </div>
            
            <div className="info-section">
              <h4>💰 Resource Generation</h4>
              <p>
                Each territory produces <strong>Gold</strong>, <strong>Population</strong>, and <strong>Land</strong> 
                based on its defense level. Higher level territories generate more resources per turn.
              </p>
              <ul>
                <li><strong>Gold:</strong> 10 × Defense Level per turn</li>
                <li><strong>Population:</strong> 5 × Defense Level per turn</li>
                <li><strong>Land:</strong> 2 × Defense Level per turn</li>
              </ul>
            </div>
            
            <div className="info-section">
              <h4>⬆️ Upgrading Territories</h4>
              <p>
                Upgrade your territories to increase their defense level and resource generation. 
                Upgrades cost <strong>Gold only</strong> (for construction, fortifications, and workers).
              </p>
              <ul>
                <li>+1 Defense Level per upgrade</li>
                <li>Increased production per turn</li>
                <li>Cost scales with level (higher levels more expensive)</li>
              </ul>
            </div>
            
            <div className="info-section">
              <h4>🗺️ Claiming New Territories</h4>
              <p>
                Expand your kingdom by sending settlers to claim adjacent territories. 
                Claiming costs:
              </p>
              <ul>
                <li><strong>Gold:</strong> Infrastructure, supplies, and roads</li>
                <li><strong>Population:</strong> Settlers who relocate to the new territory</li>
              </ul>
              <p>
                Your kingdom's population temporarily decreases as settlers move, but the 
                new territory gains those settlers. Both will grow over time through natural 
                population generation.
              </p>
            </div>
            
            <div className="info-section">
              <h4>📈 Expansion Benefits</h4>
              <p>More territories mean:</p>
              <ul>
                <li>Greater resource income per turn</li>
                <li>Stronger defensive position</li>
                <li>More strategic options</li>
                <li>Higher kingdom prestige</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={clearError} aria-label="Dismiss error">×</button>
        </div>
      )}

      {/* Kingdom Resources */}
      <div className="kingdom-resources">
        <h2>Your Kingdom Resources</h2>
        <div className="resource-display">
          <div className="resource-card">
            <span className="resource-icon">💰</span>
            <div className="resource-details">
              <span className="resource-amount">{kingdomResources.gold.toLocaleString()}</span>
              <span className="resource-name">Gold</span>
            </div>
          </div>
          <div className="resource-card">
            <span className="resource-icon">👥</span>
            <div className="resource-details">
              <span className="resource-amount">{kingdomResources.population.toLocaleString()}</span>
              <span className="resource-name">Population</span>
            </div>
          </div>
          <div className="resource-card">
            <span className="resource-icon">🏞️</span>
            <div className="resource-details">
              <span className="resource-amount">{kingdomResources.land.toLocaleString()}</span>
              <span className="resource-name">Land</span>
            </div>
          </div>
        </div>
      </div>

      {/* Territory Overview */}
      <div className="territory-overview">
        <h2>Territory Overview</h2>
        <div className="territory-stats">
          <div className="stat-card">
            <span className="stat-value">{ownedTerritories.length}</span>
            <span className="stat-label">Owned Territories</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{availableExpansions.length}</span>
            <span className="stat-label">Available Expansions</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">
              {ownedTerritoriesData.reduce((sum, t) => sum + (10 * t.defenseLevel), 0)}
            </span>
            <span className="stat-label">Gold Per Turn</span>
          </div>
        </div>
      </div>

      {/* Territory Grid */}
      <animated.div className="territory-grid" style={gridSpring as unknown as React.CSSProperties}>
        {territoryTransitions((style, territory) => (
          <TerritoryCard
            key={territory.id}
            territory={territory}
            style={style as unknown as React.CSSProperties}
            isOwned={ownedTerritories.some(t => t.id === territory.id)}
            isSelected={selectedTerritory === territory.id}
            canClaim={canClaimTerritory(territory.id)}
            onSelect={() => {
              selectTerritory(territory.id);
            }}
            onClaim={() => handleClaimTerritory(territory.id)}
            onUpgrade={() => handleUpgradeTerritory(territory.id)}
            upgradeCost={getUpgradeCost(territory.id)}
            claimCost={getClaimCost(territory.id)}
            canAfford={canAffordUpgrade(territory.id)}
            canAffordClaim={canClaimTerritory(territory.id)}
          />
        ))}
      </animated.div>

      {/* Expansion History */}
      <div className="expansion-history">
        <h3>Recent Expansions</h3>
        <div className="history-list">
          {historyTransitions((style, expansion) => (
            <animated.div key={expansion.timestamp} style={style} className="history-item">
              <div className="history-icon">
                {expansion.success ? '✅' : '❌'}
              </div>
              <div className="history-content">
                <span className="history-territory">
                  {getTerritoryById(expansion.territoryId)?.name || 'Unknown Territory'}
                </span>
                <span className="history-cost">
                  Cost: {expansion.cost.gold}💰 {expansion.cost.turns}⏱️
                </span>
              </div>
              <div className="history-time">
                {new Date(expansion.timestamp).toLocaleTimeString()}
              </div>
            </animated.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Territory Card Component
interface TerritoryCardProps {
  territory: Territory;
  style: React.CSSProperties;
  isOwned: boolean;
  isSelected: boolean;
  canClaim: boolean;
  onSelect: () => void;
  onClaim: () => void;
  onUpgrade: () => void;
  upgradeCost: { gold: number } | null;
  claimCost: { gold: number; population: number } | null;
  canAfford: boolean;
  canAffordClaim: boolean;
}

const TerritoryCard: React.FC<TerritoryCardProps> = ({
  territory,
  style,
  isOwned,
  isSelected,
  canClaim,
  onSelect,
  onClaim,
  onUpgrade,
  upgradeCost,
  claimCost,
  canAfford,
  canAffordClaim
}) => {
  const cardSpring = useSpring({
    borderColor: isSelected ? '#4ecdc4' : isOwned ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
    backgroundColor: isOwned 
      ? 'rgba(16, 185, 129, 0.1)' 
      : canClaim 
        ? 'rgba(79, 172, 254, 0.1)' 
        : 'rgba(255, 255, 255, 0.05)',
    scale: isSelected ? 1.02 : 1,
    config: config.gentle
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'capital': return '🏰';
      case 'settlement': return '🏘️';
      case 'outpost': return '🏕️';
      case 'fortress': return '🏯';
      default: return '📍';
    }
  };

  return (
    <animated.div
      style={{ ...style, ...cardSpring }}
      className={`territory-card ${isOwned ? 'owned' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-label={`Territory: ${territory.name}`}
    >
      <div className="territory-header">
        <div className="territory-icon">{getTypeIcon(territory.type)}</div>
        <div className="territory-info">
          <h4>{territory.name}</h4>
          <span className="territory-type">{territory.type}</span>
        </div>
        <div className="territory-level">
          Lv.{territory.defenseLevel}
        </div>
      </div>

      <div className="territory-production">
        <div className="production-label">Production per turn:</div>
        <div className="production-items">
          <span className="production-item" title="Gold per turn">
            💰 {10 * territory.defenseLevel}/turn
          </span>
          <span className="production-item" title="Population per turn">
            👥 {5 * territory.defenseLevel}/turn
          </span>
          <span className="production-item" title="Land per turn">
            🏞️ {2 * territory.defenseLevel}/turn
          </span>
        </div>
      </div>

      <div className="territory-actions">
        {isOwned ? (
          <>
            {upgradeCost && (
              <div className="upgrade-cost">
                <span className="cost-label">Upgrade cost:</span>
                <div className="cost-items">
                  <span className={canAfford ? 'cost-affordable' : 'cost-insufficient'}>
                    💰 {Math.floor(upgradeCost.gold).toLocaleString()} Gold
                  </span>
                </div>
              </div>
            )}
            <button 
              className="upgrade-btn"
              onClick={(e) => {
                e.stopPropagation();
                onUpgrade();
              }}
              disabled={!canAfford}
              title={canAfford ? 'Upgrade this territory' : 'Not enough gold'}
            >
              {canAfford ? `Upgrade to Lv.${territory.defenseLevel + 1}` : 'Insufficient Gold'}
            </button>
          </>
        ) : canClaim ? (
          <>
            {claimCost && (
              <div className="claim-cost">
                <span className="cost-label">Claim cost (settlers):</span>
                <div className="cost-items">
                  <span className={canAffordClaim ? 'cost-affordable' : 'cost-insufficient'}>
                    💰 {claimCost.gold.toLocaleString()}
                  </span>
                  <span className={canAffordClaim ? 'cost-affordable' : 'cost-insufficient'}>
                    👥 {claimCost.population.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
            <button 
              className="claim-btn"
              onClick={(e) => {
                e.stopPropagation();
                onClaim();
              }}
              disabled={!canAffordClaim}
              title={canAffordClaim ? 'Send settlers to claim this territory' : 'Not enough resources'}
            >
              {canAffordClaim ? 'Send Settlers' : 'Insufficient Resources'}
            </button>
          </>
        ) : (
          <span className="unavailable">Unavailable</span>
        )}
      </div>
    </animated.div>
  );
};

export default TerritoryExpansion;
