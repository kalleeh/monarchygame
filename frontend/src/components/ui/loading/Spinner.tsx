import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: '1rem', md: '1.5rem', lg: '2rem' };

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '' }) => {
  const dim = SIZES[size];
  return (
    <div
      className={className}
      style={{
        width: dim,
        height: dim,
        border: '2px solid rgba(255,255,255,0.15)',
        borderTopColor: '#4ecdc4',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
      }}
      role="status"
      aria-label="Loading"
    >
      <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Loading...</span>
    </div>
  );
};
