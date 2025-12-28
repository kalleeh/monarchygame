/**
 * Army Selector Component
 * Interface for selecting units for attacks
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Army } from '../../types/combat';

interface ArmySelectorProps {
  availableArmy: Army;
  selectedArmy: Army;
  onArmyChange: (army: Army) => void;
  maxUnits?: number;
  className?: string;
}

interface UnitTypeInfo {
  name: string;
  icon: string;
  description: string;
  stats: {
    offense: number;
    defense: number;
    cost: number;
  };
}

export const ArmySelector: React.FC<ArmySelectorProps> = ({
  availableArmy,
  selectedArmy,
  onArmyChange,
  maxUnits = Infinity,
  className = ''
}) => {
  const [presetPercentage, setPresetPercentage] = useState<number>(0);

  const unitTypes: Record<string, UnitTypeInfo> = useMemo(() => ({
    peasants: {
      name: 'Peasants',
      icon: '👨‍🌾',
      description: 'Basic infantry units. Cheap but weak.',
      stats: { offense: 1, defense: 1, cost: 10 }
    },
    militia: {
      name: 'Militia',
      icon: '🛡️',
      description: 'Trained defenders. Balanced offense and defense.',
      stats: { offense: 2, defense: 3, cost: 25 }
    },
    knights: {
      name: 'Knights',
      icon: '⚔️',
      description: 'Elite warriors. High offense and defense.',
      stats: { offense: 4, defense: 4, cost: 100 }
    },
    cavalry: {
      name: 'Cavalry',
      icon: '🐎',
      description: 'Fast mounted units. Excellent for raids.',
      stats: { offense: 5, defense: 2, cost: 150 }
    },
    archers: {
      name: 'Archers',
      icon: '🏹',
      description: 'Ranged units. Good against infantry.',
      stats: { offense: 3, defense: 2, cost: 75 }
    },
    siege: {
      name: 'Siege Engines',
      icon: '🏰',
      description: 'Specialized for breaking fortifications.',
      stats: { offense: 6, defense: 1, cost: 300 }
    }
  }), []);

  const totalSelected = useMemo(() => 
    Object.values(selectedArmy).reduce((sum, count) => (sum ?? 0) + (count ?? 0), 0)
  , [selectedArmy]);

  const totalAvailable = useMemo(() => 
    Object.values(availableArmy).reduce((sum, count) => (sum ?? 0) + (count ?? 0), 0)
  , [availableArmy]);

  const combatPower = useMemo(() => {
    return Object.entries(selectedArmy).reduce((power, [unitType, count]) => {
      const unitInfo = unitTypes[unitType];
      const unitCount = count ?? 0;
      if (unitInfo && unitCount > 0) {
        return power + (unitCount * (unitInfo.stats.offense + unitInfo.stats.defense));
      }
      return power;
    }, 0);
  }, [selectedArmy, unitTypes]);

  const handleUnitChange = useCallback((unitType: string, value: number) => {
    const available = availableArmy[unitType] || 0;
    const clampedValue = Math.max(0, Math.min(value, available));
    
    const newArmy = { ...selectedArmy, [unitType]: clampedValue };
    const newTotal = Object.values(newArmy).reduce((sum, count) => (sum ?? 0) + (count ?? 0), 0) as number;
    
    if (newTotal <= maxUnits) {
      onArmyChange(newArmy);
    }
  }, [availableArmy, selectedArmy, maxUnits, onArmyChange]);

  const handlePresetChange = useCallback((percentage: number) => {
    setPresetPercentage(percentage);
    
    const newArmy: Army = { peasants: 0, militia: 0, knights: 0, cavalry: 0 };
    Object.entries(availableArmy).forEach(([unitType, available]) => {
      const selectedCount = Math.floor((available ?? 0) * (percentage / 100));
      if (selectedCount > 0) {
        newArmy[unitType as keyof Army] = selectedCount;
      }
    });
    
    // Ensure we don't exceed maxUnits
    const total = Object.values(newArmy).reduce((sum, count) => (sum ?? 0) + (count ?? 0), 0) as number;
    if (total > maxUnits) {
      const ratio = maxUnits / total;
      Object.keys(newArmy).forEach(unitType => {
        const currentValue = newArmy[unitType as keyof Army] ?? 0;
        newArmy[unitType as keyof Army] = Math.floor(currentValue * ratio);
      });
    }
    
    onArmyChange(newArmy);
  }, [availableArmy, maxUnits, onArmyChange]);

  const handleSelectAll = useCallback(() => {
    const newArmy: Army = { ...availableArmy };
    const total = Object.values(newArmy).reduce((sum, count) => (sum ?? 0) + (count ?? 0), 0) as number;
    
    if (total > maxUnits) {
      const ratio = maxUnits / total;
      Object.keys(newArmy).forEach(unitType => {
        const currentValue = newArmy[unitType as keyof Army] ?? 0;
        newArmy[unitType as keyof Army] = Math.floor(currentValue * ratio);
      });
    }
    
    onArmyChange(newArmy);
    setPresetPercentage(100);
  }, [availableArmy, maxUnits, onArmyChange]);

  const handleClearAll = useCallback(() => {
    const clearedArmy: Army = {
      peasants: 0,
      militia: 0,
      knights: 0,
      cavalry: 0
    };
    Object.keys(availableArmy).forEach(unitType => {
      clearedArmy[unitType as keyof Army] = 0;
    });
    onArmyChange(clearedArmy);
    setPresetPercentage(0);
  }, [availableArmy, onArmyChange]);

  // Update preset percentage when army changes externally
  useEffect(() => {
    const totalAvailableValue = totalAvailable ?? 0;
    const totalSelectedValue = totalSelected ?? 0;
    if (totalAvailableValue > 0) {
      const currentPercentage = Math.round((totalSelectedValue / totalAvailableValue) * 100);
      setPresetPercentage(currentPercentage);
    }
  }, [totalSelected, totalAvailable]);

  const presetOptions = [10, 25, 50, 75, 100];

  return (
    <div className={`army-selector ${className}`}>
      <div className="selector-header">
        <div className="army-summary">
          <div className="summary-stat">
            <span className="stat-label">Selected:</span>
            <span className="stat-value">{(totalSelected ?? 0).toLocaleString()}</span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Available:</span>
            <span className="stat-value">{(totalAvailable ?? 0).toLocaleString()}</span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Power:</span>
            <span className="stat-value">{combatPower}</span>
          </div>
        </div>

        <div className="preset-controls">
          <label htmlFor="preset-slider">Quick Select:</label>
          <div className="preset-buttons">
            {presetOptions.map(percentage => (
              <button
                key={percentage}
                type="button"
                className={`preset-button ${presetPercentage === percentage ? 'active' : ''}`}
                onClick={() => handlePresetChange(percentage)}
              >
                {percentage}%
              </button>
            ))}
          </div>
          
          <div className="action-buttons">
            <button
              type="button"
              className="action-button"
              onClick={handleSelectAll}
              disabled={totalSelected === totalAvailable}
            >
              All
            </button>
            <button
              type="button"
              className="action-button"
              onClick={handleClearAll}
              disabled={totalSelected === 0}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="unit-selectors">
        {Object.entries(availableArmy).map(([unitType, available]) => {
          const unitInfo = unitTypes[unitType];
          const selected = selectedArmy[unitType] || 0;
          const availableCount = available ?? 0;
          const percentage = availableCount > 0 ? (selected / availableCount) * 100 : 0;
          
          if (!unitInfo || availableCount === 0) return null;

          return (
            <div key={unitType} className="unit-selector">
              <div className="unit-header">
                <div className="unit-info">
                  <span className="unit-icon">{unitInfo.icon}</span>
                  <div className="unit-details">
                    <span className="unit-name">{unitInfo.name}</span>
                    <span className="unit-description">{unitInfo.description}</span>
                  </div>
                </div>
                
                <div className="unit-stats">
                  <div className="stat">
                    <span className="stat-icon">⚔️</span>
                    <span className="stat-value">{unitInfo.stats.offense}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-icon">🛡️</span>
                    <span className="stat-value">{unitInfo.stats.defense}</span>
                  </div>
                </div>
              </div>

              <div className="unit-controls">
                <div className="unit-count">
                  <span className="count-label">Available: {availableCount.toLocaleString()}</span>
                  <span className="count-selected">Selected: {selected.toLocaleString()}</span>
                </div>

                <div className="input-controls">
                  <button
                    type="button"
                    className="quantity-button"
                    onClick={() => handleUnitChange(unitType, selected - Math.max(1, Math.floor(availableCount * 0.1)))}
                    disabled={selected === 0}
                    aria-label={`Decrease ${unitInfo.name}`}
                  >
                    −
                  </button>
                  
                  <input
                    type="number"
                    className="unit-input"
                    value={selected}
                    onChange={(e) => handleUnitChange(unitType, parseInt(e.target.value) || 0)}
                    min="0"
                    max={availableCount}
                    aria-label={`Number of ${unitInfo.name}`}
                  />
                  
                  <button
                    type="button"
                    className="quantity-button"
                    onClick={() => handleUnitChange(unitType, selected + Math.max(1, Math.floor(availableCount * 0.1)))}
                    disabled={selected >= availableCount || (totalSelected ?? 0) >= maxUnits}
                    aria-label={`Increase ${unitInfo.name}`}
                  >
                    +
                  </button>
                </div>

                <div className="unit-slider">
                  <input
                    type="range"
                    className="slider"
                    value={selected}
                    onChange={(e) => handleUnitChange(unitType, parseInt(e.target.value))}
                    min="0"
                    max={availableCount}
                    aria-label={`Select ${unitInfo.name} with slider`}
                  />
                  <div className="slider-labels">
                    <span>0</span>
                    <span className="percentage">{percentage.toFixed(0)}%</span>
                    <span>{availableCount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(totalSelected ?? 0) > maxUnits && (
        <div className="warning-message" role="alert">
          <span className="warning-icon">⚠️</span>
          <span>Army size exceeds maximum limit of {maxUnits.toLocaleString()} units</span>
        </div>
      )}
    </div>
  );
};

export default ArmySelector;
