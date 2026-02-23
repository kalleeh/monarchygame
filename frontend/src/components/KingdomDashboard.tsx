/* eslint-disable */
import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { KingdomResources } from '../types/amplify';
import { AmplifyFunctionService } from '../services/amplifyFunctionService';
import { ToastService } from '../services/toastService';
import { TopNavigation } from './TopNavigation';
import { LoadingButton } from './ui/loading/LoadingButton';
import { useTerritoryStore } from '../stores/territoryStore';
import { useKingdomStore } from '../stores/kingdomStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { useSummonStore } from '../stores/useSummonStore';
import { AIActionService } from '../services/aiActionService';
import { achievementTriggers } from '../utils/achievementTriggers';
import { useAchievementStore } from '../stores/achievementStore';
import { RACES } from '../../__mocks__/@game-data/races';
import { Tutorial } from './ui/Tutorial';
import { useTutorial } from '../hooks/useTutorial';
import { useTutorialStore } from '../stores/tutorialStore';
import { KINGDOM_DASHBOARD_TUTORIAL } from '../data/tutorialSteps';
import { TurnTimer } from './ui/TurnTimer';
import { DemoTimeControl } from './ui/DemoTimeControl';
import { calculateTimeTravel, calculateGoldIncome, calculatePopulationGrowth, type BuildingCounts } from '../utils/resourceCalculations';
import { calculateBRT, getBuildingName } from '../utils/buildingMechanics';
import { RESOURCE_GENERATION } from '../constants/gameConfig';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { BalanceTestRunner } from './BalanceTestRunner';
import { useRestorationStore } from '../stores/restorationStore';
import { isDemoMode } from '../utils/authMode';
import { subscriptionManager } from '../services/subscriptionManager';
import { TURN_MECHANICS } from '../../../shared/mechanics/turn-mechanics';
import { NotificationCenter } from './ui/NotificationCenter';

