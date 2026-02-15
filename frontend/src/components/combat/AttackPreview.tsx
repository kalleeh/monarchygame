/**
 * Attack Preview Component
 * Shows estimated battle outcomes before confirming attack
 */

import React, { useMemo, useCallback } from 'react';
import type { Kingdom, AttackType, Army, Territory } from '../../types/combat';
import { hasStats } from '../../types/guards';

interface AttackPreviewProps {
  attacker: Kingdom;
  target: Kingdom;
  attackType: AttackType;
  army: Army;
  targetTerritory?: Territory | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

interface BattleEstimate {
  winProbability: number;
  estimatedCasualties: {
    attacker: Army;
    defender: Army;
  };
  estimatedSpoils: {
    gold: number;
    population: number;
    land: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
}

export const AttackPreview: React.FC<AttackPreviewProps> = ({
  attacker,
  target,
  attackType,
  army,
  targetTerritory,
  onConfirm,
  onCancel,
  isLoading
}) => {
  // Calculate battle estimates (simplified version)
  const battleEstimate: BattleEstimate = useMemo(() => {
    const attackerWarOffense = hasStats(attacker) ? attacker.stats.warOffense : 10;
    const targetWarDefense = hasStats(target) ? target.stats.warDefense : 10;
    
    const attackerPower = Object.entries(army).reduce((power, [unitType, count]) => {
      const unitPower = unitType === 'knights' ? 4 : unitType === 'cavalry' ? 3 : unitType === 'militia' ? 2 : 1;
      return power + ((count ?? 0) * unitPower * (attackerWarOffense / 10));
    }, 0);

    const defenderPower = Object.values(target.totalUnits).reduce((power, count, index) => {
      const unitPower = index === 2 ? 4 : index === 3 ? 3 : index === 1 ? 2 : 1; // knights, cavalry, militia, peasants
      return power + ((count ?? 0) * unitPower * (targetWarDefense / 10));
    }, 0);

    // Add fortification bonus
    const fortBonus = targetTerritory?.fortificationLevel ? targetTerritory.fortificationLevel * 0.1 : 0;
    const adjustedDefenderPower = defenderPower * (1 + fortBonus);

    const powerRatio = attackerPower / Math.max(adjustedDefenderPower, 1);
    let winProbability = Math.min(0.95, Math.max(0.05, powerRatio * 0.6));

    // Attack type modifiers
    const typeModifiers: Record<AttackType, { winBonus: number; casualtyReduction: number; spoilsReduction: number }> = {
      guerilla_raid: { winBonus: 0.1, casualtyReduction: 0.3, spoilsReduction: 0.5 },
      full_attack: { winBonus: -0.1, casualtyReduction: -0.2, spoilsReduction: -0.1 },
      controlled_strike: { winBonus: 0.05, casualtyReduction: 0.1, spoilsReduction: 0.2 },
      ambush: { winBonus: 0.15, casualtyReduction: 0.2, spoilsReduction: 0.3 },
      mob_assault: { winBonus: 0, casualtyReduction: 0, spoilsReduction: 0 }
    };

    const modifier = typeModifiers[attackType];
    winProbability = Math.min(0.95, Math.max(0.05, winProbability + modifier.winBonus));

    // Calculate casualties
    const baseCasualtyRate = 0.15;
    const attackerCasualtyRate = baseCasualtyRate * (1 - modifier.casualtyReduction) * (2 - winProbability);
    const defenderCasualtyRate = baseCasualtyRate * (1 - modifier.casualtyReduction) * winProbability;

    const estimatedCasualties = {
      attacker: Object.fromEntries(
        Object.entries(army).map(([unitType, count]) => [
          unitType,
          Math.floor((count ?? 0) * attackerCasualtyRate)
        ])
      ) as Army,
      defender: Object.fromEntries(
        Object.entries(target.totalUnits).map(([unitType, count]) => [
          unitType,
          Math.floor((count ?? 0) * defenderCasualtyRate)
        ])
      ) as Army
    };

    // Calculate spoils
    const baseSpoils = {
      gold: Math.floor(target.resources.gold * 0.1 * winProbability * (1 - modifier.spoilsReduction)),
      population: Math.floor(target.resources.population * 0.05 * winProbability * (1 - modifier.spoilsReduction)),
      land: Math.floor(target.resources.land * 0.03 * winProbability * (1 - modifier.spoilsReduction))
    };

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high';
    if (winProbability > 0.7) riskLevel = 'low';
    else if (winProbability > 0.4) riskLevel = 'medium';
    else riskLevel = 'high';

    // Generate recommendation
    let recommendation: string;
    if (winProbability > 0.8) {
      recommendation = 'Excellent chance of victory with minimal losses.';
    } else if (winProbability > 0.6) {
      recommendation = 'Good chance of success, acceptable risk.';
    } else if (winProbability > 0.4) {
      recommendation = 'Risky attack, consider sending more forces.';
    } else {
      recommendation = 'High risk of defeat, not recommended.';
    }

    return {
      winProbability,
      estimatedCasualties,
      estimatedSpoils: baseSpoils,
      riskLevel,
      recommendation
    };
  }, [attacker, target, attackType, army, targetTerritory]);

  const formatArmy = useCallback((armyData: Army): string => {
    return Object.entries(armyData)
      .filter(([, count]) => (count ?? 0) > 0)
      .map(([unitType, count]) => `${count ?? 0} ${unitType}`)
      .join(', ');
  }, []);

  const getRiskColor = useCallback((risk: 'low' | 'medium' | 'high'): string => {
    switch (risk) {
      case 'low': return '#22c55e';
      case 'medium': return '#f59e0b';
      case 'high': return '#ef4444';
    }
  }, []);

  const getAttackTypeDescription = useCallback((type: AttackType): string => {
    switch (type) {
      case 'guerilla_raid':
        return 'Quick strike for resources with reduced casualties';
      case 'full_attack':
        return 'Full assault to capture territory with maximum gains';
      case 'controlled_strike':
        return 'Balanced attack with moderate risk and reward';
      case 'ambush':
        return 'Surprise attack with tactical advantage';
      case 'mob_assault':
        return 'Mass assault with overwhelming numbers';
    }
  }, []);

  return (
    <div className="attack-preview">
      <div className="preview-header">
        <h3>Attack Preview</h3>
        <div className="attack-summary">
          <span className="attack-type">{attackType.replace('_', ' ').toUpperCase()}</span>
          <span className="target-name">vs {target.name}</span>
        </div>
      </div>

      <div className="preview-content">
        {/* Battle Overview */}
        <section className="battle-overview">
          <h4>Battle Overview</h4>
          <div className="overview-grid">
            <div className="overview-item">
              <span className="label">Attack Type:</span>
              <span className="value">{getAttackTypeDescription(attackType)}</span>
            </div>
            <div className="overview-item">
              <span className="label">Target:</span>
              <span className="value">
                {target.name} ({target.race})
                {targetTerritory && ` - ${targetTerritory.name}`}
              </span>
            </div>
            <div className="overview-item">
              <span className="label">Your Forces:</span>
              <span className="value">{formatArmy(army)}</span>
            </div>
            {targetTerritory && (
              <div className="overview-item">
                <span className="label">Fortification:</span>
                <span className="value">Level {targetTerritory.fortificationLevel}</span>
              </div>
            )}
          </div>
        </section>

        {/* Battle Estimates */}
        <section className="battle-estimates">
          <h4>Battle Estimates</h4>
          
          <div className="estimate-card win-probability">
            <div className="estimate-header">
              <span className="estimate-label">Victory Chance</span>
              <span 
                className="estimate-value"
                style={{ color: getRiskColor(battleEstimate.riskLevel) }}
              >
                {(battleEstimate.winProbability * 100).toFixed(1)}%
              </span>
            </div>
            <div className="probability-bar">
              <div 
                className="probability-fill"
                style={{ 
                  width: `${battleEstimate.winProbability * 100}%`,
                  backgroundColor: getRiskColor(battleEstimate.riskLevel)
                }}
              />
            </div>
            <div className="risk-indicator">
              <span className={`risk-badge ${battleEstimate.riskLevel}`}>
                {battleEstimate.riskLevel.toUpperCase()} RISK
              </span>
            </div>
          </div>

          <div className="casualties-estimates">
            <h5>Estimated Casualties</h5>
            <div className="casualties-grid">
              <div className="casualty-column">
                <h6>Your Losses</h6>
                <div className="casualty-list">
                  {Object.entries(battleEstimate.estimatedCasualties.attacker)
                    .filter(([, count]) => (count ?? 0) > 0)
                    .map(([unitType, count]) => (
                      <div key={unitType} className="casualty-item">
                        <span className="unit-type">{unitType}:</span>
                        <span className="casualty-count">{count ?? 0}</span>
                      </div>
                    ))}
                </div>
              </div>
              
              <div className="casualty-column">
                <h6>Enemy Losses</h6>
                <div className="casualty-list">
                  {Object.entries(battleEstimate.estimatedCasualties.defender)
                    .filter(([, count]) => (count ?? 0) > 0)
                    .map(([unitType, count]) => (
                      <div key={unitType} className="casualty-item">
                        <span className="unit-type">{unitType}:</span>
                        <span className="casualty-count">{count ?? 0}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          <div className="spoils-estimates">
            <h5>Estimated Spoils (if victorious)</h5>
            <div className="spoils-grid">
              <div className="spoil-item">
                <span className="spoil-icon">💰</span>
                <span className="spoil-label">Gold:</span>
                <span className="spoil-value">{battleEstimate.estimatedSpoils.gold.toLocaleString()}</span>
              </div>
              <div className="spoil-item">
                <span className="spoil-icon">👥</span>
                <span className="spoil-label">Population:</span>
                <span className="spoil-value">{battleEstimate.estimatedSpoils.population.toLocaleString()}</span>
              </div>
              <div className="spoil-item">
                <span className="spoil-icon">🏞️</span>
                <span className="spoil-label">Land:</span>
                <span className="spoil-value">{battleEstimate.estimatedSpoils.land.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Recommendation */}
        <section className="recommendation">
          <h4>Recommendation</h4>
          <div className={`recommendation-card ${battleEstimate.riskLevel}`}>
            <span className="recommendation-text">{battleEstimate.recommendation}</span>
          </div>
        </section>
      </div>

      <div className="preview-actions">
        <button
          type="button"
          className="cancel-button"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </button>
        
        <button
          type="button"
          className={`confirm-button ${battleEstimate.riskLevel}`}
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? 'Launching...' : 'Confirm Attack'}
        </button>
      </div>
    </div>
  );
};

export default AttackPreview;
