/**
 * Guild Management Component
 * Real-time guild system with chat, invitations, and member management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import { GuildService, type GuildData, type GuildMessage, type GuildInvitation } from '../services/GuildService';
import { AmplifyFunctionService } from '../services/amplifyFunctionService';
import { ToastService } from '../services/toastService';
import { isDemoMode } from '../utils/authMode';
import { ErrorBoundary } from './ErrorBoundary';
import { TopNavigation } from './TopNavigation';
import type { Schema } from '../../../amplify/data/resource';
import './TerritoryExpansion.css';
import './GuildManagement.css';

interface GuildManagementProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
}

const GuildManagementContent: React.FC<GuildManagementProps> = ({ kingdom, onBack }) => {
  const [currentView, setCurrentView] = useState<'overview' | 'browse' | 'create' | 'chat' | 'applications' | 'rankings' | 'wars'>('overview');
  const [guilds, setGuilds] = useState<GuildData[]>([]);
  const [messages, setMessages] = useState<GuildMessage[]>([]);
  const [invitations, setInvitations] = useState<GuildInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [newGuildName, setNewAllianceName] = useState('');
  const [newGuildTag, setNewAllianceTag] = useState('');
  const [newGuildDesc, setNewAllianceDesc] = useState('');
  const [charterPurpose, setCharterPurpose] = useState('');
  const [charterRequirements, setCharterRequirements] = useState('');
  const [charterRules, setCharterRules] = useState('');
  const [charterAutoApprove, setCharterAutoApprove] = useState(false);
  const [pendingAllianceInvitations, setPendingAllianceInvitations] = useState<Schema['AllianceInvitation']['type'][]>([]);

  const loadPendingInvitations = useCallback(async () => {
    if (isDemoMode() || !kingdom?.id) return;
    try {
      const dataClient = generateClient<Schema>();
      const { data } = await dataClient.models.AllianceInvitation.list({
        filter: { inviteeId: { eq: kingdom.id }, status: { eq: 'pending' } },
      });
      setPendingAllianceInvitations(data || []);
    } catch (error) {
      console.error('Failed to load pending invitations:', error);
    }
  }, [kingdom?.id]);

  const loadGuilds = useCallback(async () => {
    try {
      setLoading(true);
      const data = await GuildService.getPublicGuilds();
      setGuilds(data);
    } catch (error) {
      console.error('Failed to load guilds:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGuildMessages = useCallback(async () => {
    if (!kingdom.guildId) return;
    
    try {
      const data = await GuildService.getGuildMessages(kingdom.guildId);
      setMessages(data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, [kingdom.guildId]);

  // Load initial data
  useEffect(() => {
    loadGuilds();
    loadPendingInvitations();
    if (kingdom.guildId) {
      loadGuildMessages();
    }
  }, [kingdom.guildId, loadGuilds, loadGuildMessages, loadPendingInvitations]);

  // Set up real-time subscriptions
  useEffect(() => {
    let messageSubscription: { unsubscribe(): void } | null = null;
    let invitationSubscription: { unsubscribe(): void } | null = null;

    try {
      if (kingdom.guildId) {
        if (isDemoMode()) {
          // Demo mode: use GuildService mock subscription (fires on individual new messages)
          messageSubscription = GuildService.subscribeToGuildMessages(
            kingdom.guildId,
            (message) => {
              setMessages(prev => [...prev, message]);
            }
          );
        } else {
          // Auth mode: use AllianceMessage.observeQuery for full real-time sync
          const dataClient = generateClient<Schema>();
          const sub = dataClient.models.AllianceMessage.observeQuery({
            filter: { guildId: { eq: kingdom.guildId! } }
          }).subscribe({
            next: ({ items, isSynced }) => {
              if (!isSynced) return;
              const mapped: GuildMessage[] = items
                .map(item => ({
                  id: item.id,
                  guildId: item.guildId,
                  senderId: item.senderId,
                  senderName: item.senderId, // AllianceMessage has no senderName field
                  content: item.content,
                  messageType: 'CHAT' as const,
                  createdAt: item.createdAt ?? new Date().toISOString(),
                }))
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                .slice(-50); // Keep last 50 messages
              setMessages(mapped);
            },
            error: (err) => {
              console.error('[GuildManagement] Chat subscription error:', err);
            }
          });
          messageSubscription = { unsubscribe: () => sub.unsubscribe() };
        }
      }

      invitationSubscription = GuildService.subscribeToInvitations(
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
  }, [kingdom.guildId, kingdom.id]);

  const handleCreateGuild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuildName.trim() || !newGuildTag.trim()) return;

    try {
      setLoading(true);

      if (isDemoMode()) {
        // Demo mode: use GuildService (mock)
        await GuildService.createGuild({
          name: newGuildName.trim(),
          tag: newGuildTag.trim().toUpperCase(),
          description: newGuildDesc.trim() || undefined,
        });
        ToastService.success('Alliance created!');
      } else {
        // Auth mode: call the alliance-manager Lambda
        const result = await AmplifyFunctionService.callFunction('alliance-manager', {
          kingdomId: kingdom.id,
          action: 'create',
          name: newGuildName.trim(),
          description: newGuildDesc.trim() || undefined,
          isPublic: true,
        });
        const parsed = JSON.parse((result as Record<string, string>).result || '{}');
        console.log('[GuildManagement] Alliance created:', parsed);
        ToastService.success('Alliance created!');
      }

      setNewAllianceName('');
      setNewAllianceTag('');
      setNewAllianceDesc('');
      setCharterPurpose('');
      setCharterRequirements('');
      setCharterRules('');
      setCharterAutoApprove(false);
      setCurrentView('overview');
      await loadGuilds();
    } catch (error) {
      console.error('Failed to create guild:', error);
      ToastService.error('Failed to create alliance');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGuild = async (guildId: string) => {
    try {
      setLoading(true);

      if (isDemoMode()) {
        // Demo mode: use GuildService (mock)
        await GuildService.joinGuild(guildId, kingdom.id);
        ToastService.success('Joined alliance!');
      } else {
        // Auth mode: call the alliance-manager Lambda
        await AmplifyFunctionService.callFunction('alliance-manager', {
          kingdomId: kingdom.id,
          action: 'join',
          allianceId: guildId,
        });
        ToastService.success('Joined alliance!');
      }

      setCurrentView('overview');
      await loadGuilds();
    } catch (error) {
      console.error('Failed to join guild:', error);
      ToastService.error('Failed to join alliance');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !kingdom.guildId) return;

    const content = newMessage.trim();

    // Optimistic update: add to local state immediately
    const optimisticMsg: GuildMessage = {
      id: `local-${Date.now()}`,
      guildId: kingdom.guildId,
      senderId: kingdom.id,
      senderName: kingdom.name || 'Unknown',
      content,
      messageType: 'CHAT',
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');

    try {
      await GuildService.sendGuildMessage({
        guildId: kingdom.guildId,
        content,
        senderId: kingdom.id,
        senderName: kingdom.name || 'Unknown',
      });
    } catch (error) {
      console.error('[GuildManagement] Failed to send message:', error);
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    }
  };

  const handleLeaveGuild = async () => {
    if (!kingdom.guildId) return;
    try {
      setLoading(true);
      if (isDemoMode()) {
        await GuildService.leaveGuild(kingdom.id);
        ToastService.success('Left alliance');
      } else {
        await AmplifyFunctionService.callFunction('alliance-manager', {
          kingdomId: kingdom.id,
          action: 'leave',
          allianceId: kingdom.guildId,
        });
        ToastService.success('Left alliance');
      }
      setCurrentView('overview');
      await loadGuilds();
    } catch (error) {
      console.error('Failed to leave guild:', error);
      ToastService.error('Failed to leave alliance');
    } finally {
      setLoading(false);
    }
  };

  const handleKickMember = async (targetKingdomId: string) => {
    if (!kingdom.guildId) return;
    try {
      setLoading(true);
      if (isDemoMode()) {
        await GuildService.kickMember(kingdom.id, kingdom.guildId, targetKingdomId);
        ToastService.success('Member kicked');
      } else {
        await AmplifyFunctionService.callFunction('alliance-manager', {
          kingdomId: kingdom.id,
          action: 'kick',
          allianceId: kingdom.guildId,
          targetKingdomId,
        });
        ToastService.success('Member kicked');
      }
      await loadGuilds();
    } catch (error) {
      console.error('Failed to kick member:', error);
      ToastService.error('Failed to kick member');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async (targetKingdomId: string) => {
    if (!kingdom.guildId) return;
    try {
      setLoading(true);
      if (isDemoMode()) {
        await GuildService.sendInvitation({
          guildId: kingdom.guildId,
          targetKingdomId,
          targetKingdomName: targetKingdomId,
          kingdomId: kingdom.id,
        });
        ToastService.success('Invitation sent');
      } else {
        await AmplifyFunctionService.callFunction('alliance-manager', {
          kingdomId: kingdom.id,
          action: 'invite',
          allianceId: kingdom.guildId,
          targetKingdomId,
        });
        ToastService.success('Invitation sent');
      }
    } catch (error) {
      console.error('Failed to send invitation:', error);
      ToastService.error('Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async (allianceId: string) => {
    try {
      setLoading(true);
      await AmplifyFunctionService.callFunction('alliance-manager', {
        kingdomId: kingdom.id,
        action: 'join',
        allianceId,
      });
      ToastService.success('Joined alliance!');
      await loadPendingInvitations();
      await loadGuilds();
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      ToastService.error('Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineInvitation = async (allianceId: string) => {
    try {
      setLoading(true);
      await AmplifyFunctionService.callFunction('alliance-manager', {
        kingdomId: kingdom.id,
        action: 'decline',
        allianceId,
      });
      ToastService.success('Invitation declined');
      await loadPendingInvitations();
    } catch (error) {
      console.error('Failed to decline invitation:', error);
      ToastService.error('Failed to decline invitation');
    } finally {
      setLoading(false);
    }
  };

  // Expose kick/invite for future member list use (suppresses unused-var lint)
  void handleKickMember;
  void handleInviteMember;

  const currentGuild = guilds.find(a => a.id === kingdom.guildId);
  const pendingInvitations = invitations.filter(inv => inv.status === 'pending');

  return (
    <div className="guild-management" style={{ 
      backgroundColor: 'var(--bg-primary)', 
      color: 'var(--text-primary)', 
      minHeight: '100vh' 
    }}>
      <TopNavigation
        title={<><img src="/alliance-icon.png" style={{width:32,height:32,objectFit:'contain',verticalAlign:'middle',marginRight:8}} alt="" />Guild Management</>}
        subtitle={currentGuild ? `${currentGuild.name} [${currentGuild.tag}]` : 'Diplomatic Relations'}
        onBack={onBack}
        backLabel="← Back to Kingdom"
      />

      {pendingInvitations.length > 0 && (
        <div className="invitations-alert" style={{ 
          backgroundColor: 'var(--accent-primary)', 
          color: 'white',
          padding: '0.5rem 1rem',
          textAlign: 'center'
        }}>
          📨 {pendingInvitations.length} pending invitation{pendingInvitations.length !== 1 ? 's' : ''}
        </div>
      )}

      <nav className="guild-nav" style={{ 
        backgroundColor: 'var(--bg-secondary)', 
        padding: '1rem',
        borderBottom: '1px solid var(--border-primary)'
      }}>
        <button 
          className={currentView === 'overview' ? 'active' : ''}
          onClick={() => setCurrentView('overview')}
          style={{
            backgroundColor: currentView === 'overview' ? 'var(--primary)' : 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-primary)',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            marginRight: '0.5rem'
          }}
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
        {kingdom.guildId && (
          <>
            <button 
              className={currentView === 'chat' ? 'active' : ''}
              onClick={() => setCurrentView('chat')}
            >
              Guild Chat
            </button>
            <button 
              className={currentView === 'applications' ? 'active' : ''}
              onClick={() => setCurrentView('applications')}
            >
              Applications
            </button>
            <button 
              className={currentView === 'rankings' ? 'active' : ''}
              onClick={() => setCurrentView('rankings')}
            >
              Rankings
            </button>
            <button 
              className={currentView === 'wars' ? 'active' : ''}
              onClick={() => setCurrentView('wars')}
            >
              Wars
            </button>
          </>
        )}
      </nav>

      <main className="guild-content">
        {currentView === 'overview' && (
          <div className="guild-overview">
            {pendingAllianceInvitations.length > 0 && (
              <div className="pending-invitations" style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                background: 'rgba(78, 205, 196, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(78, 205, 196, 0.3)',
              }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                  Pending Invitations
                </h3>
                {pendingAllianceInvitations.map(inv => (
                  <div key={inv.id} className="invitation-card" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    background: 'var(--bg-card)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-primary)',
                    marginBottom: '0.5rem',
                  }}>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                      Invited to join alliance <strong style={{ color: 'var(--text-primary)' }}>{inv.guildId}</strong>
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button
                        onClick={() => handleAcceptInvitation(inv.guildId)}
                        disabled={loading}
                        style={{
                          backgroundColor: 'var(--success, #22c55e)',
                          color: 'white',
                          border: 'none',
                          padding: '0.375rem 0.75rem',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeclineInvitation(inv.guildId)}
                        disabled={loading}
                        style={{
                          backgroundColor: 'var(--danger, #ef4444)',
                          color: 'white',
                          border: 'none',
                          padding: '0.375rem 0.75rem',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {currentGuild ? (
              <div className="current-guild">
                <div className="guild-info">
                  <h3>[{currentGuild.tag}] {currentGuild.name}</h3>
                  <p>{currentGuild.description}</p>
                  <div className="guild-stats">
                    <span>Members: {currentGuild.memberCount}/{currentGuild.maxMembers}</span>
                    <span>Power: {currentGuild.totalPower.toLocaleString()}</span>
                    <span>Leader: {currentGuild.leaderName}</span>
                  </div>
                </div>
                <div className="guild-actions">
                  <button
                    className="leave-btn"
                    onClick={handleLeaveGuild}
                    disabled={loading}
                  >
                    {loading ? 'Leaving...' : 'Leave Alliance'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="no-guild">
                <h3>You are not in an guild</h3>
                <p>Join an guild to access shared resources, coordinate attacks, and chat with allies.</p>
                <div className="guild-benefits">
                  <h4>Guild Benefits:</h4>
                  <ul>
                    <li>🛡️ Mutual defense pacts</li>
                    <li>💬 Real-time guild chat</li>
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
          <div className="browse-guilds">
            <h3>Public Alliances</h3>
            {loading ? (
              <div className="loading">Loading guilds...</div>
            ) : (
              <div className="guilds-grid">
                {guilds.map(guild => (
                  <div key={guild.id} className="guild-card">
                    <div className="guild-header">
                      <h4>[{guild.tag}] {guild.name}</h4>
                      <span className="member-count">
                        {guild.memberCount}/{guild.maxMembers}
                      </span>
                    </div>
                    <p className="guild-description">
                      {guild.description || 'No description provided'}
                    </p>
                    <div className="guild-stats">
                      <span>Power: {guild.totalPower.toLocaleString()}</span>
                      <span>Leader: {guild.leaderName}</span>
                    </div>
                    <button 
                      className="join-btn"
                      onClick={() => handleJoinGuild(guild.id)}
                      disabled={loading || guild.memberCount >= guild.maxMembers}
                    >
                      {guild.memberCount >= guild.maxMembers ? 'Full' : 'Join Alliance'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === 'create' && (
          <div className="create-guild">
            <h3>Create New Alliance</h3>
            <form onSubmit={handleCreateGuild} className="guild-form">
              <div className="form-group">
                <label htmlFor="guild-name">Guild Name</label>
                <input
                  id="guild-name"
                  type="text"
                  value={newGuildName}
                  onChange={(e) => setNewAllianceName(e.target.value)}
                  placeholder="Enter guild name"
                  maxLength={50}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="guild-tag">Guild Tag (3-5 characters)</label>
                <input
                  id="guild-tag"
                  type="text"
                  value={newGuildTag}
                  onChange={(e) => setNewAllianceTag(e.target.value.toUpperCase())}
                  placeholder="TAG"
                  maxLength={5}
                  minLength={3}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="guild-desc">Description (Optional)</label>
                <textarea
                  id="guild-desc"
                  value={newGuildDesc}
                  onChange={(e) => setNewAllianceDesc(e.target.value)}
                  placeholder="Describe your guild's goals and values"
                  maxLength={500}
                  rows={4}
                />
              </div>
              
              <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Guild Charter</h4>
              
              <div className="form-group">
                <label htmlFor="charter-purpose">Purpose</label>
                <textarea
                  id="charter-purpose"
                  value={charterPurpose}
                  onChange={(e) => setCharterPurpose(e.target.value)}
                  placeholder="What is the purpose of this guild?"
                  maxLength={300}
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="charter-requirements">Requirements</label>
                <textarea
                  id="charter-requirements"
                  value={charterRequirements}
                  onChange={(e) => setCharterRequirements(e.target.value)}
                  placeholder="What are the requirements to join?"
                  maxLength={300}
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="charter-rules">Rules</label>
                <textarea
                  id="charter-rules"
                  value={charterRules}
                  onChange={(e) => setCharterRules(e.target.value)}
                  placeholder="What are the guild rules?"
                  maxLength={500}
                  rows={4}
                />
              </div>
              
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={charterAutoApprove}
                    onChange={(e) => setCharterAutoApprove(e.target.checked)}
                  />
                  {' '}Auto-approve applications
                </label>
              </div>
              
              <button type="submit" disabled={loading} className="create-btn">
                {loading ? 'Creating...' : 'Create Alliance'}
              </button>
            </form>
          </div>
        )}

        {currentView === 'applications' && kingdom.guildId && (
          <div className="guild-applications">
            <h3>Guild Applications</h3>
            <p style={{ color: '#a0a0a0', marginBottom: '1rem' }}>
              Review and manage applications to join your guild
            </p>
            <div className="applications-list">
              <p style={{ textAlign: 'center', color: '#a0a0a0', padding: '2rem' }}>
                No pending applications
              </p>
            </div>
          </div>
        )}

        {currentView === 'rankings' && kingdom.guildId && (
          <div className="guild-rankings">
            <h3>Guild Rankings</h3>
            <div className="rankings-display">
              <div className="rank-card" style={{
                padding: '1rem',
                background: 'rgba(78, 205, 196, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(78, 205, 196, 0.3)',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>Current Rank</span>
                  <span style={{ fontSize: '2rem', color: '#4ecdc4' }}>
                    #{currentGuild?.ranking || 'N/A'}
                  </span>
                </div>
                <small style={{ color: '#a0a0a0', display: 'block', marginTop: '0.5rem' }}>
                  Total Power: {currentGuild?.totalPower.toLocaleString() || 0}
                </small>
              </div>
              <p style={{ color: '#a0a0a0', textAlign: 'center' }}>
                Rankings updated hourly based on total guild power
              </p>
            </div>
          </div>
        )}

        {currentView === 'wars' && kingdom.guildId && (
          <div className="guild-wars">
            <h3>Guild Wars</h3>
            <p style={{ color: '#a0a0a0', marginBottom: '1rem' }}>
              Active and historical wars between guilds
            </p>
            <div className="wars-list">
              {currentGuild?.warDeclarations && currentGuild.warDeclarations.length > 0 ? (
                currentGuild.warDeclarations.map(war => (
                  <div key={war.id} className="war-card" style={{
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>
                        {war.attackingGuildName} vs {war.defendingGuildName}
                      </span>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: war.isActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(160, 160, 160, 0.2)',
                        color: war.isActive ? '#ef4444' : '#a0a0a0'
                      }}>
                        {war.isActive ? 'ACTIVE' : 'ENDED'}
                      </span>
                    </div>
                    <small style={{ color: '#a0a0a0', display: 'block', marginTop: '0.5rem' }}>
                      Declared: {new Date(war.declaredAt).toLocaleDateString()}
                    </small>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: 'center', color: '#a0a0a0', padding: '2rem' }}>
                  No active wars
                </p>
              )}
            </div>
          </div>
        )}

        {currentView === 'chat' && kingdom.guildId && (
          <div className="guild-chat">
            <div className="chat-header">
              <h3>Guild Chat - [{currentGuild?.tag}]</h3>
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

const GuildManagement: React.FC<GuildManagementProps> = (props) => {
  return (
    <ErrorBoundary fallback={
      <div className="guild-error">
        <h2>🤝 Guild System Temporarily Unavailable</h2>
        <p>We're working on getting the guild system back online.</p>
        <button onClick={props.onBack}>← Back to Kingdom</button>
      </div>
    }>
      <GuildManagementContent {...props} />
    </ErrorBoundary>
  );
};

export default GuildManagement;
