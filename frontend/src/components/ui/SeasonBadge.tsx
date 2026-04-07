import React, { useState } from 'react';
import { calculateCurrentAge } from '../../../../shared/mechanics/age-mechanics';

interface SeasonBadgeProps {
  seasonNumber: number;
  currentAge: string;
  startDate: string;
}

const AGE_EFFECTS: Record<string, string> = {
  early: '🏗️ Building -20% · Income +20% · Defense +10%',
  middle: '⚖️ Balanced combat · Training -10%',
  late: '⚔️ Offense +10% · Defense -10% · Training -20% · Building +20%',
};

export function SeasonBadge({ seasonNumber, currentAge, startDate }: SeasonBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const ageStatus = calculateCurrentAge(new Date(startDate));
  const hoursLeft = Math.max(0, ageStatus.remainingTime);
  const timeDisplay = hoursLeft < 48
    ? `${Math.ceil(hoursLeft)}h left`
    : `${Math.ceil(hoursLeft / 24)}d left`;

  const ageColor = currentAge === 'early' ? '#9ca3af'
    : currentAge === 'middle' ? '#fbbf24' : '#f87171';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.25rem 0.75rem',
        marginBottom: '0.75rem',
        borderRadius: '999px',
        fontSize: '0.8rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
        background: currentAge === 'early'
          ? 'rgba(107, 114, 128, 0.2)'
          : currentAge === 'middle'
          ? 'rgba(245, 158, 11, 0.15)'
          : 'rgba(239, 68, 68, 0.15)',
        border: `1px solid ${
          currentAge === 'early'
            ? 'rgba(107, 114, 128, 0.4)'
            : currentAge === 'middle'
            ? 'rgba(245, 158, 11, 0.5)'
            : 'rgba(239, 68, 68, 0.5)'
        }`,
        color: ageColor,
        position: 'relative',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => setShowTooltip(prev => !prev)}
      role="status"
      aria-label={`Season ${seasonNumber}, ${currentAge} age, ${timeDisplay}`}
    >
      Season {seasonNumber} &middot; {currentAge.charAt(0).toUpperCase() + currentAge.slice(1)} Age{hoursLeft > 0 ? ` · ${timeDisplay}` : ''}
      <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>ℹ️</span>
      {showTooltip && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '0.25rem',
          padding: '0.5rem 0.75rem',
          background: '#1f2937',
          border: `1px solid ${ageColor}`,
          borderRadius: '8px',
          fontSize: '0.75rem',
          color: '#e5e7eb',
          whiteSpace: 'nowrap',
          zIndex: 50,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          {AGE_EFFECTS[currentAge] ?? 'Standard effects'}
        </div>
      )}
    </div>
  );
}
