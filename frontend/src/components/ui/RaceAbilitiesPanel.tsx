import React from 'react';

interface RaceSpecialAbility {
  name: string;
  description: string;
  strategicValue?: string;
  [key: string]: unknown;
}

interface RaceStats {
  [stat: string]: number;
}

interface RaceData {
  name: string;
  specialAbility: RaceSpecialAbility;
  stats: RaceStats;
}

interface RaceAbilitiesPanelProps {
  raceData: RaceData | null | undefined;
  /** When true, hides the stat bars and strategic value — fits in a narrower side panel */
  compact?: boolean;
}

function formatStatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export function RaceAbilitiesPanel({ raceData, compact = false }: RaceAbilitiesPanelProps) {
  return (
    <div className={compact ? 'race-abilities-compact' : 'race-stats-panel'}>
      {!compact && <h2>Race Abilities</h2>}
      {compact && <div className="race-abilities-compact-header">⚔️ Race Abilities</div>}
      <div className="race-info">
        {raceData && (
          <div className="race-ability-highlight">
            <div className="race-ability-name">✨ Special Ability</div>
            <div className="race-ability-desc">{raceData.specialAbility.description}</div>
            {!compact && (raceData.specialAbility as any).strategicValue && (
              <div className="race-ability-effect">{(raceData.specialAbility as any).strategicValue}</div>
            )}
          </div>
        )}
        {!compact && (
          <div className="stats-mini">
            {raceData && Object.entries(raceData.stats).slice(0, 4).map(([stat, value]) => (
              <div key={stat} className="stat-mini">
                <span className="stat-name">{formatStatLabel(stat)}</span>
                <div className="stat-bar-mini">
                  <div className="stat-fill-mini" style={{ width: `${value * 20}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {compact && raceData && (
          <div className="stats-mini-compact">
            {Object.entries(raceData.stats).slice(0, 4).map(([stat, value]) => (
              <span key={stat} className="stat-chip">{formatStatLabel(stat)}: {value}/5</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
