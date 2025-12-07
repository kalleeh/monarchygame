import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import { Toaster } from 'react-hot-toast';
import type { AuthUser } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';
import outputs from '../amplify_outputs.json';
import { AppRouter } from './AppRouter';
import { RACES } from '@shared/races';
import './App.css';
import './components/KingdomCreation.css';
import './components/KingdomDashboard.css';
import './components/TerritoryManagement.css';
import './components/WelcomePage.css';
import './components/TopNavigation.css';
import './components/TerritoryExpansion.css';
import './components/BattleFormations.css';
import './components/SpellCastingInterface.css';
import './components/TradeSystem.css';
import './components/UnitSummonInterface.css';
import './components/DiplomacyInterface.css';
import './styles/game-pages.css';
import type { Schema } from '../../amplify/data/resource';
import { TutorialOverlay } from './components/tutorial/TutorialOverlay';
import { useInitializeAchievements } from './hooks/useInitializeAchievements';

Amplify.configure(outputs);
const client = generateClient<Schema>();

function AppContent() {
  const navigate = useNavigate();
  useInitializeAchievements();
  const [kingdoms, setKingdoms] = useState<Schema['Kingdom']['type'][]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const fetchKingdoms = useCallback(async () => {
    try {
      if (demoMode) {
        // Demo mode - check if kingdoms exist in localStorage
        const savedKingdoms = localStorage.getItem('demo-kingdoms');
        if (savedKingdoms) {
          const kingdoms = JSON.parse(savedKingdoms);
          setKingdoms(kingdoms);
          
          // Navigate to kingdoms list if on root
          if (window.location.pathname === '/') {
            navigate('/kingdoms');
          }
        } else {
          // No saved kingdoms - go to creation
          if (window.location.pathname === '/') {
            navigate('/creation');
          }
        }
        
        setLoading(false);
        return;
      }
      
      const { data } = await client.models.Kingdom.list();
      setKingdoms(data);
      
      // Only navigate if we're on the root path
      if (window.location.pathname === '/') {
        if (data.length === 0) {
          navigate('/creation');
        } else {
          navigate('/kingdoms');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('NoValidAuthTokens') && !errorMessage.includes('No federated jwt')) {
        console.error('Failed to fetch kingdoms:', error);
      }
      setKingdoms([]);
      
      // Only navigate if we're on the root path
      if (window.location.pathname === '/') {
        navigate('/creation');
      }
    } finally {
      setLoading(false);
    }
  }, [demoMode, navigate]);

  useEffect(() => {
    const isDemoMode = localStorage.getItem('demo-mode') === 'true';
    setDemoMode(isDemoMode);
    
    if (isDemoMode) {
      // Always fetch kingdoms in demo mode, even on refresh
      fetchKingdoms();
    } else {
      // Not in demo mode - stop loading and show welcome page
      setLoading(false);
    }
  }, []); // Empty deps - only run once on mount
  
  // Fetch kingdoms again if demoMode changes
  useEffect(() => {
    if (demoMode && kingdoms.length === 0) {
      fetchKingdoms();
    }
  }, [demoMode, kingdoms.length, fetchKingdoms]);

  useEffect(() => {
    if (currentUser && !demoMode) {
      setLoading(true);
      setTimeout(() => {
        fetchKingdoms();
      }, 1000);
    }
  }, [currentUser, demoMode, fetchKingdoms]);

  const handleGetStarted = () => {
    const isDemoMode = localStorage.getItem('demo-mode') === 'true';
    if (isDemoMode) {
      setDemoMode(true);
      setLoading(true);
      setTimeout(() => {
        fetchKingdoms();
      }, 100);
    } else {
      setShowAuth(true);
    }
  };

  const handleKingdomCreated = (kingdomName: string, race: string) => {
    const isDemoMode = localStorage.getItem('demo-mode') === 'true';
    
    if (isDemoMode) {
      const raceName = race.charAt(0).toUpperCase() + race.slice(1).toLowerCase();
      const raceData = RACES[raceName];
      const startingResources = raceData?.startingResources || {
        gold: 2000,
        population: 1000,
        land: 500,
        turns: 50
      };
      
      const newKingdom = {
        id: `demo-kingdom-${Date.now()}`,
        name: kingdomName || 'Demo Kingdom',
        race: raceName,
        resources: startingResources,
        stats: {},
        totalUnits: {},
        owner: 'demo-player',
        isOnline: true,
        lastActive: new Date().toISOString(),
        guildId: null
      } as Schema['Kingdom']['type'];
      
      // Get existing kingdoms or create new array
      const savedKingdoms = localStorage.getItem('demo-kingdoms');
      const existingKingdoms = savedKingdoms ? JSON.parse(savedKingdoms) : [];
      const updatedKingdoms = [...existingKingdoms, newKingdom];
      
      // Save updated kingdoms array
      localStorage.setItem('demo-kingdoms', JSON.stringify(updatedKingdoms));
      
      // Save kingdom-specific data
      localStorage.setItem(`kingdom-${newKingdom.id}`, JSON.stringify({
        resources: startingResources,
        units: []
      }));
      
      setKingdoms(updatedKingdoms);
      
      setTimeout(() => {
        navigate('/kingdoms');
      }, 100);
    } else {
      navigate('/kingdoms');
      fetchKingdoms();
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <p>Loading your kingdoms...</p>
      </div>
    );
  }

  // Demo mode
  if (demoMode) {
    return (
      <main className="app">
        <TutorialOverlay />
        <header className="app-header">
          <h1>
            <img src="/logo.png" alt="Monarchy" style={{ width: '64px', height: '64px', verticalAlign: 'middle', marginRight: '12px' }} />
            Monarchy Game - Demo Mode
          </h1>
          <div className="user-info">
            <span>Demo Player</span>
            <button 
              onClick={() => {
                // Clear all demo data
                const savedKingdoms = localStorage.getItem('demo-kingdoms');
                if (savedKingdoms) {
                  const kingdoms = JSON.parse(savedKingdoms);
                  kingdoms.forEach((k: Schema['Kingdom']['type']) => {
                    localStorage.removeItem(`kingdom-${k.id}`);
                  });
                }
                localStorage.removeItem('demo-mode');
                localStorage.removeItem('demo-kingdoms');
                localStorage.removeItem('tutorial-progress');
                window.location.href = '/';
              }} 
              className="sign-out-btn"
            >
              Exit Demo
            </button>
          </div>
        </header>
        
        <div className="game-content">
          <AppRouter 
            kingdoms={kingdoms}
            onGetStarted={handleGetStarted}
            onKingdomCreated={handleKingdomCreated}
          />
        </div>
      </main>
    );
  }

  // Show welcome or auth
  if (!showAuth && !demoMode) {
    return (
      <AppRouter 
        kingdoms={kingdoms}
        onGetStarted={handleGetStarted}
        onKingdomCreated={handleKingdomCreated}
      />
    );
  }

  // Authenticated app
  const AuthenticatedApp = ({ user, signOut }: { user: AuthUser | undefined, signOut?: () => void }) => {
    useEffect(() => {
      if (user && user !== currentUser) {
        setCurrentUser(user as AuthUser);
      }
    }, [user]);

    return (
      <main className="app">
        <Toaster />
        <header className="app-header">
          <h1>🏰 Monarchy Game</h1>
          <div className="user-info">
            <span>Welcome, {(user as any)?.attributes?.preferred_username || (user as any)?.attributes?.email || 'User'}</span>
            <button onClick={signOut} className="sign-out-btn">
              Sign Out
            </button>
          </div>
        </header>
        
        <div className="game-content">
          <AppRouter 
            kingdoms={kingdoms}
            onGetStarted={handleGetStarted}
            onKingdomCreated={handleKingdomCreated}
          />
        </div>
      </main>
    );
  };

  return (
    <Authenticator
      signUpAttributes={['email', 'preferred_username', 'given_name', 'family_name']}
      loginMechanisms={['email']}
    >
      {({ signOut, user }) => (
        <AuthenticatedApp user={user} signOut={signOut} />
      )}
    </Authenticator>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