// EncampPanel — shows active encamp countdown or the two encamp buttons
const EncampPanel = memo(({
  kingdomId,
  onEncamp
}: {
  kingdomId: string;
  onEncamp: (action: 'encamp', duration: 16 | 24) => void;
}) => {
  const [encampEndTime, setEncampEndTime] = useState<number | null>(null);
  const [encampBonusTurns, setEncampBonusTurns] = useState<number>(0);
  const [now, setNow] = useState(() => Date.now());

  // Poll localStorage every second to update countdown
  useEffect(() => {
    const tick = () => {
      try {
        const raw = localStorage.getItem(`encamp-${kingdomId}`);
        if (raw) {
          const data = JSON.parse(raw) as { endTime: number; bonusTurns: number };
          setEncampEndTime(data.endTime);
          setEncampBonusTurns(data.bonusTurns);
        } else {
          setEncampEndTime(null);
          setEncampBonusTurns(0);
        }
      } catch {
        setEncampEndTime(null);
        setEncampBonusTurns(0);
      }
      setNow(Date.now());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [kingdomId]);

  const isActive = encampEndTime !== null && now < encampEndTime;

  const formatCountdown = (ms: number) => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="encamp-panel" style={{
      marginTop: '1rem',
      padding: '1rem',
      background: 'rgba(78, 205, 196, 0.08)',
      border: '1px solid rgba(78, 205, 196, 0.25)',
      borderRadius: '8px'
    }}>
      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: 'var(--primary)' }}>
        Encamp
      </h4>
      {isActive ? (
        <div>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', color: '#a0a0a0' }}>
            Kingdom is resting — {formatCountdown(encampEndTime! - now)} remaining
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#4ecdc4' }}>
            +{encampBonusTurns} bonus turns when you return
          </p>
        </div>
      ) : (
        <div>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#a0a0a0' }}>
            Rest your troops to earn bonus turns when you return
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="resource-btn"
              onClick={() => onEncamp('encamp', 16)}
              style={{ flex: '1 1 auto' }}
              title={`Encamp for 16 hours to receive +${TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_16_HOURS.bonusTurns} bonus turns`}
            >
              Encamp 16h (+{TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_16_HOURS.bonusTurns} turns)
            </button>
            <button
              className="resource-btn"
              onClick={() => onEncamp('encamp', 24)}
              style={{ flex: '1 1 auto' }}
              title={`Encamp for 24 hours to receive +${TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_24_HOURS.bonusTurns} bonus turns`}
            >
              Encamp 24h (+{TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_24_HOURS.bonusTurns} turns)
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

interface KingdomDashboardProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
  onManageTerritories?: () => void;
  onManageCombat?: () => void;
  onManageAlliance?: () => void;
  onViewWorldMap?: () => void;
  onCastSpells?: () => void;
  onManageTrade?: () => void;
  onSummonUnits?: () => void;
  onDiplomacy?: () => void;
  onBattleReports?: () => void;
  onViewLeaderboard?: () => void;
}

// Memoized sub-components for performance
const MemoizedResourceDisplay = memo(({ resources, buildingStats, upkeepInfo }: {
  resources: KingdomResources;
  buildingStats: any;
  upkeepInfo: any;
}) => (
  <div className="bg-white rounded-lg shadow-md p-6 mb-6">
    <h2 className="text-xl font-bold mb-4">Kingdom Resources</h2>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="text-center">
        <div className="text-2xl font-bold text-yellow-600">{resources.gold?.toLocaleString() || 0}</div>
        <div className="text-sm text-gray-600">Gold</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-green-600">{resources.land?.toLocaleString() || 0}</div>
        <div className="text-sm text-gray-600">Land</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600">{resources.population?.toLocaleString() || 0}</div>
        <div className="text-sm text-gray-600">Population</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-600">{resources.mana?.toLocaleString() || 0}</div>
        <div className="text-sm text-gray-600">Mana</div>
      </div>
    </div>
    <div className="mt-4 text-sm text-gray-600">
      <div>BRT: {buildingStats.brt.toFixed(2)}%</div>
      <div>Upkeep: {upkeepInfo.totalUpkeep.toLocaleString()} gold ({upkeepInfo.upkeepPercentage.toFixed(1)}%)</div>
    </div>
  </div>
));

const MemoizedActionButtons = memo(({ 
  onManageTerritories, 
  onManageCombat, 
  onManageAlliance, 
  onViewWorldMap, 
  onCastSpells, 
  onManageTrade, 
  onSummonUnits, 
  onDiplomacy, 
  onBattleReports, 
  onViewLeaderboard,
  onShowBalanceTester 
}: {
  onManageTerritories?: () => void;
  onManageCombat?: () => void;
  onManageAlliance?: () => void;
  onViewWorldMap?: () => void;
  onCastSpells?: () => void;
  onManageTrade?: () => void;
  onSummonUnits?: () => void;
  onDiplomacy?: () => void;
  onBattleReports?: () => void;
  onViewLeaderboard?: () => void;
  onShowBalanceTester: () => void;
}) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
    <button onClick={onManageTerritories} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">
      🏰 Territories
    </button>
    <button onClick={onManageCombat} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">
      ⚔️ Combat
    </button>
    <button onClick={onManageAlliance} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
      🤝 Alliance
    </button>
    <button onClick={onViewWorldMap} className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded">
      🗺️ World Map
    </button>
    <button onClick={onCastSpells} className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">
      🔮 Magic
    </button>
    <button onClick={onManageTrade} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded">
      💰 Trade
    </button>
    <button onClick={onSummonUnits} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">
      👥 Units
    </button>
    <button onClick={onShowBalanceTester} className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded">
      ⚖️ Balance Tester
    </button>
  </div>
));

function KingdomDashboard({ 
  kingdom, 
  onBack, 
  onManageTerritories, 
  onManageCombat, 
  onManageAlliance, 
  onViewWorldMap, 
  onCastSpells, 
  onManageTrade, 
  onSummonUnits, 
  onDiplomacy, 
  onBattleReports, 
  onViewLeaderboard 
}: KingdomDashboardProps) {
  // Use centralized kingdom store for resources
  const resources = useKingdomStore((state) => state.resources);
  const setKingdomId = useKingdomStore((state) => state.setKingdomId);
  const setResources = useKingdomStore((state) => state.setResources);
  const addGold = useKingdomStore((state) => state.addGold);
  const addTurns = useKingdomStore((state) => state.addTurns);
  const updateResources = useKingdomStore((state) => state.updateResources);
  
  // Territory store
  const ownedTerritories = useTerritoryStore((state) => state.ownedTerritories);
  const initializeTerritories = useTerritoryStore((state) => state.initializeTerritories);
  
  // AI kingdoms
  const aiKingdoms = useAIKingdomStore((state) => state.aiKingdoms);
  const generateAIKingdoms = useAIKingdomStore((state) => state.generateAIKingdoms);
  
  // Restoration store
  const isInRestoration = useRestorationStore((state) => state.isInRestoration);
  const restorationType = useRestorationStore((state) => state.restorationType);
  const prohibitedActions = useRestorationStore((state) => state.prohibitedActions);
  const getRemainingHours = useRestorationStore((state) => state.getRemainingHours);
  const updateRestoration = useRestorationStore((state) => state.updateRestoration);

  // Helper: is a named action prohibited by restoration?
  const isActionProhibited = useCallback((action: string) => {
    return isInRestoration && prohibitedActions.includes(action);
  }, [isInRestoration, prohibitedActions]);

  const [loading, setLoading] = useState(true);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [showBalanceTester, setShowBalanceTester] = useState(false);

  // Tutorial state
  const { hasCompleted: tutorialCompleted, markComplete: completeTutorial } = useTutorial('kingdom-dashboard');
  
  // Navigation
  const navigate = useNavigate();

  // Calculate BRT and upkeep
  const { getTotalUpkeep, accumulatedGoldSpent, calculateRemainingCapacity } = useSummonStore();
  
  const buildingStats = useMemo(() => {
    const totalLand = resources.land || 0;
    // Use actual constructed buildings from kingdom data, fall back to percentage estimates
    const kingdomBuildings = (kingdom.buildings || {}) as Record<string, number>;

    const actualQuarries = kingdomBuildings.buildrate || kingdomBuildings.quarries || kingdomBuildings.mine || 0;
    const quarries = actualQuarries > 0 ? actualQuarries : Math.floor(totalLand * 0.30);

    const actualBarracks = kingdomBuildings.troop || kingdomBuildings.barracks || 0;
    const barracks = actualBarracks > 0 ? actualBarracks : Math.floor(totalLand * 0.30);

    const actualGuildhalls = kingdomBuildings.income || kingdomBuildings.guildhalls || kingdomBuildings.tower || 0;
    const guildhalls = actualGuildhalls > 0 ? actualGuildhalls : Math.floor(totalLand * 0.10);

    const actualHovels = kingdomBuildings.population || kingdomBuildings.hovels || kingdomBuildings.farm || 0;
    const hovels = actualHovels > 0 ? actualHovels : Math.floor(totalLand * 0.10);

    const actualTemples = kingdomBuildings.magic || kingdomBuildings.temples || 0;
    const temples = actualTemples > 0 ? actualTemples : Math.floor(totalLand * 0.12);

    const actualForts = kingdomBuildings.fortress || kingdomBuildings.forts || 0;
    const forts = actualForts > 0 ? actualForts : Math.floor(totalLand * 0.05);

    const quarryPercentage = totalLand > 0 ? (quarries / totalLand) * 100 : 0;
    const brt = calculateBRT(quarryPercentage);

    return {
      quarries,
      barracks,
      guildhalls,
      hovels,
      temples,
      forts,
      totalBuildings: quarries + barracks + guildhalls + hovels + temples + forts,
      quarryPercentage,
      brt
    };
  }, [resources.land, kingdom.buildings]);

  // Flush any pending DB sync before navigating away from the dashboard
  const handleBack = useCallback(() => {
    void useKingdomStore.getState().syncToDatabase();
    onBack();
  }, [onBack]);

  // Memoized event handlers for performance
  const handleShowBalanceTester = useCallback(() => {
    setShowBalanceTester(true);
  }, []);

  const handleCloseBalanceTester = useCallback(() => {
    setShowBalanceTester(false);
  }, []);

  const handleUpdateResources = useCallback(async () => {
    if (!kingdom?.id) return;
    
    setResourceLoading(true);
    try {
      const result = await AmplifyFunctionService.updateResources(kingdom.id);
      if (result.success && result.resources) {
        const newResources = JSON.parse(result.resources);
        setResources(newResources);
        ToastService.success('Resources updated successfully!');
      }
    } catch (error) {
      console.error('Failed to update resources:', error);
      ToastService.error('Failed to update resources');
    } finally {
      setResourceLoading(false);
    }
  }, [kingdom?.id, setResources]);

  const handleTutorialComplete = useCallback(() => {
    completeTutorial();
  }, [completeTutorial]);

  const upkeepInfo = useMemo(() => {
    const totalUpkeep = getTotalUpkeep();
    const currentGold = resources.gold || 0;
    const upkeepPercentage = currentGold > 0 ? (totalUpkeep / currentGold) * 100 : 0;
    const isHigh = upkeepPercentage > 10;
    const isCritical = upkeepPercentage > 25;
    
    return {
      totalUpkeep,
      upkeepPercentage,
      isHigh,
      isCritical,
      troopCapUsed: accumulatedGoldSpent,
      troopCapRemaining: calculateRemainingCapacity()
    };
  }, [getTotalUpkeep, resources.gold, accumulatedGoldSpent, calculateRemainingCapacity]);

  // Initialize kingdom store ONCE on first mount only
  useEffect(() => {
    const currentKingdomId = useKingdomStore.getState().kingdomId;

    // Only initialize if this is a new kingdom or first load
    if (currentKingdomId !== kingdom.id) {
      setKingdomId(kingdom.id);
      setResources(kingdom.resources as KingdomResources);

      // Load achievements from server in auth mode
      if (!isDemoMode()) {
        void useAchievementStore.getState().loadFromDatabase(kingdom.id);
      }
    }
  }, [kingdom.id]); // Only run when kingdom ID changes
  
  // Generate AI kingdoms on mount (demo mode only)
  useEffect(() => {
    if (isDemoMode() && aiKingdoms.length === 0) {
      const playerNetworth = (resources.land || 0) * 1000 + (resources.gold || 0);
      generateAIKingdoms(5, playerNetworth);
    }
  }, [aiKingdoms.length, resources.land, resources.gold, generateAIKingdoms]);

  // Initialize territory store on mount
  useEffect(() => {
    const initializeData = async () => {
      try {
        await initializeTerritories();
      } catch (error) {
        console.error('Failed to initialize territories:', error);
      } finally {
        setLoading(false);
      }
    };
    
    initializeData();
  }, [kingdom.id, initializeTerritories]);

  // Check if restoration has ended on mount
  useEffect(() => {
    updateRestoration();
  }, [updateRestoration]);

  // Track online presence — mark online on mount, offline on unmount/tab close
  useEffect(() => {
    if (!kingdom?.id || isDemoMode()) return;

    const presenceClient = generateClient<Schema>();
    void presenceClient.models.Kingdom.update({ id: kingdom.id, isOnline: true });

    const setOffline = () => {
      void presenceClient.models.Kingdom.update({ id: kingdom.id, isOnline: false });
    };

    window.addEventListener('beforeunload', setOffline);
    return () => {
      window.removeEventListener('beforeunload', setOffline);
      setOffline();
    };
  }, [kingdom?.id]);

  // Real-time subscriptions: get live notifications when attacked, war declared, or trade offers appear
  useEffect(() => {
    if (!kingdom?.id || isDemoMode()) return;

    subscriptionManager.startSubscriptions(kingdom.id, {
      onAttackReceived: (_report) => {
        // BattleReport toast is shown by subscriptionManager; future: refresh battle history here
      },
      onWarDeclared: (_war) => {
        // WarDeclaration toast is shown by subscriptionManager; future: update war state here
      },
      onTradeOfferReceived: (_offers) => {
        // TradeOffer toast is shown by subscriptionManager; future: update trade store here
      },
    });

    return () => {
      subscriptionManager.stopSubscriptions();
    };
  }, [kingdom?.id]);

  const handleGenerateResources = async (action: 'generate_turns' | 'generate_income' | 'encamp', encampDuration?: 16 | 24) => {
    // Encamp is handled client-side: store the end time and bonus turns in localStorage
    if (action === 'encamp') {
      const duration = encampDuration ?? 24;
      const bonusTurns = duration === 24 ? 10 : 7;
      const endTime = Date.now() + duration * 60 * 60 * 1000;
      localStorage.setItem(
        `encamp-${kingdom.id}`,
        JSON.stringify({ endTime, bonusTurns })
      );
      ToastService.success(
        `Encamping for ${duration}h! You'll receive +${bonusTurns} bonus turns when you return.`
      );
      return;
    }

    setResourceLoading(true);

    const actionMessages = {
      generate_turns: { loading: 'Generating turns...', success: 'Turns generated successfully!' },
      generate_income: { loading: 'Generating income...', success: 'Income generated successfully!' },
    };

    try {
      await ToastService.promise(
        AmplifyFunctionService.updateResources({
          kingdomId: kingdom.id,
          resourceType: action,
          operation: 'generate',
          amount: undefined
        }),
        {
          loading: actionMessages[action].loading,
          success: actionMessages[action].success,
          error: (error) => `Resource generation failed: ${error.message}`
        }
      );

      // Update centralized store
      if (action === 'generate_turns') {
        addTurns(3);
      } else if (action === 'generate_income') {
        addGold(1000);
      }
    } catch (error) {
      console.error('Resource generation error:', error);
      // Still update locally for demo mode
      if (action === 'generate_turns') {
        addTurns(3);
      } else if (action === 'generate_income') {
        addGold(1000);
      }
    } finally {
      setResourceLoading(false);
    }
  };

  const handleTimeTravel = async (hours: number) => {
    // Get actual building counts from kingdom data
    const kingdomBuildings = (kingdom.buildings || {}) as Record<string, number>;
    const buildings: BuildingCounts = {
      quarries: kingdomBuildings.mine || 0,
      hovels: kingdomBuildings.farm || 0,
      guildhalls: kingdomBuildings.tower || 0
    };
    
    // Calculate resources from buildings (aligned with reference)
    const generated = calculateTimeTravel(hours, buildings);
    
    // Calculate resource generation for AI kingdoms (moved outside try for catch block access)
    const incomeToGenerate = RESOURCE_GENERATION.BASE_INCOME_PER_TICK;
    const populationGrowth = RESOURCE_GENERATION.BASE_POPULATION_GROWTH;
    const landGrowth = RESOURCE_GENERATION.LAND_GROWTH;
    const turnsToGenerate = RESOURCE_GENERATION.TURNS_PER_HOUR;
    
    try {
      await ToastService.promise(
        AmplifyFunctionService.updateResources({
          kingdomId: kingdom.id,
          resourceType: 'time_travel',
          operation: 'generate',
          amount: generated.turns
        }),
        {
          loading: `Fast-forwarding ${hours} hours...`,
          success: `Time traveled ${hours} hours! Generated ${generated.turns} turns, ${generated.gold} gold, ${generated.population} population.`,
          error: (error) => `Time travel failed: ${error.message}`
        }
      );

      // Update centralized store with calculated resources
      addTurns(generated.turns);
      addGold(generated.gold);
      useKingdomStore.getState().updateResources({
        population: (resources.population || 0) + generated.population
      });

      // Trigger achievement checks
      achievementTriggers.onGoldChanged();
      achievementTriggers.onPopulationChanged();
      achievementTriggers.onLandChanged();

      // In auth mode, persist the time-traveled state to the server
      if (!isDemoMode()) {
        void useKingdomStore.getState().syncToDatabase();
      }

      // Update AI kingdoms with time progression AND actions
      const updateAIKingdom = useAIKingdomStore.getState().updateAIKingdom;
      const aiActionLog: string[] = [];
      
      aiKingdoms.forEach(ai => {
        // First, update resources from time progression
        const updatedAI = {
          ...ai,
          resources: {
            ...ai.resources,
            gold: ai.resources.gold + incomeToGenerate,
            population: ai.resources.population + populationGrowth,
            land: ai.resources.land + landGrowth,
            turns: Math.min(ai.resources.turns + turnsToGenerate, 100)
          }
        };
        
        // Then, AI takes actions based on state
        const actions = AIActionService.decideActions(updatedAI, aiKingdoms);
        
        actions.forEach(action => {
          if (action.type === 'build') {
            const result = AIActionService.executeBuild(updatedAI);
            if (result.resources) {
              updatedAI.resources = result.resources;
              aiActionLog.push(`${ai.name} built structures`);
            }
          } else if (action.type === 'train') {
            const result = AIActionService.executeTrain(updatedAI);
            if (result.resources) {
              updatedAI.resources = result.resources;
              if (result.units) updatedAI.units = result.units;
              aiActionLog.push(`${ai.name} trained units`);
            }
          } else if (action.type === 'attack') {
            const target = aiKingdoms.find(t => t.id !== ai.id && t.networth < ai.networth * 1.5);
            if (target) {
              const result = AIActionService.executeAttack(updatedAI, target);
              if (result.attacker.resources) {
                updatedAI.resources = result.attacker.resources;
                aiActionLog.push(`${ai.name} attacked ${target.name}`);
                
                // Update defender too
                if (result.defender.resources) {
                  updateAIKingdom(target.id, result.defender);
                }
              }
            }
          }
        });
        
        // Apply all updates to AI kingdom
        const newNetworth = 
          updatedAI.resources.land * 1000 + 
          updatedAI.resources.gold + 
          Object.values(updatedAI.units).reduce((sum, count) => sum + count * 100, 0);
        
        updateAIKingdom(ai.id, {
          resources: updatedAI.resources,
          units: updatedAI.units,
          networth: newNetworth
        });
      });
      
      // Show AI action summary if any actions taken
      if (aiActionLog.length > 0) {
        ToastService.info(`AI Activity: ${aiActionLog.slice(0, 3).join(', ')}${aiActionLog.length > 3 ? '...' : ''}`);
      }
    } catch (error) {
      console.error('Time travel error:', error);
      // Still update locally for demo mode
      addTurns(turnsToGenerate);
      addGold(incomeToGenerate);
      useKingdomStore.getState().updateResources({
        population: (resources.population || 0) + populationGrowth,
        land: (resources.land || 0) + landGrowth
      });

      // Update AI kingdoms even on error (demo mode)
      const updateAIKingdom = useAIKingdomStore.getState().updateAIKingdom;
      
      aiKingdoms.forEach(ai => {
        const updatedAI = {
          ...ai,
          resources: {
            ...ai.resources,
            gold: ai.resources.gold + incomeToGenerate,
            population: ai.resources.population + populationGrowth,
            land: ai.resources.land + landGrowth,
            turns: Math.min(ai.resources.turns + turnsToGenerate, 100)
          }
        };
        
        // AI takes actions even on error
        const actions = AIActionService.decideActions(updatedAI, aiKingdoms);
        actions.forEach(action => {
          if (action.type === 'build') {
            const result = AIActionService.executeBuild(updatedAI);
            if (result.resources) updatedAI.resources = result.resources;
          } else if (action.type === 'train') {
            const result = AIActionService.executeTrain(updatedAI);
            if (result.resources) updatedAI.resources = result.resources;
            if (result.units) updatedAI.units = result.units;
          }
        });
        
        const newNetworth = 
          updatedAI.resources.land * 1000 + 
          updatedAI.resources.gold + 
          Object.values(updatedAI.units).reduce((sum, count) => sum + count * 100, 0);
        
        updateAIKingdom(ai.id, {
          resources: updatedAI.resources,
          units: updatedAI.units,
          networth: newNetworth
        });
      });
    }
  };

  const raceKey = kingdom.race ? kingdom.race.charAt(0).toUpperCase() + kingdom.race.slice(1).toLowerCase() : 'Human';
  const raceData = RACES[raceKey as keyof typeof RACES];

  return (
    <div className="kingdom-dashboard">
      {/* Tutorial overlay */}
      {!tutorialCompleted && (
        <Tutorial
          steps={KINGDOM_DASHBOARD_TUTORIAL}
          onComplete={completeTutorial}
          onSkip={completeTutorial}
          autoStart={true}
        />
      )}
      
      <ErrorBoundary>
        <TopNavigation
        title={kingdom.name}
        subtitle={`${kingdom.race} Kingdom`}
        onBack={handleBack}
        backLabel="← Back to Kingdoms"
        actions={
          <div className="kingdom-race">
            <NotificationCenter kingdomId={kingdom.id} />
            <span className="race-badge">{kingdom.race}</span>
          </div>
        }
      />

      {/* Restoration Status Banner */}
      {isInRestoration && (
        <div style={{
          padding: '1rem 1.5rem',
          marginBottom: '1rem',
          background: restorationType === 'death_based'
            ? 'rgba(239, 68, 68, 0.15)'
            : 'rgba(245, 158, 11, 0.15)',
          border: `2px solid ${restorationType === 'death_based'
            ? 'rgba(239, 68, 68, 0.5)'
            : 'rgba(245, 158, 11, 0.5)'}`,
          borderRadius: '8px',
          color: restorationType === 'death_based' ? '#ef4444' : '#f59e0b',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <strong style={{ fontSize: '1.1rem' }}>
              Kingdom in Restoration
            </strong>
            <span style={{
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '0.25rem 0.75rem',
              borderRadius: '12px',
              fontSize: '0.85rem',
            }}>
              {restorationType === 'death_based' ? 'Death-Based' : 'Damage-Based'} &mdash; {getRemainingHours().toFixed(1)} hours remaining
            </span>
          </div>
          {prohibitedActions.length > 0 && (
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
              <span style={{ fontWeight: 600 }}>Prohibited actions: </span>
              {prohibitedActions.join(', ')}
            </div>
          )}
        </div>
      )}

      <div className="dashboard-grid">
        <div className="resources-panel">
          <h2>Resources</h2>
          
          {/* Networth Display */}
          <div className="networth-display" style={{
            padding: '1rem',
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.1) 0%, rgba(79, 172, 254, 0.1) 100%)',
            border: '2px solid var(--primary)',
            borderRadius: '0.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              KINGDOM NETWORTH (SCORE)
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
              {((resources?.land || 0) * 1000 + (resources?.gold || 0) + (kingdom.totalUnits ? Object.values(kingdom.totalUnits).reduce((sum, count) => sum + count * 100, 0) : 0)).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Land × 1,000 + Gold + Units × 100
            </div>
          </div>
          
          <div className="resources-grid">
            <div className="resource-item">
              <img src="/gold-resource-icon.png" alt="Gold" className="resource-icon-img" />
              <div>
                <div className="resource-value">{resources?.gold || 0}</div>
                <div className="resource-label">Gold</div>
              </div>
            </div>
            <div className="resource-item">
              <img src="/population-resource-icon.png" alt="Population" className="resource-icon-img" />
              <div>
                <div className="resource-value">{resources?.population || 0}</div>
                <div className="resource-label">Population</div>
              </div>
            </div>
            <div className="resource-item">
              <img src="/land-resource-icon.png" alt="Land" className="resource-icon-img" />
              <div>
                <div className="resource-value">{resources?.land || 0}</div>
                <div className="resource-label">Land</div>
              </div>
            </div>
            <div className="resource-item">
              <img src="/time-turns-icon.png" alt="Turns" className="resource-icon-img" />
              <div>
                <div className="resource-value">{resources?.turns || 0}</div>
                <div className="resource-label">Turns</div>
              </div>
            </div>
          </div>
          
          <div className="resource-actions">
            <LoadingButton
              onClick={() => handleGenerateResources('generate_turns')}
              loading={resourceLoading}
              className="resource-btn"
            >
              Generate Turns
            </LoadingButton>
            <LoadingButton
              onClick={() => handleGenerateResources('generate_income')}
              loading={resourceLoading}
              className="resource-btn"
            >
              Generate Income
            </LoadingButton>
          </div>

          <EncampPanel kingdomId={kingdom.id} onEncamp={handleGenerateResources} />
        </div>

        <div className="race-stats-panel">
          <h2>Race Abilities</h2>
          <div className="race-info">
            <p className="special-ability">
              <strong>Special:</strong> {raceData?.specialAbility?.description}
            </p>
            <div className="stats-mini">
              {raceData && Object.entries(raceData.stats).slice(0, 4).map(([stat, value]) => (
                <div key={stat} className="stat-mini">
                  <span className="stat-name">{stat}</span>
                  <div className="stat-bar-mini">
                    <div 
                      className="stat-fill-mini" 
                      style={{ width: `${value * 20}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="race-stats-panel">
          <h2>🏗️ Buildings & Economy</h2>
          
          {/* BRT Display */}
          <div className="brt-display" style={{
            padding: '0.75rem',
            background: 'rgba(78, 205, 196, 0.1)',
            borderRadius: '8px',
            marginBottom: '1rem',
            border: '1px solid rgba(78, 205, 196, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Build Rate (BRT)</span>
              <span style={{ fontSize: '1.5rem', color: '#4ecdc4' }}>{buildingStats.brt}</span>
            </div>
            <small style={{ color: '#a0a0a0', display: 'block', marginTop: '0.25rem' }}>
              {buildingStats.quarryPercentage.toFixed(1)}% {getBuildingName(kingdom.race || 'Human', 'buildrate')} • {buildingStats.brt} structures/turn
            </small>
            {buildingStats.quarryPercentage < 25 && (
              <small style={{ color: '#f59e0b', display: 'block', marginTop: '0.25rem' }}>
                ⚠️ Low BRT - Consider building more {getBuildingName(kingdom.race || 'Human', 'buildrate')}
              </small>
            )}
          </div>

          {/* Building Breakdown */}
          <div className="building-breakdown" style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#a0a0a0' }}>Building Distribution</h4>
            <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{getBuildingName(kingdom.race || 'Human', 'buildrate')}</span>
                <span style={{ color: '#4ecdc4' }}>{buildingStats.quarries} ({buildingStats.quarryPercentage.toFixed(1)}%)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{getBuildingName(kingdom.race || 'Human', 'troop')}</span>
                <span style={{ color: '#4ecdc4' }}>{buildingStats.barracks}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{getBuildingName(kingdom.race || 'Human', 'income')}</span>
                <span style={{ color: '#4ecdc4' }}>{buildingStats.guildhalls}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{getBuildingName(kingdom.race || 'Human', 'magic')}</span>
                <span style={{ color: '#4ecdc4' }}>{buildingStats.temples}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{getBuildingName(kingdom.race || 'Human', 'fortress')}</span>
                <span style={{ color: '#4ecdc4' }}>{buildingStats.forts}</span>
              </div>
            </div>
          </div>

          {/* Upkeep Warning */}
          <div className={`upkeep-display ${upkeepInfo.isCritical ? 'critical' : upkeepInfo.isHigh ? 'warning' : ''}`} style={{
            padding: '0.75rem',
            background: upkeepInfo.isCritical ? 'rgba(239, 68, 68, 0.1)' : upkeepInfo.isHigh ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            border: `1px solid ${upkeepInfo.isCritical ? 'rgba(239, 68, 68, 0.3)' : upkeepInfo.isHigh ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Army Upkeep</span>
              <span style={{ fontSize: '1.25rem', color: upkeepInfo.isCritical ? '#ef4444' : upkeepInfo.isHigh ? '#f59e0b' : '#4ecdc4' }}>
                {upkeepInfo.totalUpkeep}g/turn
              </span>
            </div>
            <small style={{ color: '#a0a0a0', display: 'block', marginTop: '0.25rem' }}>
              {upkeepInfo.upkeepPercentage.toFixed(1)}% of treasury
            </small>
            {upkeepInfo.isCritical && (
              <small style={{ color: '#ef4444', display: 'block', marginTop: '0.25rem', fontWeight: 600 }}>
                🚨 CRITICAL: Upkeep exceeds 25% of gold! Risk of bankruptcy!
              </small>
            )}
            {upkeepInfo.isHigh && !upkeepInfo.isCritical && (
              <small style={{ color: '#f59e0b', display: 'block', marginTop: '0.25rem' }}>
                ⚠️ High upkeep - Consider downsizing or increasing income
              </small>
            )}
            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>Troop Cap Used</span>
                <span>{upkeepInfo.troopCapUsed.toLocaleString()}g / 10,000,000g</span>
              </div>
            </div>
          </div>
        </div>

        <div className="turn-generation-panel">
          <TurnTimer
            kingdomId={kingdom.id}
            onTurnGenerated={(newTurns) => {
              addTurns(newTurns);

              const BASE_INCOME_PER_TURN = 100;
              const buildings: BuildingCounts = {
                quarries: buildingStats.quarries,
                hovels: buildingStats.hovels,
                guildhalls: buildingStats.guildhalls,
                temples: buildingStats.temples,
              };
              const buildingIncome = calculateGoldIncome(buildings);
              const goldEarned = (BASE_INCOME_PER_TURN + buildingIncome) * newTurns;
              const populationEarned = calculatePopulationGrowth(buildings) * newTurns;
              const manaEarned = (buildingStats.temples || 0) * 3 * newTurns;

              addGold(goldEarned);
              updateResources({
                population: (resources.population || 0) + populationEarned,
                ...({ mana: Math.min(((resources as any).mana || 0) + manaEarned, 50000) } as any)
              });

              // Fire achievement triggers after each turn generation
              achievementTriggers.onGoldChanged();
              achievementTriggers.onPopulationChanged();
            }}
          />
        </div>

        <div className="territories-panel">
          <h2>Territories ({ownedTerritories.length})</h2>
          {loading ? (
            <p>Loading territories...</p>
          ) : ownedTerritories.length === 0 ? (
            <div className="no-territories">
              <p>No territories claimed yet.</p>
              <button 
                className="claim-territory-btn"
                onClick={onManageTerritories}
              >
                Claim First Territory
              </button>
            </div>
          ) : (
            <div className="territories-list">
              {ownedTerritories.map((territory) => (
                <div key={territory.id} className="territory-item">
                  <h4>{territory.name}</h4>
                  <p>Type: {territory.type}</p>
                  <div className="territory-resources">
                    <span>💰 {territory.resources?.gold || 0}</span>
                    <span>👥 {territory.resources?.population || 0}</span>
                    <span>🏞️ {territory.resources?.land || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="actions-panel">
          <h2>Kingdom Actions</h2>
          <div className="action-buttons">
            <button
              className="action-btn primary"
              onClick={onManageTerritories}
            >
              <img src="/territories-icon.png" alt="Territories" className="action-icon" />
              Manage Territories
            </button>
            <button
              className="action-btn primary"
              onClick={onViewWorldMap}
            >
              <img src="/world-map-icon.png" alt="World Map" className="action-icon" />
              World Map
            </button>
            <button
              className={`action-btn${isActionProhibited('combat_attacks') ? ' opacity-50 cursor-not-allowed' : ''}`}
              onClick={isActionProhibited('combat_attacks') ? undefined : onManageCombat}
              disabled={isActionProhibited('combat_attacks')}
              title={isActionProhibited('combat_attacks') ? 'In restoration — combat prohibited' : undefined}
            >
              <img src="/combat-icon.png" alt="Combat" className="action-icon" />
              Combat Operations
            </button>
            <button
              className={`action-btn${isActionProhibited('alliance_changes') ? ' opacity-50 cursor-not-allowed' : ''}`}
              onClick={isActionProhibited('alliance_changes') ? undefined : onManageAlliance}
              disabled={isActionProhibited('alliance_changes')}
              title={isActionProhibited('alliance_changes') ? 'In restoration — alliance changes prohibited' : undefined}
            >
              <img src="/alliance-icon.png" alt="Alliance" className="action-icon" />
              Alliance Management
            </button>
            <button
              className={`action-btn${isActionProhibited('sorcery_casting') ? ' opacity-50 cursor-not-allowed' : ''}`}
              onClick={isActionProhibited('sorcery_casting') ? undefined : onCastSpells}
              disabled={isActionProhibited('sorcery_casting')}
              title={isActionProhibited('sorcery_casting') ? 'In restoration — spellcasting prohibited' : undefined}
            >
              <img src="/magic-spells-icon.png" alt="Magic" className="action-icon" />
              Cast Spells
            </button>
            <button
              className="action-btn"
              onClick={onSummonUnits}
            >
              <img src="/train-units-icon.png" alt="Summon Units" className="action-icon" />
              ⚔️ Summon Units
            </button>
            <button
              className={`action-btn trade-btn${isActionProhibited('diplomatic_actions') ? ' opacity-50 cursor-not-allowed' : ''}`}
              onClick={isActionProhibited('diplomatic_actions') ? undefined : onManageTrade}
              disabled={isActionProhibited('diplomatic_actions')}
              title={isActionProhibited('diplomatic_actions') ? 'In restoration — trade prohibited' : undefined}
            >
              <img src="/trade-economy-icon.png" alt="Trade" className="action-icon" />
              Trade
            </button>
            <button
              className={`action-btn${isActionProhibited('diplomatic_actions') ? ' opacity-50 cursor-not-allowed' : ''}`}
              onClick={isActionProhibited('diplomatic_actions') ? undefined : onDiplomacy}
              disabled={isActionProhibited('diplomatic_actions')}
              title={isActionProhibited('diplomatic_actions') ? 'In restoration — diplomacy prohibited' : undefined}
            >
              <img src="/diplomacy-icon.png" alt="Diplomacy" className="action-icon" />
              Diplomacy
            </button>
            <button
              className="action-btn danger"
              onClick={onBattleReports}
            >
              <img src="/battle-reports-icon.png" alt="Battle Reports" className="action-icon" />
              Battle Reports
            </button>
            <button
              className="action-btn primary"
              onClick={() => navigate(`/kingdom/${kingdom.id}/multiplayer`)}
            >
              🌐 Multiplayer
            </button>
            <button
              className="action-btn primary"
              onClick={onViewLeaderboard}
            >
              🏆 Kingdom Scrolls
            </button>
            <button
              className="action-btn"
              onClick={() => useTutorialStore.getState().restartTutorial()}
              title="Restart tutorial"
            >
              📚 Tutorial
            </button>
            <button
              className="action-btn"
              onClick={() => navigate(`/kingdom/${kingdom.id}/achievements`)}
              title="View achievements"
            >
              🏆 Achievements
            </button>
            <button
              className="action-btn"
              onClick={() => setShowBalanceTester(true)}
              title="Run AI balance tests"
            >
              🎮 Balance Tester
            </button>
            <button
              className={`action-btn${isActionProhibited('espionage_operations') ? ' opacity-50 cursor-not-allowed' : ''}`}
              onClick={isActionProhibited('espionage_operations') ? undefined : () => navigate(`/kingdom/${kingdom.id}/espionage`)}
              disabled={isActionProhibited('espionage_operations')}
              title={isActionProhibited('espionage_operations') ? 'In restoration — espionage prohibited' : 'Espionage operations'}
            >
              🕵️ Espionage
            </button>
            <button
              className="action-btn"
              onClick={() => navigate(`/kingdom/${kingdom.id}/bounties`)}
              title="Hunt bounties for rewards"
            >
              🎯 Bounty Board
            </button>
            <button
              className="action-btn"
              onClick={() => navigate(`/kingdom/${kingdom.id}/faith`)}
              title="Manage faith and focus"
            >
              🙏 Faith & Focus
            </button>
          </div>
        </div>
      </div>

      {/* Balance Test Runner Modal */}
      {showBalanceTester && (
        <BalanceTestRunner onClose={() => setShowBalanceTester(false)} />
      )}

      {/* Demo Time Control - Only visible in demo mode */}
      {isDemoMode() && (
        <DemoTimeControl
          onTimeTravel={handleTimeTravel}
        />
      )}
      {!isDemoMode() && (
        <div style={{ padding: '8px', color: '#888', fontSize: '0.8rem' }}>
          Time travel only available in demo mode
        </div>
      )}
      </ErrorBoundary>
    </div>
  );
}

export default KingdomDashboard;
