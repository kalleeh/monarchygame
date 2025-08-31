import { useEffect, useState } from 'react';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import '@aws-amplify/ui-react/styles.css';
import outputs from '../amplify_outputs.json';
import { KingdomCreation } from './components/KingdomCreation';
import { KingdomDashboard } from './components/KingdomDashboard';
import { TerritoryManagement } from './components/TerritoryManagement';
import './App.css';
import './components/KingdomCreation.css';
import './components/KingdomDashboard.css';
import './components/TerritoryManagement.css';
import type { Schema } from '../../amplify/data/resource';
import type { AuthenticatorProps, KingdomResources } from './types/amplify';

Amplify.configure(outputs);
const client = generateClient<Schema>();

type AppView = 'kingdoms' | 'creation' | 'dashboard' | 'territories';

function App() {
  const [kingdoms, setKingdoms] = useState<Schema['Kingdom']['type'][]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>('kingdoms');
  const [selectedKingdom, setSelectedKingdom] = useState<Schema['Kingdom']['type'] | null>(null);

  const fetchKingdoms = async () => {
    try {
      const { data } = await client.models.Kingdom.list();
      setKingdoms(data);
      if (data.length === 0) {
        setCurrentView('creation');
      }
    } catch (error) {
      console.error('Failed to fetch kingdoms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKingdomCreated = () => {
    setCurrentView('kingdoms');
    fetchKingdoms();
  };

  const handleEnterKingdom = (kingdom: Schema['Kingdom']['type']) => {
    setSelectedKingdom(kingdom);
    setCurrentView('dashboard');
  };

  const handleManageTerritories = () => {
    setCurrentView('territories');
  };

  const handleBackToKingdoms = () => {
    setCurrentView('kingdoms');
    setSelectedKingdom(null);
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
  };

  useEffect(() => {
    fetchKingdoms();
  }, []);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'creation':
        return <KingdomCreation onKingdomCreated={handleKingdomCreated} />;
      
      case 'dashboard':
        return selectedKingdom ? (
          <KingdomDashboard 
            kingdom={selectedKingdom} 
            onBack={handleBackToKingdoms}
          />
        ) : null;
      
      case 'territories':
        return selectedKingdom ? (
          <TerritoryManagement 
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
              <h3>🚧 Epic 3: Kingdom Management Interface - IN PROGRESS ⏳</h3>
              <ul>
                <li>✅ Kingdom overview dashboard</li>
                <li>✅ Resource management display</li>
                <li>✅ Territory management interface</li>
                <li>✅ Race abilities and stats display</li>
                <li>⏳ Building and unit management</li>
                <li>⏳ Combat system integration</li>
                <li>⏳ Real-time updates</li>
              </ul>
            </div>
          </div>
        );
    }
  };

  return (
    <Authenticator
      signUpAttributes={['email', 'preferred_username', 'given_name', 'family_name']}
      loginMechanisms={['email']}
    >
      {({ signOut, user }: AuthenticatorProps) => (
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
            {loading ? (
              <div className="loading">
                <p>Loading your kingdoms...</p>
              </div>
            ) : (
              renderCurrentView()
            )}
          </div>
        </main>
      )}
    </Authenticator>
  );
}

export default App;
