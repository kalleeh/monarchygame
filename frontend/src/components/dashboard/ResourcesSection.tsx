import { useState } from 'react';
import { isDemoMode } from '../../utils/authMode';
import { LoadingButton } from '../ui/loading/LoadingButton';
import { EncampPanel } from '../ui/EncampPanel';
import type { GenerationRates } from '../../../../shared/mechanics/economy-mechanics';
import { TURN_MECHANICS } from '../../../../shared/mechanics/turn-mechanics';

/** Renders a "+N/turn" rate line; hidden when zero so it stays uncluttered. */
function RatePerTurn({ amount, unit = '/turn', color = '#4ecdc4' }: { amount: number; unit?: string; color?: string }) {
  if (!amount) return null;
  return (
    <div style={{ fontSize: '0.7rem', color, fontWeight: 600 }}>
      +{amount.toLocaleString()}{unit}
    </div>
  );
}

interface ResourceStatusInfo {
  label: string;
  color: string;
}

interface ResourcesSectionProps {
  networth: number;
  resources: { gold?: number; population?: number; land?: number; turns?: number; elan?: number; mana?: number };
  resourceStatus: {
    gold: ResourceStatusInfo;
    population: ResourceStatusInfo;
    land: ResourceStatusInfo;
    turns: ResourceStatusInfo;
  };
  generationRates: GenerationRates;
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
  generationRates,
  resourceLoading,
  onGenerateTurns,
  onGenerateIncome,
  kingdomId,
  encampEndTimeMs,
  encampBonusTurns,
  onEncamp,
  encampLoading,
}: ResourcesSectionProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const elanRate = generationRates.elanPerTurn;
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
            <RatePerTurn amount={generationRates.goldPerTurn} />
            <div style={{ fontSize: '0.7rem', color: resourceStatus.gold.color }}>{resourceStatus.gold.label}</div>
          </div>
        </div>
        <div className="resource-item">
          <img src="/population-resource-icon.png" alt="Population" className="resource-icon-img" />
          <div>
            <div className="resource-value">{resources?.population || 0}</div>
            <div className="resource-label">Population</div>
            <RatePerTurn amount={generationRates.populationPerTurn} />
            <div style={{ fontSize: '0.7rem', color: resourceStatus.population.color }}>{resourceStatus.population.label}</div>
          </div>
        </div>
        <div className="resource-item">
          <img src="/land-resource-icon.png" alt="Land" className="resource-icon-img" />
          <div>
            <div className="resource-value">{resources?.land || 0}</div>
            <div className="resource-label">Land</div>
            <RatePerTurn amount={generationRates.landPerTurn} />
          </div>
        </div>
        <div className="resource-item">
          <img src="/time-turns-icon.png" alt="Turns" className="resource-icon-img" />
          <div>
            <div className="resource-value">{resources?.turns || 0}</div>
            <div className="resource-label">Turns</div>
            <div style={{ fontSize: '0.7rem', color: '#4ecdc4', fontWeight: 600 }}>
              +1 / {TURN_MECHANICS.BASE_GENERATION.MINUTES_PER_TURN}min (max {TURN_MECHANICS.BASE_GENERATION.MAX_STORED_TURNS})
            </div>
            <div style={{ fontSize: '0.7rem', color: resourceStatus.turns.color }}>{resourceStatus.turns.label}</div>
          </div>
        </div>
        {elanRate > 0 && (
          <div className="resource-item">
            <img src="/mana-resource-icon.png" alt="Elan" className="resource-icon-img"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
            <div>
              <div className="resource-value">{resources?.elan ?? resources?.mana ?? 0}</div>
              <div className="resource-label">Elan</div>
              <RatePerTurn amount={elanRate} color="#a78bfa" />
            </div>
          </div>
        )}
      </div>

      {/* Per-turn economy breakdown — explains exactly where gold/turn comes from. */}
      <button
        type="button"
        className="economy-breakdown-toggle"
        onClick={() => setShowBreakdown(v => !v)}
        aria-expanded={showBreakdown}
        style={{
          background: 'none', border: 'none', color: 'var(--text-secondary)',
          fontSize: '0.75rem', cursor: 'pointer', padding: '0.25rem 0', textDecoration: 'underline',
        }}
      >
        {showBreakdown ? '▾ Hide' : '▸ Show'} income breakdown
      </button>
      {showBreakdown && (
        <div className="economy-breakdown" style={{
          fontSize: '0.75rem', color: 'var(--text-secondary)',
          background: 'rgba(255,255,255,0.03)', borderRadius: '0.4rem', padding: '0.6rem 0.8rem', marginBottom: '0.75rem',
        }}>
          <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>Gold / turn — {generationRates.goldPerTurn.toLocaleString()}</div>
          {generationRates.breakdown.goldBase.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{s.label}</span><span>+{s.amount.toLocaleString()}</span>
            </div>
          ))}
          {generationRates.breakdown.ageMultiplier !== 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Age bonus</span><span>×{generationRates.breakdown.ageMultiplier}</span>
            </div>
          )}
          {generationRates.breakdown.territoryGold > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Territories</span><span>+{generationRates.breakdown.territoryGold.toLocaleString()}</span>
            </div>
          )}
          {generationRates.breakdown.populationSources.length > 0 && (
            <div style={{ fontWeight: 700, margin: '0.5rem 0 0.35rem', color: 'var(--text-primary)' }}>Population / turn — {generationRates.populationPerTurn.toLocaleString()}</div>
          )}
          {generationRates.breakdown.populationSources.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{s.label}</span><span>+{s.amount.toLocaleString()}</span>
            </div>
          ))}
          <div style={{ marginTop: '0.5rem', fontStyle: 'italic', opacity: 0.7 }}>
            Alliance & faith bonuses, if any, are applied on top at each tick.
          </div>
        </div>
      )}

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
