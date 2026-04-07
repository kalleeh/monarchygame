/**
 * Thievery/Espionage Interface Component
 * Provides UI for scum operations: Scout, Steal, Sabotage, Burn, Desecrate Temples
 * Follows existing component patterns (SpellCastingInterface, UnitSummonInterface)
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useThieveryStore, type OperationType } from '../stores/thieveryStore';
import { useKingdomStore } from '../stores/kingdomStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { isDemoMode } from '../utils/authMode';
import { useKingdomTargets } from '../hooks/useKingdomTargets';
import { TopNavigation } from './TopNavigation';
import { ToastService } from '../services/toastService';
import { StarIcon } from './ui/MenuIcons';
import { AmplifyFunctionService } from '../services/amplifyFunctionService';
import { THIEVERY_MECHANICS } from '../../../shared/mechanics/thievery-mechanics';
import './ThieveryInterface.css';

interface ThieveryInterfaceProps {
  kingdomId: string;
  race: string;
  onBack: () => void;
}

const OPERATION_CONFIG: Record<OperationType, { label: string; turnCost: number; description: string; color: string }> = {
  scout: {
    label: 'Scout',
    turnCost: THIEVERY_MECHANICS.OPERATION_COSTS.SCOUT,
    description: 'Gather intelligence on enemy kingdom. Reveals gold, scum, and defense.',
    color: '#4ecdc4',
  },
  steal: {
    label: 'Steal',
    turnCost: THIEVERY_MECHANICS.OPERATION_COSTS.STEAL,
    description: 'Attempt to steal gold from the target. Up to 3.5M per successful loot.',
    color: '#ffd700',
  },
  sabotage: {
    label: 'Sabotage',
    turnCost: THIEVERY_MECHANICS.OPERATION_COSTS.SABOTAGE,
    description: 'Sabotage enemy scum forces, reducing their espionage capability.',
    color: '#f59e0b',
  },
  burn: {
    label: 'Burn',
    turnCost: THIEVERY_MECHANICS.OPERATION_COSTS.BURN,
    description: 'High-risk operation to destroy enemy scum. Highest casualties on both sides.',
    color: '#ef4444',
  },
  desecrate: {
    label: 'Desecrate Temples',
    turnCost: THIEVERY_MECHANICS.OPERATION_COSTS.DESECRATE,
    description: 'Destroy ~10% of enemy temples, crippling their elan generation. The primary counter to Sidhe and Vampire mage kingdoms.',
    color: '#a855f7',
  },
  spread_dissention: {
    label: 'Spread Dissention',
    turnCost: THIEVERY_MECHANICS.OPERATION_COSTS.SPREAD_DISSENTION,
    description: 'Spread unrest through enemy lands, killing ~3% of their population and reducing their income.',
    color: '#8b5cf6',
  },
  intercept_caravans: {
    label: 'Intercept Caravans',
    turnCost: THIEVERY_MECHANICS.OPERATION_COSTS.INTERCEPT,
    description: 'Intercept enemy trade caravans, stealing 2% of their gold. Cheaper than direct theft.',
    color: '#f59e0b',
  },
  scum_kill: {
    label: 'Execute Scouts',
    turnCost: THIEVERY_MECHANICS.OPERATION_COSTS.SCUM_KILL ?? 4,
    description: 'CENTAUR ONLY: Directly execute enemy scouts with lethal efficiency. 7% kill rate.',
    color: '#dc2626',
  },
};

const ThieveryInterface: React.FC<ThieveryInterfaceProps> = ({ kingdomId, race, onBack }) => {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState(false);
  const [targetSearch, setTargetSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    scumCount,
    eliteScumCount,
    operations,
    loading,
    error,
    initializeThievery,
    executeOperation,
    getDetectionRate,
    clearError,
  } = useThieveryStore();

  const resources = useKingdomStore((state) => state.resources);
  const spendTurns = useKingdomStore((state) => state.spendTurns);
  const addGold = useKingdomStore((state) => state.addGold);

  const aiKingdoms = useAIKingdomStore((state) => state.aiKingdoms);
  const generateAIKingdoms = useAIKingdomStore((state) => state.generateAIKingdoms);

  const { targets: kingdomTargets, loading: targetsLoading, hasMore: targetsHasMore, loadMore: loadMoreTargets } = useKingdomTargets({ nameSearch: debouncedSearch });

  // Initialize on mount
  useEffect(() => {
    initializeThievery(kingdomId, race);
    // Demo mode: seed AI kingdoms if none exist
    if (isDemoMode() && aiKingdoms.length === 0) {
      const networth = (resources.gold || 0) + (resources.land || 0) * 50;
      generateAIKingdoms(5, networth);
    }
  }, [kingdomId, race, initializeThievery, aiKingdoms.length, generateAIKingdoms, resources.gold, resources.land]);

  // Debounce name search input (300ms)
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(targetSearch), 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [targetSearch]);

  const totalScum = scumCount + eliteScumCount;

  const selectedKingdom = kingdomTargets.find((k) => k.id === selectedTarget);

  // Calculate detection rate for selected target
  const currentDetection = selectedKingdom
    ? getDetectionRate(
        Math.floor((selectedKingdom.resources.land || selectedKingdom.networth / 1000) * 0.1), // estimated enemy scum
        selectedKingdom.race
      )
    : 0;

  const handleExecuteOperation = useCallback(
    async (type: OperationType) => {
      if (!selectedKingdom) return;
      if (operationLoading) return;

      const estimatedEnemyScum = Math.floor((selectedKingdom.resources.land || selectedKingdom.networth / 1000) * 0.1);
      setOperationLoading(true);
      try {
        const spendTurnsFn = spendTurns; // Deduct locally for immediate UI; server deducts authoritatively
        const result = await executeOperation(
          type,
          selectedKingdom.id,
          selectedKingdom.name,
          estimatedEnemyScum,
          selectedKingdom.race,
          selectedKingdom.resources.gold,
          spendTurnsFn
        );

        if (result) {
          // If gold was stolen, add it to kingdom (demo mode only — Lambda handles auth mode)
          if (isDemoMode() && result.result.goldStolen > 0) {
            addGold(result.result.goldStolen);
          }

          // In auth mode, sync resources from server after successful operation
          if (!isDemoMode()) {
            void AmplifyFunctionService.refreshKingdomResources(kingdomId);
          }

          // Build result message
          let message: string;
          if (result.success) {
            switch (type) {
              case 'scout':
                message = `Scout successful! Intel gathered on ${selectedKingdom.name}.`;
                if (result.result.informationGained) {
                  const info = result.result.informationGained;
                  message += ` Est. gold: ${info.estimatedGold?.toLocaleString()}, Est. scum: ${info.estimatedScum?.toLocaleString()}, Defense: ${info.defenseRating}`;
                }
                break;
              case 'steal':
                message = `Theft successful! Stole ${result.result.goldStolen.toLocaleString()} gold from ${selectedKingdom.name}.`;
                break;
              case 'sabotage':
                message = `Sabotage successful! Eliminated ${result.result.casualtiesInflicted} enemy scum from ${selectedKingdom.name}.`;
                break;
              case 'burn':
                message = `Burn successful! Destroyed ${result.result.casualtiesInflicted} enemy scum in ${selectedKingdom.name}.`;
                break;
              case 'desecrate':
                message = result.result.templesDestroyed > 0
                  ? `Desecration successful! Destroyed ${result.result.templesDestroyed} temples in ${selectedKingdom.name}. Their elan generation is weakened.`
                  : `Desecration successful against ${selectedKingdom.name} (no temples to destroy).`;
                break;
              case 'spread_dissention':
                message = result.result.populationKilled > 0
                  ? `Dissention spread through ${selectedKingdom.name}! Killed ${result.result.populationKilled.toLocaleString()} peasants.`
                  : `Dissention spread through ${selectedKingdom.name} (no population to kill).`;
                break;
              case 'intercept_caravans':
                message = result.result.goldIntercepted > 0
                  ? `Caravan intercepted! Seized ${result.result.goldIntercepted.toLocaleString()} gold from ${selectedKingdom.name}.`
                  : `Caravan interception against ${selectedKingdom.name} yielded no gold.`;
                break;
              case 'scum_kill':
                message = result.result.scoutsKilled > 0
                  ? `Scout execution successful! Eliminated ${result.result.scoutsKilled} scouts in ${selectedKingdom.name}.`
                  : `Scout execution against ${selectedKingdom.name} — no scouts to eliminate.`;
                break;
              default:
                message = `Operation successful against ${selectedKingdom.name}.`;
            }
          } else {
            message = `${OPERATION_CONFIG[type].label} operation against ${selectedKingdom.name} failed. Lost ${result.result.casualtiesSuffered} scum.`;
          }

          // Append promotion info
          if ((result.result.promoted ?? 0) > 0) {
            message += ` ⭐ ${result.result.promoted} scouts promoted to elite!`;
          }

          setLastResult(message);
        }
      } catch (err) {
        ToastService.error('Operation failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setOperationLoading(false);
      }
    },
    [selectedKingdom, operationLoading, executeOperation, spendTurns, addGold, kingdomId]
  );

  return (
    <div className="thievery-interface">
      <TopNavigation
        title={<><img src="/espionage-icon.png" style={{width:28,height:28,objectFit:'contain',verticalAlign:'middle',marginRight:8}} alt="" />Espionage Operations</>}
        onBack={onBack}
        backLabel="← Back to Kingdom"
        subtitle={`${totalScum} Scum Available`}
        kingdomId={kingdomId}
      />

      {/* Error Display */}
      {error && (
        <div className="thievery-error-banner gm-error-banner">
          <span>{error}</span>
          <button onClick={clearError} aria-label="Dismiss error">
            x
          </button>
        </div>
      )}

      {/* Result Display */}
      {lastResult && (
        <div className="thievery-result-banner gm-success-banner">
          <span>{lastResult}</span>
          <button onClick={() => setLastResult(null)} aria-label="Dismiss result">
            x
          </button>
        </div>
      )}

      <div className="thievery-content">
        {/* Scum Overview */}
        <section className="thievery-stats">
          <div className="stat-card">
            <h4>Green Scum</h4>
            <span className="stat-value">{scumCount.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <h4>Elite Scum</h4>
            <span className="stat-value">{eliteScumCount.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <h4>Total Scum</h4>
            <span className="stat-value">{totalScum.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <h4>Detection Rate</h4>
            <span className="stat-value">
              {selectedKingdom ? `${(currentDetection * 100).toFixed(1)}%` : '--'}
            </span>
            {selectedKingdom && (
              <small>vs {selectedKingdom.name}</small>
            )}
          </div>
          <div className="stat-card">
            <h4>Turns Available</h4>
            <span className="stat-value">{resources.turns || 0}</span>
          </div>
        </section>

        {/* Target Selection */}
        <section className="thievery-targets">
          <h3>Select Target</h3>
          <input
            type="text"
            placeholder="Search kingdoms by name..."
            value={targetSearch}
            onChange={(e) => setTargetSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '0.9rem',
              marginBottom: '0.75rem',
              boxSizing: 'border-box',
            }}
          />
          {targetsLoading && kingdomTargets.length === 0 ? (
            <p className="gm-empty-state">Loading targets...</p>
          ) : kingdomTargets.length === 0 ? (
            <p className="gm-empty-state">No kingdoms found matching your search.</p>
          ) : (
            <div
              className="target-grid"
              style={{ maxHeight: '300px', overflowY: 'auto' }}
            >
              {kingdomTargets.map((kingdom) => (
                <button
                  key={kingdom.id}
                  className={`target-card ${selectedTarget === kingdom.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTarget(kingdom.id)}
                >
                  <h4>{kingdom.name}</h4>
                  <p className="target-race">{kingdom.race}</p>
                  {kingdom.difficulty && <p className="target-difficulty">{kingdom.difficulty}</p>}
                  <p className="target-land">{kingdom.networth > 0 ? `${(kingdom.networth / 1000).toFixed(0)}k NW` : `${kingdom.resources.land.toLocaleString()} acres`}</p>
                </button>
              ))}
            </div>
          )}
          {targetsHasMore && (
            <button
              onClick={loadMoreTargets}
              disabled={targetsLoading}
              style={{
                marginTop: '0.75rem',
                padding: '0.4rem 1rem',
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.4)',
                borderRadius: '6px',
                color: '#a78bfa',
                fontSize: '0.85rem',
                cursor: targetsLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {targetsLoading ? 'Loading...' : 'Load more'}
            </button>
          )}
        </section>

        {/* Operation Buttons */}
        <section className="thievery-operations">
          <h3>Operations</h3>
          {totalScum < THIEVERY_MECHANICS.DETECTION.MINIMUM_SCUM && (
            <p className="warning-text">
              You need at least {THIEVERY_MECHANICS.DETECTION.MINIMUM_SCUM} scum to perform
              operations. Train more scum in the Summon Units screen.
            </p>
          )}
          <div className="operations-grid">
            {(Object.entries(OPERATION_CONFIG) as [OperationType, typeof OPERATION_CONFIG[OperationType]][]).map(
              ([type, config]) => {
                const canExecute =
                  !loading &&
                  !operationLoading &&
                  selectedTarget !== null &&
                  totalScum >= THIEVERY_MECHANICS.DETECTION.MINIMUM_SCUM &&
                  (resources.turns || 0) >= config.turnCost;

                return (
                  <button
                    key={type}
                    className={`operation-btn ${canExecute ? '' : 'disabled'}`}
                    style={{ borderColor: config.color }}
                    onClick={() => handleExecuteOperation(type)}
                    disabled={!canExecute}
                  >
                    <h4 style={{ color: config.color }}>{config.label}</h4>
                    <p className="operation-description">{config.description}</p>
                    <span className="operation-cost">{config.turnCost} turns</span>
                  </button>
                );
              }
            )}
          </div>
        </section>

        {/* Operation History */}
        <section className="thievery-history">
          <h3>Operation History</h3>
          {operations.length === 0 ? (
            <p className="gm-empty-state">No operations performed yet.</p>
          ) : (
            <div className="history-list">
              {operations.map((op) => (
                <div
                  key={op.id}
                  className={`history-item ${op.success ? 'success' : 'failure'}`}
                >
                  <div className="history-header">
                    <span
                      className="history-type"
                      style={{ color: OPERATION_CONFIG[op.type]?.color }}
                    >
                      {OPERATION_CONFIG[op.type]?.label || op.type}
                    </span>
                    <span className="history-target">vs {op.targetName}</span>
                    <span className={`history-result ${op.success ? 'success' : 'failure'}`}>
                      {op.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  <div className="history-details">
                    {op.result.goldStolen > 0 && (
                      <span>Stolen: {op.result.goldStolen.toLocaleString()}g</span>
                    )}
                    {op.result.casualtiesSuffered > 0 && (
                      <span>Lost: {op.result.casualtiesSuffered} scum</span>
                    )}
                    {op.result.casualtiesInflicted > 0 && (
                      <span>Destroyed: {op.result.casualtiesInflicted} enemy scum</span>
                    )}
                    {(op.result.promoted ?? 0) > 0 && (
                      <span style={{color: '#fbbf24'}}><StarIcon /> {op.result.promoted} promoted to elite</span>
                    )}
                    <span className="history-time">
                      {new Date(op.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ThieveryInterface;
