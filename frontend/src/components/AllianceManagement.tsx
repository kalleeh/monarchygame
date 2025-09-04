/**
 * Alliance Management Component
 * Real-time alliance system with chat, invitations, and member management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AllianceService, type AllianceData, type AllianceMessage, type AllianceInvitation } from '../services/AllianceService';
import { ErrorBoundary } from './ErrorBoundary';
import type { Schema } from '../../../amplify/data/resource';

interface AllianceManagementProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
}

const AllianceManagementContent: React.FC<AllianceManagementProps> = ({ kingdom, onBack }) => {
  const [currentView, setCurrentView] = useState<'overview' | 'browse' | 'create' | 'chat'>('overview');
  const [alliances, setAlliances] = useState<AllianceData[]>([]);
  const [messages, setMessages] = useState<AllianceMessage[]>([]);
  const [invitations, setInvitations] = useState<AllianceInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [newAllianceName, setNewAllianceName] = useState('');
  const [newAllianceTag, setNewAllianceTag] = useState('');
  const [newAllianceDesc, setNewAllianceDesc] = useState('');

  // Load initial data
  useEffect(() => {
    loadAlliances();
    if (kingdom.allianceId) {
      loadAllianceMessages();
    }
  }, [kingdom.allianceId]);

  // Set up real-time subscriptions
  useEffect(() => {
    let messageSubscription: any;
    let invitationSubscription: any;

    try {
      if (kingdom.allianceId) {
        messageSubscription = AllianceService.subscribeToAllianceMessages(
          kingdom.allianceId,
          (message) => {
            setMessages(prev => [...prev, message]);
          }
        );
      }

      invitationSubscription = AllianceService.subscribeToInvitations(
        kingdom.id,
        (invitation) => {
          setInvitations(prev => [...prev, invitation]);
        }
      );

      return () => {
        try {
          messageSubscription?.unsubscribe();
          invitationSubscription?.unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing:', error);
        }
      };
    } catch (error) {
      console.error('Error setting up subscriptions:', error);
    }
  }, [kingdom.allianceId, kingdom.id]);

  const loadAlliances = useCallback(async () => {
    try {
      setLoading(true);
      const data = await AllianceService.getPublicAlliances();
      setAlliances(data);
    } catch (error) {
      console.error('Failed to load alliances:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllianceMessages = useCallback(async () => {
    if (!kingdom.allianceId) return;
    
    try {
      const data = await AllianceService.getAllianceMessages(kingdom.allianceId);
      setMessages(data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, [kingdom.allianceId]);

  const handleCreateAlliance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAllianceName.trim() || !newAllianceTag.trim()) return;

    try {
      setLoading(true);
      await AllianceService.createAlliance({
        name: newAllianceName.trim(),
        tag: newAllianceTag.trim().toUpperCase(),
        description: newAllianceDesc.trim() || undefined,
      });
      
      setNewAllianceName('');
      setNewAllianceTag('');
      setNewAllianceDesc('');
      setCurrentView('overview');
      await loadAlliances();
    } catch (error) {
      console.error('Failed to create alliance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinAlliance = async (allianceId: string) => {
    try {
      setLoading(true);
      await AllianceService.joinAlliance(allianceId, kingdom.id);
      setCurrentView('overview');
    } catch (error) {
      console.error('Failed to join alliance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !kingdom.allianceId) return;

    try {
      await AllianceService.sendAllianceMessage({
        allianceId: kingdom.allianceId,
        content: newMessage.trim(),
      });
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const currentAlliance = alliances.find(a => a.id === kingdom.allianceId);

  return (
    <div className="alliance-management">
      <header className="alliance-header">
        <button className="back-btn" onClick={onBack}>
          ← Back to Kingdom
        </button>
        <h2>🤝 Alliance Management</h2>
      </header>

      <nav className="alliance-nav">
        <button 
          className={currentView === 'overview' ? 'active' : ''}
          onClick={() => setCurrentView('overview')}
        >
          Overview
        </button>
        <button 
          className={currentView === 'browse' ? 'active' : ''}
          onClick={() => setCurrentView('browse')}
        >
          Browse Alliances
        </button>
        <button 
          className={currentView === 'create' ? 'active' : ''}
          onClick={() => setCurrentView('create')}
        >
          Create Alliance
        </button>
        {kingdom.allianceId && (
          <button 
            className={currentView === 'chat' ? 'active' : ''}
            onClick={() => setCurrentView('chat')}
          >
            Alliance Chat
          </button>
        )}
      </nav>

      <main className="alliance-content">
        {currentView === 'overview' && (
          <div className="alliance-overview">
            {currentAlliance ? (
              <div className="current-alliance">
                <div className="alliance-info">
                  <h3>[{currentAlliance.tag}] {currentAlliance.name}</h3>
                  <p>{currentAlliance.description}</p>
                  <div className="alliance-stats">
                    <span>Members: {currentAlliance.memberCount}/{currentAlliance.maxMembers}</span>
                    <span>Power: {currentAlliance.totalPower.toLocaleString()}</span>
                    <span>Leader: {currentAlliance.leaderName}</span>
                  </div>
                </div>
                <div className="alliance-actions">
                  <button 
                    className="leave-btn"
                    onClick={() => AllianceService.leaveAlliance(kingdom.id)}
                  >
                    Leave Alliance
                  </button>
                </div>
              </div>
            ) : (
              <div className="no-alliance">
                <h3>You are not in an alliance</h3>
                <p>Join an alliance to access shared resources, coordinate attacks, and chat with allies.</p>
                <div className="alliance-benefits">
                  <h4>Alliance Benefits:</h4>
                  <ul>
                    <li>🛡️ Mutual defense pacts</li>
                    <li>💬 Real-time alliance chat</li>
                    <li>⚔️ Coordinated warfare</li>
                    <li>📊 Shared intelligence</li>
                    <li>🤝 Resource sharing</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {currentView === 'browse' && (
          <div className="browse-alliances">
            <h3>Public Alliances</h3>
            {loading ? (
              <div className="loading">Loading alliances...</div>
            ) : (
              <div className="alliances-grid">
                {alliances.map(alliance => (
                  <div key={alliance.id} className="alliance-card">
                    <div className="alliance-header">
                      <h4>[{alliance.tag}] {alliance.name}</h4>
                      <span className="member-count">
                        {alliance.memberCount}/{alliance.maxMembers}
                      </span>
                    </div>
                    <p className="alliance-description">
                      {alliance.description || 'No description provided'}
                    </p>
                    <div className="alliance-stats">
                      <span>Power: {alliance.totalPower.toLocaleString()}</span>
                      <span>Leader: {alliance.leaderName}</span>
                    </div>
                    <button 
                      className="join-btn"
                      onClick={() => handleJoinAlliance(alliance.id)}
                      disabled={loading || alliance.memberCount >= alliance.maxMembers}
                    >
                      {alliance.memberCount >= alliance.maxMembers ? 'Full' : 'Join Alliance'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === 'create' && (
          <div className="create-alliance">
            <h3>Create New Alliance</h3>
            <form onSubmit={handleCreateAlliance} className="alliance-form">
              <div className="form-group">
                <label htmlFor="alliance-name">Alliance Name</label>
                <input
                  id="alliance-name"
                  type="text"
                  value={newAllianceName}
                  onChange={(e) => setNewAllianceName(e.target.value)}
                  placeholder="Enter alliance name"
                  maxLength={50}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="alliance-tag">Alliance Tag (3-5 characters)</label>
                <input
                  id="alliance-tag"
                  type="text"
                  value={newAllianceTag}
                  onChange={(e) => setNewAllianceTag(e.target.value.toUpperCase())}
                  placeholder="TAG"
                  maxLength={5}
                  minLength={3}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="alliance-desc">Description (Optional)</label>
                <textarea
                  id="alliance-desc"
                  value={newAllianceDesc}
                  onChange={(e) => setNewAllianceDesc(e.target.value)}
                  placeholder="Describe your alliance's goals and values"
                  maxLength={500}
                  rows={4}
                />
              </div>
              
              <button type="submit" disabled={loading} className="create-btn">
                {loading ? 'Creating...' : 'Create Alliance'}
              </button>
            </form>
          </div>
        )}

        {currentView === 'chat' && kingdom.allianceId && (
          <div className="alliance-chat">
            <div className="chat-header">
              <h3>Alliance Chat - [{currentAlliance?.tag}]</h3>
            </div>
            
            <div className="chat-messages">
              {messages.map(message => (
                <div 
                  key={message.id} 
                  className={`message ${message.messageType.toLowerCase()}`}
                >
                  <div className="message-header">
                    <span className="sender">{message.senderName}</span>
                    <span className="timestamp">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="message-content">{message.content}</div>
                </div>
              ))}
            </div>
            
            <form onSubmit={handleSendMessage} className="chat-input">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                maxLength={500}
              />
              <button type="submit" disabled={!newMessage.trim()}>
                Send
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

export const AllianceManagement: React.FC<AllianceManagementProps> = (props) => {
  return (
    <ErrorBoundary fallback={
      <div className="alliance-error">
        <h2>🤝 Alliance System Temporarily Unavailable</h2>
        <p>We're working on getting the alliance system back online.</p>
        <button onClick={props.onBack}>← Back to Kingdom</button>
      </div>
    }>
      <AllianceManagementContent {...props} />
    </ErrorBoundary>
  );
};
