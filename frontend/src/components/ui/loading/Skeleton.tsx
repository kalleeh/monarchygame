import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

const pulse: React.CSSProperties = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeleton-pulse 1.5s ease-in-out infinite',
  borderRadius: '6px',
};

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', width = '100%', height = '1rem' }) => (
  <div
    className={className}
    style={{ ...pulse, width, height }}
    role="status"
    aria-label="Loading content"
  >
    <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Loading...</span>
  </div>
);

export const SkeletonCard: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
    <Skeleton height="8rem" />
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <Skeleton />
      <Skeleton width="80%" />
    </div>
  </div>
);
