import React from 'react';

interface LoadingSkeletonProps {
  type?: 'dashboard' | 'list' | 'card' | 'page';
  className?: string;
}

const pulse: React.CSSProperties = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeleton-pulse 1.5s ease-in-out infinite',
  borderRadius: '6px',
};

const Bar = ({ w = '100%', h = '1rem' }: { w?: string; h?: string }) => (
  <div style={{ ...pulse, width: w, height: h }} />
);

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ type = 'page', className = '' }) => {
  const wrap: React.CSSProperties = { padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' };

  switch (type) {
    case 'dashboard':
      return (
        <div style={wrap} className={className}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Bar w="12rem" h="2rem" />
            <Bar w="6rem" h="2rem" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
            {[...Array(4)].map((_, i) => <div key={i} style={{ ...pulse, height: '4rem', borderRadius: '8px' }} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
            {[...Array(8)].map((_, i) => <div key={i} style={{ ...pulse, height: '3rem' }} />)}
          </div>
        </div>
      );
    case 'list':
      return (
        <div style={{ ...wrap, gap: '1rem' }} className={className}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <div style={{ ...pulse, width: '3rem', height: '3rem', borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Bar w="75%" />
                <Bar w="50%" h="0.75rem" />
              </div>
            </div>
          ))}
        </div>
      );
    case 'card':
      return (
        <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }} className={className}>
          <Bar w="75%" h="1.5rem" />
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Bar />
            <Bar w="83%" />
            <Bar w="66%" />
          </div>
        </div>
      );
    default:
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }} className={className}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ ...pulse, width: '4rem', height: '4rem', borderRadius: '50%' }} />
            <Bar w="8rem" />
          </div>
        </div>
      );
  }
};
