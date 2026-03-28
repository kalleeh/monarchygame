import React from 'react';
import { calculateCurrentAge } from '../../../../shared/mechanics/age-mechanics';

interface SeasonBadgeProps {
  seasonNumber: number;
  currentAge: string;
  startDate: string;
}

export function SeasonBadge({ seasonNumber, currentAge, startDate }: SeasonBadgeProps) {
  const ageStatus = calculateCurrentAge(new Date(startDate));
  const hoursLeft = Math.max(0, ageStatus.remainingTime);
  const timeDisplay = hoursLeft < 48
    ? `${Math.ceil(hoursLeft)}h left`
    : `${Math.ceil(hoursLeft / 24)}d left`;

  return (
    <div style={{
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
      color: currentAge === 'early'
        ? '#9ca3af'
        : currentAge === 'middle'
        ? '#fbbf24'
        : '#f87171',
    }}>
      Season {seasonNumber} &middot; {currentAge.charAt(0).toUpperCase() + currentAge.slice(1)} Age{hoursLeft > 0 ? ` · ${timeDisplay}` : ''}
    </div>
  );
}
