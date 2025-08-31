import { useEffect, useState } from 'react';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import '@aws-amplify/ui-react/styles.css';
import outputs from '../amplify_outputs.json';
import { KingdomCreation } from './components/KingdomCreation';
import './App.css';
import './components/KingdomCreation.css';
import type { Schema } from '../../amplify/data/resource';
import type { AuthenticatorProps, KingdomResources } from './types/amplify';

Amplify.configure(outputs);
const client = generateClient<Schema>();

function App() {
  const [kingdoms, setKingdoms] = useState<Schema['Kingdom']['type'][]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreation, setShowCreation] = useState(false);

  const fetchKingdoms = async () => {
    try {
      const { data } = await client.models.Kingdom.list();
      setKingdoms(data);
      setShowCreation(data.length === 0);
    } catch (error) {
      console.error('Failed to fetch kingdoms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKingdomCreated = () => {
    setShowCreation(false);
    fetchKingdoms();
  };

  useEffect(() => {
    fetchKingdoms();
  }, []);

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
              <span>Welcome, {user.attributes.preferred_username || user.attributes.email}</span>
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
            ) : showCreation ? (
              <KingdomCreation onKingdomCreated={handleKingdomCreated} />
            ) : (
              <div className="kingdom-management">
                <div className="kingdoms-header">
                  <h2>Your Kingdoms</h2>
                  <button 
                    className="create-new-btn"
                    onClick={() => setShowCreation(true)}
                  >
                    Create New Kingdom
                  </button>
                </div>

                {kingdoms.length === 0 ? (
                  <div className="no-kingdoms">
                    <p>You haven't created any kingdoms yet.</p>
                    <button 
                      className="create-first-btn"
                      onClick={() => setShowCreation(true)}
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
                          <button className="enter-kingdom-btn">
                            Enter Kingdom
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="next-steps">
                  <h3>🚧 Epic 2: Core Game Data Models - COMPLETE ✅</h3>
                  <ul>
                    <li>✅ Kingdom and Territory data models</li>
                    <li>✅ Race selection with stats and abilities</li>
                    <li>✅ Kingdom creation interface</li>
                    <li>✅ Resource management foundation</li>
                    <li>⏳ Territory management interface</li>
                    <li>⏳ Combat system implementation</li>
                    <li>⏳ Real-time features</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </main>
      )}
    </Authenticator>
  );
}

export default App;
