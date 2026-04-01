import React, { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { Toaster } from 'react-hot-toast';
import { fetchUserAttributes, fetchAuthSession } from 'aws-amplify/auth';
import type { AuthUser } from 'aws-amplify/auth';
import outputs from './amplify-config';
import { AppRouter } from './AppRouter';
import { RACES } from './shared-races';
import { normalizeRace } from './utils/raceUtils';
import { STORAGE_KEYS } from './constants/storageKeys';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { isDemoMode, disableDemoMode } from './utils/authMode';
import { getActiveSeason } from './services/domain/SeasonService';
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
import { useAITick } from './hooks/useAITick';

// @aws-amplify/ui-react (Authenticator + ThemeProvider + CSS) is lazy-loaded
// so it doesn't ship in the initial bundle for the welcome / demo-mode pages.
const AuthProvider = lazy(() => import('./AuthProvider'));

// Defined at module scope to satisfy Rules of Hooks — must not be inside another
// component's render function, otherwise its hooks re-run on every parent render.
interface AuthenticatedAppProps {
  user: AuthUser | undefined;
  signOut?: () => void;
  username: string;
  isAdminUser: boolean;
  kingdoms: Schema['Kingdom']['type'][];
  kingdomsLoading: boolean;
  currentUser: AuthUser | null;
  setCurrentUser: (user: AuthUser) => void;
  handleGetStarted: () => void;
  handleKingdomCreated: (kingdomName: string, race: string) => Promise<void>;
  navigate: ReturnType<typeof useNavigate>;
}

const AuthenticatedApp = React.memo(function AuthenticatedApp({
  user,
  signOut,
  username,
  isAdminUser,
  kingdoms,
  kingdomsLoading,
  currentUser,
  setCurrentUser,
  handleGetStarted,
  handleKingdomCreated,
  navigate,
}: AuthenticatedAppProps) {
  useEffect(() => {
    if (user && user !== currentUser) {
      setCurrentUser(user as AuthUser);
    }
  }, [user, currentUser, setCurrentUser]);

  const handleKingdomCreatedWithAuth = async (kingdomName: string, race: string) => {
    const isDemo = isDemoMode();
    if (isDemo) {
      return handleKingdomCreated(kingdomName, race);
    }
    if (!user) {
      alert('Authentication required. Please sign in again.');
      return;
    }
    return handleKingdomCreated(kingdomName, race);
  };

  return (
    <main className="app">
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1a1a2e',
            color: '#e8d5a3',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            borderRadius: '8px',
            fontSize: '0.875rem',
            padding: '10px 14px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#1a1a2e' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#1a1a2e' },
          },
          duration: 4000,
        }}
      />
      <div className="app-utility-bar">
        <span className="utility-bar-label">Welcome, {username}</span>
        {isAdminUser && (
          <button
            className="utility-bar-btn utility-bar-btn--admin"
            onClick={() => navigate('/admin')}
            title="Admin Dashboard"
          >
            ⚙ Admin
          </button>
        )}
        <button onClick={signOut} className="utility-bar-btn utility-bar-btn--signout">
          Sign Out
        </button>
      </div>

      <div className="game-content">
        <ErrorBoundary>
          <AppRouter
            kingdoms={kingdoms}
            kingdomsLoading={kingdomsLoading}
            onGetStarted={handleGetStarted}
            onKingdomCreated={handleKingdomCreatedWithAuth}
          />
        </ErrorBoundary>
      </div>
    </main>
  );
});

Amplify.configure(outputs);
let _client: ReturnType<typeof generateClient<Schema>> | null = null;
const getClient = () => { if (!_client) _client = generateClient<Schema>(); return _client; };

