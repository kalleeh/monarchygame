import React from 'react';
import { type GuildWar } from '../../services/GuildService';

interface ActiveWarCardProps {
  war: GuildWar;
  kingdom: { id: string; guildId?: string | null };
  isLeader: boolean;
  loading: boolean;
  onConcede: (warId: string) => void;
  onResolve: (warId: string) => void;
}

const ActiveWarCard: React.FC<ActiveWarCardProps> = ({
  war,
  kingdom,
  isLeader,
  loading,
  onConcede,
  onResolve,
}) => {
  const isAttacker = war.attackingGuildId === kingdom.guildId;
  const ourScore = isAttacker ? war.attackingScore : war.defendingScore;
  const theirScore = isAttacker ? war.defendingScore : war.attackingScore;
  const enemyName = isAttacker ? war.defendingGuildName : war.attackingGuildName;
  const endsAt = new Date(war.endsAt);
  const msLeft = endsAt.getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.floor(msLeft / 3600000));
  const minutesLeft = Math.max(0, Math.floor((msLeft % 3600000) / 60000));
  const isExpired = msLeft <= 0;

  const ourContribs = war.contributions
    .filter(c => c.guildId === kingdom.guildId)
    .sort((a, b) => b.score - a.score);

  return (
    <div style={{
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
      {isLeader && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isExpired && (
            <button
              onClick={() => onResolve(war.id)}
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
            onClick={() => onConcede(war.id)}
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
};

export default ActiveWarCard;
