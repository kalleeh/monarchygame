import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Schema } from '../../../amplify/data/resource';
import type { KingdomResources } from '../types/amplify';
import { AmplifyFunctionService } from '../services/amplifyFunctionService';
import { getActiveSeason, startSeason } from '../services/domain/SeasonService';
import { ToastService } from '../services/toastService';
import { useTerritoryStore } from '../stores/territoryStore';
import { useKingdomStore } from '../stores/kingdomStore';
import { useFaithStore } from '../stores/faithStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { useSummonStore } from '../stores/useSummonStore';
import { AIActionService } from '../services/aiActionService';
import { achievementTriggers } from '../utils/achievementTriggers';
import { useAchievementStore } from '../stores/achievementStore';
import { useRestorationStore } from '../stores/restorationStore';
import { RACES } from '../../__mocks__/@game-data/races';
import { useTutorial } from '../hooks/useTutorial';
import { calculateTimeTravel, calculateGoldIncome, calculatePopulationGrowth, type BuildingCounts } from '../utils/resourceCalculations';
import { calculateBRT } from '../utils/buildingMechanics';
import { getUnitsForRace } from '../utils/units';
import { RESOURCE_GENERATION } from '../constants/gameConfig';
import { isDemoMode } from '../utils/authMode';
import { normalizeRace } from '../utils/raceUtils';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { TURN_MECHANICS } from '../../../shared/mechanics/turn-mechanics';
import { AGE_MECHANICS } from '../../../shared/mechanics/age-mechanics';

// ── AI simulation helper ──────────────────────────────────────────────────────

interface AIKingdomLike {
  id: string;
  name: string;
  race: string;
  resources: { gold: number; population: number; land: number; turns: number };
  units: Record<string, number>;
  networth: number;
}

function simulateAITick(
  aiKingdoms: AIKingdomLike[],
  updateAIKingdom: (id: string, updates: Partial<AIKingdomLike>) => void,
  incomeToGenerate: number,
  populationGrowth: number,
  landGrowth: number,
  turnsToGenerate: number,
  includeAttacks: boolean
): string[] {
  const aiActionLog: string[] = [];

  aiKingdoms.forEach(ai => {
    const updatedAI = {
      ...ai,
      resources: {
        ...ai.resources,
        gold: ai.resources.gold + incomeToGenerate,
        population: ai.resources.population + populationGrowth,
        land: ai.resources.land + landGrowth,
        turns: Math.min(ai.resources.turns + turnsToGenerate, 100),
      },
    };

    const actions = AIActionService.decideActions(updatedAI, aiKingdoms);

    actions.forEach(action => {
      if (action.type === 'build') {
        const result = AIActionService.executeBuild(updatedAI);
        if (result.resources) {
          updatedAI.resources = result.resources;
          if (includeAttacks) aiActionLog.push(`${ai.name} built structures`);
        }
      } else if (action.type === 'train') {
        const result = AIActionService.executeTrain(updatedAI);
        if (result.resources) {
          updatedAI.resources = result.resources;
          if (result.units) updatedAI.units = result.units;
          if (includeAttacks) aiActionLog.push(`${ai.name} trained units`);
        }
      } else if (action.type === 'attack' && includeAttacks) {
        const target = aiKingdoms.find(t => t.id !== ai.id && t.networth < ai.networth * 1.5);
        if (target) {
          const result = AIActionService.executeAttack(updatedAI, target);
          if (result.attacker.resources) {
            updatedAI.resources = result.attacker.resources;
            aiActionLog.push(`${ai.name} attacked ${target.name}`);
            if (result.defender.resources) {
              updateAIKingdom(target.id, result.defender);
            }
          }
        }
      }
    });

    const newNetworth =
      updatedAI.resources.land * 1000 +
      updatedAI.resources.gold +
      Object.values(updatedAI.units).reduce((sum, count) => sum + count * 100, 0);

    updateAIKingdom(ai.id, {
      resources: updatedAI.resources,
      units: updatedAI.units,
      networth: newNetworth,
    });
  });

  return aiActionLog;
}

