import React from 'react';

interface StatBarProps {
  value: number;
  statType: string;
  max?: number;
}

const statLabels: Record<string, string> = {
  offense: 'War Offense',
  defense: 'War Defense',
  sorcery: 'Sorcery',
  scum: 'Scum',
  forts: 'Forts',
  tithe: 'Tithe',
  training: 'Training',
  siege: 'Siege',
  economy: 'Economy',
  building: 'Building'
};

export const StatBar: React.FC<StatBarProps> = ({ value, statType, max = 5 }) => (
  <div className="stat-bar-container">
    <div className="stat-header">
      <span className="stat-name">{statLabels[statType] || statType}</span>
      <span className="stat-value">{value}/{max}</span>
    </div>
    <div className="stat-bar">
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={i < value ? `stat-fill ${statType}` : 'stat-dot'}
        />
      ))}
    </div>
  </div>
);
