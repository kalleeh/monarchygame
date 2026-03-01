import React from 'react';
import { type GuildWar } from '../../services/GuildService';

interface WarHistoryCardProps {
  war: GuildWar;
  kingdom: { id: string; guildId?: string | null };
}

const WarHistoryCard: React.FC<WarHistoryCardProps> = ({ war, kingdom }) => {
  const isAttacker = war.attackingGuildId === kingdom.guildId;
  const ourScore = isAttacker ? war.attackingScore : war.defendingScore;
  const theirScore = isAttacker ? war.defendingScore : war.attackingScore;
  const enemyName = isAttacker ? war.defendingGuildName : war.attackingGuildName;
  const won = war.winnerId === kingdom.guildId;
  const tied = !war.winnerId;

  return (
    <div style={{
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
};

export default WarHistoryCard;