export function useKingdomDashboardState(kingdom: Schema['Kingdom']['type']) {
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
  const loadAIKingdomsFromServer = useAIKingdomStore((state) => state.loadAIKingdomsFromServer);

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
  const [encampEndTimeMs, setEncampEndTimeMs] = useState<number | null>(() => {
    if (isDemoMode()) return null;
    const raw = (kingdom as any)?.encampEndTime as string | null | undefined;
    if (!raw) return null;
    const ms = new Date(raw).getTime();
    return ms > Date.now() ? ms : null;
  });
  const [encampBonusTurns, setEncampBonusTurns] = useState<number>(() => {
    if (isDemoMode()) return 0;
    return ((kingdom as any)?.encampBonusTurns as number | null | undefined) ?? 0;
  });
  const [encampLoading, setEncampLoading] = useState(false);

  // Season info for the age badge
  const [seasonInfo, setSeasonInfo] = useState<{ seasonNumber: number; currentAge: 'early' | 'middle' | 'late'; startDate: string } | null>(null);
  const prevAgeRef = useRef<string | null>(null);
  const [noActiveSeason, setNoActiveSeason] = useState(false);
  const [startingSeasonLoading, setStartingSeasonLoading] = useState(false);

  // Tutorial state
  const { hasCompleted: tutorialCompleted, markComplete: completeTutorial } = useTutorial('kingdom-dashboard');

  // Calculate BRT and upkeep
  const { getTotalUpkeep: _getTotalUpkeep, accumulatedGoldSpent, calculateRemainingCapacity } = useSummonStore();

  const getTotalUpkeep = useCallback(() => {
    const raceKey = normalizeRace(kingdom.race);
    const raceUnits = getUnitsForRace(raceKey);
    return liveUnits.reduce((sum, unit) => {
      const def = raceUnits.find(u => u.id === unit.type);
      return sum + (def?.stats.upkeep ?? 0) * unit.count;
    }, 0);
  }, [kingdom.race, liveUnits]);

  const buildingStats = useMemo(() => {
    const totalLand = resources.land || 0;
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
  const handleBack = useCallback((onBack: () => void) => {
    void useKingdomStore.getState().syncToDatabase();
    onBack();
  }, []);

  // FE-4: memoised networth calculation
  const networth = useMemo(() => {
    const land = Number(resources?.land) || 0;
    const gold = Number(resources?.gold) || 0;
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
    return land * 1000 + gold + unitValue;
  }, [resources, liveUnits, kingdom.totalUnits]);

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
    if (currentKingdomId !== kingdom.id) {
      setKingdomId(kingdom.id);
      setResources(kingdom.resources as KingdomResources);
      if (!isDemoMode()) {
        void useAchievementStore.getState().loadFromDatabase(kingdom.id);
      }
    }
  }, [kingdom.id]); // Only run when kingdom ID changes

  // Generate AI kingdoms on mount (demo mode) or load from server (auth mode)
  useEffect(() => {
    if (aiKingdoms.length === 0) {
      if (isDemoMode()) {
        const playerNetworth = (resources.land || 0) * 1000 + (resources.gold || 0);
        generateAIKingdoms(5, playerNetworth);
      } else {
        void loadAIKingdomsFromServer();
      }
    }
  }, [aiKingdoms.length, resources.land, resources.gold, generateAIKingdoms, loadAIKingdomsFromServer]);

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
    void initializeData();
  }, [kingdom.id, initializeTerritories]);

  // Check if restoration has ended on mount
  useEffect(() => {
    updateRestoration();
  }, [updateRestoration]);

  // Unwrap the season payload returned by getActiveSeason / startSeason.
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
        startDate: seasonData.startDate ?? new Date().toISOString(),
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

  const handleGenerateResources = async (action: 'generate_turns' | 'generate_income') => {
    setResourceLoading(true);

    if (isDemoMode()) {
      if (action === 'generate_turns') {
        addTurns(3);
        ToastService.success('Turns generated successfully!');
      } else if (action === 'generate_income') {
        addGold(1000);
        ToastService.success('Income generated successfully!');
      }
      useFaithStore.getState().grantFocusPoints(1);
      setResourceLoading(false);
      return;
    }

    try {
      const raw = await AmplifyFunctionService.updateResources({
        kingdomId: kingdom.id,
        amount: action === 'generate_turns' ? 3 : undefined,
      });
      const payload = (raw as any)?.data ?? raw;
      const serverResources = payload?.resources
        ? (JSON.parse(payload.resources as string) as { gold?: number; population?: number; land?: number })
        : null;

      if (serverResources) {
        updateResources({
          gold: serverResources.gold,
          population: serverResources.population,
          land: serverResources.land,
        });
      } else {
        if (action === 'generate_income') addGold(1000);
      }

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

  const handleEncamp = async (duration: 16 | 24) => {
    if (isDemoMode()) {
      const bonusTurns = duration === 24
        ? TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_24_HOURS.bonusTurns
        : TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_16_HOURS.bonusTurns;
      const endTime = Date.now() + duration * 60 * 60 * 1000;
      localStorage.setItem(
        STORAGE_KEYS.ENCAMP(kingdom.id),
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
    const kingdomBuildings = (kingdom.buildings || {}) as Record<string, number>;
    const buildings: BuildingCounts = {
      quarries: kingdomBuildings.mine || 0,
      hovels: kingdomBuildings.farm || 0,
      guildhalls: kingdomBuildings.tower || 0
    };

    const generated = calculateTimeTravel(hours, buildings);

    const incomeToGenerate = RESOURCE_GENERATION.BASE_INCOME_PER_TICK;
    const populationGrowth = RESOURCE_GENERATION.BASE_POPULATION_GROWTH;
    const landGrowth = RESOURCE_GENERATION.LAND_GROWTH;
    const turnsToGenerate = RESOURCE_GENERATION.TURNS_PER_HOUR;

    try {
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

      addTurns(generated.turns);
      addGold(generated.gold);
      useKingdomStore.getState().updateResources({
        population: (resources.population || 0) + generated.population
      });

      achievementTriggers.onGoldChanged();
      achievementTriggers.onPopulationChanged();
      achievementTriggers.onLandChanged();

      if (!isDemoMode()) {
        void useKingdomStore.getState().syncToDatabase();
      }

      const updateAIKingdom = useAIKingdomStore.getState().updateAIKingdom;
      const aiActionLog = simulateAITick(
        aiKingdoms,
        updateAIKingdom,
        incomeToGenerate,
        populationGrowth,
        landGrowth,
        turnsToGenerate,
        true
      );

      if (aiActionLog.length > 0) {
        ToastService.info(`AI Activity: ${aiActionLog.slice(0, 3).join(', ')}${aiActionLog.length > 3 ? '...' : ''}`);
      }
    } catch (error) {
      console.error('Time travel error:', error);
      addTurns(turnsToGenerate);
      addGold(incomeToGenerate);
      useKingdomStore.getState().updateResources({
        population: (resources.population || 0) + populationGrowth,
        land: (resources.land || 0) + landGrowth
      });

      const updateAIKingdom = useAIKingdomStore.getState().updateAIKingdom;
      simulateAITick(
        aiKingdoms,
        updateAIKingdom,
        incomeToGenerate,
        populationGrowth,
        landGrowth,
        turnsToGenerate,
        false
      );
    }
  };

  const raceKey = normalizeRace(kingdom.race);
  const raceData = RACES[raceKey as keyof typeof RACES];

  const getNextStepRecommendation = () => {
    if (ownedTerritories.length === 0) {
      return { text: 'Claim your first territory to start earning resources', action: 'Claim Territory' };
    }
    const units = useKingdomStore.getState().units;
    if (!units || units.length === 0) {
      return { text: 'Train units to build your army', action: 'Summon Units' };
    }
    if ((resources.turns || 0) > 20 && ownedTerritories.length > 0) {
      return { text: 'You have turns ready — attack a kingdom to gain land', action: 'View Targets' };
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
    if (!tutorialCompleted) return;

    const kingdomId = kingdom.id;
    const coached = JSON.parse(localStorage.getItem(STORAGE_KEYS.COACHED(kingdomId)) || '{}');

    const visitCount = (parseInt(localStorage.getItem(STORAGE_KEYS.VISITS(kingdomId)) || '0')) + 1;
    localStorage.setItem(STORAGE_KEYS.VISITS(kingdomId), String(visitCount));

    if (visitCount >= 2 && ownedTerritories.length === 0 && !coached.territory) {
      setTimeout(() => {
        ToastService.info('💡 Tip: Claiming a territory gives you income every turn. Try Manage Territories!');
        localStorage.setItem(STORAGE_KEYS.COACHED(kingdomId), JSON.stringify({ ...coached, territory: true }));
      }, 3000);
    }

    const hasBattled = localStorage.getItem(STORAGE_KEYS.HAS_BATTLED(kingdomId));
    if ((resources.turns || 0) > 40 && ownedTerritories.length > 0 && !coached.combat && !hasBattled) {
      setTimeout(() => {
        ToastService.info('💡 Tip: You have plenty of turns! Attack a kingdom on the Leaderboard to gain land.');
        localStorage.setItem(STORAGE_KEYS.COACHED(kingdomId), JSON.stringify({ ...coached, combat: true }));
      }, 5000);
    }
  }, [tutorialCompleted, ownedTerritories.length, resources.turns, kingdom.id]);

  // Notify player when the age changes
  useEffect(() => {
    const currentAge = seasonInfo?.currentAge;
    if (!currentAge) return;
    if (prevAgeRef.current !== null && prevAgeRef.current !== currentAge) {
      const effects = AGE_MECHANICS.ECONOMIC_AGE_EFFECTS[currentAge as 'early' | 'middle' | 'late'];
      const ageLabel = currentAge.charAt(0).toUpperCase() + currentAge.slice(1);
      const incomeNote = effects.incomeMultiplier > 1
        ? `+${Math.round((effects.incomeMultiplier - 1) * 100)}% income`
        : effects.incomeMultiplier < 1
        ? `-${Math.round((1 - effects.incomeMultiplier) * 100)}% income`
        : 'standard income';
      ToastService.info(`⚔️ The ${ageLabel} Age has begun — ${incomeNote}`);
    }
    prevAgeRef.current = currentAge;
  }, [seasonInfo?.currentAge]);

  return {
    // Store values
    resources,
    liveUnits,
    addGold,
    addTurns,
    updateResources,
    ownedTerritories,
    aiKingdoms,
    isInRestoration,
    restorationType,
    prohibitedActions,
    getRemainingHours,
    isActionProhibited,

    // Local state
    loading,
    resourceLoading,
    showBalanceTester,
    setShowBalanceTester,
    showHelp,
    setShowHelp,
    showUnitRoster,
    setShowUnitRoster,
    encampEndTimeMs,
    encampBonusTurns,
    encampLoading,
    seasonInfo,
    noActiveSeason,
    startingSeasonLoading,
    tutorialCompleted,
    completeTutorial,

    // Computed
    buildingStats,
    networth,
    upkeepInfo,
    resourceStatus,
    nextStep,
    raceData,

    // Handlers
    handleBack,
    handleGenerateResources,
    handleEncamp,
    handleTimeTravel,
    handleStartSeason,
    getTotalUpkeep,
  };
}
