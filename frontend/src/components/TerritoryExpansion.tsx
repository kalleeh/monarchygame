/**
 * Territory Expansion Component
 * IQC Compliant: Integrity (validation), Quality (animations), Consistency (patterns)
 */

import React, { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSpring, useTransition, animated, config } from '@react-spring/web';
import { useTerritoryStore, type Territory } from '../stores/territoryStore';
import { useKingdomStore } from '../stores/kingdomStore';

interface TerritoryExpansionProps {
  kingdomId: string;
  onBack?: () => void;
}

// Region metadata — maps wt-XX IDs from WorldMap to display names and archetypes
const REGION_NAMES: Record<string, { name: string; type: 'capital' | 'settlement' | 'outpost' | 'fortress' }> = {
  'wt-01': { name: 'Frostwall Keep', type: 'fortress' },
  'wt-02': { name: 'Ashfen Marsh', type: 'outpost' },
  'wt-03': { name: 'Crystalpeak', type: 'capital' },
  'wt-04': { name: 'Thornwood', type: 'settlement' },
  'wt-05': { name: 'Duskwall Fortress', type: 'fortress' },
  'wt-06': { name: 'Rimstone Outpost', type: 'outpost' },
  'wt-07': { name: 'Ironhold Keep', type: 'capital' },
  'wt-08': { name: 'Embervale', type: 'settlement' },
  'wt-09': { name: 'Silvergate', type: 'capital' },
  'wt-10': { name: 'Coldbrook Pass', type: 'outpost' },
};

// Maximum territory slots per region archetype
const REGION_SLOT_COUNTS: Record<string, number> = {
  capital: 5,
  settlement: 3,
  outpost: 2,
  fortress: 4,
};

// Per-tick resource production by territory category
const CATEGORY_PRODUCTION: Record<string, { gold: number; pop: number; land: number }> = {
  farmland:   { gold: 20, pop: 30, land: 50 },
  mine:       { gold: 60, pop: 5,  land: 10 },
  forest:     { gold: 10, pop: 10, land: 30 },
  port:       { gold: 80, pop: 20, land: 5  },
  stronghold: { gold: 5,  pop: 0,  land: 0  },
  ruins:      { gold: 0,  pop: 0,  land: 0  },
};

/** Returns the production stats for a territory based on its category */
function getTerritoryProduction(territory: Territory): { gold: number; pop: number; land: number } {
  if (territory.category && CATEGORY_PRODUCTION[territory.category]) {
    return CATEGORY_PRODUCTION[territory.category];
  }
  // Fallback: use legacy defenseLevel-based production
  return {
    gold: 10 * territory.defenseLevel,
    pop: 5 * territory.defenseLevel,
    land: 2 * territory.defenseLevel,
  };
}

