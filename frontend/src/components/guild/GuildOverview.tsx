import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { GuildData } from '../../services/GuildService';
import type { Schema } from '../../../../amplify/data/resource';
import { isDemoMode } from '../../utils/authMode';
import GuildMemberList from './GuildMemberList';

interface MemberDetail {
  id: string;
  name: string;
  race: string;
}

const DEMO_MEMBER_DETAILS: MemberDetail[] = [
  { id: 'demo-member-1', name: 'Aelindra Moonsong', race: 'Elven' },
  { id: 'demo-member-2', name: 'Grax Ironjaw', race: 'Droben' },
  { id: 'demo-member-3', name: 'Sable Nightwhisper', race: 'Vampire' },
];

interface GuildOverviewProps {
  currentGuild: GuildData | undefined;
  loading: boolean;
  pendingAllianceInvitations: Schema['AllianceInvitation']['type'][];
  onAcceptInvitation: (allianceId: string) => void;
  onDeclineInvitation: (allianceId: string) => void;
  onLeaveGuild: () => void;
}

const GuildOverview: React.FC<GuildOverviewProps> = ({
  currentGuild,
  loading,
  pendingAllianceInvitations,
  onAcceptInvitation,
  onDeclineInvitation,
  onLeaveGuild,
}) => {
  const [memberDetails, setMemberDetails] = useState<MemberDetail[]>([]);

  // Fetch member details (name + race) whenever the current guild changes
  useEffect(() => {
    if (!currentGuild) {
      setMemberDetails([]);
      return;
    }

    if (isDemoMode()) {
      setMemberDetails(DEMO_MEMBER_DETAILS);
      return;
    }

    const rawAlliance = currentGuild as unknown as Record<string, unknown>;
    let memberIds: string[] = [];
    try {
      const raw = rawAlliance.memberIds;
      if (Array.isArray(raw)) {
        memberIds = raw as string[];
      } else if (typeof raw === 'string') {
        memberIds = JSON.parse(raw) as string[];
      }
    } catch {
      memberIds = [];
    }

    if (memberIds.length === 0) {
      setMemberDetails([]);
      return;
    }

    const fetchMembers = async () => {
      try {
        const dataClient = generateClient<Schema>();
        const results = await Promise.all(
          memberIds.map(id => dataClient.models.Kingdom.get({ id }))
        );
        const details: MemberDetail[] = results
          .filter(r => r.data != null)
          .map(r => ({
            id: r.data!.id,
            name: r.data!.name,
            race: r.data!.race ?? 'Human',
          }));
        setMemberDetails(details);
      } catch (err) {
        console.error('[GuildOverview] Failed to fetch member details:', err);
        setMemberDetails([]);
      }
    };

    void fetchMembers();
  }, [currentGuild]);
  return (
    <div className="guild-overview">
      {pendingAllianceInvitations.length > 0 && (
        <div className="pending-invitations" style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          background: 'rgba(78, 205, 196, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(78, 205, 196, 0.3)',
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.75rem', color: '#e2e8f0' }}>
            Pending Invitations
          </h3>
          {pendingAllianceInvitations.map(inv => (
            <div key={inv.id} className="invitation-card" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: 'rgba(15, 15, 30, 0.8)',
              borderRadius: '6px',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              marginBottom: '0.5rem',
            }}>
              <p style={{ margin: 0, color: '#94a3b8' }}>
                Invited to join alliance <strong style={{ color: '#e2e8f0' }}>{inv.guildId}</strong>
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  onClick={() => onAcceptInvitation(inv.guildId)}
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
                  onClick={() => onDeclineInvitation(inv.guildId)}
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
              <span>Power: {(currentGuild.totalPower ?? 0).toLocaleString()}</span>
              <span>Leader: {currentGuild.leaderName}</span>
              {(() => {
                let stats: Record<string, unknown> = {};
                try {
                  const rawStats = currentGuild.stats as unknown;
                  stats = rawStats
                    ? (typeof rawStats === 'string' ? JSON.parse(rawStats as string) : (rawStats as Record<string, unknown>))
                    : {};
                } catch { /* malformed stats */ }
                const bonus = stats.compositionBonus as { combat: number } | undefined;
                const isFullComp = bonus && bonus.combat >= 1.05;
                return (
                  <span style={{ color: isFullComp ? '#4ade80' : '#f59e0b' }} title={isFullComp ? '+5% income, +5% combat, +5% espionage active' : 'Need mage (Sidhe/Elven/Vampire/Elemental/Fae) + warrior (Droben/Goblin/Dwarven/Centaur/Human) + scum (Centaur/Human/Vampire/Sidhe/Goblin)'}>
                    Composition: {isFullComp ? '✓ Full (+5% all)' : '✗ Partial (missing role)'}
                  </span>
                );
              })()}
            </div>

            {/* Member roster with race badges */}
            <GuildMemberList memberDetails={memberDetails} />
          </div>
          <div className="guild-actions">
            <button
              className="leave-btn"
              onClick={onLeaveGuild}
              disabled={loading}
            >
              {loading ? 'Leaving...' : 'Leave Alliance'}
            </button>
          </div>
        </div>
      ) : (
        <div className="no-guild">
          <h3>You are not in a guild</h3>
          <p>Join a guild to access shared resources, coordinate attacks, and chat with allies.</p>
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
  );
};

export default GuildOverview;
