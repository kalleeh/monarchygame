/**
 * Page Wrapper - Consistent styling for all game pages
 */

import React from 'react';
import { TopNavigation } from '../TopNavigation';
import './PageWrapper.css';

interface PageWrapperProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  backLabel?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({
  title,
  subtitle,
  onBack,
  backLabel = '← Back to Kingdom',
  children,
  actions
}) => {
  return (
    <div className="page-wrapper">
      <TopNavigation
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        backLabel={backLabel}
        actions={actions}
      />
      <div className="page-content">
        {children}
      </div>
    </div>
  );
};
