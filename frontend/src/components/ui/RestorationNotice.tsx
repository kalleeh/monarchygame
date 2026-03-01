import React from 'react';

interface RestorationNoticeProps {
  isInRestoration: boolean;
  restorationType: string;
  getRemainingHours: () => number;
  prohibitedActions: string[];
}

export function RestorationNotice({
  isInRestoration,
  restorationType,
  getRemainingHours,
  prohibitedActions,
}: RestorationNoticeProps) {
  if (!isInRestoration) return null;

  return (
    <div style={{
      padding: '1rem 1.5rem',
      marginBottom: '1rem',
      background: restorationType === 'death_based'
        ? 'rgba(239, 68, 68, 0.15)'
        : 'rgba(245, 158, 11, 0.15)',
      border: `2px solid ${restorationType === 'death_based'
        ? 'rgba(239, 68, 68, 0.5)'
        : 'rgba(245, 158, 11, 0.5)'}`,
      borderRadius: '8px',
      color: restorationType === 'death_based' ? '#ef4444' : '#f59e0b',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <strong style={{ fontSize: '1.1rem' }}>
          Kingdom in Restoration
        </strong>
        <span style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '0.25rem 0.75rem',
          borderRadius: '12px',
          fontSize: '0.85rem',
        }}>
          {restorationType === 'death_based' ? 'Death-Based' : 'Damage-Based'} &mdash; {getRemainingHours().toFixed(1)} hours remaining
        </span>
      </div>
      {prohibitedActions.length > 0 && (
        <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
          <span style={{ fontWeight: 600 }}>Prohibited actions: </span>
          {prohibitedActions.join(', ')}
        </div>
      )}
    </div>
  );
}
