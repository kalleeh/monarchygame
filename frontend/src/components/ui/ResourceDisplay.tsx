import { useKingdomStore } from '../../stores/kingdomStore';
import './ResourceDisplay.css';

interface ResourceDisplayProps {
  compact?: boolean;
  showLabels?: boolean;
}

export function ResourceDisplay({ compact = false, showLabels = true }: ResourceDisplayProps) {
  const resources = useKingdomStore((state) => state.resources);

  if (compact) {
    return (
      <div className="resource-display-compact">
        <span className="resource-compact" title="Gold">
          💰 {resources?.gold?.toLocaleString() || 0}
        </span>
        <span className="resource-compact" title="Population">
          👥 {resources?.population?.toLocaleString() || 0}
        </span>
        <span className="resource-compact" title="Land">
          🏞️ {resources?.land?.toLocaleString() || 0}
        </span>
        <span className="resource-compact" title="Turns">
          ⏱️ {resources?.turns || 0}
        </span>
      </div>
    );
  }

  return (
    <div className="resource-display">
      <div className="resource-item">
        <span className="resource-icon">💰</span>
        <div className="resource-info">
          <div className="resource-value">{resources?.gold?.toLocaleString() || 0}</div>
          {showLabels && <div className="resource-label">Gold</div>}
        </div>
      </div>
      <div className="resource-item">
        <span className="resource-icon">👥</span>
        <div className="resource-info">
          <div className="resource-value">{resources?.population?.toLocaleString() || 0}</div>
          {showLabels && <div className="resource-label">Population</div>}
        </div>
      </div>
      <div className="resource-item">
        <span className="resource-icon">🏞️</span>
        <div className="resource-info">
          <div className="resource-value">{resources?.land?.toLocaleString() || 0}</div>
          {showLabels && <div className="resource-label">Land</div>}
        </div>
      </div>
      <div className="resource-item">
        <span className="resource-icon">⏱️</span>
        <div className="resource-info">
          <div className="resource-value">{resources?.turns || 0}</div>
          {showLabels && <div className="resource-label">Turns</div>}
        </div>
      </div>
    </div>
  );
}
