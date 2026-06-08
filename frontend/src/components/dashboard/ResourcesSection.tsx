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
          {(() => {
            const bd = generationRates.breakdown;
            const row = (label: string, value: string, opts?: { strong?: boolean; rule?: boolean; muted?: boolean }) => (
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontWeight: opts?.strong ? 700 : 400,
                color: opts?.strong ? 'var(--text-primary)' : opts?.muted ? 'rgba(255,255,255,0.45)' : 'inherit',
                borderTop: opts?.rule ? '1px solid rgba(255,255,255,0.12)' : undefined,
                paddingTop: opts?.rule ? '0.3rem' : undefined, marginTop: opts?.rule ? '0.3rem' : undefined,
              }}>
                <span>{label}</span><span>{value}</span>
              </div>
            );
            return (
              <>
                {/* ── GOLD ── */}
                <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                  Gold / turn — {generationRates.goldPerTurn.toLocaleString()}
                </div>
                {bd.goldBase.map((s) => row(s.label, `+${s.amount.toLocaleString()}`))}
                {row('Subtotal', bd.goldSubtotal.toLocaleString(), { strong: true, rule: true })}
                {bd.ageMultiplier !== 1 && row(`Age bonus`, `× ${bd.ageMultiplier}`)}
                {bd.compositionIncomeBonus !== 1 && row('Alliance composition', `× ${bd.compositionIncomeBonus.toFixed(2)}`)}
                {bd.upgradeIncomeBonus !== 1 && row('Alliance upgrades', `× ${bd.upgradeIncomeBonus.toFixed(2)}`)}
                {bd.economicFocus && row('Faith: Economic Focus', `× ${bd.economicFocusMultiplier}`)}
                {bd.territoryGold > 0 && row('From buildings', bd.goldAfterMultipliers.toLocaleString(), { rule: true })}
                {bd.territoryGold > 0 && row('Territories', `+${bd.territoryGold.toLocaleString()}`)}
                {row('= Gold / turn', generationRates.goldPerTurn.toLocaleString(), { strong: true, rule: true })}

                {/* ── POPULATION ── */}
                {(bd.populationSources.length > 0 || generationRates.populationPerTurn > 0) && (
                  <div style={{ fontWeight: 700, margin: '0.6rem 0 0.35rem', color: 'var(--text-primary)' }}>
                    Population / turn — {generationRates.populationPerTurn.toLocaleString()}
                  </div>
                )}
                {bd.populationSources.map((s) => row(s.label, `+${s.amount.toLocaleString()}`))}

                {/* ── ELAN ── */}
                {bd.elanSources.length > 0 && (
                  <div style={{ fontWeight: 700, margin: '0.6rem 0 0.35rem', color: 'var(--text-primary)' }}>
                    Elan / turn — {generationRates.elanPerTurn.toLocaleString()}
                  </div>
                )}
                {bd.elanSources.map((s) => row(s.label, `+${s.amount.toLocaleString()}`))}

                {/* ── LAND ── */}
                {generationRates.landPerTurn > 0 && row('Land / turn (territories)', `+${generationRates.landPerTurn.toLocaleString()}`, { strong: true, rule: true })}

                <div style={{ marginTop: '0.5rem', fontStyle: 'italic', opacity: 0.6 }}>
                  Rates update as you build, claim territory, or the age advances. Turns regenerate
                  +1 every {TURN_MECHANICS.BASE_GENERATION.MINUTES_PER_TURN} min (max {TURN_MECHANICS.BASE_GENERATION.MAX_STORED_TURNS}).
                </div>
              </>
            );
          })()}
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
