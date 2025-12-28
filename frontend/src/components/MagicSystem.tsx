/**
 * Magic System Component - Enhanced with Zustand State Management
 * IQC Compliant: Integrity (server validation), Quality (animations), Consistency (patterns)
 */

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { TopNavigation } from './TopNavigation';
import { SpellCastingInterface } from './SpellCastingInterface';
import { useSpellStore } from '../stores/spellStore';
import type { Schema } from '../../../amplify/data/resource';
import './SpellCastingInterface.css';

interface MagicSystemProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
}

const MagicSystemContent: React.FC<MagicSystemProps> = ({ kingdom, onBack }) => {
  const { currentElan, maxElan } = useSpellStore();

  return (
    <div className="magic-system">
      <TopNavigation
        title="🔮 Magic System"
        subtitle={`Mana: ${currentElan}/${maxElan}`}
        onBack={onBack}
        backLabel="← Back to Kingdom"
      />

      <SpellCastingInterface kingdomId={kingdom.id} />
    </div>
  );
};

export const MagicSystem: React.FC<MagicSystemProps> = (props) => {
  return (
    <ErrorBoundary fallback={
      <div className="magic-system-error" style={{ 
        padding: '2rem', 
        textAlign: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        minHeight: '100vh'
      }}>
        <h2>⚠️ Magic System Error</h2>
        <p>The magic system encountered an error. Please try refreshing the page.</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--primary)',
            color: 'var(--text-primary)',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer'
          }}
        >
          Refresh Page
        </button>
      </div>
    }>
      <MagicSystemContent {...props} />
    </ErrorBoundary>
  );
};
