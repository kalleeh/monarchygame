/**
 * App Router - URL-based routing with React Router
 * Separates routing logic from authentication logic
 * Implements code splitting with React.lazy and Suspense
 */

import React, { Suspense, lazy, useEffect, useState, useCallback, useMemo } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import { useKingdomStore } from './stores/kingdomStore';
import { useCombatReplayStore } from './stores/combatReplayStore';
import { useCombatStore, type Unit } from './stores/combatStore';
import { useAIKingdomStore } from './stores/aiKingdomStore';
import type { BattleHistory, Army } from './types/combat';
import type { Schema } from '../../amplify/data/resource';
import { LoadingSkeleton } from './components/ui/loading/LoadingSkeleton';
import { TopNavigation } from './components/TopNavigation';
import { isDemoMode } from './utils/authMode';
import { MessageCompose } from './components/MessageCompose';
import type { MessageTarget } from './components/MessageCompose';
import './components/KingdomList.css';

// Lazy-loaded components for code splitting
const WelcomePage = lazy(() => import('./components/WelcomePage'));
const KingdomCreation = lazy(() => import('./components/KingdomCreation'));
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
const BattleReports = lazy(() => import('./components/combat/BattleReports'));
const CombatReplayViewer = lazy(() => import('./components/combat/CombatReplayViewer').then(m => ({ default: m.CombatReplayViewer })));
const ThieveryInterface = lazy(() => import('./components/ThieveryInterface'));
const BountyBoard = lazy(() => import('./components/BountyBoard'));
const FaithInterface = lazy(() => import('./components/FaithInterface'));
const MultiplayerLobby = lazy(() => import('./components/MultiplayerLobby'));
const KingdomBrowser = lazy(() => import('./components/KingdomBrowser'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const BuildingManagement = lazy(() => import('./components/BuildingManagement'));
import { KingdomActionBarConnected } from './components/KingdomActionBar';

interface AppRouterProps {
  kingdoms: Schema['Kingdom']['type'][];
  onGetStarted: () => void;
  onKingdomCreated: (kingdomName: string, race: string) => void;
}

export function AppRouter({ kingdoms, onGetStarted, onKingdomCreated }: AppRouterProps) {
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
        <Route path="/kingdom/:kingdomId/*" element={<KingdomRoutes kingdoms={kingdoms} />} />
        
        {/* Admin dashboard */}
        <Route path="/admin" element={<Suspense fallback={<LoadingSkeleton type="page" />}><AdminDashboard /></Suspense>} />

        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

// Kingdom list component
function KingdomList({ kingdoms: propKingdoms }: { kingdoms: Schema['Kingdom']['type'][] }) {
  const navigate = useNavigate();
  const [serverKingdoms, setServerKingdoms] = useState<Schema['Kingdom']['type'][] | null>(null);

  // In auth mode, fetch the authoritative list of kingdoms from AppSync so that
  // a player on a new device (or after clearing localStorage) sees the correct data.
  useEffect(() => {
    if (isDemoMode()) return;
    const fetchKingdoms = async () => {
      try {
        const client = generateClient<Schema>();
        const { data } = await client.models.Kingdom.list();
        setServerKingdoms(data || []);
      } catch (err) {
        console.error('[KingdomList] Failed to fetch kingdoms:', err);
      }
    };
    void fetchKingdoms();
  }, []);

  // Prefer the freshly-fetched server list in auth mode; fall back to prop.
  const kingdoms = (!isDemoMode() && serverKingdoms !== null) ? serverKingdoms : propKingdoms;

  const getKingdomResources = (kingdom: Schema['Kingdom']['type']) => {
    // In auth mode prefer server-side resources stored on the kingdom record
    if (!isDemoMode()) {
      if (typeof kingdom.resources === 'string') {
        try { return JSON.parse(kingdom.resources); } catch { /* fall through */ }
      } else if (kingdom.resources && typeof kingdom.resources === 'object') {
        return kingdom.resources as { gold: number; population: number; land: number; turns: number };
      }
    }
    // Demo mode (or auth mode with no server resources): read from localStorage
    const stored = localStorage.getItem(`kingdom-${kingdom.id}`);
    if (stored) {
      const data = JSON.parse(stored);
      return data.resources;
    }
    return { gold: 0, population: 0, land: 0, turns: 0 };
  };

  return (
    <div className="kingdom-management">
      <div className="kingdoms-header">
        <div>
          <h2>Your Kingdoms</h2>
          <p style={{margin:'0.25rem 0 0 0',fontSize:'0.9rem',color:'#9ca3af',fontStyle:'italic'}}>Rule wisely. Conquer boldly.</p>
        </div>
        <button className="create-new-btn" onClick={() => navigate('/creation')}>
          Create New Kingdom
        </button>
      </div>

      {kingdoms.length === 0 ? (
        <div className="no-kingdoms">
          <p>You haven't created any kingdoms yet.</p>
          <button className="create-first-btn" onClick={() => navigate('/creation')}>
            Create Your First Kingdom
          </button>
        </div>
      ) : (
        <div className="kingdoms-grid">
          {kingdoms.map((kingdom) => {
            const resources = getKingdomResources(kingdom);
            return (
              <div key={kingdom.id} className="kingdom-card">
                <h3 style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                  <img src="/logo.png" style={{width:'24px',height:'24px',objectFit:'contain',flexShrink:0}} alt="" />
                  {kingdom.name}
                </h3>
                <div className="kingdom-info">
                  <p><strong>Race:</strong> {kingdom.race}</p>
                  <p><strong>💰 Gold:</strong> {resources?.gold?.toLocaleString() || 0}</p>
                  <p><strong>👥 Population:</strong> {resources?.population?.toLocaleString() || 0}</p>
                  <p><strong>🏞️ Land:</strong> {resources?.land?.toLocaleString() || 0}</p>
                  <p><strong>⏱️ Turns:</strong> {resources?.turns || 0}</p>
                </div>
                <div className="kingdom-actions">
                  <button 
                    className="enter-kingdom-btn"
                    onClick={() => navigate(`/kingdom/${kingdom.id}`)}
                  >
                    Enter Kingdom
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {kingdoms.length > 0 && (
        <div style={{
          marginTop:'2rem',
          padding:'0.875rem 1rem',
          border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:'8px',
          background:'rgba(255,255,255,0.03)'
        }}>
          <p style={{margin:0,fontSize:'0.85rem',color:'#9ca3af'}}>
            💡 Tip: Claim territories to increase your income each turn.
          </p>
        </div>
      )}
    </div>
  );
}

// Kingdom-specific routes with nested Suspense boundaries
function KingdomRoutes({ kingdoms }: { kingdoms: Schema['Kingdom']['type'][] }) {
  const { kingdomId } = useParams<{ kingdomId: string }>();
  const navigate = useNavigate();
  const loadKingdom = useKingdomStore((state) => state.loadKingdom);

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

  // Redirect to kingdoms list if kingdom not found
  if (!kingdom) {
    setTimeout(() => navigate('/kingdoms', { replace: true }), 1000);
    return <div className="loading">Kingdom not found. Redirecting...</div>;
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
            <div className="leaderboard-page">
              <div className="leaderboard-header">
                <button className="back-btn" onClick={handleBackToDashboard}>← Back to Kingdom</button>
                <h1><img src="/overview-analytics-icon.png" style={{width:32,height:32,objectFit:'contain',verticalAlign:'middle',marginRight:8}} alt="" />Kingdom Scrolls</h1>
              </div>
              <Leaderboard
                kingdoms={kingdoms.map(k => {
                  const rawStats = (k.stats ?? {}) as Record<string, unknown>;
                  // Amplify returns json fields as strings — parse if needed
                  const parsedResources: Record<string, number> =
                    typeof k.resources === 'string' ? JSON.parse(k.resources) : (k.resources ?? {});
                  const parsedTotalUnits: Record<string, number> =
                    typeof k.totalUnits === 'string' ? JSON.parse(k.totalUnits) : (k.totalUnits ?? {});
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
                  const parsedResources: Record<string, number> =
                    typeof kingdom.resources === 'string' ? JSON.parse(kingdom.resources) : (kingdom.resources ?? {});
                  const parsedTotalUnitsK: Record<string, number> =
                    typeof kingdom.totalUnits === 'string' ? JSON.parse(kingdom.totalUnits) : (kingdom.totalUnits ?? {});
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
            </div>
          </Suspense>
        } />

        {/* Achievements */}
        <Route path="achievements" element={
          <Suspense fallback={<LoadingSkeleton type="list" className="m-8" />}>
            <div className="achievements-page" style={{ background: 'var(--color-bg-deep, #0f1629)', minHeight: '100vh' }}>
              <TopNavigation
                title={<><img src="/achievements-icon.png" style={{width:28,height:28,objectFit:'contain',verticalAlign:'middle',marginRight:8}} alt="" />Achievements</>}
                onBack={handleBackToDashboard}
                backLabel="← Back to Kingdom"
                kingdomId={kingdom.id}
              />
              <AchievementList />
            </div>
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
            <div style={{ background: 'var(--color-bg-deep, #0f1629)', minHeight: '100vh' }}>
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
            </div>
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

// Lists recent replays stored in the replay store
function ReplaysListRoute({ onNavigate }: { onNavigate: (replayId: string) => void }) {
  const getRecentReplays = useCombatReplayStore((state) => state.getRecentReplays);
  const replays = getRecentReplays(20);

  if (replays.length === 0) {
    return (
      <div style={{ padding: '2rem', color: '#9ca3af', textAlign: 'center' }}>
        <p>No replays available yet. Fight a battle to record one.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem 2rem' }}>
      {replays.map((replay) => (
        <div
          key={replay.battleId}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            marginBottom: '0.5rem',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div>
            <span style={{ color: replay.result === 'victory' ? '#22c55e' : '#ef4444', marginRight: '0.5rem' }}>
              {replay.result === 'victory' ? 'Victory' : 'Defeat'}
            </span>
            <span style={{ color: '#d1d5db' }}>vs {replay.defenderName}</span>
            <span style={{ color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.75rem' }}>
              {new Date(replay.timestamp).toLocaleDateString()}
            </span>
          </div>
          <button
            className="action-btn"
            style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}
            onClick={() => onNavigate(replay.battleId)}
          >
            View Replay
          </button>
        </div>
      ))}
    </div>
  );
}

// Reads live battle history from combatStore and transforms it to the BattleHistory
// shape expected by the BattleReports component.
function BattleReportsRoute({ kingdom }: { kingdom: Schema['Kingdom']['type'] }) {
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
      const attackerName = kingdom.name ?? 'Your Kingdom';
      const attackerRace = kingdom.race ?? 'Human';

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
  }, [rawHistory, aiKingdoms, kingdom]);

  return <BattleReports battleHistory={battleHistory} className="battle-reports-content" currentKingdomId={kingdom.id} />;
}

// Wrapper component that looks up the replay from the store by replayId param
function ReplayRoute({ onBack }: { onBack: () => void }) {
  const { replayId } = useParams<{ replayId: string }>();
  const getReplay = useCombatReplayStore((state) => state.getReplay);
  const replay = replayId ? getReplay(replayId) : undefined;

  if (!replay) {
    return (
      <div style={{ padding: '2rem', color: '#9ca3af', textAlign: 'center' }}>
        <p>Replay not found.</p>
        <button className="back-btn" onClick={onBack}>← Back to Kingdom</button>
      </div>
    );
  }

  return <CombatReplayViewer replay={replay} onClose={onBack} />;
}
