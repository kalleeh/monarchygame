import React from 'react';
import type { GuildData } from '../../services/GuildService';

interface GuildBrowseProps {
  guilds: GuildData[];
  loading: boolean;
  onJoinGuild: (guildId: string) => void;
}

const GuildBrowse: React.FC<GuildBrowseProps> = ({ guilds, loading, onJoinGuild }) => {
  return (
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
                <span>Power: {(guild.totalPower ?? 0).toLocaleString()}</span>
                <span>Leader: {guild.leaderName}</span>
                {(() => {
                  let stats: Record<string, unknown> = {};
                  try {
                    const rawStats = guild.stats as unknown;
                    stats = rawStats
                      ? (typeof rawStats === 'string' ? JSON.parse(rawStats as string) : (rawStats as Record<string, unknown>))
                      : {};
                  } catch { /* malformed stats */ }
                  const bonus = stats.compositionBonus as { combat: number } | undefined;
                  const isFullComp = bonus && bonus.combat >= 1.05;
                  return (
                    <span style={{ color: isFullComp ? '#4ade80' : '#f59e0b', fontSize: '0.8em' }} title={isFullComp ? '+5% income, +5% combat, +5% espionage active' : 'Need mage + warrior + scum for +5% bonus'}>
                      {isFullComp ? '✓ Full comp' : '○ Partial comp'}
                    </span>
                  );
                })()}
              </div>
              <button
                className="join-btn"
                onClick={() => onJoinGuild(guild.id)}
                disabled={loading || guild.memberCount >= guild.maxMembers}
              >
                {guild.memberCount >= guild.maxMembers ? 'Full' : 'Join Alliance'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GuildBrowse;
