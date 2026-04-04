/**
 * App Router - URL-based routing with React Router
 * Separates routing logic from authentication logic
 * Implements code splitting with React.lazy and Suspense
 */

import React, { Suspense, lazy, useState, useCallback } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useKingdomStore } from './stores/kingdomStore';
import { useAIKingdomStore } from './stores/aiKingdomStore';
import type { Schema } from '../../amplify/data/resource';
import { LoadingSkeleton } from './components/ui/loading/LoadingSkeleton';
import { TopNavigation } from './components/TopNavigation';
import { isDemoMode } from './utils/authMode';
import { MessageCompose } from './components/MessageCompose';
import type { MessageTarget } from './components/MessageCompose';
import { MobileBottomNav } from './components/MobileBottomNav';
import { useRestorationStore } from './stores/restorationStore';
import UnitRoster from './components/UnitRoster';
import { HelpModal } from './components/ui/HelpModal';

// Lazy-loaded components for code splitting
const BattleReportsRoute = lazy(() => import('./components/BattleReportsRoute'));
const ReplaysListRoute = lazy(() => import('./components/ReplaysListRoute'));
const ReplayRoute = lazy(() => import('./components/ReplayRoute'));
const WelcomePage = lazy(() => import('./components/WelcomePage'));
const KingdomCreation = lazy(() => import('./components/KingdomCreation'));
const KingdomList = lazy(() => import('./components/KingdomList'));
const KingdomDashboard = lazy(() => import('./components/KingdomDashboard'));
const TerritoryExpansion = lazy(() => import('./components/TerritoryExpansion'));
const BattleFormations = lazy(() => import('./components/BattleFormations'));
const SpellCastingInterface = lazy(() => import('./components/SpellCastingInterface'));
const TradeSystem = lazy(() => import('./components/TradeSystem'));
const UnitSummonInterface = lazy(() => import('./components/UnitSummonInterface'));
const DiplomacyInterface = lazy(() => import('./components/DiplomacyInterface'));
const Leaderboard = lazy(() => import('./components/Leaderboard'));
const AchievementList = lazy(() => import('./components/achievements/AchievementList'));
const GuildManagement = lazy(() => import('./components/GuildManagement'));
const WorldMap = lazy(() => import('./components/WorldMap'));
const ThieveryInterface = lazy(() => import('./components/ThieveryInterface'));
const BountyBoard = lazy(() => import('./components/BountyBoard'));
const FaithInterface = lazy(() => import('./components/FaithInterface'));
const MultiplayerLobby = lazy(() => import('./components/MultiplayerLobby'));
const KingdomBrowser = lazy(() => import('./components/KingdomBrowser'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const BuildingManagement = lazy(() => import('./components/BuildingManagement'));

interface AppRouterProps {
  kingdoms: Schema['Kingdom']['type'][];
  kingdomsLoading: boolean;
  onGetStarted: () => void;
  onKingdomCreated: (kingdomName: string, race: string) => void;
}

export function AppRouter({ kingdoms, kingdomsLoading, onGetStarted, onKingdomCreated }: AppRouterProps) {
  return (
    <Suspense fallback={<LoadingSkeleton type="page" />}>
      <Routes>
        {/* Welcome page */}
        <Route path="/" element={<WelcomePage onGetStarted={onGetStarted} />} />
        
        {/* Kingdom creation */}
        <Route path="/creation" element={<KingdomCreation onKingdomCreated={onKingdomCreated} />} />
        
        {/* Kingdom list */}
        <Route path="/kingdoms" element={<KingdomList kingdoms={kingdoms} />} />
        
        {/* Kingdom routes - all nested under /kingdom/:kingdomId */}
        <Route path="/kingdom/:kingdomId/*" element={<KingdomRoutes kingdoms={kingdoms} loading={kingdomsLoading} />} />
        
        {/* Admin dashboard */}
        <Route path="/admin" element={<Suspense fallback={<LoadingSkeleton type="page" />}><AdminDashboard /></Suspense>} />

        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

// Kingdom-specific routes with nested Suspense boundaries
function KingdomRoutes({ kingdoms, loading }: { kingdoms: Schema['Kingdom']['type'][]; loading: boolean }) {
  const { kingdomId } = useParams<{ kingdomId: string }>();
  const navigate = useNavigate();
  const loadKingdom = useKingdomStore((state) => state.loadKingdom);
  const loadAIKingdomsFromServer = useAIKingdomStore((state) => state.loadAIKingdomsFromServer);
  const isInRestoration = useRestorationStore((s) => s.isInRestoration);
  const prohibitedActions = useRestorationStore((s) => s.prohibitedActions);
  const [showMobileRoster, setShowMobileRoster] = useState(false);
  const [showMobileHelp, setShowMobileHelp] = useState(false);
  const isActionProhibitedRoute = useCallback(
    (action: string) => isInRestoration && prohibitedActions.includes(action),
    [isInRestoration, prohibitedActions]
  );

  const kingdom = kingdoms.find(k => k.id === kingdomId);

  // ── Diplomatic message compose modal state ──────────────────────────────
  const [composeTarget, setComposeTarget] = useState<MessageTarget | null>(null);
  const openCompose = useCallback((target: MessageTarget) => setComposeTarget(target), []);
  const closeCompose = useCallback(() => setComposeTarget(null), []);

  // Load kingdom data when entering
  React.useEffect(() => {
    if (kingdomId) {
      loadKingdom(kingdomId);
    }
  }, [kingdomId, loadKingdom]);

  // In auth mode, pre-load AI kingdoms so they are available on all kingdom pages
  React.useEffect(() => {
    if (!isDemoMode()) {
      void loadAIKingdomsFromServer();
    }
  }, [loadAIKingdomsFromServer]);

  // While kingdoms are loading, show spinner — don't redirect yet
  // Use a useEffect-based redirect so it cancels if loading flips back to true
  // (happens when Cognito session arrives after initial render with loading=false)
  React.useEffect(() => {
    if (!kingdom && !loading) {
      const t = setTimeout(() => navigate('/kingdoms', { replace: true }), 2000);
      return () => clearTimeout(t);
    }
  }, [kingdom, loading, navigate]);

  if (!kingdom) {
    if (loading) {
      return <div className="loading">Loading kingdom...</div>;
    }
    return <div className="loading">Loading kingdom...</div>;
  }

  const handleBack = () => navigate('/kingdoms');
  const handleBackToDashboard = () => navigate(`/kingdom/${kingdomId}`);

  // Build the list of kingdoms the player can send messages to (everyone except themselves)
  const messageableKingdoms: MessageTarget[] = kingdoms
    .filter(k => k.id !== kingdom.id)
    .map(k => ({ id: k.id, name: k.name || 'Unknown Kingdom' }));

  return (
    <>
      {/* Diplomatic message compose modal — rendered above the routed page */}
      {composeTarget && (
        <MessageCompose
          senderKingdom={{ id: kingdom.id, name: kingdom.name || 'Your Kingdom' }}
          defaultTarget={composeTarget}
          availableTargets={messageableKingdoms}
          onClose={closeCompose}
        />
      )}

      {/* Mobile bottom navigation — shown on all kingdom sub-pages (CSS hides on desktop) */}
      {kingdomId && (
        <MobileBottomNav
          kingdomId={kingdomId}
          isActionProhibited={isActionProhibitedRoute}
          onShowUnitRoster={() => setShowMobileRoster(true)}
          onShowHelp={() => setShowMobileHelp(true)}
        />
      )}
      {showMobileRoster && <UnitRoster onClose={() => setShowMobileRoster(false)} />}
      {showMobileHelp && <HelpModal onClose={() => setShowMobileHelp(false)} />}

      <Suspense fallback={<LoadingSkeleton type="dashboard" />}>
      <Routes>
        {/* Dashboard - default view */}
        <Route index element={
          <KingdomDashboard
            kingdom={kingdom}
            onBack={handleBack}
            onManageTerritories={() => navigate(`/kingdom/${kingdomId}/territories`)}
            onManageCombat={() => navigate(`/kingdom/${kingdomId}/combat`)}
            onManageAlliance={() => navigate(`/kingdom/${kingdomId}/alliance`)}
            onViewWorldMap={() => navigate(`/kingdom/${kingdomId}/worldmap`)}
            onCastSpells={() => navigate(`/kingdom/${kingdomId}/magic`)}
            onManageTrade={() => navigate(`/kingdom/${kingdomId}/trade`)}
            onSummonUnits={() => navigate(`/kingdom/${kingdomId}/summon`)}
            onDiplomacy={() => navigate(`/kingdom/${kingdomId}/diplomacy`)}
            onBattleReports={() => navigate(`/kingdom/${kingdomId}/reports`)}
            onViewLeaderboard={() => navigate(`/kingdom/${kingdomId}/leaderboard`)}
            onManageBuildings={() => navigate(`/kingdom/${kingdomId}/buildings`)}
            onComposeMessage={openCompose}
          />
        } />
        
        {/* Territory management */}
        <Route path="territories" element={
          <Suspense fallback={<LoadingSkeleton type="card" className="m-8" />}>
            <TerritoryExpansion 
              kingdomId={kingdom.id}
              onBack={handleBackToDashboard}
            />
          </Suspense>
        } />
        
        {/* Building construction */}
        <Route path="buildings" element={
          <Suspense fallback={<LoadingSkeleton type="card" className="m-8" />}>
            <BuildingManagement
              kingdomId={kingdom.id}
              race={kingdom.race || 'Human'}
              onBack={handleBackToDashboard}
            />
          </Suspense>
        } />

        {/* Combat */}
        <Route path="combat" element={
          <Suspense fallback={<LoadingSkeleton type="card" className="m-8" />}>
            <BattleFormations
              kingdomId={kingdom.id}
              race={kingdom.race || 'Human'}
              onBack={handleBackToDashboard}
            />
          </Suspense>
        } />
        
        {/* Guild */}
        <Route path="alliance" element={
          <Suspense fallback={<LoadingSkeleton type="card" className="m-8" />}>
            <GuildManagement 
              kingdom={kingdom}
              onBack={handleBackToDashboard}
            />
          </Suspense>
        } />
        
        {/* World map */}
        <Route path="worldmap" element={
          <Suspense fallback={<LoadingSkeleton type="page" />}>
            <WorldMap 
              kingdom={kingdom}
              onBack={handleBackToDashboard}
            />
          </Suspense>
        } />
        
        {/* Magic */}
        <Route path="magic" element={
          <Suspense fallback={<LoadingSkeleton type="card" className="m-8" />}>
            <SpellCastingInterface 
              kingdomId={kingdom.id}
              onBack={handleBackToDashboard}
            />
          </Suspense>
        } />
        
        {/* Trade */}
        <Route path="trade" element={
          <Suspense fallback={<LoadingSkeleton type="card" className="m-8" />}>
            <TradeSystem 
              kingdomId={kingdom.id}
              onBack={handleBackToDashboard}
            />
          </Suspense>
        } />
        
        {/* Summon Units */}
        <Route path="summon" element={
          <Suspense fallback={<LoadingSkeleton type="card" className="m-8" />}>
            <UnitSummonInterface 
              kingdomId={kingdom.id}
              race={kingdom.race || 'Human'}
              onBack={handleBackToDashboard}
            />
          </Suspense>
        } />
        
        {/* Diplomacy */}
        <Route path="diplomacy" element={
          <Suspense fallback={<LoadingSkeleton type="card" className="m-8" />}>
            <DiplomacyInterface
              kingdomId={kingdom.id}
              kingdomName={kingdom.name || 'Your Kingdom'}
              kingdomRace={kingdom.race || 'Human'}
              onBack={handleBackToDashboard}
            />
          </Suspense>
        } />
        
        {/* Espionage */}
        <Route path="espionage" element={
          <Suspense fallback={<LoadingSkeleton type="card" className="m-8" />}>
            <ThieveryInterface
              kingdomId={kingdom.id}
              race={kingdom.race || 'Human'}
              onBack={handleBackToDashboard}
            />
          </Suspense>
        } />

        {/* Bounty Board */}
        <Route path="bounties" element={
          <Suspense fallback={<LoadingSkeleton type="card" className="m-8" />}>
            <BountyBoard
              kingdomId={kingdom.id}
              onBack={handleBackToDashboard}
            />
          </Suspense>
        } />

        {/* Faith & Focus */}
        <Route path="faith" element={
          <Suspense fallback={<LoadingSkeleton type="card" className="m-8" />}>
            <FaithInterface
              kingdomId={kingdom.id}
              race={kingdom.race || 'Human'}
              onBack={handleBackToDashboard}
              serverFocusPoints={(() => {
                try {
                  const s = kingdom.stats;
                  const parsed = typeof s === 'string' ? JSON.parse(s) : (s ?? {});
                  return typeof parsed.focusPoints === 'number' ? parsed.focusPoints : undefined;
                } catch { return undefined; }
              })()}
            />
          </Suspense>
        } />

        {/* Battle reports */}
        <Route path="reports" element={
          <Suspense fallback={<LoadingSkeleton type="list" className="m-8" />}>
            <div style={{ background: 'var(--color-bg-deep, #0f1629)', minHeight: '100vh' }}>
              <TopNavigation
                title={<><img src="/battle-reports-icon.png" style={{width:28,height:28,objectFit:'contain',verticalAlign:'middle',marginRight:8}} alt="" />Battle Reports</>}
                onBack={handleBackToDashboard}
                backLabel="← Back to Kingdom"
                subtitle="Combat history & statistics"
                kingdomId={kingdom.id}
              />
              <BattleReportsRoute kingdom={kingdom} />
            </div>
          </Suspense>
        } />
        
        {/* Leaderboard */}
        <Route path="leaderboard" element={
          <Suspense fallback={<LoadingSkeleton type="list" className="m-8" />}>
            <>
              <TopNavigation
                title={<><img src="/overview-analytics-icon.png" style={{width:32,height:32,objectFit:'contain',verticalAlign:'middle',marginRight:8}} alt="" />Kingdom Scrolls</>}
                onBack={handleBackToDashboard}
                backLabel="← Back to Kingdom"
                kingdomId={kingdomId}
              />
              <Leaderboard
                kingdoms={kingdoms.map(k => {
                  const rawStats = (k.stats ?? {}) as Record<string, unknown>;
                  // Amplify returns json fields as strings — parse if needed
                  const parsedResources: Record<string, number> = (() => {
                    if (typeof k.resources !== 'string') return (k.resources ?? {}) as Record<string, number>;
                    try { return JSON.parse(k.resources); } catch { return {}; }
                  })();
                  const parsedTotalUnits: Record<string, number> = (() => {
                    if (typeof k.totalUnits !== 'string') return (k.totalUnits ?? {}) as Record<string, number>;
                    try { return JSON.parse(k.totalUnits); } catch { return {}; }
                  })();
                  return {
                    id: k.id,
                    name: k.name || 'Unknown',
                    race: k.race || 'Human',
                    owner: k.owner || undefined,
                    resources: {
                      gold: parsedResources.gold || 0,
                      population: parsedResources.population || 0,
                      land: parsedResources.land || 0,
                      turns: parsedResources.turns || 0
                    },
                    stats: {
                      warOffense: Number(rawStats.warOffense ?? 0),
                      warDefense: Number(rawStats.warDefense ?? 0),
                      sorcery: Number(rawStats.sorcery ?? 0),
                      scum: Number(rawStats.scum ?? 0),
                      forts: Number(rawStats.forts ?? 0),
                      tithe: Number(rawStats.tithe ?? 0),
                      training: Number(rawStats.training ?? 0),
                      siege: Number(rawStats.siege ?? 0),
                      economy: Number(rawStats.economy ?? 0),
                      building: Number(rawStats.building ?? 0),
                      previousSeasonRank: rawStats.previousSeasonRank != null ? Number(rawStats.previousSeasonRank) : undefined,
                      previousSeasonNetworth: rawStats.previousSeasonNetworth != null ? Number(rawStats.previousSeasonNetworth) : undefined,
                      previousSeasonNumber: rawStats.previousSeasonNumber != null ? Number(rawStats.previousSeasonNumber) : undefined,
                    },
                    totalUnits: ({ peasants: parsedTotalUnits.peasants || 0, militia: parsedTotalUnits.militia || 0, knights: parsedTotalUnits.knights || 0, cavalry: parsedTotalUnits.cavalry || 0 }),
                    isOnline: k.isOnline ?? false,
                    lastActive: k.lastActive ? new Date(k.lastActive) : undefined,
                    guildId: k.guildId || undefined
                  };
                })}
                currentKingdom={(() => {
                  const rawStats = (kingdom.stats ?? {}) as Record<string, unknown>;
                  const parsedResources: Record<string, number> = (() => {
                    if (typeof kingdom.resources !== 'string') return (kingdom.resources ?? {}) as Record<string, number>;
                    try { return JSON.parse(kingdom.resources); } catch { return {}; }
                  })();
                  const parsedTotalUnitsK: Record<string, number> = (() => {
                    if (typeof kingdom.totalUnits !== 'string') return (kingdom.totalUnits ?? {}) as Record<string, number>;
                    try { return JSON.parse(kingdom.totalUnits); } catch { return {}; }
                  })();
                  return {
                    id: kingdom.id,
                    name: kingdom.name || 'Unknown',
                    race: kingdom.race || 'Human',
                    owner: kingdom.owner || undefined,
                    resources: {
                      gold: parsedResources.gold || 0,
                      population: parsedResources.population || 0,
                      land: parsedResources.land || 0,
                      turns: parsedResources.turns || 0
                    },
                    stats: {
                      warOffense: Number(rawStats.warOffense ?? 0),
                      warDefense: Number(rawStats.warDefense ?? 0),
                      sorcery: Number(rawStats.sorcery ?? 0),
                      scum: Number(rawStats.scum ?? 0),
                      forts: Number(rawStats.forts ?? 0),
                      tithe: Number(rawStats.tithe ?? 0),
                      training: Number(rawStats.training ?? 0),
                      siege: Number(rawStats.siege ?? 0),
                      economy: Number(rawStats.economy ?? 0),
                      building: Number(rawStats.building ?? 0),
                      previousSeasonRank: rawStats.previousSeasonRank != null ? Number(rawStats.previousSeasonRank) : undefined,
                      previousSeasonNetworth: rawStats.previousSeasonNetworth != null ? Number(rawStats.previousSeasonNetworth) : undefined,
                      previousSeasonNumber: rawStats.previousSeasonNumber != null ? Number(rawStats.previousSeasonNumber) : undefined,
                    },
                    totalUnits: ({ peasants: parsedTotalUnitsK.peasants || 0, militia: parsedTotalUnitsK.militia || 0, knights: parsedTotalUnitsK.knights || 0, cavalry: parsedTotalUnitsK.cavalry || 0 }),
                    isOnline: kingdom.isOnline ?? false,
                    lastActive: kingdom.lastActive ? new Date(kingdom.lastActive) : undefined,
                    guildId: kingdom.guildId || undefined
                  };
                })()}
                onSendMessage={openCompose}
              />
            </>
          </Suspense>
        } />

        {/* Achievements */}
        <Route path="achievements" element={
          <Suspense fallback={<LoadingSkeleton type="list" className="m-8" />}>
            <>
              <TopNavigation
                title={<><img src="/achievements-icon.png" style={{width:28,height:28,objectFit:'contain',verticalAlign:'middle',marginRight:8}} alt="" />Achievements</>}
                onBack={handleBackToDashboard}
                backLabel="← Back to Kingdom"
                kingdomId={kingdom.id}
              />
              <AchievementList />
            </>
          </Suspense>
        } />

        {/* Multiplayer Lobby */}
        <Route path="multiplayer" element={
          <Suspense fallback={<LoadingSkeleton type="card" className="m-8" />}>
            <MultiplayerLobby
              kingdomId={kingdom.id}
              onBack={handleBackToDashboard}
              onBrowseKingdoms={() => navigate(`/kingdom/${kingdomId}/browse`)}
              onTrade={() => navigate(`/kingdom/${kingdomId}/trade`)}
              onDiplomacy={() => navigate(`/kingdom/${kingdomId}/diplomacy`)}
            />
          </Suspense>
        } />

        {/* Kingdom Browser */}
        <Route path="browse" element={
          <Suspense fallback={<LoadingSkeleton type="list" className="m-8" />}>
            <KingdomBrowser
              kingdomId={kingdom.id}
              onBack={handleBackToDashboard}
              onAttack={(targetId) => navigate(`/kingdom/${kingdomId}/combat`, { state: { targetKingdomId: targetId } })}
              onTrade={(_targetId) => navigate(`/kingdom/${kingdomId}/trade`)}
              onDiplomacy={(_targetId) => navigate(`/kingdom/${kingdomId}/diplomacy`)}
            />
          </Suspense>
        } />

        {/* Battle Replays list */}
        <Route path="replays" element={
          <Suspense fallback={<LoadingSkeleton type="list" className="m-8" />}>
            <>
              <TopNavigation
                title="Battle Replays"
                onBack={handleBackToDashboard}
                backLabel="← Back to Kingdom"
                subtitle="Review your recent battles"
                kingdomId={kingdom.id}
              />
              <ReplaysListRoute
                onNavigate={(replayId) => navigate(`/kingdom/${kingdomId}/replay/${replayId}`)}
              />
            </>
          </Suspense>
        } />

        {/* Combat Replay */}
        <Route path="replay/:replayId" element={
          <Suspense fallback={<LoadingSkeleton type="card" className="m-8" />}>
            <ReplayRoute onBack={handleBackToDashboard} />
          </Suspense>
        } />
      </Routes>
    </Suspense>
    </>
  );
}
