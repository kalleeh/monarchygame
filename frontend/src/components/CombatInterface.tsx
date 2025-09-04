/**
 * Combat Interface Component
 * Main interface for managing attacks, viewing battle reports, and defense settings
 */

import React, { useState, useCallback, useMemo } from 'react';
import './CombatInterface.css';
import type { 
  Kingdom, 
  AttackRequest, 
  AttackType, 
  Army, 
  BattleHistory,
  CombatNotification 
} from '../types/combat';
import { AttackPlanner } from './combat/AttackPlanner';
import { BattleReports } from './combat/BattleReports';
import { DefenseManager } from './combat/DefenseManager';
import { CombatNotifications } from './combat/CombatNotifications';

interface CombatInterfaceProps {
  currentKingdom: Kingdom;
  onAttack: (request: AttackRequest) => Promise<void>;
  onUpdateDefense: (settings: any) => Promise<void>;
  className?: string;
  'aria-label'?: string;
}

type CombatTab = 'attack' | 'defense' | 'reports' | 'notifications';

export const CombatInterface: React.FC<CombatInterfaceProps> = ({
  currentKingdom,
  onAttack,
  onUpdateDefense,
  className = '',
  'aria-label': ariaLabel = 'Combat Interface'
}) => {
  const [activeTab, setActiveTab] = useState<CombatTab>('attack');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Mock data - in real app this would come from props or context
  const mockBattleHistory: BattleHistory[] = useMemo(() => [
    {
      id: '1',
      result: {
        success: true,
        attackType: 'raid',
        attacker: {
          kingdomId: currentKingdom.id,
          kingdomName: currentKingdom.name,
          race: currentKingdom.race,
          armyBefore: { peasants: 100, militia: 50, knights: 20, cavalry: 10 },
          armyAfter: { peasants: 85, militia: 42, knights: 18, cavalry: 9 },
          casualties: { peasants: 15, militia: 8, knights: 2, cavalry: 1 }
        },
        defender: {
          kingdomId: 'enemy1',
          kingdomName: 'Enemy Kingdom',
          race: 'Goblin',
          armyBefore: { peasants: 80, militia: 40, knights: 15, cavalry: 5 },
          armyAfter: { peasants: 60, militia: 25, knights: 10, cavalry: 3 },
          casualties: { peasants: 20, militia: 15, knights: 5, cavalry: 2 },
          fortificationLevel: 2
        },
        spoils: { gold: 1500, population: 25, land: 5 },
        battleReport: {
          rounds: [],
          duration: 45,
          terrain: 'plains'
        },
        timestamp: new Date(Date.now() - 3600000)
      },
      isAttacker: true,
      outcome: 'victory',
      netGain: { gold: 1500, land: 5, population: 25 },
      timestamp: new Date(Date.now() - 3600000)
    }
  ], [currentKingdom]);

  const mockNotifications: CombatNotification[] = useMemo(() => [
    {
      id: '1',
      type: 'incoming_attack',
      message: 'Incoming raid from Dark Empire',
      kingdomName: 'Dark Empire',
      attackType: 'raid',
      estimatedArrival: new Date(Date.now() + 1800000),
      isRead: false,
      timestamp: new Date(Date.now() - 300000)
    }
  ], []);

  const handleAttack = useCallback(async (request: AttackRequest) => {
    try {
      setIsLoading(true);
      setError(null);
      await onAttack(request);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Attack failed';
      setError(errorMessage);
      console.error('Attack failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [onAttack]);

  const handleDefenseUpdate = useCallback(async (settings: any) => {
    try {
      setIsLoading(true);
      setError(null);
      await onUpdateDefense(settings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Defense update failed';
      setError(errorMessage);
      console.error('Defense update failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [onUpdateDefense]);

  const handleTabChange = useCallback((tab: CombatTab) => {
    setActiveTab(tab);
    setError(null);
  }, []);

  const unreadNotifications = useMemo(() => 
    mockNotifications.filter(n => !n.isRead).length
  , [mockNotifications]);

  const renderTabContent = useMemo(() => {
    switch (activeTab) {
      case 'attack':
        return (
          <AttackPlanner
            currentKingdom={currentKingdom}
            onAttack={handleAttack}
            isLoading={isLoading}
            error={error}
          />
        );
      case 'defense':
        return (
          <DefenseManager
            currentKingdom={currentKingdom}
            onUpdateDefense={handleDefenseUpdate}
            isLoading={isLoading}
            error={error}
          />
        );
      case 'reports':
        return (
          <BattleReports
            battleHistory={mockBattleHistory}
            currentKingdomId={currentKingdom.id}
          />
        );
      case 'notifications':
        return (
          <CombatNotifications
            notifications={mockNotifications}
            onMarkAsRead={() => {}}
            onMarkAllAsRead={() => {}}
          />
        );
      default:
        return null;
    }
  }, [activeTab, currentKingdom, handleAttack, handleDefenseUpdate, isLoading, error, mockBattleHistory, mockNotifications]);

  return (
    <div 
      className={`combat-interface ${className}`}
      role="region"
      aria-label={ariaLabel}
    >
      <div className="combat-header">
        <h2 className="combat-title">Combat Operations</h2>
        <div className="kingdom-info">
          <span className="kingdom-name">{currentKingdom.name}</span>
          <span className="kingdom-race">({currentKingdom.race})</span>
        </div>
      </div>

      <nav className="combat-tabs" role="tablist" aria-label="Combat sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'attack'}
          aria-controls="attack-panel"
          className={`tab-button ${activeTab === 'attack' ? 'active' : ''}`}
          onClick={() => handleTabChange('attack')}
        >
          <span className="tab-icon">⚔️</span>
          Attack
        </button>
        
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'defense'}
          aria-controls="defense-panel"
          className={`tab-button ${activeTab === 'defense' ? 'active' : ''}`}
          onClick={() => handleTabChange('defense')}
        >
          <span className="tab-icon">🛡️</span>
          Defense
        </button>
        
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reports'}
          aria-controls="reports-panel"
          className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => handleTabChange('reports')}
        >
          <span className="tab-icon">📊</span>
          Reports
        </button>
        
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'notifications'}
          aria-controls="notifications-panel"
          className={`tab-button ${activeTab === 'notifications' ? 'active' : ''} ${unreadNotifications > 0 ? 'has-notifications' : ''}`}
          onClick={() => handleTabChange('notifications')}
        >
          <span className="tab-icon">🔔</span>
          Alerts
          {unreadNotifications > 0 && (
            <span className="notification-badge" aria-label={`${unreadNotifications} unread notifications`}>
              {unreadNotifications}
            </span>
          )}
        </button>
      </nav>

      <div className="combat-content">
        <div
          id={`${activeTab}-panel`}
          role="tabpanel"
          aria-labelledby={`${activeTab}-tab`}
          className="tab-panel"
        >
          {renderTabContent}
        </div>
      </div>

      {error && (
        <div 
          role="alert" 
          aria-live="polite" 
          className="combat-error"
        >
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button
            type="button"
            className="error-dismiss"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default CombatInterface;
