/**
 * Thievery/Espionage Interface Component
 * Provides UI for scum operations: Scout, Steal, Sabotage, Burn
 * Follows existing component patterns (SpellCastingInterface, UnitSummonInterface)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useThieveryStore, type OperationType } from '../stores/thieveryStore';
import { useKingdomStore } from '../stores/kingdomStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { TopNavigation } from './TopNavigation';
import { THIEVERY_MECHANICS } from '../../../shared/mechanics/thievery-mechanics';
import './ThieveryInterface.css';

interface ThieveryInterfaceProps {
  kingdomId: string;
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
};

const ThieveryInterface: React.FC<ThieveryInterfaceProps> = ({ kingdomId, onBack }) => {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

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

  // Initialize on mount
  useEffect(() => {
    // Load stored kingdom data to figure out the race
    const stored = localStorage.getItem(`kingdom-${kingdomId}`);
    let race = 'Human';
    if (stored) {
      try {
        const data = JSON.parse(stored);
        race = data.race || 'Human';
      } catch {
        // default
      }
    }
    initializeThievery(kingdomId, race);

    // Generate AI kingdoms if none exist
    if (aiKingdoms.length === 0) {
      const networth = (resources.gold || 0) + (resources.land || 0) * 50;
      generateAIKingdoms(5, networth);
    }
  }, [kingdomId, initializeThievery, aiKingdoms.length, generateAIKingdoms, resources.gold, resources.land]);

  const totalScum = scumCount + eliteScumCount;

  const selectedKingdom = aiKingdoms.find((k) => k.id === selectedTarget);

  // Calculate detection rate for selected target
  const currentDetection = selectedKingdom
    ? getDetectionRate(
        Math.floor(selectedKingdom.resources.land * 0.1), // estimated enemy scum
        selectedKingdom.race
      )
    : 0;

  const handleExecuteOperation = useCallback(
    (type: OperationType) => {
      if (!selectedKingdom) return;

      const estimatedEnemyScum = Math.floor(selectedKingdom.resources.land * 0.1);
      const result = executeOperation(
        type,
        selectedKingdom.id,
        selectedKingdom.name,
        estimatedEnemyScum,
        selectedKingdom.race,
        selectedKingdom.resources.gold,
        spendTurns
      );

      if (result) {
        // If gold was stolen, add it to kingdom
        if (result.result.goldStolen > 0) {
          addGold(result.result.goldStolen);
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
          }
        } else {
          message = `${OPERATION_CONFIG[type].label} operation against ${selectedKingdom.name} failed. Lost ${result.result.casualtiesSuffered} scum.`;
        }

        setLastResult(message);
      }
    },
    [selectedKingdom, executeOperation, spendTurns, addGold]
  );

  return (
    <div className="thievery-interface">
      <TopNavigation
        title={<><img src="/espionage-icon.png" style={{width:28,height:28,objectFit:'contain',verticalAlign:'middle',marginRight:8}} alt="" />Espionage Operations</>}
        onBack={onBack}
        backLabel="← Back to Kingdom"
        subtitle={`${totalScum} Scum Available`}
      />

      {/* Error Display */}
      {error && (
        <div className="thievery-error-banner">
          <span>{error}</span>
          <button onClick={clearError} aria-label="Dismiss error">
            x
          </button>
        </div>
      )}

      {/* Result Display */}
      {lastResult && (
        <div className="thievery-result-banner">
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
          {aiKingdoms.length === 0 ? (
            <p className="empty-state">No kingdoms available to target.</p>
          ) : (
            <div className="target-grid">
              {aiKingdoms.map((kingdom) => (
                <button
                  key={kingdom.id}
                  className={`target-card ${selectedTarget === kingdom.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTarget(kingdom.id)}
                >
                  <h4>{kingdom.name}</h4>
                  <p className="target-race">{kingdom.race}</p>
                  <p className="target-difficulty">{kingdom.difficulty}</p>
                  <p className="target-land">{kingdom.resources.land.toLocaleString()} acres</p>
                </button>
              ))}
            </div>
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
            <p className="empty-state">No operations performed yet.</p>
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
