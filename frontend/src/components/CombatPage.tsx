/**
 * Combat Page Component
 * Integrated combat system for the Monarchy game
 */

import React, { useState, useCallback, useEffect } from 'react';
import { CombatInterface } from './CombatInterface';
import { CombatService } from '../services/combatService';
import { TopNavigation } from './TopNavigation';
import type { Kingdom, AttackRequest } from '../types/combat';
import type { Schema } from '../../../amplify/data/resource';

interface CombatPageProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
}

export const CombatPage: React.FC<CombatPageProps> = ({ kingdom, onBack }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastAttackResult, setLastAttackResult] = useState<string | null>(null);

  // Convert Schema Kingdom to Combat Kingdom type
  const combatKingdom: Kingdom = {
    id: kingdom.id,
    name: kingdom.name,
    race: kingdom.race as any,
    owner: kingdom.owner || 'current-user',
    resources: kingdom.resources as any,
    stats: kingdom.stats as any,
    territories: [], // Would be populated from actual data
    totalUnits: kingdom.totalUnits as any || { peasants: 100, militia: 50, knights: 25, cavalry: 10 },
    isOnline: kingdom.isOnline || true,
    lastActive: new Date(kingdom.lastActive || Date.now())
  };

  const handleAttack = useCallback(async (request: AttackRequest) => {
    setIsLoading(true);
    
    try {
      const result = await CombatService.launchAttack(request);
      
      if (result.success) {
        setLastAttackResult(
          `🏆 Victory! Gained ${result.spoils.gold.toLocaleString()} gold, ${result.spoils.population} population, and ${result.spoils.land} land.`
        );
      } else {
        setLastAttackResult('💀 Attack failed. Your forces were repelled.');
      }
      
      setTimeout(() => setLastAttackResult(null), 5000);
      
    } catch (error) {
      console.error('Attack failed:', error);
      setLastAttackResult('⚠️ Attack failed due to an error. Please try again.');
      setTimeout(() => setLastAttackResult(null), 5000);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleUpdateDefense = useCallback(async (settings: any) => {
    setIsLoading(true);
    
    try {
      await CombatService.updateDefenseSettings(settings);
      setLastAttackResult('✅ Defense settings updated successfully.');
      setTimeout(() => setLastAttackResult(null), 3000);
    } catch (error) {
      console.error('Failed to update defense settings:', error);
      setLastAttackResult('⚠️ Failed to update defense settings.');
      setTimeout(() => setLastAttackResult(null), 3000);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="combat-page">
      <TopNavigation
        title="⚔️ Combat Operations"
        subtitle={`${kingdom.name} - Battle Management`}
        onBack={onBack}
        backLabel="← Back to Kingdom"
      />

      {lastAttackResult && (
        <div 
          className={`attack-result-banner ${
            lastAttackResult.includes('Victory') || lastAttackResult.includes('updated') 
              ? 'success' 
              : 'failure'
          }`}
          role="alert"
          aria-live="polite"
        >
          <span className="result-message">{lastAttackResult}</span>
          <button
            type="button"
            className="dismiss-button"
            onClick={() => setLastAttackResult(null)}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      <CombatInterface
        currentKingdom={combatKingdom}
        onAttack={handleAttack}
        onUpdateDefense={handleUpdateDefense}
        className="main-combat-interface"
      />
    </div>
  );
};
