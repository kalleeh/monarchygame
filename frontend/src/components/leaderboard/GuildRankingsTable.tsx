import React from 'react';
import type { GuildRow } from './leaderboardHelpers';
import { SwordIcon, GoldIcon } from '../ui/MenuIcons';

interface GuildRankingsTableProps {
  guildRows: GuildRow[];
}

const GuildRankingsTable: React.FC<GuildRankingsTableProps> = ({ guildRows }) => {
  if (guildRows.length === 0) {
    return (
      <div className="lb-guilds-table-wrapper">
        <p className="lb-empty-state">No guilds found. Kingdoms must have a guild affiliation to appear here.</p>
      </div>
    );
  }

  return (
    <div className="lb-guilds-table-wrapper">
      <table className="lb-guilds-table" aria-label="Guild rankings">
        <thead>
          <tr>
            <th className="lb-guilds-th lb-guilds-th--rank">Rank</th>
            <th className="lb-guilds-th">Guild</th>
            <th className="lb-guilds-th lb-guilds-th--center">Members</th>
            <th className="lb-guilds-th lb-guilds-th--center">Comp</th>
            <th className="lb-guilds-th lb-guilds-th--right">Combined Networth</th>
          </tr>
        </thead>
        <tbody>
          {guildRows.map((row, idx) => (
            <tr key={row.guildId} className={`lb-guilds-row ${idx % 2 === 0 ? 'lb-guilds-row--even' : ''}`}>
              <td className="lb-guilds-td lb-guilds-td--rank">#{idx + 1}</td>
              <td className="lb-guilds-td lb-guilds-td--name">
                <span>{row.label}</span>
                {row.coordMultiplier > 1.0 && (
                  <span
                    title="Active coordination bonus"
                    style={{
                      marginLeft: '0.5rem',
                      padding: '0.1rem 0.4rem',
                      background: 'rgba(245,158,11,0.15)',
                      border: '1px solid rgba(245,158,11,0.4)',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      color: '#f59e0b',
                      fontWeight: 600,
                      verticalAlign: 'middle',
                    }}
                  >
                    Coord: {row.coordMultiplier.toFixed(1)}×
                  </span>
                )}
              </td>
              <td className="lb-guilds-td lb-guilds-td--center">{row.members}</td>
              <td className="lb-guilds-td lb-guilds-td--center">
                {row.hasFullComposition ? (
                  <span title="Full composition: mage + warrior + scum" style={{ fontSize: '1rem', letterSpacing: '-0.05em' }}>
                    <SwordIcon />&#x1F3AD;<GoldIcon />
                  </span>
                ) : (
                  <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                    {row.hasWarrior ? <SwordIcon /> : '·'}
                    {row.hasMage ? '🎭' : '·'}
                    {row.hasScum ? <GoldIcon /> : '·'}
                  </span>
                )}
              </td>
              <td className="lb-guilds-td lb-guilds-td--right">
                {(row.totalNW / 1_000_000).toFixed(2)}M
                {row.coordMultiplier > 1.0 && (
                  <span style={{ color: '#f59e0b', fontSize: '0.75rem', marginLeft: '0.3rem' }}>
                    ({(row.sortKey / 1_000_000).toFixed(2)}M eff.)
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GuildRankingsTable;
