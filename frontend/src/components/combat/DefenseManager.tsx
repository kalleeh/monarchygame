/**
 * Defense Manager Component
 * Interface for managing defensive settings and strategies
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { Kingdom, DefenseSettings } from '../../types/combat';
import { hasTerritories } from '../../types/guards';

interface DefenseManagerProps {
  currentKingdom: Kingdom;
  onUpdateDefense: (settings: DefenseSettings) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export const DefenseManager: React.FC<DefenseManagerProps> = ({
  currentKingdom,
  onUpdateDefense,
  isLoading
}) => {
  const [defenseSettings, setDefenseSettings] = useState<DefenseSettings>({
    stance: 'balanced',
    autoRecruit: false,
    alertThreshold: 50,
    unitDistribution: {
      frontline: 60,
      reserves: 30,
      fortifications: 10
    },
    autoRetaliate: false,
    alertAlliance: true
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  const totalUnits = useMemo(() => 
    Object.values(currentKingdom.totalUnits).reduce((sum, count) => sum + count, 0)
  , [currentKingdom.totalUnits]);

  const distributedUnits = useMemo(() => {
    const frontline = defenseSettings.unitDistribution?.frontline ?? 60;
    const reserves = defenseSettings.unitDistribution?.reserves ?? 30;
    const fortifications = defenseSettings.unitDistribution?.fortifications ?? 10;
    return {
      frontline: Math.floor(totalUnits * (frontline / 100)),
      reserves: Math.floor(totalUnits * (reserves / 100)),
      fortifications: Math.floor(totalUnits * (fortifications / 100))
    };
  }, [totalUnits, defenseSettings.unitDistribution]);

  const defensivePower = useMemo(() => {
    const baseDefense = Object.entries(currentKingdom.totalUnits).reduce((power, [unitType, count]) => {
      const unitDefense = unitType === 'knights' ? 4 : unitType === 'militia' ? 3 : unitType === 'cavalry' ? 2 : 1;
      return power + (count * unitDefense);
    }, 0);

    const stanceMultiplier = {
      aggressive: 0.8,
      balanced: 1.0,
      defensive: 1.3
    }[defenseSettings.stance];

    const racialBonus = currentKingdom.stats.warDefense / 10;
    const fortificationBonus = hasTerritories(currentKingdom) 
      ? currentKingdom.territories.reduce((bonus, territory) => 
          bonus + (territory.fortificationLevel * 0.1), 0
        )
      : 0;

    return Math.floor(baseDefense * stanceMultiplier * (1 + racialBonus + fortificationBonus));
  }, [currentKingdom, defenseSettings.stance]);

  const handleStanceChange = useCallback((stance: DefenseSettings['stance']) => {
    setDefenseSettings(prev => ({ ...prev, stance }));
    setHasUnsavedChanges(true);
  }, []);

  const handleDistributionChange = useCallback((type: 'frontline' | 'reserves' | 'fortifications' | 'tier1' | 'tier2' | 'tier3' | 'tier4', value: number) => {
    setDefenseSettings(prev => {
      const newDistribution = { ...prev.unitDistribution, [type]: value };
      
      // Ensure total doesn't exceed 100%
      const total = Object.values(newDistribution).reduce((sum, val) => (sum ?? 0) + (val ?? 0), 0);
      if (total > 100) {
        return prev; // Don't update if it would exceed 100%
      }
      
      return {
        ...prev,
        unitDistribution: newDistribution
      };
    });
    setHasUnsavedChanges(true);
  }, []);

  const handleToggleChange = useCallback((setting: 'autoRetaliate' | 'alertAlliance') => {
    setDefenseSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      await onUpdateDefense(defenseSettings);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Failed to save defense settings:', err);
    }
  }, [defenseSettings, onUpdateDefense]);

  const handleReset = useCallback(() => {
    setDefenseSettings({
      stance: 'balanced',
      autoRecruit: false,
      alertThreshold: 50,
      unitDistribution: {
        frontline: 60,
        reserves: 30,
        fortifications: 10
      },
      autoRetaliate: false,
      alertAlliance: true
    });
    setHasUnsavedChanges(true);
  }, []);

  const stanceOptions = [
    {
      value: 'aggressive' as const,
      label: 'Aggressive',
      description: 'Focus on counter-attacks. -20% defense, +30% retaliation damage.',
      icon: '⚔️',
      color: '#ef4444'
    },
    {
      value: 'balanced' as const,
      label: 'Balanced',
      description: 'Standard defensive posture. No bonuses or penalties.',
      icon: '⚖️',
      color: '#6b7280'
    },
    {
      value: 'defensive' as const,
      label: 'Defensive',
      description: 'Maximize protection. +30% defense, -50% retaliation damage.',
      icon: '🛡️',
      color: '#22c55e'
    }
  ];

  const distributionTotal = Object.values(defenseSettings.unitDistribution ?? {}).reduce((sum, val) => sum + (val ?? 0), 0);

  return (
    <div className="defense-manager">
      <div className="manager-header">
        <h3>Defense Management</h3>
        <div className="defense-summary">
          <div className="summary-stat">
            <span className="stat-label">Total Forces:</span>
            <span className="stat-value">{totalUnits.toLocaleString()}</span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Defensive Power:</span>
            <span className="stat-value">{defensivePower.toLocaleString()}</span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Fortifications:</span>
            <span className="stat-value">
              {hasTerritories(currentKingdom) 
                ? currentKingdom.territories.reduce((sum, t) => sum + t.fortificationLevel, 0) 
                : 0} levels
            </span>
          </div>
        </div>
      </div>

      <div className="defense-content">
        {/* Defensive Stance */}
        <section className="defense-section">
          <h4>Defensive Stance</h4>
          <div className="stance-options">
            {stanceOptions.map(option => (
              <label key={option.value} className="stance-option">
                <input
                  type="radio"
                  name="stance"
                  value={option.value}
                  checked={defenseSettings.stance === option.value}
                  onChange={() => handleStanceChange(option.value)}
                />
                <div className="stance-content">
                  <div className="stance-header">
                    <span className="stance-icon" style={{ color: option.color }}>
                      {option.icon}
                    </span>
                    <span className="stance-label">{option.label}</span>
                  </div>
                  <p className="stance-description">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Unit Distribution */}
        <section className="defense-section">
          <h4>Unit Distribution</h4>
          <div className="distribution-controls">
            <div className="distribution-item">
              <div className="distribution-header">
                <span className="distribution-label">
                  <span className="distribution-icon">⚔️</span>
                  Frontline ({defenseSettings.unitDistribution?.frontline ?? 60}%)
                </span>
                <span className="unit-count">{distributedUnits.frontline.toLocaleString()} units</span>
              </div>
              <input
                type="range"
                className="distribution-slider"
                min="0"
                max="100"
                value={defenseSettings.unitDistribution?.frontline ?? 60}
                onChange={(e) => handleDistributionChange('frontline', parseInt(e.target.value))}
              />
              <p className="distribution-description">
                Units positioned for immediate combat. High casualties but maximum damage.
              </p>
            </div>

            <div className="distribution-item">
              <div className="distribution-header">
                <span className="distribution-label">
                  <span className="distribution-icon">🏃</span>
                  Reserves ({defenseSettings.unitDistribution?.reserves ?? 30}%)
                </span>
                <span className="unit-count">{distributedUnits.reserves.toLocaleString()} units</span>
              </div>
              <input
                type="range"
                className="distribution-slider"
                min="0"
                max="100"
                value={defenseSettings.unitDistribution?.reserves ?? 30}
                onChange={(e) => handleDistributionChange('reserves', parseInt(e.target.value))}
              />
              <p className="distribution-description">
                Units held back for reinforcement. Lower casualties, moderate effectiveness.
              </p>
            </div>

            <div className="distribution-item">
              <div className="distribution-header">
                <span className="distribution-label">
                  <span className="distribution-icon">🏰</span>
                  Fortifications ({defenseSettings.unitDistribution?.fortifications ?? 10}%)
                </span>
                <span className="unit-count">{distributedUnits.fortifications.toLocaleString()} units</span>
              </div>
              <input
                type="range"
                className="distribution-slider"
                min="0"
                max="100"
                value={defenseSettings.unitDistribution?.fortifications ?? 10}
                onChange={(e) => handleDistributionChange('fortifications', parseInt(e.target.value))}
              />
              <p className="distribution-description">
                Units manning defensive structures. Lowest casualties, defensive bonus.
              </p>
            </div>

            <div className="distribution-total">
              <span className="total-label">Total Distribution:</span>
              <span className={`total-value ${distributionTotal === 100 ? 'complete' : 'incomplete'}`}>
                {distributionTotal}%
              </span>
              {distributionTotal !== 100 && (
                <span className="total-warning">
                  ⚠️ Distribution should total 100%
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Automated Settings */}
        <section className="defense-section">
          <h4>Automated Defense</h4>
          <div className="automation-settings">
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={defenseSettings.autoRetaliate}
                onChange={() => handleToggleChange('autoRetaliate')}
              />
              <div className="toggle-content">
                <div className="toggle-header">
                  <span className="toggle-icon">🔄</span>
                  <span className="toggle-label">Auto-Retaliate</span>
                </div>
                <p className="toggle-description">
                  Automatically launch counter-attacks against successful attackers using available forces.
                </p>
              </div>
            </label>

            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={defenseSettings.alertAlliance}
                onChange={() => handleToggleChange('alertAlliance')}
              />
              <div className="toggle-content">
                <div className="toggle-header">
                  <span className="toggle-icon">📢</span>
                  <span className="toggle-label">Alert Alliance</span>
                </div>
                <p className="toggle-description">
                  Notify alliance members when your kingdom is under attack for potential assistance.
                </p>
              </div>
            </label>
          </div>
        </section>

        {/* Territory Fortifications */}
        <section className="defense-section">
          <h4>Territory Fortifications</h4>
          <div className="fortifications-list">
            {(currentKingdom.territories ?? []).map(territory => (
              <div key={territory.id} className="fortification-item">
                <div className="territory-info">
                  <span className="territory-name">{territory.name}</span>
                  {territory.isCapital && <span className="capital-badge">👑 Capital</span>}
                </div>
                <div className="fortification-level">
                  <span className="level-label">Level {territory.fortificationLevel}</span>
                  <div className="level-bars">
                    {[1, 2, 3, 4, 5].map(level => (
                      <div
                        key={level}
                        className={`level-bar ${level <= territory.fortificationLevel ? 'active' : ''}`}
                      />
                    ))}
                  </div>
                  <span className="level-bonus">
                    +{(territory.fortificationLevel * 10)}% defense
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="defense-actions">
        <button
          type="button"
          className="reset-button"
          onClick={handleReset}
          disabled={isLoading}
        >
          Reset to Defaults
        </button>
        
        <button
          type="button"
          className="save-button"
          onClick={handleSave}
          disabled={!hasUnsavedChanges || isLoading || distributionTotal !== 100}
        >
          {isLoading ? 'Saving...' : 'Save Defense Settings'}
        </button>
      </div>

      {hasUnsavedChanges && (
        <div className="unsaved-warning">
          <span className="warning-icon">⚠️</span>
          <span>You have unsaved changes to your defense settings.</span>
        </div>
      )}
    </div>
  );
};

export default DefenseManager;
