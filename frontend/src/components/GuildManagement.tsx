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
import { ScrollIcon, WarningIcon, SocialIcon } from './ui/MenuIcons';
import { achievementTriggers } from '../utils/achievementTriggers';
import type { Schema } from '../../../amplify/data/resource';
import GuildChat from './guild/GuildChat';
import GuildWarsPanel from './guild/GuildWarsPanel';
import GuildUpgradesPanel from './guild/GuildUpgradesPanel';
import GuildDiplomacyPanel from './guild/GuildDiplomacyPanel';
import GuildOverview from './guild/GuildOverview';
import GuildCreateForm from './guild/GuildCreateForm';
import GuildBrowse from './guild/GuildBrowse';
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
  const [newGuildName, setNewAllianceName] = useState('');
  const [newGuildTag, setNewAllianceTag] = useState('');
  const [newGuildDesc, setNewAllianceDesc] = useState('');
  const [charterPurpose, setCharterPurpose] = useState('');
  const [charterRequirements, setCharterRequirements] = useState('');
  const [charterRules, setCharterRules] = useState('');
  const [charterAutoApprove, setCharterAutoApprove] = useState(false);
  const [pendingAllianceInvitations, setPendingAllianceInvitations] = useState<Schema['AllianceInvitation']['type'][]>([]);
  const [chatSubscriptionError, setChatSubscriptionError] = useState<string | null>(null);


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
      ToastService.error('Failed to load pending invitations');
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
      ToastService.error('Failed to load guild messages');
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
              setChatSubscriptionError('Real-time chat is currently unavailable. Messages may not update automatically.');
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

  // Expose kick/invite for future member list use (suppresses unused-var lint)
  void handleKickMember;
  void handleInviteMember;

  const currentGuild = guilds.find(a => a.id === kingdom.guildId);
  const pendingInvitations = invitations.filter(inv => inv.status === 'pending');

  return (
    <div className="guild-management">
      <TopNavigation
        title={<><img src="/alliance-icon.png" style={{width:32,height:32,objectFit:'contain',verticalAlign:'middle',marginRight:8}} alt="" />Guild Management</>}
        subtitle={currentGuild ? `${currentGuild.name} [${currentGuild.tag}]` : 'Diplomatic Relations'}
        onBack={onBack}
        backLabel="← Back to Kingdom"
        kingdomId={kingdom.id}
      />

      {pendingInvitations.length > 0 && (
        <div className="invitations-alert" style={{
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          color: '#e2e8f0',
          padding: '0.5rem 1rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}>
          <ScrollIcon /> {pendingInvitations.length} pending invitation{pendingInvitations.length !== 1 ? 's' : ''}
        </div>
      )}

      <nav className="guild-nav">
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
          <GuildOverview
            currentGuild={currentGuild}
            loading={loading}
            pendingAllianceInvitations={pendingAllianceInvitations}
            onAcceptInvitation={handleAcceptInvitation}
            onDeclineInvitation={handleDeclineInvitation}
            onLeaveGuild={handleLeaveGuild}
          />
        )}

        {currentView === 'browse' && (
          <GuildBrowse
            guilds={guilds}
            loading={loading}
            onJoinGuild={handleJoinGuild}
          />
        )}

        {currentView === 'create' && (
          <GuildCreateForm
            loading={loading}
            newGuildName={newGuildName}
            newGuildTag={newGuildTag}
            newGuildDesc={newGuildDesc}
            charterPurpose={charterPurpose}
            charterRequirements={charterRequirements}
            charterRules={charterRules}
            charterAutoApprove={charterAutoApprove}
            onNewGuildNameChange={setNewAllianceName}
            onNewGuildTagChange={setNewAllianceTag}
            onNewGuildDescChange={setNewAllianceDesc}
            onCharterPurposeChange={setCharterPurpose}
            onCharterRequirementsChange={setCharterRequirements}
            onCharterRulesChange={setCharterRules}
            onCharterAutoApproveChange={setCharterAutoApprove}
            onSubmit={handleCreateGuild}
          />
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
                  Total Power: {(currentGuild?.totalPower ?? 0).toLocaleString()}
                </small>
              </div>
              <p style={{ color: '#a0a0a0', textAlign: 'center' }}>
                Rankings updated hourly based on total guild power
              </p>
            </div>
          </div>
        )}

        {currentView === 'wars' && kingdom.guildId && (
          <GuildWarsPanel
            kingdom={kingdom}
            currentGuild={currentGuild}
            isVisible={currentView === 'wars'}
          />
        )}

        {/* ── Upgrades tab ───────────────────────────────────────────── */}
        {currentView === 'upgrades' && kingdom.guildId && (
          <GuildUpgradesPanel
            kingdom={kingdom}
            currentGuild={currentGuild}
          />
        )}

        {/* ── Diplomacy tab ───────────────────────────────────────────── */}
        {currentView === 'diplomacy' && kingdom.guildId && (
          <GuildDiplomacyPanel
            kingdom={kingdom}
            currentGuild={currentGuild}
          />
        )}

        {currentView === 'chat' && kingdom.guildId && (
          <>
            {chatSubscriptionError && (
              <div className="gm-error-banner" role="alert" style={{ margin: '0.75rem 0' }}>
                <span><WarningIcon /> {chatSubscriptionError}</span>
                <button onClick={() => setChatSubscriptionError(null)} aria-label="Dismiss">×</button>
              </div>
            )}
            <GuildChat
              kingdom={kingdom}
              guildTag={currentGuild?.tag}
              messages={messages}
              onMessageSent={(msg) => setMessages(prev => [...prev, msg])}
              onMessageFailed={(msgId) => setMessages(prev => prev.filter(m => m.id !== msgId))}
            />
          </>
        )}
      </main>
    </div>
  );
};

const GuildManagement: React.FC<GuildManagementProps> = (props) => {
  return (
    <ErrorBoundary fallback={
      <div className="guild-error">
        <h2><SocialIcon /> Guild System Temporarily Unavailable</h2>
        <p>We're working on getting the guild system back online.</p>
        <button onClick={props.onBack}>← Back to Kingdom</button>
      </div>
    }>
      <GuildManagementContent {...props} />
    </ErrorBoundary>
  );
};

export default GuildManagement;
