/**
 * Guild Management Component
 * Real-time guild system with chat, invitations, and member management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import { GuildService, type GuildData, type GuildMessage, type GuildInvitation, type GuildWar, type AllianceRelationship } from '../services/GuildService';
import { AmplifyFunctionService } from '../services/amplifyFunctionService';
import { ToastService } from '../services/toastService';
import { isDemoMode } from '../utils/authMode';
import { ErrorBoundary } from './ErrorBoundary';
import { TopNavigation } from './TopNavigation';
import { achievementTriggers } from '../utils/achievementTriggers';
import type { Schema } from '../../../amplify/data/resource';
import './TerritoryExpansion.css';
import './GuildManagement.css';

interface GuildManagementProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
}

const GuildManagementContent: React.FC<GuildManagementProps> = ({ kingdom, onBack }) => {
  const [currentView, setCurrentView] = useState<'overview' | 'browse' | 'create' | 'chat' | 'applications' | 'rankings' | 'wars' | 'upgrades' | 'diplomacy'>('overview');
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

  // Guild wars state
  const [activeWars, setActiveWars] = useState<GuildWar[]>([]);
  const [warHistory, setWarHistory] = useState<GuildWar[]>([]);
  const [warsLoading, setWarsLoading] = useState(false);
  const [showDeclareWarModal, setShowDeclareWarModal] = useState(false);
  const [declareWarTargetId, setDeclareWarTargetId] = useState('');
  const [declareWarTargetName, setDeclareWarTargetName] = useState('');
  // Guild picker state for declare-war modal
  const [availableGuilds, setAvailableGuilds] = useState<GuildData[]>([]);
  const [warTargetSearch, setWarTargetSearch] = useState('');
  const [selectedWarTargetGuild, setSelectedWarTargetGuild] = useState<GuildData | null>(null);
  const [warGuildsLoading, setWarGuildsLoading] = useState(false);

  // Alliance upgrades state
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [upgradeNow, setUpgradeNow] = useState(Date.now());

  // Tick the upgrade countdown clock every 30s while the upgrades view is open
  useEffect(() => {
    if (currentView !== 'upgrades') return;
    const id = setInterval(() => setUpgradeNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [currentView]);

  // Diplomacy state
  const [diplomacyTargetId, setDiplomacyTargetId] = useState('');
  const [diplomacyRelationship, setDiplomacyRelationship] = useState<AllianceRelationship['relationship']>('neutral');
  const [diplomacyLoading, setDiplomacyLoading] = useState(false);

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

  const loadWars = useCallback(async () => {
    if (!kingdom.guildId) return;
    try {
      setWarsLoading(true);
      const { active, history } = await GuildService.loadGuildWars(kingdom.guildId);
      setActiveWars(active);
      setWarHistory(history);
    } catch (error) {
      console.error('Failed to load guild wars:', error);
    } finally {
      setWarsLoading(false);
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

  // Load wars when Wars tab is active
  useEffect(() => {
    if (currentView === 'wars' && kingdom.guildId) {
      void loadWars();
    }
  }, [currentView, kingdom.guildId, loadWars]);

  // When the declare-war modal opens, fetch the guild list for the picker.
  // We use the already-loaded `guilds` list (fetched on mount via loadGuilds)
  // and exclude the player's own guild. If guilds is empty we re-fetch once.
  useEffect(() => {
    if (!showDeclareWarModal) return;

    // Reset picker state each time the modal opens
    setWarTargetSearch('');
    setSelectedWarTargetGuild(null);

    const populate = async () => {
      // If `guilds` is already populated (from the Browse tab load), just filter
      if (guilds.length > 0) {
        setAvailableGuilds(guilds.filter(g => g.id !== kingdom.guildId));
        return;
      }
      // Otherwise do a one-off fetch
      try {
        setWarGuildsLoading(true);
        const fetched = await GuildService.getPublicGuilds();
        setAvailableGuilds(fetched.filter(g => g.id !== kingdom.guildId));
      } catch (err) {
        console.error('[GuildManagement] Failed to load guilds for war picker:', err);
        setAvailableGuilds([]);
      } finally {
        setWarGuildsLoading(false);
      }
    };
    void populate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeclareWarModal]);

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
        achievementTriggers.onAllianceFormed();
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
        achievementTriggers.onAllianceFormed();
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
        achievementTriggers.onGuildJoined();
        ToastService.success('Joined alliance!');
      } else {
        // Auth mode: call the alliance-manager Lambda
        await AmplifyFunctionService.callFunction('alliance-manager', {
          kingdomId: kingdom.id,
          action: 'join',
          allianceId: guildId,
        });
        achievementTriggers.onGuildJoined();
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
      achievementTriggers.onMessageSent();
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
      achievementTriggers.onGuildJoined();
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

  // ─── Guild War handlers ───────────────────────────────────────────────────

  const handleDeclareWar = async () => {
    if (!kingdom.guildId || !currentGuild) return;

    // Resolve target from the guild picker (preferred) or legacy text inputs
    const targetId   = selectedWarTargetGuild ? selectedWarTargetGuild.id   : declareWarTargetId.trim();
    const targetName = selectedWarTargetGuild ? selectedWarTargetGuild.name : declareWarTargetName.trim();

    if (!targetId || !targetName) {
      ToastService.error('Select a guild to declare war on');
      return;
    }
    try {
      setLoading(true);
      await GuildService.declareGuildWar({
        attackingGuildId: kingdom.guildId,
        defendingGuildId: targetId,
        declaringKingdomId: kingdom.id,
        attackingGuildName: currentGuild.name,
        defendingGuildName: targetName,
      });
      achievementTriggers.onGuildWarDeclared();
      ToastService.success(`War declared on ${targetName}!`);
      setShowDeclareWarModal(false);
      setSelectedWarTargetGuild(null);
      setDeclareWarTargetId('');
      setDeclareWarTargetName('');
      setWarTargetSearch('');
      await loadWars();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to declare war';
      ToastService.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConcedeWar = async (warId: string) => {
    if (!kingdom.guildId) return;
    if (!window.confirm('Are you sure you want to concede this war? The enemy guild will be declared the winner.')) return;
    try {
      setLoading(true);
      await GuildService.concedeGuildWar(warId, kingdom.guildId);
      ToastService.success('War conceded');
      await loadWars();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to concede war';
      ToastService.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveWar = async (warId: string) => {
    try {
      setLoading(true);
      const resolved = await GuildService.resolveGuildWar(warId);
      if (resolved.winnerId === kingdom.guildId) {
        ToastService.success('War resolved — your guild wins!');
      } else if (resolved.winnerId) {
        ToastService.error('War resolved — your guild lost.');
      } else {
        ToastService.success('War resolved — it\'s a tie!');
      }
      await loadWars();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to resolve war';
      ToastService.error(msg);
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
            <button
              className={currentView === 'upgrades' ? 'active' : ''}
              onClick={() => setCurrentView('upgrades')}
            >
              Upgrades
            </button>
            <button
              className={currentView === 'diplomacy' ? 'active' : ''}
              onClick={() => setCurrentView('diplomacy')}
            >
              Diplomacy
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
          <div className="guild-wars" style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Guild Wars</h3>
              {/* Only guild leader can declare war (leaderId check) */}
              {currentGuild?.leaderId === kingdom.id && (
                <button
                  onClick={() => setShowDeclareWarModal(true)}
                  disabled={loading || activeWars.length > 0}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '6px',
                    cursor: activeWars.length > 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    opacity: activeWars.length > 0 ? 0.5 : 1,
                  }}
                  title={activeWars.length > 0 ? 'Already in an active war' : 'Declare war on a guild'}
                >
                  Declare War
                </button>
              )}
            </div>

            {warsLoading ? (
              <p style={{ color: '#a0a0a0', textAlign: 'center', padding: '2rem' }}>Loading wars...</p>
            ) : (
              <>
                {/* ── Active Wars ────────────────────────────────────── */}
                {activeWars.length > 0 ? (
                  activeWars.map(war => {
                    const isAttacker = war.attackingGuildId === kingdom.guildId;
                    const ourScore = isAttacker ? war.attackingScore : war.defendingScore;
                    const theirScore = isAttacker ? war.defendingScore : war.attackingScore;
                    const enemyName = isAttacker ? war.defendingGuildName : war.attackingGuildName;
                    const endsAt = new Date(war.endsAt);
                    const msLeft = endsAt.getTime() - Date.now();
                    const hoursLeft = Math.max(0, Math.floor(msLeft / 3600000));
                    const minutesLeft = Math.max(0, Math.floor((msLeft % 3600000) / 60000));
                    const isExpired = msLeft <= 0;

                    // Contributions by our guild members
                    const ourContribs = war.contributions
                      .filter(c => c.guildId === kingdom.guildId)
                      .sort((a, b) => b.score - a.score);

                    return (
                      <div key={war.id} style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: '10px',
                        padding: '1.25rem',
                        marginBottom: '1.5rem',
                      }}>
                        {/* War header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                              War vs {enemyName}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#a0a0a0' }}>
                              Declared {new Date(war.declaredAt).toLocaleDateString()}
                            </div>
                          </div>
                          <span style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                          }}>
                            ACTIVE
                          </span>
                        </div>

                        {/* Score */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          marginBottom: '1rem',
                          padding: '0.75rem 1rem',
                          background: 'rgba(0,0,0,0.2)',
                          borderRadius: '8px',
                        }}>
                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ecdc4' }}>{ourScore}</div>
                            <div style={{ fontSize: '0.75rem', color: '#a0a0a0' }}>Our Score</div>
                          </div>
                          <div style={{ color: '#666', fontSize: '1.25rem' }}>vs</div>
                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{theirScore}</div>
                            <div style={{ fontSize: '0.75rem', color: '#a0a0a0' }}>{enemyName}</div>
                          </div>
                        </div>

                        {/* Time remaining */}
                        <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: isExpired ? '#ef4444' : '#a0a0a0' }}>
                          {isExpired
                            ? 'War has expired — awaiting resolution'
                            : `Ends in: ${hoursLeft}h ${minutesLeft}m`}
                        </div>

                        {/* Member contributions */}
                        {ourContribs.length > 0 && (
                          <div style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#ccc' }}>
                              Member Contributions
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                  <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', color: '#a0a0a0' }}>Kingdom</th>
                                  <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', color: '#a0a0a0' }}>Attacks</th>
                                  <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', color: '#a0a0a0' }}>Score</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ourContribs.map(c => (
                                  <tr key={c.kingdomId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '0.25rem 0.5rem' }}>{c.kingdomName}</td>
                                    <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>{c.attackCount}</td>
                                    <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right', color: '#4ecdc4' }}>{c.score}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Actions — leader only */}
                        {currentGuild?.leaderId === kingdom.id && (
                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {isExpired && (
                              <button
                                onClick={() => void handleResolveWar(war.id)}
                                disabled={loading}
                                style={{
                                  background: 'rgba(78, 205, 196, 0.2)',
                                  border: '1px solid rgba(78, 205, 196, 0.5)',
                                  color: '#4ecdc4',
                                  padding: '0.4rem 1rem',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                }}
                              >
                                Resolve War
                              </button>
                            )}
                            <button
                              onClick={() => void handleConcedeWar(war.id)}
                              disabled={loading}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                color: '#ef4444',
                                padding: '0.4rem 1rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                              }}
                            >
                              Concede War
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', color: '#a0a0a0', padding: '2rem 0', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚔️</div>
                    <p style={{ margin: 0 }}>No active wars.</p>
                    {currentGuild?.leaderId === kingdom.id && (
                      <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                        Use the <strong>Declare War</strong> button to challenge another guild.
                      </p>
                    )}
                  </div>
                )}

                {/* ── War History ────────────────────────────────────── */}
                {warHistory.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ color: '#a0a0a0', marginBottom: '0.75rem', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Past Wars
                    </h4>
                    {warHistory.map(war => {
                      const isAttacker = war.attackingGuildId === kingdom.guildId;
                      const ourScore = isAttacker ? war.attackingScore : war.defendingScore;
                      const theirScore = isAttacker ? war.defendingScore : war.attackingScore;
                      const enemyName = isAttacker ? war.defendingGuildName : war.attackingGuildName;
                      const won = war.winnerId === kingdom.guildId;
                      const tied = !war.winnerId;

                      return (
                        <div key={war.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.6rem 0.75rem',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '6px',
                          marginBottom: '0.4rem',
                          fontSize: '0.875rem',
                        }}>
                          <span style={{ color: '#ccc' }}>{enemyName}</span>
                          <span style={{
                            color: tied ? '#a0a0a0' : won ? '#4ecdc4' : '#ef4444',
                            fontWeight: 600,
                            margin: '0 1rem',
                          }}>
                            {tied ? 'Tied' : won ? 'Won' : 'Lost'}
                          </span>
                          <span style={{ color: '#a0a0a0' }}>{ourScore} — {theirScore}</span>
                          <span style={{ color: '#666', marginLeft: '1rem' }}>
                            {new Date(war.declaredAt).toLocaleDateString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── Declare War Modal ─────────────────────────────────── */}
            {showDeclareWarModal && (
              <div style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000,
              }}>
                <div style={{
                  background: 'var(--bg-secondary, #1e2a3a)',
                  border: '1px solid rgba(239,68,68,0.5)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  width: '100%',
                  maxWidth: '460px',
                  maxHeight: '90vh',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <h4 style={{ marginTop: 0, color: '#ef4444', flexShrink: 0 }}>Declare Guild War</h4>
                  <p style={{ color: '#a0a0a0', fontSize: '0.875rem', marginBottom: '1rem', flexShrink: 0 }}>
                    Select a target guild below. Wars last 72 hours — the guild with
                    the higher combined score wins.
                  </p>

                  {/* Selected guild highlight */}
                  {selectedWarTargetGuild && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.45)',
                      borderRadius: '6px',
                      marginBottom: '0.75rem',
                      flexShrink: 0,
                    }}>
                      <span style={{ color: '#ef4444', fontSize: '1rem' }}>⚔</span>
                      <span style={{ color: '#fff', fontWeight: 600, flex: 1 }}>
                        [{selectedWarTargetGuild.tag}] {selectedWarTargetGuild.name}
                      </span>
                      <span style={{ color: '#a0a0a0', fontSize: '0.8rem' }}>
                        {selectedWarTargetGuild.memberCount} members
                      </span>
                      <button
                        onClick={() => setSelectedWarTargetGuild(null)}
                        style={{
                          background: 'none', border: 'none', color: '#a0a0a0',
                          cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '0 0.2rem',
                        }}
                        aria-label="Clear selection"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Search input */}
                  <input
                    type="search"
                    value={warTargetSearch}
                    onChange={e => setWarTargetSearch(e.target.value)}
                    placeholder="Search alliances by name…"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: 'var(--bg-card, #0f1923)',
                      border: '1px solid var(--border-primary, #334)',
                      borderRadius: '6px',
                      color: 'var(--text-primary, #fff)',
                      boxSizing: 'border-box',
                      marginBottom: '0.6rem',
                      flexShrink: 0,
                    }}
                  />

                  {/* Guild list */}
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    marginBottom: '1rem',
                    minHeight: '120px',
                    maxHeight: '300px',
                    border: '1px solid var(--border-primary, #334)',
                    borderRadius: '6px',
                  }}>
                    {warGuildsLoading ? (
                      <p style={{ textAlign: 'center', color: '#a0a0a0', padding: '1.5rem', margin: 0 }}>
                        Loading guilds…
                      </p>
                    ) : availableGuilds.length === 0 ? (
                      <p style={{ textAlign: 'center', color: '#a0a0a0', padding: '1.5rem', margin: 0 }}>
                        No other alliances found.
                      </p>
                    ) : (
                      availableGuilds
                        .filter(g => {
                          const q = warTargetSearch.trim().toLowerCase();
                          return !q || g.name.toLowerCase().includes(q) || g.tag.toLowerCase().includes(q);
                        })
                        .map(g => {
                          const isSelected = selectedWarTargetGuild?.id === g.id;
                          return (
                            <button
                              key={g.id}
                              onClick={() => setSelectedWarTargetGuild(isSelected ? null : g)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                width: '100%',
                                padding: '0.6rem 0.75rem',
                                background: isSelected
                                  ? 'rgba(239,68,68,0.15)'
                                  : 'transparent',
                                border: 'none',
                                borderBottom: '1px solid var(--border-primary, #334)',
                                color: 'var(--text-primary, #fff)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                gap: '0.6rem',
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={e => {
                                if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                              }}
                              onMouseLeave={e => {
                                if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                              }}
                            >
                              {/* Checkmark column */}
                              <span style={{
                                width: '16px',
                                flexShrink: 0,
                                color: '#ef4444',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                              }}>
                                {isSelected ? '✓' : ''}
                              </span>

                              {/* Tag + Name */}
                              <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{
                                  fontSize: '0.72rem',
                                  color: '#a0a0a0',
                                  marginRight: '0.3rem',
                                  fontFamily: 'monospace',
                                }}>
                                  [{g.tag}]
                                </span>
                                <span style={{ fontWeight: isSelected ? 600 : 400 }}>{g.name}</span>
                              </span>

                              {/* Members */}
                              <span style={{ fontSize: '0.8rem', color: '#a0a0a0', flexShrink: 0 }}>
                                {g.memberCount}/{g.maxMembers} members
                              </span>

                              {/* Power */}
                              <span style={{ fontSize: '0.8rem', color: '#4ecdc4', flexShrink: 0, marginLeft: '0.5rem' }}>
                                {g.totalPower.toLocaleString()} pw
                              </span>
                            </button>
                          );
                        })
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        setShowDeclareWarModal(false);
                        setSelectedWarTargetGuild(null);
                        setWarTargetSearch('');
                        setDeclareWarTargetId('');
                        setDeclareWarTargetName('');
                      }}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border-primary, #334)',
                        color: 'var(--text-secondary, #aaa)',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleDeclareWar()}
                      disabled={loading || !selectedWarTargetGuild}
                      style={{
                        background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1.25rem',
                        borderRadius: '6px',
                        cursor: selectedWarTargetGuild && !loading ? 'pointer' : 'not-allowed',
                        fontWeight: 600,
                        opacity: loading || !selectedWarTargetGuild ? 0.5 : 1,
                      }}
                    >
                      {loading ? 'Declaring…' : 'Declare War'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Upgrades tab ───────────────────────────────────────────── */}
        {currentView === 'upgrades' && kingdom.guildId && (() => {
          const UPGRADE_DISPLAY = [
            { key: 'war_banner',    label: 'War Banner',      cost: '50k gold',  duration: '48h', desc: '+5% offense for all members', costNum: 50000 },
            { key: 'fortification', label: 'Fortification',   cost: '100k gold', duration: '7d',  desc: '+10% defense for all members', costNum: 100000 },
            { key: 'intel_network', label: 'Intel Network',   cost: '100k gold', duration: '7d',  desc: '+15% espionage success', costNum: 100000 },
            { key: 'trade_routes',  label: 'Trade Routes',    cost: '75k gold',  duration: '7d',  desc: '+10% income for all members', costNum: 75000 },
            { key: 'grand_assault', label: 'Grand Assault',   cost: '200k gold', duration: '24h', desc: '+25% offense on coordinated attacks', costNum: 200000 },
          ];

          const treasury = currentGuild?.stats?.treasury ?? 0;
          const activeUpgrades = currentGuild?.stats?.activeUpgrades ?? [];
          const isLeader = currentGuild?.leaderId === kingdom.id;
          const demo = isDemoMode();

          const getCountdown = (expiresAt: string): string => {
            const ms = new Date(expiresAt).getTime() - upgradeNow;
            if (ms <= 0) return 'Expired';
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            return `${h}h ${m}m remaining`;
          };

          const handlePurchase = async (upgradeKey: string) => {
            if (!kingdom.guildId || !isLeader || demo) return;
            try {
              setUpgradeLoading(upgradeKey);
              await GuildService.purchaseUpgrade(kingdom.guildId, kingdom.id, upgradeKey);
              ToastService.success('Upgrade purchased!');
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Failed to purchase upgrade';
              ToastService.error(msg);
            } finally {
              setUpgradeLoading(null);
            }
          };

          return (
            <div style={{ maxWidth: '800px' }}>
              {/* Treasury balance */}
              <div style={{
                padding: '1rem 1.25rem',
                background: 'rgba(78, 205, 196, 0.08)',
                border: '1px solid rgba(78, 205, 196, 0.3)',
                borderRadius: '10px',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#a0a0a0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Alliance Treasury
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#4ecdc4' }}>
                    {treasury.toLocaleString()} gold
                  </div>
                </div>
                {!isLeader && (
                  <div style={{ fontSize: '0.8rem', color: '#a0a0a0', fontStyle: 'italic' }}>
                    Only the alliance leader can purchase upgrades
                  </div>
                )}
              </div>

              {/* Active upgrades */}
              {activeUpgrades.filter(u => new Date(u.expiresAt).getTime() > upgradeNow).length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem', color: '#a0a0a0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Active Upgrades
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {activeUpgrades
                      .filter(u => new Date(u.expiresAt).getTime() > upgradeNow)
                      .map(u => {
                        const def = UPGRADE_DISPLAY.find(d => d.key === u.key);
                        return (
                          <div key={u.key} style={{
                            padding: '0.5rem 0.9rem',
                            background: 'rgba(78, 205, 196, 0.12)',
                            border: '1px solid rgba(78, 205, 196, 0.45)',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                          }}>
                            <span style={{ fontWeight: 600, color: '#4ecdc4' }}>
                              {def ? def.label : u.key}
                            </span>
                            <span style={{ color: '#a0a0a0', marginLeft: '0.5rem', fontSize: '0.78rem' }}>
                              {getCountdown(u.expiresAt)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Upgrade shop */}
              <h4 style={{ margin: '0 0 0.75rem', color: '#a0a0a0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Available Upgrades
              </h4>
              <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {UPGRADE_DISPLAY.map(upg => {
                  const isActive = activeUpgrades.some(
                    u => u.key === upg.key && new Date(u.expiresAt).getTime() > upgradeNow
                  );
                  const canAfford = treasury >= upg.costNum;
                  const isPurchasing = upgradeLoading === upg.key;

                  return (
                    <div key={upg.key} style={{
                      padding: '1rem',
                      background: isActive
                        ? 'rgba(78, 205, 196, 0.08)'
                        : 'rgba(255,255,255,0.03)',
                      border: isActive
                        ? '1px solid rgba(78, 205, 196, 0.45)'
                        : '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: isActive ? '#4ecdc4' : '#e2e8f0' }}>
                          {upg.label}
                        </div>
                        {isActive && (
                          <span style={{
                            padding: '0.15rem 0.5rem',
                            background: 'rgba(78, 205, 196, 0.2)',
                            border: '1px solid rgba(78, 205, 196, 0.5)',
                            borderRadius: '3px',
                            fontSize: '0.7rem',
                            color: '#4ecdc4',
                            fontWeight: 600,
                          }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                        {upg.desc}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#a0a0a0', marginBottom: '0.75rem' }}>
                        <span>Cost: <span style={{ color: '#f59e0b' }}>{upg.cost}</span></span>
                        <span>Duration: <span style={{ color: '#e2e8f0' }}>{upg.duration}</span></span>
                      </div>
                      <button
                        disabled={!isLeader || isActive || isPurchasing || demo}
                        onClick={() => void handlePurchase(upg.key)}
                        title={
                          demo ? 'Sign in for full features'
                          : !isLeader ? 'Only the alliance leader can purchase upgrades'
                          : isActive ? 'Already active'
                          : !canAfford ? 'Not enough gold in treasury'
                          : `Purchase ${upg.label}`
                        }
                        style={{
                          width: '100%',
                          padding: '0.4rem 0',
                          background: isActive
                            ? 'rgba(78,205,196,0.1)'
                            : !isLeader || demo || !canAfford
                            ? 'rgba(255,255,255,0.05)'
                            : 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(109,40,217,0.4))',
                          border: isActive
                            ? '1px solid rgba(78,205,196,0.3)'
                            : '1px solid rgba(139,92,246,0.4)',
                          borderRadius: '6px',
                          color: isActive || !isLeader || demo || !canAfford ? '#6b7280' : '#e2e8f0',
                          cursor: isActive || !isLeader || demo || !canAfford ? 'not-allowed' : 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          opacity: isPurchasing ? 0.6 : 1,
                        }}
                      >
                        {isPurchasing ? 'Purchasing…' : isActive ? 'Active' : demo ? 'Sign in to Purchase' : 'Purchase'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Diplomacy tab ───────────────────────────────────────────── */}
        {currentView === 'diplomacy' && kingdom.guildId && (() => {
          const relationships: AllianceRelationship[] = currentGuild?.stats?.relationships ?? [];
          const isLeader = currentGuild?.leaderId === kingdom.id;
          const demo = isDemoMode();

          const REL_LABELS: Record<AllianceRelationship['relationship'], string> = {
            neutral: 'Neutral',
            trade_pact: 'Trade Pact',
            non_aggression: 'Non-Aggression',
            allied: 'Allied',
            hostile: 'Hostile',
          };

          const REL_TOOLTIPS: Partial<Record<AllianceRelationship['relationship'], string>> = {
            trade_pact: '+5% caravan income for both alliances',
            allied: 'Can see each other\'s intel',
          };

          const REL_COLORS: Record<AllianceRelationship['relationship'], string> = {
            neutral: '#9ca3af',
            trade_pact: '#34d399',
            non_aggression: '#60a5fa',
            allied: '#f59e0b',
            hostile: '#ef4444',
          };

          // Check for active trade pacts
          const activeTradePacts = relationships.filter(r => r.relationship === 'trade_pact');

          const handleSetRelationship = async () => {
            if (!kingdom.guildId || !isLeader || demo || !diplomacyTargetId.trim()) return;
            try {
              setDiplomacyLoading(true);
              await GuildService.setInterAllianceRelationship(
                kingdom.guildId,
                kingdom.id,
                diplomacyTargetId.trim(),
                diplomacyRelationship
              );
              ToastService.success(`Relationship updated to ${REL_LABELS[diplomacyRelationship]}`);
              setDiplomacyTargetId('');
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Failed to update relationship';
              ToastService.error(msg);
            } finally {
              setDiplomacyLoading(false);
            }
          };

          return (
            <div style={{ maxWidth: '700px' }}>
              {/* Trade pact income indicator */}
              {activeTradePacts.length > 0 && (
                <div style={{
                  padding: '0.6rem 1rem',
                  background: 'rgba(52, 211, 153, 0.08)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  borderRadius: '6px',
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem',
                  color: '#34d399',
                }}>
                  +5% trade income active ({activeTradePacts.length} trade pact{activeTradePacts.length !== 1 ? 's' : ''})
                </div>
              )}

              {/* Current relationships */}
              <div style={{ marginBottom: '1.75rem' }}>
                <h4 style={{ margin: '0 0 0.75rem', color: '#a0a0a0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Current Relationships
                </h4>
                {relationships.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
                    No alliance relationships established yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {relationships.map(rel => (
                      <div key={rel.targetAllianceId} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.65rem 1rem',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '7px',
                      }}>
                        <span style={{ fontSize: '0.9rem', color: '#e2e8f0' }}>
                          {rel.targetAllianceName ?? rel.targetAllianceId}
                        </span>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: REL_COLORS[rel.relationship],
                          background: `${REL_COLORS[rel.relationship]}18`,
                          border: `1px solid ${REL_COLORS[rel.relationship]}44`,
                        }}>
                          {REL_LABELS[rel.relationship]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Set relationship (leader only) */}
              {(isLeader || demo) && (
                <div style={{
                  padding: '1.25rem',
                  background: 'rgba(139, 92, 246, 0.05)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  borderRadius: '10px',
                }}>
                  <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#e2e8f0' }}>
                    Set Relationship
                    {!isLeader && <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '0.8rem', marginLeft: '0.5rem' }}>(Leader only)</span>}
                  </h4>

                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.3rem' }}>
                        Target Alliance ID
                      </label>
                      <input
                        type="text"
                        value={diplomacyTargetId}
                        onChange={e => setDiplomacyTargetId(e.target.value)}
                        placeholder="Enter alliance ID…"
                        disabled={demo}
                        title={demo ? 'Sign in for full features' : undefined}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '6px',
                          color: '#e2e8f0',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.3rem' }}>
                        Relationship Status
                      </label>
                      <select
                        value={diplomacyRelationship}
                        onChange={e => setDiplomacyRelationship(e.target.value as AllianceRelationship['relationship'])}
                        disabled={demo}
                        title={demo ? 'Sign in for full features' : undefined}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          background: '#1a1a2e',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '6px',
                          color: '#e2e8f0',
                          boxSizing: 'border-box',
                        }}
                      >
                        {(Object.entries(REL_LABELS) as [AllianceRelationship['relationship'], string][]).map(([val, label]) => (
                          <option key={val} value={val} title={REL_TOOLTIPS[val]}>
                            {label}{REL_TOOLTIPS[val] ? ` — ${REL_TOOLTIPS[val]}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      disabled={demo || !isLeader || diplomacyLoading || !diplomacyTargetId.trim()}
                      onClick={() => void handleSetRelationship()}
                      title={demo ? 'Sign in for full features' : !isLeader ? 'Only the alliance leader can set relationships' : undefined}
                      style={{
                        padding: '0.5rem 1.25rem',
                        background: demo || !isLeader || !diplomacyTargetId.trim()
                          ? 'rgba(255,255,255,0.05)'
                          : 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(109,40,217,0.4))',
                        border: '1px solid rgba(139,92,246,0.4)',
                        borderRadius: '6px',
                        color: demo || !isLeader || !diplomacyTargetId.trim() ? '#6b7280' : '#e2e8f0',
                        cursor: demo || !isLeader || !diplomacyTargetId.trim() || diplomacyLoading ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        opacity: diplomacyLoading ? 0.6 : 1,
                        alignSelf: 'flex-start',
                      }}
                    >
                      {diplomacyLoading ? 'Updating…' : demo ? 'Sign in for full features' : 'Update Relationship'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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
