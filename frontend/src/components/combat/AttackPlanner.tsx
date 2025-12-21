/* eslint-disable */
/**
 * Attack Planner Component
 * Interface for planning and launching attacks against other kingdoms
 */

import React, { useState, useCallback, useMemo, useEffect, memo } from 'react';
import type { 
  Kingdom, 
  AttackRequest, 
  AttackType, 
  Army,
  Territory 
} from '../../types/combat';
import { hasTerritories } from '../../types/guards';
import { KingdomSearch } from './KingdomSearch';
import { ArmySelector } from './ArmySelector';
import { AttackPreview } from './AttackPreview';

interface AttackPlannerProps {
  currentKingdom: Kingdom;
  onAttack: (request: AttackRequest) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

// Memoized sub-components
const MemoizedKingdomSearch = memo(KingdomSearch);
const MemoizedArmySelector = memo(ArmySelector);
const MemoizedAttackPreview = memo(AttackPreview);

function AttackPlanner({
  currentKingdom,
  onAttack,
  isLoading
}: AttackPlannerProps) {
  const [selectedTarget, setSelectedTarget] = useState<Kingdom | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  const [attackType, setAttackType] = useState<AttackType>('guerilla_raid');
  const [selectedArmy, setSelectedArmy] = useState<Army>({
    peasants: 0,
    militia: 0,
    knights: 0,
    cavalry: 0
  });
  const [showPreview, setShowPreview] = useState<boolean>(false);

  // Memoized available army to prevent recalculation
  const availableArmy = useMemo(() => currentKingdom.totalUnits, [currentKingdom.totalUnits]);

  // Memoized event handlers
  const handleTargetSelect = useCallback((target: Kingdom | null) => {
    setSelectedTarget(target);
    setSelectedTerritory(null);
    setShowPreview(false);
  }, []);

  const handleTerritorySelect = useCallback((territory: Territory | null) => {
    setSelectedTerritory(territory);
  }, []);

  const handleAttackTypeChange = useCallback((type: AttackType) => {
    setAttackType(type);
  }, []);

  const handleArmyChange = useCallback((army: Army) => {
    setSelectedArmy(army);
  }, []);

  const handleShowPreview = useCallback(() => {
    setShowPreview(true);
  }, []);

  const handleHidePreview = useCallback(() => {
    setShowPreview(false);
  }, []);

  const handleLaunchAttack = useCallback(async () => {
    if (!selectedTarget || !selectedTerritory) return;
    
    const attackRequest: AttackRequest = {
      targetKingdom: selectedTarget,
      targetTerritory: selectedTerritory,
      attackType,
      army: selectedArmy
    };
    
    await onAttack(attackRequest);
  }, [selectedTarget, selectedTerritory, attackType, selectedArmy, onAttack]);

  const totalSelectedUnits = useMemo(() => 
    Object.values(selectedArmy).reduce((sum, count) => (sum ?? 0) + (count ?? 0), 0)
  , [selectedArmy]);

  const canAttack = useMemo(() => 
    selectedTarget && 
    (totalSelectedUnits ?? 0) > 0 && 
    !isLoading &&
    selectedTarget.id !== currentKingdom.id
  , [selectedTarget, totalSelectedUnits, isLoading, currentKingdom.id]);



  const handlePreview = useCallback(() => {
    if (canAttack) {
      setShowPreview(true);
    }
  }, [canAttack]);

  const handleConfirmAttack = useCallback(async () => {
    if (!canAttack || !selectedTarget) return;

    const attackRequest: AttackRequest = {
      attackerId: currentKingdom.id,
      defenderId: selectedTarget.id,
      targetKingdomId: selectedTarget.id,
      targetTerritoryId: selectedTerritory?.id,
      attackType,
      units: selectedArmy
    };

    try {
      await onAttack(attackRequest);
      // Reset form on success
      setSelectedTarget(null);
      setSelectedTerritory(null);
      setSelectedArmy({
        peasants: 0,
        militia: 0,
        knights: 0,
        cavalry: 0
      });
      setShowPreview(false);
    } catch (err) {
      // Error handling is done in parent component
      console.error('Attack failed:', err);
    }
  }, [canAttack, selectedTarget, selectedTerritory, attackType, selectedArmy, onAttack, currentKingdom.id]);

  const attackTypeOptions = useMemo(() => [
    {
      value: 'raid' as AttackType,
      label: 'Raid',
      description: 'Quick strike for resources. Lower casualties, moderate gains.',
      icon: '🏃'
    },
    {
      value: 'siege' as AttackType,
      label: 'Siege',
      description: 'Full assault to capture territory. Higher casualties, major gains.',
      icon: '🏰'
    },
    {
      value: 'controlled_strike' as AttackType,
      label: 'Controlled Strike',
      description: 'Precise attack with minimal losses. Balanced risk/reward.',
      icon: '🎯'
    }
  ], []);

  return (
    <div className="attack-planner">
      <div className="planner-header">
        <h3>Plan Attack</h3>
        <div className="army-summary">
          <span>Available Forces: {Object.values(availableArmy).reduce((sum, count) => sum + count, 0)} units</span>
        </div>
      </div>

      <div className="planner-content">
        {/* Target Selection */}
        <section className="target-selection" aria-labelledby="target-heading">
          <h4 id="target-heading">Select Target</h4>
          <KingdomSearch
            currentKingdomId={currentKingdom.id}
            onKingdomSelect={handleTargetSelect}
            selectedKingdom={selectedTarget}
          />
          
          {selectedTarget && hasTerritories(selectedTarget) && selectedTarget.territories.length > 1 && (
            <div className="territory-selection">
              <label htmlFor="territory-select">Target Territory (Optional)</label>
              <select
                id="territory-select"
                value={selectedTerritory?.id || ''}
                onChange={(e) => {
                  if (!hasTerritories(selectedTarget)) return;
                  const territory = selectedTarget.territories.find(t => t.id === e.target.value);
                  handleTerritorySelect(territory || selectedTarget.territories[0]);
                }}
                className="territory-select"
              >
                <option value="">Any Territory</option>
                {selectedTarget.territories.map(territory => (
                  <option key={territory.id} value={territory.id}>
                    {territory.name} (Fort Level {territory.fortificationLevel})
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* Attack Type Selection */}
        <section className="attack-type-selection" aria-labelledby="attack-type-heading">
          <h4 id="attack-type-heading">Attack Type</h4>
          <div className="attack-type-options" role="radiogroup" aria-labelledby="attack-type-heading">
            {attackTypeOptions.map(option => (
              <label key={option.value} className="attack-type-option">
                <input
                  type="radio"
                  name="attackType"
                  value={option.value}
                  checked={attackType === option.value}
                  onChange={() => handleAttackTypeChange(option.value)}
                />
                <div className="option-content">
                  <div className="option-header">
                    <span className="option-icon">{option.icon}</span>
                    <span className="option-label">{option.label}</span>
                  </div>
                  <p className="option-description">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Army Selection */}
        <section className="army-selection" aria-labelledby="army-heading">
          <h4 id="army-heading">Select Army</h4>
          <ArmySelector
            availableArmy={availableArmy}
            selectedArmy={selectedArmy}
            onArmyChange={handleArmyChange}
            maxUnits={Math.floor(Object.values(availableArmy).reduce((sum, count) => (sum ?? 0) + (count ?? 0), 0) * 0.8)}
          />
          <div className="army-summary">
            <span>Selected: {totalSelectedUnits ?? 0} units</span>
            <span>Remaining: {Object.values(availableArmy).reduce((sum, count) => (sum ?? 0) + (count ?? 0), 0) - (totalSelectedUnits ?? 0)} units</span>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="planner-actions">
          <button
            type="button"
            className="preview-button"
            onClick={handlePreview}
            disabled={!canAttack}
          >
            Preview Attack
          </button>
          
          <button
            type="button"
            className="attack-button primary"
            onClick={handleConfirmAttack}
            disabled={!canAttack || !showPreview}
          >
            {isLoading ? 'Launching...' : 'Launch Attack'}
          </button>
        </div>

        {/* Attack Preview */}
        {showPreview && selectedTarget && (
          <AttackPreview
            attacker={currentKingdom}
            target={selectedTarget}
            attackType={attackType}
            army={selectedArmy}
            targetTerritory={selectedTerritory}
            onConfirm={handleConfirmAttack}
            onCancel={() => setShowPreview(false)}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}

export default AttackPlanner;
