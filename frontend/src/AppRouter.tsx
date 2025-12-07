/**
 * App Router - URL-based routing with React Router
 * Separates routing logic from authentication logic
 */

import React from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { WelcomePage } from './components/WelcomePage';
import { KingdomCreation } from './components/KingdomCreation';
import { KingdomDashboard } from './components/KingdomDashboard';
import { TerritoryExpansion } from './components/TerritoryExpansion';
import { BattleFormations } from './components/BattleFormations';
import { SpellCastingInterface } from './components/SpellCastingInterface';
import { TradeSystem } from './components/TradeSystem';
import { UnitSummonInterface } from './components/UnitSummonInterface';
import { DiplomacyInterface } from './components/DiplomacyInterface';
import { Leaderboard } from './components/Leaderboard';
import { AchievementList } from './components/achievements/AchievementList';
import { GuildManagement } from './components/GuildManagement';
import { WorldMap } from './components/WorldMap';
import { BattleReports } from './components/combat/BattleReports';
import { useKingdomStore } from './stores/kingdomStore';
import type { Schema } from '../../amplify/data/resource';
import './components/KingdomList.css';

interface AppRouterProps {
  kingdoms: Schema['Kingdom']['type'][];
  onGetStarted: () => void;
  onKingdomCreated: (kingdomName: string, race: string) => void;
}

export function AppRouter({ kingdoms, onGetStarted, onKingdomCreated }: AppRouterProps) {

  return (
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

// Kingdom-specific routes
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
        <TerritoryExpansion 
          kingdomId={kingdom.id}
          onBack={handleBackToDashboard}
        />
      } />
      
      {/* Combat */}
      <Route path="combat" element={
        <BattleFormations 
          kingdomId={kingdom.id}
          onBack={handleBackToDashboard}
        />
      } />
      
      {/* Guild */}
      <Route path="alliance" element={
        <GuildManagement 
          kingdom={kingdom}
          onBack={handleBackToDashboard}
        />
      } />
      
      {/* World map */}
      <Route path="worldmap" element={
        <WorldMap 
          kingdom={kingdom}
          onBack={handleBackToDashboard}
        />
      } />
      
      {/* Magic */}
      <Route path="magic" element={
        <SpellCastingInterface 
          kingdomId={kingdom.id}
          onBack={handleBackToDashboard}
        />
      } />
      
      {/* Trade */}
      <Route path="trade" element={
        <TradeSystem 
          kingdomId={kingdom.id}
          onBack={handleBackToDashboard}
        />
      } />
      
      {/* Summon Units */}
      <Route path="summon" element={
        <UnitSummonInterface 
          kingdomId={kingdom.id}
          race={kingdom.race || 'Human'}
          onBack={handleBackToDashboard}
        />
      } />
      
      {/* Diplomacy */}
      <Route path="diplomacy" element={
        <DiplomacyInterface 
          kingdomId={kingdom.id}
          onBack={handleBackToDashboard}
        />
      } />
      
      {/* Battle reports */}
      <Route path="reports" element={
        <div className="battle-reports-container">
          <div className="battle-reports-header">
            <button className="back-btn" onClick={handleBackToDashboard}>← Back to Kingdom</button>
            <h1>📊 Battle Reports</h1>
          </div>
          <BattleReports battleHistory={[]} className="battle-reports-content" />
        </div>
      } />
      
      {/* Leaderboard */}
      <Route path="leaderboard" element={
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
                gold: (k.resources as any)?.gold || 0,
                population: (k.resources as any)?.population || 0,
                land: (k.resources as any)?.land || 0,
                turns: (k.resources as any)?.turns || 0
              },
              stats: (k.stats as any) || {
                warOffense: 0, warDefense: 0, sorcery: 0, scum: 0,
                forts: 0, tithe: 0, training: 0, siege: 0, economy: 0, building: 0
              },
              totalUnits: (k.totalUnits as any) || { peasants: 0, militia: 0, knights: 0, cavalry: 0 },
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
                gold: (kingdom.resources as any)?.gold || 0,
                population: (kingdom.resources as any)?.population || 0,
                land: (kingdom.resources as any)?.land || 0,
                turns: (kingdom.resources as any)?.turns || 0
              },
              stats: (kingdom.stats as any) || {
                warOffense: 0, warDefense: 0, sorcery: 0, scum: 0,
                forts: 0, tithe: 0, training: 0, siege: 0, economy: 0, building: 0
              },
              totalUnits: (kingdom.totalUnits as any) || { peasants: 0, militia: 0, knights: 0, cavalry: 0 },
              isOnline: kingdom.isOnline ?? false,
              lastActive: kingdom.lastActive ? new Date(kingdom.lastActive) : undefined,
              guildId: kingdom.guildId || undefined
            }}
          />
        </div>
      } />

      {/* Achievements */}
      <Route path="achievements" element={
        <div className="achievements-page">
          <div className="achievements-header">
            <button className="back-btn" onClick={handleBackToDashboard}>← Back to Kingdom</button>
          </div>
          <AchievementList />
        </div>
      } />
    </Routes>
  );
}
