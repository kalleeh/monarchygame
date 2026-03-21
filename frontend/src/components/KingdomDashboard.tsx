import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { KingdomResources } from '../types/amplify';
import { AmplifyFunctionService } from '../services/amplifyFunctionService';
import { getActiveSeason, startSeason } from '../services/domain/SeasonService';
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
import { ErrorBoundary } from './ui/ErrorBoundary';
import { BalanceTestRunner } from './BalanceTestRunner';
import { useRestorationStore } from '../stores/restorationStore';
import { isDemoMode } from '../utils/authMode';
import { subscriptionManager } from '../services/subscriptionManager';
import { TURN_MECHANICS } from '../../../shared/mechanics/turn-mechanics';
import { NotificationCenter } from './ui/NotificationCenter';
import UnitRoster from './UnitRoster';
import WorldFeed from './WorldFeed';
import { FirstSteps } from './ui/FirstSteps';
import { RestorationNotice } from './ui/RestorationNotice';
import { SeasonBadge } from './ui/SeasonBadge';
import { NoActiveSeasonBanner } from './ui/NoActiveSeasonBanner';
import { BuildingStatsPanel } from './ui/BuildingStatsPanel';
import { RaceAbilitiesPanel } from './ui/RaceAbilitiesPanel';
import { EncampPanel } from './ui/EncampPanel';
import { NextStepBanner } from './ui/NextStepBanner';
import { AchievementsPanel } from './ui/AchievementsPanel';
import { HelpModal } from './ui/HelpModal';

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
  onManageBuildings?: () => void;
  /** Opens the diplomatic message compose modal for a given target kingdom. */
  onComposeMessage?: (target: { id: string; name: string }) => void;
}

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
  onViewLeaderboard,
  onManageBuildings,
  onComposeMessage,
}: KingdomDashboardProps) {
  // Use centralized kingdom store for resources AND live units
  const resources = useKingdomStore((state) => state.resources);
  const liveUnits = useKingdomStore((state) => state.units);
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
  const [showHelp, setShowHelp] = useState(false);
  const [showUnitRoster, setShowUnitRoster] = useState(false);

  // Encamp server state — initialised from the kingdom prop on mount.
  // In auth mode these are set by the encampKingdom Lambda and cleared by turn-ticker.
  const [encampEndTimeMs, setEncampEndTimeMs] = useState<number | null>(() => {
    if (isDemoMode()) return null; // demo mode uses localStorage via EncampPanel
    const raw = (kingdom as unknown as Record<string, unknown>).encampEndTime as string | null | undefined;
    if (!raw) return null;
    const ms = new Date(raw).getTime();
    return ms > Date.now() ? ms : null;
  });
  const [encampBonusTurns, setEncampBonusTurns] = useState<number>(() => {
    if (isDemoMode()) return 0;
    return ((kingdom as unknown as Record<string, unknown>).encampBonusTurns as number | null | undefined) ?? 0;
  });
  const [encampLoading, setEncampLoading] = useState(false);

  // Season info for the age badge
  const [seasonInfo, setSeasonInfo] = useState<{ seasonNumber: number; currentAge: 'early' | 'middle' | 'late' } | null>(null);
  // True when the season fetch completed and returned no active season (auth mode only)
  const [noActiveSeason, setNoActiveSeason] = useState(false);
  const [startingSeasonLoading, setStartingSeasonLoading] = useState(false);

  // Tutorial state
  const { hasCompleted: tutorialCompleted, markComplete: completeTutorial } = useTutorial('kingdom-dashboard');
  
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
        initializeTerritories();
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

  // Unwrap the season payload returned by getActiveSeason / startSeason.
  // Handles three possible shapes:
  //   { success, season: { ... } }                        <- Lambda direct / SeasonService
  //   { data: { success, season: { ... } } }              <- Amplify envelope
  //   { data: { getActiveSeason: { success, season } } }  <- GraphQL query shape
  const applySeasonResult = useCallback((raw: unknown) => {
    const payload = (raw as any)?.data ?? raw;
    const lambdaResult =
      (payload as any)?.getActiveSeason ??
      payload;
    const parsed = typeof lambdaResult === 'string'
      ? (() => { try { return JSON.parse(lambdaResult); } catch { return null; } })()
      : lambdaResult;
    const seasonData = parsed?.season ?? null;
    if (seasonData && seasonData.currentAge) {
      setSeasonInfo({
        seasonNumber: seasonData.seasonNumber ?? 1,
        currentAge: seasonData.currentAge as 'early' | 'middle' | 'late',
      });
      setNoActiveSeason(false);
      return true;
    }
    return false;
  }, []);

  // Fetch active season age once on mount
  useEffect(() => {
    const fetchSeason = async () => {
      try {
        const raw = await getActiveSeason(kingdom.id);
        const found = applySeasonResult(raw);
        if (!found && !isDemoMode()) {
          // No active season found in auth mode — show start prompt
          setNoActiveSeason(true);
        }
      } catch {
        // Non-fatal — season badge is informational only
      }
    };
    void fetchSeason();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally run once on mount
  }, []);

  const handleStartSeason = async () => {
    setStartingSeasonLoading(true);
    try {
      const raw = await startSeason(kingdom.id);
      const found = applySeasonResult(raw);
      if (!found) {
        // Lambda succeeded but returned no season data — re-fetch to confirm
        const refetch = await getActiveSeason(kingdom.id);
        const confirmed = applySeasonResult(refetch);
        if (!confirmed && !isDemoMode()) {
          setNoActiveSeason(true);
        }
      }
    } catch (err) {
      console.error('[KingdomDashboard] Failed to start season:', err);
    } finally {
      setStartingSeasonLoading(false);
    }
  };

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

  const handleGenerateResources = async (action: 'generate_turns' | 'generate_income') => {
    setResourceLoading(true);

    // Demo mode: skip Lambda entirely, update local store directly
    if (isDemoMode()) {
      if (action === 'generate_turns') {
        addTurns(3);
        ToastService.success('Turns generated successfully!');
      } else if (action === 'generate_income') {
        addGold(1000);
        ToastService.success('Income generated successfully!');
      }
      setResourceLoading(false);
      return;
    }

    // Auth mode: call Lambda and apply the server-returned values directly.
    // DO NOT call refreshKingdomResources() here — DynamoDB eventual consistency
    // means a read immediately after write can return stale data, which would
    // overwrite the freshly-generated turns/gold with old values.
    try {
      const raw = await AmplifyFunctionService.updateResources({
        kingdomId: kingdom.id,
        amount: action === 'generate_turns' ? 3 : undefined,
      });
      // Lambda returns { success, resources: JSON.stringify({gold,land,population,elan}), newTurns }
      // Unwrap potential { data: ... } envelope from Amplify client.
      const payload = (raw as any)?.data ?? raw;
      const serverResources = payload?.resources
        ? (JSON.parse(payload.resources as string) as { gold?: number; population?: number; land?: number })
        : null;

      if (serverResources) {
        // Apply only the income fields — do NOT touch turns here so we don't
        // accidentally overwrite the player's action-turn count.
        updateResources({
          gold: serverResources.gold,
          population: serverResources.population,
          land: serverResources.land,
        });
      } else {
        // Parsing failed — fall back to local estimate
        if (action === 'generate_income') addGold(1000);
      }

      // Action turns are a separate counter; generate_turns always adds 3.
      if (action === 'generate_turns') addTurns(3);

      ToastService.success(action === 'generate_turns' ? 'Turns generated!' : 'Income generated!');
    } catch (error) {
      console.error('Resource generation error:', error);
      if (action === 'generate_turns') addTurns(3);
      else addGold(1000);
      ToastService.success(action === 'generate_turns' ? 'Turns generated!' : 'Income generated!');
    } finally {
      setResourceLoading(false);
    }
  };

  // handleEncamp — server-authoritative encamp.
  // In demo mode: stores to localStorage (unchanged behaviour).
  // In auth mode: calls encampKingdom Lambda, which writes encampEndTime +
  // encampBonusTurns to DynamoDB; turn-ticker awards the bonus on expiry.
  const handleEncamp = async (duration: 16 | 24) => {
    if (isDemoMode()) {
      const bonusTurns = duration === 24
        ? TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_24_HOURS.bonusTurns
        : TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_16_HOURS.bonusTurns;
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

    setEncampLoading(true);
    try {
      const raw = await AmplifyFunctionService.callFunction('resource-manager', {
        kingdomId: kingdom.id,
        action: 'encamp',
        amount: duration,
      });
      const result = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>;
      const data = (result?.data as Record<string, unknown>) ?? result;
      const inner = (data?.encampKingdom as Record<string, unknown>) ?? data;
      if (inner?.success) {
        const endIso = inner.encampEndTime as string;
        const bonus = (inner.encampBonusTurns as number) ?? 0;
        setEncampEndTimeMs(new Date(endIso).getTime());
        setEncampBonusTurns(bonus);
        ToastService.success(
          `Encamping for ${duration}h! You'll receive +${bonus} bonus turns when you return.`
        );
      } else {
        ToastService.error((inner?.error as string) ?? 'Encamp failed. Please try again.');
      }
    } catch (err) {
      console.error('Encamp error:', err);
      ToastService.error('Encamp failed. Please try again.');
    } finally {
      setEncampLoading(false);
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
      // Skip Lambda in demo mode or if it fails due to schema mismatch
      if (!isDemoMode()) {
        try {
          await AmplifyFunctionService.updateResources({
            kingdomId: kingdom.id,
            amount: generated.turns,
          });
        } catch (lambdaErr) {
          console.warn('Time travel Lambda unavailable, applying locally:', lambdaErr);
        }
      }

      ToastService.success(`Time traveled ${hours} hours! +${generated.turns} turns, +${generated.gold} gold, +${generated.population} population.`);

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

  // Calculate context-aware "Next Step" recommendation
  const getNextStepRecommendation = () => {
    if (ownedTerritories.length === 0) {
      return { text: 'Claim your first territory to start earning resources', action: 'Claim Territory', onClick: onManageTerritories };
    }
    const units = useKingdomStore.getState().units;
    if (!units || units.length === 0) {
      return { text: 'Train units to build your army', action: 'Summon Units', onClick: onSummonUnits };
    }
    if ((resources.turns || 0) > 20 && ownedTerritories.length > 0) {
      return { text: 'You have turns ready — attack a kingdom to gain land', action: 'View Targets', onClick: onManageCombat };
    }
    return null;
  };

  const nextStep = getNextStepRecommendation();

  const getResourceStatus = () => {
    const gold = resources.gold || 0;
    const turns = resources.turns || 0;
    const upkeep = upkeepInfo.totalUpkeep || 0;
    const turnsOfUpkeep = upkeep > 0 ? Math.floor(gold / upkeep) : 999;

    return {
      gold: upkeep === 0 ? { label: 'No upkeep', color: '#6b7280' }
        : turnsOfUpkeep > 20  ? { label: `~${turnsOfUpkeep} turns safe`, color: '#34d399' }
        : turnsOfUpkeep > 5   ? { label: `⚠️ ${turnsOfUpkeep} turns left`, color: '#fbbf24' }
        : { label: '🚨 Critical', color: '#f87171' },
      turns: turns >= 30 ? { label: 'Plenty', color: '#34d399' }
        : turns >= 10   ? { label: 'Good', color: '#60a5fa' }
        : turns > 0     ? { label: '⚠️ Low — generate now', color: '#fbbf24' }
        : { label: '🚨 Empty', color: '#f87171' },
      population: { label: `+${Math.floor((resources.population || 0) * 0.01)}/turn`, color: '#6b7280' },
      land: { label: `${resources.land || 0} acres`, color: '#6b7280' },
    };
  };
  const resourceStatus = getResourceStatus();

  // Adaptive coaching nudges — fires after tutorial is completed
  useEffect(() => {
    // Only coach after tutorial is done
    if (!tutorialCompleted) return;

    const kingdomId = kingdom.id;
    const coached = JSON.parse(localStorage.getItem(`coached-${kingdomId}`) || '{}');

    // Coach 1: no territories after visiting dashboard twice
    const visitCount = (parseInt(localStorage.getItem(`visits-${kingdomId}`) || '0')) + 1;
    localStorage.setItem(`visits-${kingdomId}`, String(visitCount));

    if (visitCount >= 2 && ownedTerritories.length === 0 && !coached.territory) {
      setTimeout(() => {
        ToastService.info('💡 Tip: Claiming a territory gives you income every turn. Try Manage Territories!');
        localStorage.setItem(`coached-${kingdomId}`, JSON.stringify({ ...coached, territory: true }));
      }, 3000);
    }

    // Coach 2: turns are high but no attacks yet
    const hasBattled = localStorage.getItem(`has-battled-${kingdomId}`);
    if ((resources.turns || 0) > 40 && ownedTerritories.length > 0 && !coached.combat && !hasBattled) {
      setTimeout(() => {
        ToastService.info('💡 Tip: You have plenty of turns! Attack a kingdom on the Leaderboard to gain land.');
        localStorage.setItem(`coached-${kingdomId}`, JSON.stringify({ ...coached, combat: true }));
      }, 5000);
    }
  }, [tutorialCompleted, ownedTerritories.length, resources.turns, kingdom.id]);

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
        kingdomId={kingdom.id}
        actions={
          <div className="kingdom-race">
            <NotificationCenter kingdomId={kingdom.id} onReply={onComposeMessage} />
            <span className="race-badge">{kingdom.race}</span>
          </div>
        }
      />

      {/* Season Age Badge */}
      {seasonInfo && (
        <SeasonBadge
          seasonNumber={seasonInfo.seasonNumber}
          currentAge={seasonInfo.currentAge}
        />
      )}

      {/* No Active Season Banner — auth mode only, shown when no season is running */}
      {noActiveSeason && !isDemoMode() && (
        <NoActiveSeasonBanner
          onStartSeason={() => { void handleStartSeason(); }}
          isLoading={startingSeasonLoading}
        />
      )}

      {/* Restoration Status Banner */}
      <RestorationNotice
        isInRestoration={isInRestoration}
        restorationType={restorationType}
        getRemainingHours={getRemainingHours}
        prohibitedActions={prohibitedActions}
      />

      {/* Next Step contextual banner */}
      {nextStep && (
        <NextStepBanner text={nextStep.text} action={nextStep.action} onClick={nextStep.onClick} />
      )}

      {/* First Steps onboarding checklist */}
      <FirstSteps
        kingdomId={kingdom.id}
        onManageBuildings={onManageBuildings}
        onSummonUnits={onSummonUnits}
        onViewWorldMap={onViewWorldMap}
        onManageCombat={onManageCombat}
        onManageTerritories={onManageTerritories}
        onGenerateIncome={() => handleGenerateResources('generate_income')}
      />

      <div className="dashboard-grid">
        {/* Row 1: Resources (2fr left) + Turn Generation (1fr right) */}
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
              {(() => {
                const land = Number(resources?.land) || 0;
                const gold = Number(resources?.gold) || 0;
                // Use live units from store (updated on summon) — fall back to kingdom.totalUnits prop
                const unitValue = liveUnits.length > 0
                  ? liveUnits.reduce((sum, u) => sum + (Number.isFinite(u.count) ? u.count : 0) * 100, 0)
                  : (() => {
                      try {
                        const tu = typeof kingdom.totalUnits === 'string'
                          ? JSON.parse(kingdom.totalUnits as unknown as string)
                          : kingdom.totalUnits;
                        return tu ? Object.values(tu).reduce((s: number, v) => s + (Number.isFinite(v as number) ? (v as number) : 0) * 100, 0) : 0;
                      } catch { return 0; }
                    })();
                return (land * 1000 + gold + unitValue).toLocaleString();
              })()}
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
                <div style={{ fontSize: '0.7rem', color: resourceStatus.gold.color }}>{resourceStatus.gold.label}</div>
              </div>
            </div>
            <div className="resource-item">
              <img src="/population-resource-icon.png" alt="Population" className="resource-icon-img" />
              <div>
                <div className="resource-value">{resources?.population || 0}</div>
                <div className="resource-label">Population</div>
                <div style={{ fontSize: '0.7rem', color: resourceStatus.population.color }}>{resourceStatus.population.label}</div>
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
                <div style={{ fontSize: '0.7rem', color: resourceStatus.turns.color }}>{resourceStatus.turns.label}</div>
              </div>
            </div>
          </div>

          {/* Demo-only shortcuts — in auth mode turns/income are server-generated
              on a 20-minute timer; manual buttons would bypass anti-cheat */}
          {isDemoMode() && (
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
          )}

          <EncampPanel
            kingdomId={kingdom.id}
            encampEndTimeMs={encampEndTimeMs}
            encampBonusTurns={encampBonusTurns}
            onEncamp={handleEncamp}
            encampLoading={encampLoading}
          />
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

              // AI kingdoms take a proportional action tick each time the player's
              // turn generates — this makes the world evolve even while idle.
              const freshAIKingdoms = useAIKingdomStore.getState().aiKingdoms;
              const updateAIKingdom = useAIKingdomStore.getState().updateAIKingdom;
              freshAIKingdoms.forEach(ai => {
                const updatedAI = {
                  ...ai,
                  resources: {
                    ...ai.resources,
                    gold: ai.resources.gold + RESOURCE_GENERATION.BASE_INCOME_PER_TICK * newTurns,
                    population: ai.resources.population + RESOURCE_GENERATION.BASE_POPULATION_GROWTH * newTurns,
                    turns: Math.min(ai.resources.turns + newTurns, 100),
                  }
                };
                const actions = AIActionService.decideActions(updatedAI, freshAIKingdoms);
                actions.forEach(action => {
                  if (action.type === 'build') {
                    const result = AIActionService.executeBuild(updatedAI);
                    if (result.resources) updatedAI.resources = result.resources;
                  } else if (action.type === 'train') {
                    const result = AIActionService.executeTrain(updatedAI);
                    if (result.resources) updatedAI.resources = result.resources;
                    if (result.units) updatedAI.units = result.units;
                  } else if (action.type === 'attack') {
                    const target = freshAIKingdoms.find(t => t.id !== ai.id && t.networth < ai.networth * 1.5);
                    if (target) {
                      const result = AIActionService.executeAttack(updatedAI, target);
                      if (result.attacker.resources) updatedAI.resources = result.attacker.resources;
                      if (result.defender.resources) updateAIKingdom(target.id, result.defender);
                    }
                  }
                });
                const newNetworth =
                  updatedAI.resources.land * 1000 +
                  updatedAI.resources.gold +
                  Object.values(updatedAI.units).reduce((sum, c) => sum + (c as number) * 100, 0);
                updateAIKingdom(ai.id, { resources: updatedAI.resources, units: updatedAI.units, networth: newNetworth });
              });
            }}
          />
        </div>

        {/* Row 3: Territories (full width) */}
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

        {/* Row 4: Buildings & Economy (2fr left) + Race Abilities (1fr right) */}
        <BuildingStatsPanel
          buildingStats={buildingStats}
          upkeepInfo={upkeepInfo}
          race={kingdom.race || 'Human'}
        />

        <RaceAbilitiesPanel raceData={raceData} />

        {/* Row 5: Achievements (full width) */}
        <AchievementsPanel kingdomId={kingdom.id} />
      </div>

      {/* World Activity Feed — spans full width below the main dashboard grid */}
      <div style={{ padding: '0 0.5rem 1rem' }}>
        <WorldFeed defaultCollapsed={false} />
      </div>

      {/* Help Modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* Unit Roster Reference Modal */}
      {showUnitRoster && (
        <UnitRoster onClose={() => setShowUnitRoster(false)} />
      )}

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
