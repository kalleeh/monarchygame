import { useState } from 'react';
import { isDemoMode } from '../../utils/authMode';
import './DemoTimeControl.css';

interface LoadingButtonProps {
  onClick: () => void;
  loading: boolean;
  className?: string;
  title?: string;
  children: React.ReactNode;
}

const LoadingButton = ({ onClick, loading, className, title, children }: LoadingButtonProps) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={className}
    title={title}
  >
    {loading ? '⏳' : children}
  </button>
);

interface DemoTimeControlProps {
  onTimeTravel: (hours: number) => Promise<void>;
}

export function DemoTimeControl({ onTimeTravel }: DemoTimeControlProps) {
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleTimeTravel = async (hours: number) => {
    setLoading(true);
    try {
      await onTimeTravel(hours);
    } finally {
      setLoading(false);
    }
  };

  // Only show in demo mode
  if (!isDemoMode()) return null;

  return (
    <div className="demo-time-control">
      <button 
        className="time-control-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Demo Time Control"
      >
        ⏰ Time Travel {isExpanded ? '▼' : '▶'}
      </button>
      
      {isExpanded && (
        <div className="time-control-panel">
          <h3>⏰ Demo Time Control</h3>
          <p className="time-control-hint">Fast-forward time to test mechanics</p>
          
          <div className="time-control-buttons">
            <LoadingButton
              onClick={() => handleTimeTravel(1)}
              loading={loading}
              className="time-btn"
              title="Generate 3 turns (1 hour = 3 turns)"
            >
              +1 Hour
            </LoadingButton>
            
            <LoadingButton
              onClick={() => handleTimeTravel(8)}
              loading={loading}
              className="time-btn"
              title="Generate 24 turns (8 hours)"
            >
              +8 Hours
            </LoadingButton>
            
            <LoadingButton
              onClick={() => handleTimeTravel(24)}
              loading={loading}
              className="time-btn"
              title="Generate 72 turns (24 hours)"
            >
              +1 Day
            </LoadingButton>
            
            <LoadingButton
              onClick={() => handleTimeTravel(168)}
              loading={loading}
              className="time-btn"
              title="Generate 504 turns (1 week)"
            >
              +1 Week
            </LoadingButton>
          </div>
          
          <div className="time-control-info">
            <small>
              • Turn generation: 3 per hour (20 min each)<br/>
              • Income generated per time period<br/>
              • Demo mode only - not available in live game
            </small>
          </div>
        </div>
      )}
    </div>
  );
}
