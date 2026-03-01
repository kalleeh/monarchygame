/**
 * UnitRoster — Reference panel for the game's unit tier system.
 * Shows all unit types with tier, stats, cost, and role description.
 * Opened as a modal from KingdomDashboard via the "? Units" button.
 */

import React from 'react';

interface UnitRosterProps {
  onClose: () => void;
}

const UNIT_TIERS = [
  { tier: 1, name: 'Infantry',   attack: 3, defense: 2, cost: '100g',  role: 'Standard ground troops. Good for bulk armies.' },
  { tier: 1, name: 'Archers',    attack: 4, defense: 2, cost: '100g',  role: 'Ranged. Bonus vs. cavalry.' },
  { tier: 2, name: 'Cavalry',    attack: 5, defense: 3, cost: '100g',  role: 'Fast assault. Strong vs. infantry.' },
  { tier: 2, name: 'Scouts',     attack: 2, defense: 1, cost: '100g',  role: 'Required for espionage operations. Min 100.' },
  { tier: 3, name: 'Mages',      attack: 3, defense: 1, cost: '100g',  role: 'Magical damage. Benefit from elan.' },
  { tier: 3, name: 'Siege',      attack: 3, defense: 3, cost: '100g',  role: 'Bonus vs. fortifications. Required for siege.' },
  { tier: 4, name: 'Scum',       attack: 0, defense: 0, cost: '100g',  role: 'Espionage only. Powers all thievery operations.' },
  { tier: 4, name: 'Elite Scum', attack: 0, defense: 0, cost: '200g',  role: 'Enhanced espionage. Higher success rate.' },
] as const;

const TIER_COLORS: Record<number, { bg: string; border: string; label: string }> = {
  1: { bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.4)',  label: '#94a3b8' },
  2: { bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.35)',  label: '#60a5fa' },
  3: { bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.35)',  label: '#a78bfa' },
  4: { bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.35)',   label: '#f87171' },
};

const TIER_NAMES: Record<number, string> = {
  1: 'Basic',
  2: 'Advanced',
  3: 'Elite',
  4: 'Special',
};

function StatBar({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          style={{
            width: '10px',
            height: '6px',
            borderRadius: '2px',
            background: i < value ? '#4ecdc4' : 'rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

const UnitRoster: React.FC<UnitRosterProps> = ({ onClose }) => {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      aria-modal="true"
      role="dialog"
      aria-label="Unit Roster Reference"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(15,15,30,0.98)',
          border: '1px solid rgba(139,92,246,0.45)',
          borderRadius: '12px',
          padding: '1.5rem',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          color: '#e2e8f0',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#a78bfa', letterSpacing: '0.05em' }}>
            UNIT ROSTER REFERENCE
          </h3>
          <button
            onClick={onClose}
            aria-label="Close unit roster"
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '1.25rem',
              lineHeight: 1,
              padding: '0.1rem 0.4rem',
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ borderTop: '1px solid rgba(139,92,246,0.25)', marginBottom: '1.25rem' }} />

        {/* Unit grid — two columns on wider screens */}
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
          {UNIT_TIERS.map(unit => {
            const tc = TIER_COLORS[unit.tier];
            return (
              <div
                key={unit.name}
                style={{
                  padding: '0.9rem 1rem',
                  background: tc.bg,
                  border: `1px solid ${tc.border}`,
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {/* Tier badge + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    padding: '0.15rem 0.45rem',
                    background: `${tc.border}`,
                    borderRadius: '3px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: tc.label,
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                  }}>
                    T{unit.tier} {TIER_NAMES[unit.tier]}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9' }}>
                    {unit.name}
                  </span>
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', fontSize: '0.78rem' }}>
                  <div>
                    <div style={{ color: '#9ca3af', marginBottom: '0.2rem' }}>Attack</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: '#f87171', fontWeight: 700, minWidth: '1ch' }}>{unit.attack}</span>
                      <StatBar value={unit.attack} max={5} />
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#9ca3af', marginBottom: '0.2rem' }}>Defense</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: '#60a5fa', fontWeight: 700, minWidth: '1ch' }}>{unit.defense}</span>
                      <StatBar value={unit.defense} max={5} />
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#9ca3af', marginBottom: '0.2rem' }}>Cost</div>
                    <div style={{ color: '#fbbf24', fontWeight: 600 }}>{unit.cost}</div>
                  </div>
                </div>

                {/* Role */}
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', borderTop: `1px solid ${tc.border}`, paddingTop: '0.4rem' }}>
                  {unit.role}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.78rem', color: '#6b7280' }}>
          Stats shown are base values. Race bonuses, elan, and alliance upgrades may modify effective combat power.
          Scouts (min 100) are required before espionage operations. Scum units do not participate in combat.
        </div>

        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.4)',
              borderRadius: '6px',
              color: '#a78bfa',
              cursor: 'pointer',
              fontSize: '0.85rem',
              padding: '0.4rem 1rem',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnitRoster;
