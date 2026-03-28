import React from 'react';
import { isDemoMode } from '../../utils/authMode';
import { LoadingButton } from '../ui/loading/LoadingButton';
import { EncampPanel } from '../ui/EncampPanel';

interface ResourceStatusInfo {
  label: string;
  color: string;
}

interface ResourcesSectionProps {
  networth: number;
  resources: { gold?: number; population?: number; land?: number; turns?: number };
  resourceStatus: {
    gold: ResourceStatusInfo;
    population: ResourceStatusInfo;
    land: ResourceStatusInfo;
    turns: ResourceStatusInfo;
  };
  resourceLoading: boolean;
  onGenerateTurns: () => void;
  onGenerateIncome: () => void;
  kingdomId: string;
  encampEndTimeMs: number | null;
  encampBonusTurns: number;
  onEncamp: (duration: 16 | 24) => void;
  encampLoading: boolean;
}

export function ResourcesSection({
  networth,
  resources,
  resourceStatus,
  resourceLoading,
  onGenerateTurns,
  onGenerateIncome,
  kingdomId,
  encampEndTimeMs,
  encampBonusTurns,
  onEncamp,
  encampLoading,
}: ResourcesSectionProps) {
  return (
    <div className="resources-panel">
      <h2>Resources</h2>

      {/* Networth Display */}
      <div className="networth-display" style={{
        padding: '1rem',
        marginBottom: '1rem',
        background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.1) 0%, rgba(79, 172, 254, 0.1) 100%)',
        border: '2px solid var(--primary)',
        borderRadius: '0.5rem',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
          KINGDOM NETWORTH (SCORE)
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
          {networth.toLocaleString()}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Land × 1,000 + Gold + Units × 100
        </div>
      </div>

      <div className="resources-grid">
        <div className="resource-item">
          <img src="/gold-resource-icon.png" alt="Gold" className="resource-icon-img" />
          <div>
            <div className="resource-value">{resources?.gold || 0}</div>
            <div className="resource-label">Gold</div>
            <div style={{ fontSize: '0.7rem', color: resourceStatus.gold.color }}>{resourceStatus.gold.label}</div>
          </div>
        </div>
        <div className="resource-item">
          <img src="/population-resource-icon.png" alt="Population" className="resource-icon-img" />
          <div>
            <div className="resource-value">{resources?.population || 0}</div>
            <div className="resource-label">Population</div>
            <div style={{ fontSize: '0.7rem', color: resourceStatus.population.color }}>{resourceStatus.population.label}</div>
          </div>
        </div>
        <div className="resource-item">
          <img src="/land-resource-icon.png" alt="Land" className="resource-icon-img" />
          <div>
            <div className="resource-value">{resources?.land || 0}</div>
            <div className="resource-label">Land</div>
          </div>
        </div>
        <div className="resource-item">
          <img src="/time-turns-icon.png" alt="Turns" className="resource-icon-img" />
          <div>
            <div className="resource-value">{resources?.turns || 0}</div>
            <div className="resource-label">Turns</div>
            <div style={{ fontSize: '0.7rem', color: resourceStatus.turns.color }}>{resourceStatus.turns.label}</div>
          </div>
        </div>
      </div>

      {/* Demo-only shortcuts — in auth mode turns/income are server-generated
          on a 20-minute timer; manual buttons would bypass anti-cheat */}
      {isDemoMode() && (
        <div className="resource-actions">
          <LoadingButton
            onClick={onGenerateTurns}
            loading={resourceLoading}
            className="resource-btn"
          >
            Generate Turns
          </LoadingButton>
          <LoadingButton
            onClick={onGenerateIncome}
            loading={resourceLoading}
            className="resource-btn"
          >
            Generate Income
          </LoadingButton>
        </div>
      )}

      <EncampPanel
        kingdomId={kingdomId}
        encampEndTimeMs={encampEndTimeMs}
        encampBonusTurns={encampBonusTurns}
        onEncamp={onEncamp}
        encampLoading={encampLoading}
      />
    </div>
  );
}
