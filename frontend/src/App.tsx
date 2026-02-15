import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { Authenticator, ThemeProvider } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import { Toaster } from 'react-hot-toast';
import { fetchUserAttributes, fetchAuthSession } from 'aws-amplify/auth';
import type { AuthUser } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';
import outputs from './amplify-config';
import { monarchyAuthTheme, monarchyFormFields, monarchyAuthComponents } from './themes/authenticatorTheme';
import { AppRouter } from './AppRouter';
import { RACES } from './shared-races';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { isDemoMode, disableDemoMode } from './utils/authMode';
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
  const [username, setUsername] = useState<string>('User');
  const [hasInitialFetch, setHasInitialFetch] = useState(false);

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
    const isDemo = isDemoMode();
    setDemoMode(isDemo);

    // Fetch user attributes when user is available
    if (currentUser && !demoMode) {
      fetchUserAttributes()
        .then(attributes => {
          setUsername(attributes.preferred_username || attributes.email || 'User');
        })
        .catch(err => {
          console.error('Failed to fetch user attributes:', err);
        });
    }

    if (isDemo) {
      // Always fetch kingdoms in demo mode, even on refresh
      fetchKingdoms();
    } else {
      // Not in demo mode - stop loading and show welcome page
      setLoading(false);
    }
  }, [fetchKingdoms, currentUser, demoMode]);
  
  // Fetch kingdoms again if demoMode changes
  useEffect(() => {
    if (demoMode && kingdoms.length === 0) {
      fetchKingdoms();
    }
  }, [demoMode, fetchKingdoms, kingdoms.length]); // Add missing dependencies

  useEffect(() => {
    if (currentUser && !demoMode && !hasInitialFetch) {
      setHasInitialFetch(true);
      setLoading(true);
      setTimeout(() => {
        fetchKingdoms();
      }, 1000);
    }
  }, [currentUser, demoMode, hasInitialFetch, fetchKingdoms]); // Add fetchKingdoms dependency

  const handleGetStarted = () => {
    const isDemo = isDemoMode();
    if (isDemo) {
      setDemoMode(true);
      // Navigate directly instead of calling fetchKingdoms through a setTimeout.
      // The stale closure from useCallback would still have demoMode=false,
      // causing it to attempt an authenticated API call that fails in demo mode.
      const savedKingdoms = localStorage.getItem('demo-kingdoms');
      if (savedKingdoms) {
        const parsed = JSON.parse(savedKingdoms);
        setKingdoms(parsed);
        navigate('/kingdoms');
      } else {
        navigate('/creation');
      }
    } else {
      setShowAuth(true);
    }
  };

  const handleKingdomCreated = async (kingdomName: string, race: string) => {
    const isDemo = isDemoMode();

    if (isDemo) {
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
      navigate('/kingdoms');
    } else {
      // For authenticated users, create kingdom in database
      try {
        setLoading(true);
        
        // Wait for auth session to be ready (retry up to 5 times with 2s delay)
        let session = null;
        let retries = 5;
        
        while (retries > 0) {
          try {
            session = await fetchAuthSession({ forceRefresh: true });

            if (session.tokens) {
              break;
            }
          } catch (authError) {
            console.error('Auth session error:', authError);
          }

          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            retries--;
          }
        }
        
        if (!session?.tokens) {
          throw new Error('Please sign out and sign in again, then try creating your kingdom.');
        }
        
        const raceName = race.charAt(0).toUpperCase() + race.slice(1).toLowerCase();
        const raceData = RACES[raceName];
        const startingResources = raceData?.startingResources || {
          gold: 2000,
          population: 1000,
          land: 500,
          turns: 50
        };

        const newKingdom = await client.models.Kingdom.create({
          name: kingdomName || 'New Kingdom',
          race: raceName,
          resources: startingResources,
          stats: {},
          buildings: {},
          totalUnits: {},
          currentAge: 'early',
          isActive: true,
          isOnline: true
        });

        if (newKingdom.data) {
          // Add to local state
          setKingdoms(prev => [...prev, newKingdom.data]);
          navigate('/kingdoms');
        } else if (newKingdom.errors) {
          throw new Error(`Failed to create kingdom: ${newKingdom.errors.map((e: { message: string }) => e.message).join(', ')}`);
        } else {
          throw new Error('Kingdom creation failed. Please try again.');
        }
      } catch (error) {
        console.error('Failed to create kingdom:', error);
        alert(`Failed to create kingdom: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
        // Stay on creation page if failed
      } finally {
        setLoading(false);
      }
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
                disableDemoMode();
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
    // Check if user is trying to access protected routes directly
    const currentPath = window.location.pathname;
    const protectedRoutes = ['/creation', '/kingdoms', '/kingdom'];
    const isProtectedRoute = protectedRoutes.some(route => currentPath.startsWith(route));
    
    if (isProtectedRoute) {
      // Show loading while checking auth, then redirect to auth
      if (loading) {
        return (
          <div className="loading">
            <p>Loading...</p>
          </div>
        );
      }
      setShowAuth(true);
      return null; // Prevent flash of content
    }
    
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

    // Create a wrapper for handleKingdomCreated that uses the user prop directly
    const handleKingdomCreatedWithAuth = async (kingdomName: string, race: string) => {
      const isDemo = isDemoMode();

      if (isDemo) {
        return handleKingdomCreated(kingdomName, race);
      }
      
      // For authenticated users, verify user exists before proceeding
      if (!user) {
        alert('Authentication required. Please sign in again.');
        return;
      }
      
      // Call original handler
      return handleKingdomCreated(kingdomName, race);
    };

    return (
      <main className="app">
        <Toaster />
        <header className="app-header">
          <h1>🏰 Monarchy Game</h1>
          <div className="user-info">
            <span>Welcome, {username}</span>
            <button onClick={signOut} className="sign-out-btn">
              Sign Out
            </button>
          </div>
        </header>
        
        <div className="game-content">
          <ErrorBoundary>
            <AppRouter 
              kingdoms={kingdoms}
              onGetStarted={handleGetStarted}
              onKingdomCreated={handleKingdomCreatedWithAuth}
            />
          </ErrorBoundary>
        </div>
      </main>
    );
  };

  return (
    <ThemeProvider theme={monarchyAuthTheme}>
      <Authenticator
        formFields={monarchyFormFields}
        components={monarchyAuthComponents}
        signUpAttributes={['email', 'preferred_username']}
        loginMechanisms={['email']}
      >
        {({ signOut, user }) => (
          <AuthenticatedApp user={user} signOut={signOut} />
        )}
      </Authenticator>
    </ThemeProvider>
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
