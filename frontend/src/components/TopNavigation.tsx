import React from 'react';
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
        <h1 className="nav-title">{title}</h1>
        {subtitle && <span className="nav-subtitle">{subtitle}</span>}
      </div>
      
      <div className="nav-right">
        {actions}
      </div>
    </header>
  );
};
