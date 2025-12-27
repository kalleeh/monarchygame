/**
 * App Router - URL-based routing with React Router
 * Separates routing logic from authentication logic
 * Implements code splitting with React.lazy and Suspense
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useKingdomStore } from './stores/kingdomStore';
import type { Schema } from '../../amplify/data/resource';
import { LoadingSkeleton } from './components/ui/loading/LoadingSkeleton';
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
function KingdomList({ kingdoms }: { kingdoms: Schema['Kingdom']['type'][] }) {
  const navigate = useNavigate();

  const getKingdomResources = (kingdomId: string) => {
    const stored = localStorage.getItem(`kingdom-${kingdomId}`);
    if (stored) {
      const data = JSON.parse(stored);
      return data.resources;
    }
    return { gold: 0, population: 0, land: 0, turns: 0 };
  };

  return (
    <div className="kingdom-management">
      <div className="kingdoms-header">
        <h2>Your Kingdoms</h2>
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
            const resources = getKingdomResources(kingdom.id);
            return (
              <div key={kingdom.id} className="kingdom-card">
                <h3>{kingdom.name}</h3>
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
    setTimeout(() => navigate('/kingdoms'), 1000);
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
                kingdoms={kingdoms.map(k => ({
                  id: k.id,
                  name: k.name || 'Unknown',
                  race: k.race || 'Human',
                  owner: k.owner || undefined,
                  resources: {
                    gold: k.resources?.gold || 0,
                    population: k.resources?.population || 0,
                    land: k.resources?.land || 0,
                    turns: k.resources?.turns || 0
                  },
                  stats: k.stats || {
                    warOffense: 0, warDefense: 0, sorcery: 0, scum: 0,
                    forts: 0, tithe: 0, training: 0, siege: 0, economy: 0, building: 0
                  },
                  totalUnits: k.totalUnits || { peasants: 0, militia: 0, knights: 0, cavalry: 0 },
                  isOnline: k.isOnline ?? false,
                  lastActive: k.lastActive ? new Date(k.lastActive) : undefined,
                  guildId: k.guildId || undefined
                }))}
                currentKingdom={{
                  id: kingdom.id,
                  name: kingdom.name || 'Unknown',
                  race: kingdom.race || 'Human',
                  owner: kingdom.owner || undefined,
                  resources: {
                    gold: kingdom.resources?.gold || 0,
                    population: kingdom.resources?.population || 0,
                    land: kingdom.resources?.land || 0,
                    turns: kingdom.resources?.turns || 0
                  },
                  stats: kingdom.stats || {
                    warOffense: 0, warDefense: 0, sorcery: 0, scum: 0,
                    forts: 0, tithe: 0, training: 0, siege: 0, economy: 0, building: 0
                  },
                  totalUnits: kingdom.totalUnits || { peasants: 0, militia: 0, knights: 0, cavalry: 0 },
                  isOnline: kingdom.isOnline ?? false,
                  lastActive: kingdom.lastActive ? new Date(kingdom.lastActive) : undefined,
                  guildId: kingdom.guildId || undefined
                }}
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
      </Routes>
    </Suspense>
  );
}
