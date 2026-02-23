/**
 * App Router - URL-based routing with React Router
 * Separates routing logic from authentication logic
 * Implements code splitting with React.lazy and Suspense
 */

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import { useKingdomStore } from './stores/kingdomStore';
import type { Schema } from '../../amplify/data/resource';
import { LoadingSkeleton } from './components/ui/loading/LoadingSkeleton';
import { isDemoMode } from './utils/authMode';
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
const ThieveryInterface = lazy(() => import('./components/ThieveryInterface'));
const BountyBoard = lazy(() => import('./components/BountyBoard'));
const FaithInterface = lazy(() => import('./components/FaithInterface'));
const MultiplayerLobby = lazy(() => import('./components/MultiplayerLobby'));
const KingdomBrowser = lazy(() => import('./components/KingdomBrowser'));

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

  return (
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
              onBack={handleBackToDashboard}
            />
          </Suspense>
        } />
        
        {/* Espionage */}
        <Route path="espionage" element={
          <Suspense fallback={<LoadingSkeleton type="card" className="m-8" />}>
            <ThieveryInterface
              kingdomId={kingdom.id}
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
              onBack={handleBackToDashboard}
            />
          </Suspense>
        } />

        {/* Battle reports */}
        <Route path="reports" element={
          <Suspense fallback={<LoadingSkeleton type="list" className="m-8" />}>
            <div className="battle-reports-container">
              <div className="battle-reports-header">
                <button className="back-btn" onClick={handleBackToDashboard}>← Back to Kingdom</button>
                <h1>📊 Battle Reports</h1>
              </div>
              <BattleReports battleHistory={[]} className="battle-reports-content" />
            </div>
          </Suspense>
        } />
        
        {/* Leaderboard */}
        <Route path="leaderboard" element={
          <Suspense fallback={<LoadingSkeleton type="list" className="m-8" />}>
            <div className="leaderboard-page">
              <div className="leaderboard-header">
                <button className="back-btn" onClick={handleBackToDashboard}>← Back to Kingdom</button>
                <h1>🏆 Kingdom Scrolls</h1>
              </div>
              <Leaderboard
                kingdoms={kingdoms.map(k => {
                  const rawStats = (k.stats ?? {}) as Record<string, unknown>;
                  return {
                    id: k.id,
                    name: k.name || 'Unknown',
                    race: k.race || 'Human',
                    owner: k.owner || undefined,
                    resources: {
                      gold: (k.resources as Record<string, number> | null)?.gold || 0,
                      population: (k.resources as Record<string, number> | null)?.population || 0,
                      land: (k.resources as Record<string, number> | null)?.land || 0,
                      turns: (k.resources as Record<string, number> | null)?.turns || 0
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
                    totalUnits: ((k.totalUnits as Record<string, number> | null) || { peasants: 0, militia: 0, knights: 0, cavalry: 0 }) as { peasants: number; militia: number; knights: number; cavalry: number },
                    isOnline: k.isOnline ?? false,
                    lastActive: k.lastActive ? new Date(k.lastActive) : undefined,
                    guildId: k.guildId || undefined
                  };
                })}
                currentKingdom={(() => {
                  const rawStats = (kingdom.stats ?? {}) as Record<string, unknown>;
                  return {
                    id: kingdom.id,
                    name: kingdom.name || 'Unknown',
                    race: kingdom.race || 'Human',
                    owner: kingdom.owner || undefined,
                    resources: {
                      gold: (kingdom.resources as Record<string, number> | null)?.gold || 0,
                      population: (kingdom.resources as Record<string, number> | null)?.population || 0,
                      land: (kingdom.resources as Record<string, number> | null)?.land || 0,
                      turns: (kingdom.resources as Record<string, number> | null)?.turns || 0
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
                    totalUnits: ((kingdom.totalUnits as Record<string, number> | null) || { peasants: 0, militia: 0, knights: 0, cavalry: 0 }) as { peasants: number; militia: number; knights: number; cavalry: number },
                    isOnline: kingdom.isOnline ?? false,
                    lastActive: kingdom.lastActive ? new Date(kingdom.lastActive) : undefined,
                    guildId: kingdom.guildId || undefined
                  };
                })()}
              />
            </div>
          </Suspense>
        } />

        {/* Achievements */}
        <Route path="achievements" element={
          <Suspense fallback={<LoadingSkeleton type="list" className="m-8" />}>
            <div className="achievements-page">
              <div className="achievements-header">
                <button className="back-btn" onClick={handleBackToDashboard}>← Back to Kingdom</button>
              </div>
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
              onAttack={(_targetId) => navigate(`/kingdom/${kingdomId}/combat`)}
              onTrade={(_targetId) => navigate(`/kingdom/${kingdomId}/trade`)}
              onDiplomacy={(_targetId) => navigate(`/kingdom/${kingdomId}/diplomacy`)}
            />
          </Suspense>
        } />
      </Routes>
    </Suspense>
  );
}
