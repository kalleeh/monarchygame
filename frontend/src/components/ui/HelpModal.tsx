import React, { useEffect, useRef } from 'react';

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1a2e',
          border: '1px solid rgba(78, 205, 196, 0.4)',
          borderRadius: '10px',
          padding: '1.5rem',
          maxWidth: '480px',
          width: '100%',
          color: '#e2e8f0',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 id="help-modal-title" style={{ margin: 0, color: '#4ecdc4', fontSize: '1rem', letterSpacing: '0.05em' }}>
            MONARCHY QUICK REFERENCE
          </h3>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted-accessible, #b0b8c4)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              lineHeight: 1,
              padding: '0.1rem 0.4rem',
            }}
            aria-label="Close help"
          >
            &times;
          </button>
        </div>
        <div style={{ borderTop: '1px solid rgba(78, 205, 196, 0.3)', marginBottom: '1rem' }} />
        <dl style={{ margin: 0, display: 'grid', gap: '0.6rem', fontSize: '0.85rem' }}>
          {[
            ['Turns', '3/hour (1 per 20 min), cap 100'],
            ['Combat', '4 turns per attack, win 6.79–7.35% enemy land'],
            ['Income', 'Mines ×20, Farms ×8, Towers ×50 gold/turn'],
            ['Magic', 'Temples generate elan, cast spells to damage enemies'],
            ['Elan', '12 temples → 2/turn (most races), 3/turn (Sidhe/Vampire)'],
            ['War', 'After 3 attacks on same target, must declare war'],
            ['Restoration', '48–72h after severe defeat — no combat'],
            ['Networth', 'Land ×1000 + Gold (used for rankings)'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: '0.75rem' }}>
              <dt style={{ minWidth: '90px', color: '#4ecdc4', fontWeight: 600, flexShrink: 0 }}>{label}</dt>
              <dd style={{ margin: 0, color: '#cbd5e1' }}>{value}</dd>
            </div>
          ))}
        </dl>
        <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(78, 205, 196, 0.15)',
              border: '1px solid rgba(78, 205, 196, 0.4)',
              borderRadius: '6px',
              color: '#4ecdc4',
              cursor: 'pointer',
              fontSize: '0.85rem',
              padding: '0.4rem 1rem',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
