import React from 'react';
import { useKingdomStore } from '../stores/kingdomStore';
import './TopNavigation.css';

interface TopNavigationProps {
  title: string;
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
        {onBack && (
          <button onClick={onBack} className="back-btn">
            {backLabel}
          </button>
        )}
      </div>

      <div className="nav-center">
        <img src="/logo.png" alt="Monarchy" className="nav-logo" />
        <h1 className="nav-title">{title}</h1>
        {subtitle && <span className="nav-subtitle">{subtitle}</span>}
      </div>

      {resources && (
        <div className="nav-resources">
          <span className="nav-resource" title="Turns available">⏱️ {resources.turns ?? 0}</span>
          <span className="nav-resource" title="Gold">💰 {((resources.gold ?? 0) / 1000).toFixed(1)}K</span>
          <span className="nav-resource" title="Land">🏞️ {resources.land ?? 0}</span>
        </div>
      )}

      <div className="nav-right">
        {actions}
      </div>
    </header>
  );
};