function AppContent() {
  const navigate = useNavigate();
  useInitializeAchievements();
  useAITick();
  const [kingdoms, setKingdoms] = useState<Schema['Kingdom']['type'][]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [username, setUsername] = useState<string>('User');
  const [hasInitialFetch, setHasInitialFetch] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  // FE-7: guard against concurrent in-flight fetches
  const fetchingRef = useRef(false);

  const fetchKingdoms = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      if (demoMode) {
        // Demo mode - check if kingdoms exist in localStorage
        const savedKingdoms = localStorage.getItem(STORAGE_KEYS.DEMO_KINGDOMS);
        if (savedKingdoms) {
          let kingdoms: Schema['Kingdom']['type'][] = [];
          try { kingdoms = JSON.parse(savedKingdoms); } catch { kingdoms = []; }
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
      
      // Get current user identity to filter to only their kingdoms
      const session = await fetchAuthSession();
      const sub = (session.tokens?.accessToken?.payload?.sub ?? '') as string;
      const cognitoUsername = (session.tokens?.accessToken?.payload?.username ?? '') as string;

      // Bail if we can't identify the user — prevents overwriting good state with unfiltered results
      if (!sub && !cognitoUsername) {
        setLoading(false);
        return;
      }

      // No API filter — isAI: { ne: true } excludes records where isAI is null (DynamoDB
      // behaviour: missing attributes fail comparison conditions). Instead filter client-side
      // using the owner field which reliably identifies the current user's kingdoms.
      // AI kingdoms have owner: 'system', real kingdoms have owner: '{sub}'.
      // limit: 1000 ensures all kingdoms are returned (default page size is 100).
      const { data } = await getClient().models.Kingdom.list({ limit: 1000 });

      const myKingdoms = data.filter(k => {
        const owner = ((k as Record<string, unknown>).owner as string) ?? '';
        return (sub && owner.includes(sub)) || (cognitoUsername && owner.includes(cognitoUsername));
      });
      setKingdoms(myKingdoms);

      // Use myKingdoms.length for navigation (not data.length — raw data includes AI kingdoms)
      if (window.location.pathname === '/') {
        if (myKingdoms.length === 0) {
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
      fetchingRef.current = false;
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
          // Check admin access
          const email = attributes.email || '';
          const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '')
            .split(',')
            .map((e: string) => e.trim())
            .filter(Boolean);
          setIsAdminUser(adminEmails.includes(email));
        })
        .catch(err => {
          console.error('Failed to fetch user attributes:', err);
        });
    }

    if (isDemo) {
      // Always fetch kingdoms in demo mode, even on refresh
      fetchKingdoms();
    } else {
      // Auth mode: release loading so the welcome/auth screen shows.
      // KingdomRoutes uses a cancellable timeout so the brief loading=false window
      // (before Cognito resolves ~100ms later) doesn't cause a premature redirect.
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
      fetchKingdoms();
    }
  }, [currentUser, demoMode, hasInitialFetch, fetchKingdoms]); // Add fetchKingdoms dependency

  // FE-1: move protected-route auth redirect out of render path
  useEffect(() => {
    if (!showAuth && !demoMode && !loading) {
      const currentPath = window.location.pathname;
      const protectedRoutes = ['/creation', '/kingdoms', '/kingdom'];
      const isProtectedRoute = protectedRoutes.some(route => currentPath.startsWith(route));
      if (isProtectedRoute) {
        setShowAuth(true);
      }
    }
  }, [showAuth, demoMode, loading]);

  const handleGetStarted = () => {
    const isDemo = isDemoMode();
    if (isDemo) {
      setDemoMode(true);
      // Navigate directly instead of calling fetchKingdoms through a setTimeout.
      // The stale closure from useCallback would still have demoMode=false,
      // causing it to attempt an authenticated API call that fails in demo mode.
      const savedKingdoms = localStorage.getItem(STORAGE_KEYS.DEMO_KINGDOMS);
      if (savedKingdoms) {
        let parsed: Schema['Kingdom']['type'][] = [];
        try { parsed = JSON.parse(savedKingdoms); } catch { parsed = []; }
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
      const raceName = normalizeRace(race);
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
      const savedKingdoms = localStorage.getItem(STORAGE_KEYS.DEMO_KINGDOMS);
      let existingKingdoms: Schema['Kingdom']['type'][] = [];
      if (savedKingdoms) {
        try { existingKingdoms = JSON.parse(savedKingdoms); } catch { existingKingdoms = []; }
      }
      const updatedKingdoms = [...existingKingdoms, newKingdom];

      // Save updated kingdoms array
      localStorage.setItem(STORAGE_KEYS.DEMO_KINGDOMS, JSON.stringify(updatedKingdoms));

      // Save kingdom-specific data
      localStorage.setItem(STORAGE_KEYS.KINGDOM(newKingdom.id), JSON.stringify({
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
        
        const raceName = normalizeRace(race);
        const raceData = RACES[raceName];
        const startingResources = raceData?.startingResources || {
          gold: 2000,
          population: 1000,
          land: 500,
          turns: 50
        };

        // Get active season ID for the new kingdom
        let activeSeasonId: string | null = null;
        try {
          const seasonResult = await getActiveSeason('new');
          const data = (seasonResult as any)?.data ?? seasonResult;
          if (data?.success && data?.season?.id) {
            activeSeasonId = data.season.id;
          }
        } catch {
          // Non-fatal — kingdom can exist without a season
        }

        const newKingdom = await getClient().models.Kingdom.create({
          name: kingdomName || 'New Kingdom',
          race: raceName as "Human" | "Elven" | "Goblin" | "Droben" | "Vampire" | "Elemental" | "Centaur" | "Sidhe" | "Dwarven" | "Fae",
          resources: JSON.stringify(startingResources),
          stats: JSON.stringify({}),
          buildings: JSON.stringify({}),
          totalUnits: JSON.stringify({}),
          currentAge: 'early',
          isActive: true,
          isOnline: true,
          ...(activeSeasonId ? { seasonId: activeSeasonId } : {})
        });

        if (newKingdom.data) {
          // Create the Royal Capital territory for this kingdom
          try {
            await getClient().models.Territory.create({
              name: 'Royal Capital',
              type: 'capital',
              coordinates: JSON.stringify({ x: 0, y: 0 }),
              terrainType: 'plains',
              resources: JSON.stringify({ gold: 1000, population: 500, land: 100 }),
              buildings: JSON.stringify({}),
              defenseLevel: 1,
              kingdomId: newKingdom.data.id,
            });
          } catch {
            // Non-fatal — kingdom still works without capital territory record
          }
          // Add to local state
          setKingdoms(prev => [...prev, newKingdom.data].filter(Boolean) as typeof prev);
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
        <div className="app-utility-bar">
          <span className="utility-bar-label">Demo Mode</span>
          <button
            className="utility-bar-btn utility-bar-btn--admin"
            onClick={() => navigate('/admin')}
            title="Admin Dashboard"
          >
            ⚙ Admin
          </button>
          <button
            onClick={() => {
              // Clear all demo data
              const savedKingdoms = localStorage.getItem(STORAGE_KEYS.DEMO_KINGDOMS);
              if (savedKingdoms) {
                let kingdoms: Schema['Kingdom']['type'][] = [];
                try { kingdoms = JSON.parse(savedKingdoms); } catch { kingdoms = []; }
                kingdoms.forEach((k: Schema['Kingdom']['type']) => {
                  localStorage.removeItem(STORAGE_KEYS.KINGDOM(k.id));
                });
              }
              disableDemoMode();
              localStorage.removeItem(STORAGE_KEYS.DEMO_KINGDOMS);
              localStorage.removeItem(STORAGE_KEYS.TUTORIAL_PROGRESS);
              window.location.href = '/';
            }}
            className="utility-bar-btn"
          >
            Exit Demo
          </button>
        </div>

        <div className="game-content">
          <AppRouter
            kingdoms={kingdoms}
            kingdomsLoading={loading}
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
        kingdomsLoading={loading}
        onGetStarted={handleGetStarted}
        onKingdomCreated={handleKingdomCreated}
      />
    );
  }

  return (
    <Suspense fallback={<div className="loading"><p>Loading...</p></div>}>
      <AuthProvider>
        {({ signOut, user }) => (
          <AuthenticatedApp
            user={user}
            signOut={signOut}
            username={username}
            isAdminUser={isAdminUser}
            kingdoms={kingdoms}
            kingdomsLoading={loading}
            currentUser={currentUser}
            setCurrentUser={(u) => setCurrentUser(u)}
            handleGetStarted={handleGetStarted}
            handleKingdomCreated={handleKingdomCreated}
            navigate={navigate}
          />
        )}
      </AuthProvider>
    </Suspense>
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
