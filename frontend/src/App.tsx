import { useEffect, useState } from 'react';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import outputs from '../amplify_outputs.json';
import './App.css';

Amplify.configure(outputs);

function App() {
  return (
    <Authenticator
      signUpAttributes={['email', 'preferred_username', 'given_name', 'family_name']}
      loginMechanisms={['email']}
    >
      {({ signOut, user }) => (
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
            <div className="kingdom-overview">
              <h2>Your Kingdom</h2>
              <p>Welcome to the modernized Monarchy game! Your kingdom awaits your command.</p>
              
              <div className="user-details">
                <h3>Player Information</h3>
                <ul>
                  <li><strong>Username:</strong> {user?.attributes?.preferred_username}</li>
                  <li><strong>Email:</strong> {user?.attributes?.email}</li>
                  <li><strong>Name:</strong> {user?.attributes?.given_name} {user?.attributes?.family_name}</li>
                  <li><strong>User ID:</strong> {user?.userId}</li>
                </ul>
              </div>

              <div className="next-steps">
                <h3>🚧 Coming Soon</h3>
                <ul>
                  <li>✅ Authentication System</li>
                  <li>⏳ Kingdom Creation</li>
                  <li>⏳ Race Selection</li>
                  <li>⏳ Resource Management</li>
                  <li>⏳ Combat System</li>
                  <li>⏳ Alliance Features</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      )}
    </Authenticator>
  );
}

export default App;
