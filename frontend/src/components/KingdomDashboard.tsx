import React, { useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { TopNavigation } from './TopNavigation';
import { useCombatStore } from '../stores/combatStore';
import { useDiplomacyStore } from '../stores/useDiplomacyStore';
import { useTradeStore } from '../stores/tradeStore';
import { Tutorial } from './ui/Tutorial';
import { KINGDOM_DASHBOARD_TUTORIAL } from '../data/tutorialSteps';
import { TurnTimer } from './ui/TurnTimer';
import { DemoTimeControl } from './ui/DemoTimeControl';
import { calculateGoldIncome, calculatePopulationGrowth, type BuildingCounts } from '../utils/resourceCalculations';
import { calculateAgeBasedIncome } from '../../../shared/mechanics/age-mechanics';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { BalanceTestRunner } from './BalanceTestRunner';
import { isDemoMode } from '../utils/authMode';
import { subscriptionManager } from '../services/subscriptionManager';
import { NotificationCenter } from './ui/NotificationCenter';
import UnitRoster from './UnitRoster';
import WorldFeed from './WorldFeed';
import { HelpModal } from './ui/HelpModal';
import { achievementTriggers } from '../utils/achievementTriggers';
import { useKingdomDashboardState } from '../hooks/useKingdomDashboardState';
import { DashboardBanners } from './dashboard/DashboardBanners';
import { ResourcesSection } from './dashboard/ResourcesSection';
import { TerritoriesSection } from './dashboard/TerritoriesSection';
import { RaceAbilitiesPanel } from './ui/RaceAbilitiesPanel';
import { BuildingStatsPanel } from './ui/BuildingStatsPanel';
import { AchievementWidget } from './achievements/AchievementWidget';

interface KingdomDashboardProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
  onManageTerritories?: () => void;
  onManageCombat?: () => void;
  onViewWorldMap?: () => void;
  onSummonUnits?: () => void;
  onManageBuildings?: () => void;
  /** Opens the diplomatic message compose modal for a given target kingdom. */
  onComposeMessage?: (target: { id: string; name: string }) => void;
}

function KingdomDashboard({
  kingdom,
  onBack,
  onManageTerritories,
  onManageCombat,
  onViewWorldMap,
  onSummonUnits,
  onManageBuildings,
  onComposeMessage,
}: KingdomDashboardProps) {
  const state = useKingdomDashboardState(kingdom);

  const {
    resources,
    addGold,
    addTurns,
    updateResources,
    ownedTerritories,
    isInRestoration,
    restorationType,
    prohibitedActions,
    getRemainingHours,
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
    buildingStats,
    networth,
    upkeepInfo,
    resourceStatus,
    nextStep,
    raceData,
    handleBack,
    handleGenerateResources,
    handleEncamp,
    handleTimeTravel,
    handleStartSeason,
  } = state;

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
      onAttackReceived: (report) => {
        useCombatStore.getState().refreshBattleHistory(report);
      },
      onWarDeclared: (war) => {
        useDiplomacyStore.getState().applyIncomingWarDeclaration(war.attackerId);
      },
      onTradeOfferReceived: (offers) => {
        useTradeStore.getState().setActiveOffers(offers);
      },
    });

    return () => {
      subscriptionManager.stopSubscriptions();
    };
  }, [kingdom?.id]);

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
          onBack={() => handleBack(onBack)}
          backLabel="← Back to Kingdoms"
          kingdomId={kingdom.id}
          actions={
            <div className="kingdom-race">
              <NotificationCenter kingdomId={kingdom.id} onReply={onComposeMessage} />
              <span className="race-badge">{kingdom.race}</span>
            </div>
          }
        />

        <DashboardBanners
          seasonInfo={seasonInfo}
          noActiveSeason={noActiveSeason}
          startingSeasonLoading={startingSeasonLoading}
          onStartSeason={() => { void handleStartSeason(); }}
          isInRestoration={isInRestoration}
          restorationType={restorationType}
          getRemainingHours={getRemainingHours}
          prohibitedActions={prohibitedActions}
          nextStep={nextStep}
          onManageTerritories={onManageTerritories}
          onSummonUnits={onSummonUnits}
          onManageCombat={onManageCombat}
          kingdomId={kingdom.id}
          onManageBuildings={onManageBuildings}
          onViewWorldMap={onViewWorldMap}
          onGenerateIncome={() => handleGenerateResources('generate_income')}
          ownedTerritories={ownedTerritories}
        />

        <div className="dashboard-grid">
          {/* Left col (2fr): Resources stacked above Buildings & Economy
              Right col (1fr): Kingdom Status spans both rows */}

          <ResourcesSection
            networth={networth}
            resources={resources}
            resourceStatus={resourceStatus}
            resourceLoading={resourceLoading}
            onGenerateTurns={() => handleGenerateResources('generate_turns')}
            onGenerateIncome={() => handleGenerateResources('generate_income')}
            kingdomId={kingdom.id}
            encampEndTimeMs={encampEndTimeMs}
            encampBonusTurns={encampBonusTurns}
            onEncamp={handleEncamp}
            encampLoading={encampLoading}
          />

          {/* Kingdom Status spans rows 1-2 in the right column */}
          <div className="kingdom-status-panel kingdom-status-panel--span">
            <TurnTimer
              kingdomId={kingdom.id}
              onTurnGenerated={(newTurns) => {
                // In auth mode, the resource-manager Lambda already calculated and
                // persisted turns + income to DynamoDB. refreshKingdomResources() syncs it
                // back to the store. Adding anything here would DOUBLE-COUNT.
                // Only apply local calculations in demo mode.
                if (!isDemoMode()) return;

                addTurns(newTurns);

                const BASE_INCOME_PER_TURN = 100;
                const buildings: BuildingCounts = {
                  quarries: buildingStats.quarries,
                  hovels: buildingStats.hovels,
                  guildhalls: buildingStats.guildhalls,
                  temples: buildingStats.temples,
                };
                const buildingIncome = calculateGoldIncome(buildings);
                const rawGold = (BASE_INCOME_PER_TURN + buildingIncome) * newTurns;
                const goldEarned = calculateAgeBasedIncome(rawGold, seasonInfo?.currentAge ?? 'early');
                const populationEarned = calculatePopulationGrowth(buildings) * newTurns;
                const manaEarned = (buildingStats.temples || 0) * 3 * newTurns;

                addGold(goldEarned);
                updateResources({
                  population: (resources.population || 0) + populationEarned,
                  ...({ mana: Math.min(((resources as Record<string, number>).mana || 0) + manaEarned, 50000) } as Record<string, number>)
                });

                achievementTriggers.onGoldChanged();
                achievementTriggers.onPopulationChanged();
              }}
            />
            <div className="kingdom-status-divider" />
            <RaceAbilitiesPanel raceData={raceData} compact />
          </div>

          {/* Buildings & Economy — below Resources in the same left column */}
          <BuildingStatsPanel
            buildingStats={buildingStats}
            upkeepInfo={upkeepInfo}
            race={kingdom.race || 'Human'}
          />

          {/* Achievements — compact widget */}
          <AchievementWidget kingdomId={kingdom.id} />

          {/* Territories — full width at the bottom */}
          <TerritoriesSection
            ownedTerritories={ownedTerritories as React.ComponentProps<typeof TerritoriesSection>['ownedTerritories']}
            loading={loading}
            kingdomStats={kingdom.stats}
            onManageTerritories={onManageTerritories}
          />
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