const TerritoryExpansion: React.FC<TerritoryExpansionProps> = ({ onBack }) => {
  const [showInfo, setShowInfo] = React.useState(false);
  const navigate = useNavigate();
  const { kingdomId } = useParams<{ kingdomId: string }>();

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

  // Expansion history transitions
  const historyTransitions = useTransition(expansionHistory.slice(0, 5), {
    from: { opacity: 0, x: -50 },
    enter: { opacity: 1, x: 0 },
    leave: { opacity: 0, x: 50 },
    config: config.gentle
  });

  const ownedTerritoriesData = useMemo(() => getOwnedTerritories(), [getOwnedTerritories]);

  // Group owned territories by regionId for the management view
  const territoriesByRegion = useMemo(() => {
    const groups: Record<string, Territory[]> = {};
    for (const t of ownedTerritoriesData) {
      const key = t.regionId || 'unassigned';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  }, [ownedTerritoriesData]);

  // Sum total production across all owned territories
  const totalProduction = useMemo(() => {
    return ownedTerritoriesData.reduce(
      (acc, t) => {
        const prod = getTerritoryProduction(t);
        return { gold: acc.gold + prod.gold, pop: acc.pop + prod.pop, land: acc.land + prod.land };
      },
      { gold: 0, pop: 0, land: 0 }
    );
  }, [ownedTerritoriesData]);

  // Territories available to claim (in availableExpansions but not yet owned)
  const claimableTerritories = useMemo(
    () => territories.filter(t => availableExpansions.some(e => e.territoryId === t.id)),
    [territories, availableExpansions]
  );

  const handleClaimTerritory = async (territoryId: string) => {
    if (canClaimTerritory(territoryId)) {
      await claimTerritory(territoryId);
    }
  };

  const handleUpgradeTerritory = async (territoryId: string) => {
    await upgradeTerritory(territoryId);
  };

  const handleNavigateToWorldMap = () => {
    if (kingdomId) {
      navigate(`/kingdom/${kingdomId}/worldmap`);
    }
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
        <h1>Territory Management</h1>
        <button
          className="info-btn"
          onClick={() => setShowInfo(!showInfo)}
          aria-label="Toggle territory information"
        >
          {showInfo ? 'Hide Info' : 'What are territories?'}
        </button>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="info-panel">
          <h3>About Territories</h3>
          <div className="info-content">
            <div className="info-section">
              <h4>What are Territories?</h4>
              <p>
                Territories are individual holdings within a Region. Each territory you control
                generates resources every turn based on its category (farmland, mine, forest, etc.).
              </p>
            </div>

            <div className="info-section">
              <h4>Regions and Region Bonus</h4>
              <p>
                Each region (e.g. Crystalpeak, Ironhold Keep) contains a fixed number of territory
                slots. Control all slots in a region to earn a 20% production bonus on that region's
                territories.
              </p>
            </div>

            <div className="info-section">
              <h4>Production by Category</h4>
              <ul>
                <li><strong>Farmland:</strong> 20 gold · 30 pop · 50 land per tick</li>
                <li><strong>Mine:</strong> 60 gold · 5 pop · 10 land per tick</li>
                <li><strong>Forest:</strong> 10 gold · 10 pop · 30 land per tick</li>
                <li><strong>Port:</strong> 80 gold · 20 pop · 5 land per tick</li>
                <li><strong>Stronghold:</strong> 5 gold · 0 pop · 0 land per tick (+defence)</li>
                <li><strong>Ruins:</strong> 0 per tick (excavate for one-time gold)</li>
              </ul>
            </div>

            <div className="info-section">
              <h4>Claiming Territories</h4>
              <p>
                Visit the World Map to discover regions and claim territory slots. Each claim costs
                gold and sends settlers from your kingdom to the new territory.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError} aria-label="Dismiss error">x</button>
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

      {/* Total Territory Production Summary */}
      {ownedTerritoriesData.length > 0 && (
        <div className="territory-income-summary">
          <h3>Total territory income:</h3>
          <div className="income-chips">
            <span className="income-chip">💰 {totalProduction.gold}/tick</span>
            <span className="income-chip">👥 {totalProduction.pop}/tick</span>
            <span className="income-chip">🏞️ {totalProduction.land}/tick</span>
          </div>
        </div>
      )}

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
            <span className="stat-value">{totalProduction.gold}</span>
            <span className="stat-label">Gold Per Tick</span>
          </div>
        </div>
      </div>

      {/* Owned Territories — grouped by Region */}
      {ownedTerritoriesData.length > 0 && (
        <div className="owned-territories-section">
          <h2>Your Territories</h2>
          {Object.entries(territoriesByRegion).map(([regionId, regionTerritories]) => {
            const regionMeta = REGION_NAMES[regionId];
            const regionName = regionMeta ? regionMeta.name : regionId === 'unassigned' ? 'Unassigned Region' : regionId;
            const regionType = regionMeta ? regionMeta.type : 'settlement';
            const slotMax = REGION_SLOT_COUNTS[regionType] ?? 3;
            const slotCount = regionTerritories.length;
            const isFullyControlled = slotCount >= slotMax;

            return (
              <div key={regionId} className="region-group">
                <div className="region-group-header">
                  <span className="region-group-name">{regionName}</span>
                  <span className="region-slot-progress">
                    {slotCount} / {slotMax} slots
                  </span>
                  {isFullyControlled && (
                    <span className="region-bonus-badge">Region Bonus Active (+20%)</span>
                  )}
                </div>
                <div className="territory-grid">
                  {regionTerritories.map((territory) => (
                    <OwnedTerritoryCard
                      key={territory.id}
                      territory={territory}
                      isSelected={selectedTerritory === territory.id}
                      onSelect={() => selectTerritory(territory.id)}
                      onUpgrade={() => handleUpgradeTerritory(territory.id)}
                      upgradeCost={getUpgradeCost(territory.id)}
                      canAfford={canAffordUpgrade(territory.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Available Expansions (claimable territories) */}
      <animated.div className="territory-grid" style={gridSpring as unknown as React.CSSProperties}>
        {claimableTerritories.length > 0 ? (
          <>
            <h2 style={{ gridColumn: '1 / -1', margin: '1rem 0 0.5rem' }}>Available to Claim</h2>
            {claimableTerritories.map((territory) => (
              <TerritoryCard
                key={territory.id}
                territory={territory}
                style={{}}
                isOwned={false}
                isSelected={selectedTerritory === territory.id}
                canClaim={canClaimTerritory(territory.id)}
                onSelect={() => selectTerritory(territory.id)}
                onClaim={() => handleClaimTerritory(territory.id)}
                onUpgrade={() => handleUpgradeTerritory(territory.id)}
                upgradeCost={getUpgradeCost(territory.id)}
                claimCost={getClaimCost(territory.id)}
                canAfford={canAffordUpgrade(territory.id)}
                canAffordClaim={canClaimTerritory(territory.id)}
              />
            ))}
          </>
        ) : ownedTerritoriesData.length === 0 ? (
          <div className="empty-territories">
            <p>No territories yet. Explore the World Map to discover and claim territories.</p>
            <button className="worldmap-link-btn" onClick={handleNavigateToWorldMap}>
              Go to World Map
            </button>
          </div>
        ) : (
          <div className="empty-expansions">
            <p>No additional territories available here. Explore the World Map to discover and claim territories.</p>
            <button className="worldmap-link-btn" onClick={handleNavigateToWorldMap}>
              Go to World Map
            </button>
          </div>
        )}
      </animated.div>

      {/* Expansion History */}
      <div className="expansion-history">
        <h3>Recent Expansions</h3>
        <div className="history-list">
          {historyTransitions((style, expansion) => (
            <animated.div key={expansion.timestamp} style={style} className="history-item">
              <div className="history-icon">
                {expansion.success ? '✓' : '✗'}
              </div>
              <div className="history-content">
                <span className="history-territory">
                  {getTerritoryById(expansion.territoryId)?.name || 'Unknown Territory'}
                </span>
                <span className="history-cost">
                  Cost: {expansion.cost.gold} gold · {expansion.cost.turns} turns
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

// Owned Territory Card — shows category-based production stats
interface OwnedTerritoryCardProps {
  territory: Territory;
  isSelected: boolean;
  onSelect: () => void;
  onUpgrade: () => void;
  upgradeCost: { gold: number } | null;
  canAfford: boolean;
}

const OwnedTerritoryCard: React.FC<OwnedTerritoryCardProps> = ({
  territory,
  isSelected,
  onSelect,
  onUpgrade,
  upgradeCost,
  canAfford,
}) => {
  const cardSpring = useSpring({
    borderColor: isSelected ? '#4ecdc4' : '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    scale: isSelected ? 1.02 : 1,
    config: config.gentle,
  });

  const production = getTerritoryProduction(territory);

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'farmland':   return '🌾';
      case 'mine':       return '⛏️';
      case 'forest':     return '🌲';
      case 'port':       return '⚓';
      case 'stronghold': return '🛡️';
      case 'ruins':      return '🏚️';
      default:           return '📍';
    }
  };

  return (
    <animated.div
      style={cardSpring as unknown as React.CSSProperties}
      className={`territory-card owned ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-label={`Territory: ${territory.name}`}
    >
      <div className="territory-header">
        <div className="territory-icon">{getCategoryIcon(territory.category)}</div>
        <div className="territory-info">
          <h4>{territory.name}</h4>
          <span className="territory-type">{territory.category || territory.type}</span>
        </div>
        <div className="territory-level">Lv.{territory.defenseLevel}</div>
      </div>

      {/* Production stats per tick */}
      <div className="territory-production">
        <div className="production-chips">
          <span className="production-chip" title="Gold per tick">💰 {production.gold}/tick</span>
          <span className="production-chip" title="Population per tick">👥 {production.pop}/tick</span>
          <span className="production-chip" title="Land per tick">🏞️ {production.land}/tick</span>
        </div>
      </div>

      <div className="territory-actions">
        {upgradeCost && (
          <div className="upgrade-cost">
            <span className="cost-label">Upgrade cost:</span>
            <span className={canAfford ? 'cost-affordable' : 'cost-insufficient'}>
              💰 {Math.floor(upgradeCost.gold).toLocaleString()} Gold
            </span>
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
      </div>
    </animated.div>
  );
};

// Territory Card Component (used for claimable territories)
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

  const production = getTerritoryProduction(territory);

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
          <span className="territory-type">{territory.category || territory.type}</span>
        </div>
        <div className="territory-level">
          Lv.{territory.defenseLevel}
        </div>
      </div>

      <div className="territory-production">
        <div className="production-label">Production per tick:</div>
        <div className="production-chips">
          <span className="production-chip" title="Gold per tick">💰 {production.gold}/tick</span>
          <span className="production-chip" title="Population per tick">👥 {production.pop}/tick</span>
          <span className="production-chip" title="Land per tick">🏞️ {production.land}/tick</span>
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
