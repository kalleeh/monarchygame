import React from 'react';
import { useKingdomStore } from '../stores/kingdomStore';
import './TopNavigation.css';

interface TopNavigationProps {
  title: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  subtitle?: string;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
  title,
  onBack,
  backLabel = '← Back',
  actions,
  subtitle
}) => {
  const resources = useKingdomStore((state) => state.resources);

  return (
    <header className="top-navigation">
      <div className="nav-left">
        <img src="/logo.png" alt="Monarchy" className="nav-logo" />
        {onBack && (
          <button onClick={onBack} className="back-btn">
            {backLabel}
          </button>
        )}
        <div className="nav-title-group">
          <h1 className="nav-title">{title}</h1>
          {subtitle && <span className="nav-subtitle">{subtitle}</span>}
        </div>
      </div>

      <div className="nav-right">
        {resources && (
          <div className="nav-resources">
            <span className="nav-resource" title="Turns available">
              <img src="/time-turns-icon.png" alt="Turns" className="nav-resource-icon" />
              {resources.turns ?? 0}
            </span>
            <span className="nav-resource" title="Gold">
              <img src="/gold-resource-icon.png" alt="Gold" className="nav-resource-icon" />
              {((resources.gold ?? 0) / 1000).toFixed(1)}K
            </span>
            <span className="nav-resource" title="Land">
              <img src="/land-resource-icon.png" alt="Land" className="nav-resource-icon" />
              {resources.land ?? 0}
            </span>
          </div>
        )}
        {actions && (
          <div className="nav-actions">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
};
