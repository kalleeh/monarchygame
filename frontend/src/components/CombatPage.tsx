/**
 * Combat Page Component
 * Integrated combat system for the Monarchy game
 */

import React, { useState, useCallback, useEffect } from 'react';
import { CombatInterface } from './CombatInterface';
import { CombatService } from '../services/combatService';
import { AICombatService } from '../services/aiCombatService';
import { TopNavigation } from './TopNavigation';
import { useKingdomStore } from '../stores/kingdomStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { ToastService } from '../services/toastService';
import type { Kingdom, AttackRequest, Army, DefenseSettings } from '../types/combat';
import type { RaceType } from '../types/amplify';
import type { Schema } from '../../../amplify/data/resource';

interface CombatPageProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
}

export const CombatPage: React.FC<CombatPageProps> = ({ kingdom, onBack }) => {
  const [lastAttackResult, setLastAttackResult] = useState<string | null>(null);
  const [attacking, setAttacking] = useState(false);
  
  // Get resources from centralized store
  const resources = useKingdomStore((state) => state.resources);
  
  // Get AI kingdoms
  const aiKingdoms = useAIKingdomStore((state) => state.aiKingdoms);
  const generateAIKingdoms = useAIKingdomStore((state) => state.generateAIKingdoms);
  
  // Generate AI kingdoms on mount (demo mode only)
  useEffect(() => {
    const isDemoMode = localStorage.getItem('demo-mode') === 'true';
    if (isDemoMode && aiKingdoms.length === 0) {
      const playerNetworth = (resources.land || 0) * 1000 + (resources.gold || 0);
      generateAIKingdoms(5, playerNetworth);
    }
  }, [aiKingdoms.length, resources.land, resources.gold, generateAIKingdoms]);

  // Convert Schema Kingdom to Combat Kingdom type
  const combatKingdom: Kingdom = {
    id: kingdom.id,
    name: kingdom.name,
    race: kingdom.race as RaceType,
    owner: kingdom.owner || 'current-user',
    resources: resources as Kingdom['resources'],
    stats: kingdom.stats as Kingdom['stats'],
    territories: [], // Would be populated from actual data
    totalUnits: { 
      peasants: (kingdom.totalUnits as Army)?.peasants ?? 100, 
      militia: (kingdom.totalUnits as Army)?.militia ?? 50, 
      knights: (kingdom.totalUnits as Army)?.knights ?? 25, 
      cavalry: (kingdom.totalUnits as Army)?.cavalry ?? 10 
    },
    isOnline: kingdom.isOnline || true,
    lastActive: new Date(kingdom.lastActive || Date.now())
  };
  
  const handleAIAttack = async (aiKingdom: typeof aiKingdoms[0]) => {
    if (!AICombatService.canAffordAttack()) {
      ToastService.error('Not enough turns! Need 4 turns to attack.');
      return;
    }
    
    setAttacking(true);
    try {
      const result = await AICombatService.executeAttack(aiKingdom);
      
      if (result.success) {
        ToastService.success(result.message);
      } else {
        ToastService.error(result.message);
      }
    } catch (error) {
      console.error('Attack failed:', error);
      ToastService.error('Attack failed due to an error.');
    } finally {
      setAttacking(false);
    }
  };

  const handleAttack = useCallback(async (request: AttackRequest) => {
    try {
      const result = await CombatService.launchAttack(request);
      
      if (result.success) {
        setLastAttackResult(
          `🏆 Victory! Gained ${result.spoils?.gold?.toLocaleString() ?? 0} gold, ${result.spoils?.population ?? 0} population, and ${result.spoils?.land ?? 0} land.`
        );
      } else {
        setLastAttackResult('💀 Attack failed. Your forces were repelled.');
      }
      
      setTimeout(() => setLastAttackResult(null), 5000);
      
    } catch (error) {
      console.error('Attack failed:', error);
      setLastAttackResult('⚠️ Attack failed due to an error. Please try again.');
      setTimeout(() => setLastAttackResult(null), 5000);
    }
  }, []);

  const handleUpdateDefense = useCallback(async (settings: DefenseSettings) => {
    try {
      await CombatService.updateDefenseSettings(combatKingdom.id, settings);
      setLastAttackResult('✅ Defense settings updated successfully.');
      setTimeout(() => setLastAttackResult(null), 3000);
    } catch (error) {
      console.error('Failed to update defense settings:', error);
      setLastAttackResult('⚠️ Failed to update defense settings.');
      setTimeout(() => setLastAttackResult(null), 3000);
      throw error;
    }
  }, [combatKingdom.id]);

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

      {/* AI Kingdoms List (Demo Mode) */}
      {aiKingdoms.length > 0 && (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ color: '#8b5cf6', marginBottom: '20px' }}>🤖 Available Targets (Demo Mode)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginBottom: '40px' }}>
            {aiKingdoms.map((ai) => {
              const playerNetworth = (resources.land || 0) * 1000 + (resources.gold || 0);
              const ratio = playerNetworth / ai.networth;
              const difficulty = ratio >= 1.5 ? '🟢 Easy' : ratio >= 0.8 ? '🟡 Fair' : '🔴 Hard';
              
              return (
                <div
                  key={ai.id}
                  style={{
                    background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.8) 0%, rgba(22, 33, 62, 0.8) 100%)',
                    border: '2px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    padding: '16px'
                  }}
                >
                  <h3 style={{ color: '#fff', margin: '0 0 8px 0' }}>{ai.name}</h3>
                  <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', margin: '0 0 12px 0' }}>
                    {ai.race} Kingdom • {difficulty}
                  </p>
                  <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '12px' }}>
                    <div>💰 Gold: {ai.resources.gold.toLocaleString()}</div>
                    <div>🏞️ Land: {ai.resources.land.toLocaleString()}</div>
                    <div>⚔️ Networth: {ai.networth.toLocaleString()}</div>
                  </div>
                  <button
                    onClick={() => handleAIAttack(ai)}
                    disabled={attacking || (resources.turns || 0) < 4}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                      color: 'white',
                      border: 'none',
                      padding: '10px',
                      borderRadius: '6px',
                      cursor: attacking || (resources.turns || 0) < 4 ? 'not-allowed' : 'pointer',
                      opacity: attacking || (resources.turns || 0) < 4 ? 0.5 : 1,
                      fontWeight: 600
                    }}
                  >
                    {attacking ? 'Attacking...' : `Attack (4 turns)`}
                  </button>
                </div>
              );
            })}
          </div>
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
