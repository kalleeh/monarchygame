/**
 * Combat Interface Component
 * Main interface for managing attacks, viewing battle reports, and defense settings
 */

import React, { useState, useCallback, useMemo } from 'react';
import './CombatInterface.css';
import type {
  Kingdom,
  AttackRequest,
  BattleHistory,
  CombatNotification,
  DefenseSettings,
  Army,
} from '../types/combat';

import { useCombatStore, type Unit } from '../stores/combatStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { processCombat } from '../services/domain/CombatService';
import { ToastService } from '../services/toastService';
import { AttackPlanner } from './combat/AttackPlanner';
import BattleReports from './combat/BattleReports';
import { DefenseManager } from './combat/DefenseManager';
import { CombatNotifications } from './combat/CombatNotifications';
import { SwordIcon, ShieldIcon, ScrollIcon, InfoIcon, WarningIcon } from './ui/MenuIcons';

interface CombatInterfaceProps {
  currentKingdom: Kingdom;
  className?: string;
  'aria-label'?: string;
  onAttack?: (request: AttackRequest) => Promise<void>;
  onUpdateDefense?: (settings: DefenseSettings) => Promise<void>;
}

type CombatTab = 'attack' | 'defense' | 'reports' | 'notifications';

export const CombatInterface: React.FC<CombatInterfaceProps> = ({
  currentKingdom,
  className = '',
  'aria-label': ariaLabel = 'Combat Interface'
}) => {
  const [activeTab, setActiveTab] = useState<CombatTab>('attack');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const rawHistory = useCombatStore((state) => state.battleHistory);
  const aiKingdoms = useAIKingdomStore((state) => state.aiKingdoms);

  const battleHistory: BattleHistory[] = useMemo(() => {
    const unitsToArmy = (units: Unit[]): Army => {
      const army: Army = {};
      units.forEach(u => {
        army[u.type] = (army[u.type] ?? 0) + u.count;
      });
      return army;
    };

    const casualtiesToArmy = (casualties: Record<string, number>, units: Unit[]): Army => {
      const army: Army = {};
      Object.entries(casualties).forEach(([unitId, count]) => {
        const unit = units.find(u => u.id === unitId);
        const type = unit?.type ?? unitId;
        army[type] = (army[type] ?? 0) + count;
      });
      return army;
    };

    return rawHistory.map(report => {
      const defenderAI = aiKingdoms.find(k => k.id === report.defender);
      const defenderName = defenderAI?.name ?? report.defender;
      const defenderRace = defenderAI?.race ?? 'Unknown';
      const attackerName = currentKingdom.name ?? 'Your Kingdom';
      const attackerRace = currentKingdom.race ?? 'Human';

      const attackerArmyBefore = unitsToArmy(report.attackerUnits);
      const attackerCasualties = casualtiesToArmy(report.casualties.attacker, report.attackerUnits);
      const attackerArmyAfter: Army = { ...attackerArmyBefore };
      Object.entries(attackerCasualties).forEach(([type, lost]) => {
        attackerArmyAfter[type] = Math.max(0, (attackerArmyAfter[type] ?? 0) - (lost ?? 0));
      });

      const defenderArmyBefore = unitsToArmy(report.defenderUnits);
      const defenderCasualties = casualtiesToArmy(report.casualties.defender, report.defenderUnits);

      const attackerInfo = {
        kingdomName: attackerName,
        race: attackerRace,
        armyBefore: attackerArmyBefore,
        armyAfter: attackerArmyAfter,
        casualties: attackerCasualties,
      };
      const defenderInfo = {
        kingdomName: defenderName,
        race: defenderRace,
        armyBefore: Object.keys(defenderArmyBefore).length > 0 ? defenderArmyBefore : undefined,
        casualties: Object.keys(defenderCasualties).length > 0 ? defenderCasualties : undefined,
      };

      return {
        id: report.id,
        timestamp: new Date(report.timestamp),
        attackerId: report.attacker,
        defenderId: report.defender,
        attacker: attackerInfo,
        defender: defenderInfo,
        outcome: report.result,
        result: {
          outcome: report.result,
          attacker: attackerInfo,
          defender: defenderInfo,
          attackType: 'full_attack' as const,
          success: report.result === 'victory',
          spoils: {
            gold: report.resourcesGained?.gold ?? 0,
            population: 0,
            land: report.landGained ?? 0,
          },
          landGained: report.landGained,
        },
        casualties: { ...report.casualties.attacker, ...report.casualties.defender },
        netGain: {
          gold: report.resourcesGained?.gold ?? 0,
          land: report.landGained ?? 0,
          population: 0,
        },
        isAttacker: true,
        attackType: 'full_attack' as const,
      } satisfies BattleHistory;
    });
  }, [rawHistory, aiKingdoms, currentKingdom]);

  const notifications: CombatNotification[] = [];

  const handleAttack = useCallback(async (request: AttackRequest) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use secure Lambda function for combat processing
      const combatResult = await processCombat({
        kingdomId: currentKingdom.id,
        attackerKingdomId: currentKingdom.id,
        defenderKingdomId: request.targetKingdomId || request.defenderId,
        attackType: request.attackType,
        units: request.units
      });
      
      if (combatResult.success) {
        console.log('Combat result:', combatResult);
      } else {
        throw new Error(combatResult.error || 'Combat failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Attack failed';
      setError(errorMessage);
      ToastService.error('Attack failed: ' + errorMessage);
      console.error('Attack failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentKingdom.id]);

  const handleDefenseUpdate = useCallback(async (settings: DefenseSettings) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Defense settings are stored in database, not Lambda
      // This would typically update the DefenseSettings model
      console.log('Defense settings updated:', settings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Defense update failed';
      setError(errorMessage);
      console.error('Defense update failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTabChange = useCallback((tab: CombatTab) => {
    setActiveTab(tab);
    setError(null);
  }, []);

  const unreadNotifications = useMemo(() =>
    notifications.filter(n => !n.isRead).length
  , [notifications]);

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
          />
        );
      case 'reports':
        return (
          <BattleReports
            battleHistory={battleHistory}
            currentKingdomId={currentKingdom.id}
          />
        );
      case 'notifications':
        return (
          <CombatNotifications
            notifications={notifications}
            onMarkAsRead={() => {}}
            onMarkAllAsRead={() => {}}
          />
        );
      default:
        return null;
    }
  }, [activeTab, currentKingdom, handleAttack, handleDefenseUpdate, isLoading, error, battleHistory, notifications]);

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
          <span className="tab-icon"><SwordIcon /></span>
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
          <span className="tab-icon"><ShieldIcon /></span>
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
          <span className="tab-icon"><ScrollIcon /></span>
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
          <span className="tab-icon"><InfoIcon /></span>
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
          <span className="error-icon"><WarningIcon /></span>
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
