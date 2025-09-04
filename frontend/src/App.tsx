import { useEffect, useState, useRef } from 'react';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import '@aws-amplify/ui-react/styles.css';
import outputs from '../amplify_outputs.json';
import { WelcomePage } from './components/WelcomePage';
import { KingdomCreation } from './components/KingdomCreation';
import { KingdomDashboard } from './components/KingdomDashboard';
import { TerritoryManagement } from './components/TerritoryManagement';
import { CombatPage } from './components/CombatPage';
import { AllianceManagement } from './components/AllianceManagement';
import { WorldMap } from './components/WorldMap';
import { MagicSystem } from './components/MagicSystem';
import { TradeEconomy } from './components/TradeEconomy';
import './App.css';
import './components/KingdomCreation.css';
import './components/KingdomDashboard.css';
import './components/TerritoryManagement.css';
import './components/WelcomePage.css';
import type { Schema } from '../../amplify/data/resource';
import type { AuthenticatorProps, KingdomResources } from './types/amplify';

Amplify.configure(outputs);
const client = generateClient<Schema>();

type AppView = 'welcome' | 'kingdoms' | 'creation' | 'dashboard' | 'territories' | 'combat' | 'alliance' | 'worldmap' | 'magic' | 'trade';

function App() {
  const [kingdoms, setKingdoms] = useState<Schema['Kingdom']['type'][]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>('welcome');
  const [selectedKingdom, setSelectedKingdom] = useState<Schema['Kingdom']['type'] | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Check for demo mode
    const isDemoMode = localStorage.getItem('demo-mode') === 'true';
    setDemoMode(isDemoMode);
    
    // If in demo mode, fetch kingdoms immediately
    if (isDemoMode) {
      fetchKingdoms();
    }
  }, []);

  // Handle authenticated user changes
  useEffect(() => {
    if (currentUser && !demoMode) {
      setLoading(true);
      // Add a small delay to ensure authentication tokens are properly set
      setTimeout(() => {
        fetchKingdoms();
      }, 1000);
    }
  }, [currentUser, demoMode]);

  const fetchKingdoms = async () => {
    try {
      // Skip backend calls in demo mode
      if (demoMode) {
        setKingdoms([]);
        setCurrentView('creation');
        setLoading(false);
        return;
      }
      
      const { data } = await client.models.Kingdom.list();
      setKingdoms(data);
      if (data.length === 0) {
        setCurrentView('creation');
      } else {
        setCurrentView('kingdoms');
      }
    } catch (error) {
      console.error('Failed to fetch kingdoms:', error);
      // In case of error (including auth issues), go to creation
      setKingdoms([]);
      setCurrentView('creation');
    } finally {
      setLoading(false);
    }
  };

  const handleGetStarted = () => {
    const isDemoMode = localStorage.getItem('demo-mode') === 'true';
    if (isDemoMode) {
      setDemoMode(true);
      setLoading(true);
      // Immediately fetch kingdoms for demo mode
      setTimeout(() => {
        fetchKingdoms();
      }, 100);
    } else {
      setShowAuth(true);
    }
  };

  const handleKingdomCreated = () => {
    const isDemoMode = localStorage.getItem('demo-mode') === 'true';
    
    if (isDemoMode) {
      // In demo mode, create a mock kingdom and go to dashboard
      const mockKingdom = {
        id: 'demo-kingdom-1',
        name: 'Demo Kingdom',
        race: 'Human',
        resources: {
          gold: 1000,
          population: 500,
          land: 100,
          turns: 50
        }
      };
      setSelectedKingdom(mockKingdom as any);
      setCurrentView('dashboard');
    } else {
      setCurrentView('kingdoms');
      fetchKingdoms();
    }
  };

  const handleEnterKingdom = (kingdom: Schema['Kingdom']['type']) => {
    setSelectedKingdom(kingdom);
    setCurrentView('dashboard');
  };

  const handleManageTerritories = () => {
    setCurrentView('territories');
  };

  const handleManageCombat = () => {
    setCurrentView('combat');
  };

  const handleManageAlliance = () => {
    setCurrentView('alliance');
  };

  const handleBackToKingdoms = () => {
    setCurrentView('kingdoms');
    setSelectedKingdom(null);
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
  };

  const renderGameContent = () => {
    if (loading) {
      return (
        <div className="loading">
          <p>Loading your kingdoms...</p>
        </div>
      );
    }

    switch (currentView) {
      case 'creation':
        return <KingdomCreation onKingdomCreated={handleKingdomCreated} />;
      
      case 'dashboard':
        return selectedKingdom ? (
          <KingdomDashboard 
            kingdom={selectedKingdom} 
            onBack={handleBackToKingdoms}
            onManageTerritories={handleManageTerritories}
            onManageCombat={handleManageCombat}
            onManageAlliance={handleManageAlliance}
            onViewWorldMap={() => setCurrentView('worldmap')}
            onCastSpells={() => setCurrentView('magic')}
            onManageTrade={() => setCurrentView('trade')}
          />
        ) : null;
      
      case 'territories':
        return selectedKingdom ? (
          <TerritoryManagement 
            kingdom={selectedKingdom} 
            onBack={handleBackToDashboard}
          />
        ) : null;

      case 'combat':
        return selectedKingdom ? (
          <CombatPage 
            kingdom={selectedKingdom} 
            onBack={handleBackToDashboard}
          />
        ) : null;

      case 'alliance':
        return selectedKingdom ? (
          <AllianceManagement 
            kingdom={selectedKingdom} 
            onBack={handleBackToDashboard}
          />
        ) : null;

      case 'worldmap':
        return selectedKingdom ? (
          <WorldMap 
            kingdom={selectedKingdom} 
            onBack={handleBackToDashboard}
          />
        ) : null;

      case 'magic':
        return selectedKingdom ? (
          <MagicSystem 
            kingdom={selectedKingdom} 
            onBack={handleBackToDashboard}
          />
        ) : null;

      case 'trade':
        return selectedKingdom ? (
          <TradeEconomy 
            kingdom={selectedKingdom} 
            onBack={handleBackToDashboard}
          />
        ) : null;
      
      default: // kingdoms
        return (
          <div className="kingdom-management">
            <div className="kingdoms-header">
              <h2>Your Kingdoms</h2>
              <button 
                className="create-new-btn"
                onClick={() => setCurrentView('creation')}
              >
                Create New Kingdom
              </button>
            </div>

            {kingdoms.length === 0 ? (
              <div className="no-kingdoms">
                <p>You haven't created any kingdoms yet.</p>
                <button 
                  className="create-first-btn"
                  onClick={() => setCurrentView('creation')}
                >
                  Create Your First Kingdom
                </button>
              </div>
            ) : (
              <div className="kingdoms-grid">
                {kingdoms.map((kingdom) => (
                  <div key={kingdom.id} className="kingdom-card">
                    <h3>{kingdom.name}</h3>
                    <div className="kingdom-info">
                      <p><strong>Race:</strong> {kingdom.race}</p>
                      <p><strong>Gold:</strong> {(kingdom.resources as KingdomResources)?.gold || 0}</p>
                      <p><strong>Population:</strong> {(kingdom.resources as KingdomResources)?.population || 0}</p>
                      <p><strong>Land:</strong> {(kingdom.resources as KingdomResources)?.land || 0}</p>
                      <p><strong>Turns:</strong> {(kingdom.resources as KingdomResources)?.turns || 0}</p>
                    </div>
                    <div className="kingdom-actions">
                      <button 
                        className="enter-kingdom-btn"
                        onClick={() => handleEnterKingdom(kingdom)}
                      >
                        Enter Kingdom
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="next-steps">
              <h3>🚧 Epic 4: Combat System - COMPLETE ✅</h3>
              <ul>
                <li>✅ Combat interface with attack planning</li>
                <li>✅ Defense management system</li>
                <li>✅ Battle reports and history</li>
                <li>✅ Real-time combat notifications</li>
                <li>✅ Backend integration with Lambda functions</li>
                <li>✅ Comprehensive testing suite</li>
              </ul>
            </div>
          </div>
        );
    }
  };

  // Show welcome page if not authenticated and not in demo mode
  if (!showAuth && !demoMode) {
    return <WelcomePage onGetStarted={handleGetStarted} />;
  }

  // Demo mode - skip authentication
  if (demoMode) {
    return (
      <main className="app">
        <header className="app-header">
          <h1>🏰 Monarchy Game - Demo Mode</h1>
          <div className="user-info">
            <span>Demo Player</span>
            <button 
              onClick={() => {
                localStorage.removeItem('demo-mode');
                window.location.reload();
              }} 
              className="sign-out-btn"
            >
              Exit Demo
            </button>
          </div>
        </header>
        
        <div className="game-content">
          {renderGameContent()}
        </div>
      </main>
    );
  }

  // Authenticated app component
  const AuthenticatedApp = ({ user, signOut }: { user: any, signOut: () => void }) => {
    useEffect(() => {
      if (user && user !== currentUser) {
        setCurrentUser(user);
      }
    }, [user]);

    return (
      <main className="app">
        <header className="app-header">
          <h1>🏰 Monarchy Game</h1>
          <div className="user-info">
            <span>Welcome, {user?.attributes?.preferred_username || user?.attributes?.email}</span>
            <button onClick={signOut} className="sign-out-btn">
              Sign Out
            </button>
          </div>
        </header>
        
        <div className="game-content">
          {renderGameContent()}
        </div>
      </main>
    );
  };

  // Show authenticated game
  return (
    <Authenticator
      signUpAttributes={['email', 'preferred_username', 'given_name', 'family_name']}
      loginMechanisms={['email']}
    >
      {({ signOut, user }: AuthenticatorProps) => (
        <AuthenticatedApp user={user} signOut={signOut} />
      )}
    </Authenticator>
  );
}

export default App;
