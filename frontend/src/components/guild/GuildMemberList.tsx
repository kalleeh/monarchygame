import React from 'react';

interface MemberDetail {
  id: string;
  name: string;
  race: string;
}

const MAGE_RACES = new Set(['Sidhe', 'Elven', 'Vampire', 'Elemental', 'Fae']);
const WARRIOR_RACES = new Set(['Droben', 'Goblin', 'Dwarven', 'Centaur', 'Human']);
const SCUM_RACES = new Set(['Centaur', 'Human', 'Vampire', 'Sidhe', 'Goblin']);

const RACE_EMOJIS: Record<string, string> = {
  Sidhe: '⚗️', Elven: '🌿', Vampire: '🧛', Elemental: '🔥', Fae: '✨',
  Droben: '⚔️', Goblin: '🗡️', Dwarven: '🪓', Centaur: '🏹', Human: '👑',
};

function getRacePillColor(race: string): string {
  if (MAGE_RACES.has(race)) return '#a855f7';
  if (SCUM_RACES.has(race)) return '#f59e0b';
  if (WARRIOR_RACES.has(race)) return '#ef4444';
  return '#6b7280';
}

function getRacePrimaryRole(race: string): 'mage' | 'warrior' | 'scum' | null {
  if (MAGE_RACES.has(race)) return 'mage';
  if (SCUM_RACES.has(race)) return 'scum';
  if (WARRIOR_RACES.has(race)) return 'warrior';
  return null;
}

interface GuildMemberListProps {
  memberDetails: MemberDetail[];
}

const GuildMemberList: React.FC<GuildMemberListProps> = ({ memberDetails }) => {
  if (memberDetails.length === 0) return null;

  const hasMage    = memberDetails.some(m => MAGE_RACES.has(m.race));
  const hasWarrior = memberDetails.some(m => WARRIOR_RACES.has(m.race));
  const hasScum    = memberDetails.some(m => SCUM_RACES.has(m.race));

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Role coverage summary */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '0.75rem',
        fontSize: '0.8rem',
        flexWrap: 'wrap',
      }}>
        <span style={{ color: hasMage ? '#4ade80' : '#6b7280' }}>
          {hasMage ? '✓' : '○'} Mage
        </span>
        <span style={{ color: hasWarrior ? '#4ade80' : '#6b7280' }}>
          {hasWarrior ? '✓' : '○'} Warrior
        </span>
        <span style={{ color: hasScum ? '#4ade80' : '#6b7280' }}>
          {hasScum ? '✓' : '○'} Scum
        </span>
      </div>
      {/* Member list */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.4rem',
      }}>
        {memberDetails.map(member => (
          <span
            key={member.id}
            title={`${member.name} — ${member.race} (${getRacePrimaryRole(member.race) ?? 'unknown'})`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.2rem 0.55rem',
              borderRadius: '999px',
              fontSize: '0.78rem',
              fontWeight: 500,
              background: `${getRacePillColor(member.race)}22`,
              border: `1px solid ${getRacePillColor(member.race)}66`,
              color: '#e2e8f0',
              cursor: 'default',
            }}
          >
            <span>{RACE_EMOJIS[member.race] ?? '👤'}</span>
            <span style={{ maxWidth: '10rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {member.name}
            </span>
            <span style={{ color: getRacePillColor(member.race), fontSize: '0.7rem' }}>
              {member.race}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default GuildMemberList;
