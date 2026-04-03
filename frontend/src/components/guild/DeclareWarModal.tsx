import React from 'react';
import { type GuildData } from '../../services/GuildService';

interface DeclareWarModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableGuilds: GuildData[];
  warGuildsLoading: boolean;
  loading: boolean;
  warTargetSearch: string;
  onSearchChange: (value: string) => void;
  selectedWarTargetGuild: GuildData | null;
  onSelectGuild: (guild: GuildData | null) => void;
  onDeclare: () => void;
}

const DeclareWarModal: React.FC<DeclareWarModalProps> = ({
  isOpen,
  onClose,
  availableGuilds,
  warGuildsLoading,
  loading,
  warTargetSearch,
  onSearchChange,
  selectedWarTargetGuild,
  onSelectGuild,
  onDeclare,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby="declare-war-title" style={{
        background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.99) 0%, rgba(22, 33, 62, 0.99) 100%)',
        border: '1px solid rgba(239,68,68,0.5)',
        borderRadius: '12px',
        padding: '1.5rem',
        width: '100%',
        maxWidth: '460px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <h4 id="declare-war-title" style={{ marginTop: 0, color: '#ef4444', flexShrink: 0 }}>Declare Guild War</h4>
        <p style={{ color: '#a0a0a0', fontSize: '0.875rem', marginBottom: '1rem', flexShrink: 0 }}>
          Select a target guild below. Wars last 72 hours — the guild with
          the higher combined score wins.
        </p>

        {/* Selected guild highlight */}
        {selectedWarTargetGuild && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.5rem 0.75rem',
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.45)',
            borderRadius: '6px',
            marginBottom: '0.75rem',
            flexShrink: 0,
          }}>
            <span style={{ color: '#ef4444', fontSize: '1rem' }}>⚔</span>
            <span style={{ color: '#fff', fontWeight: 600, flex: 1 }}>
              [{selectedWarTargetGuild.tag}] {selectedWarTargetGuild.name}
            </span>
            <span style={{ color: '#a0a0a0', fontSize: '0.8rem' }}>
              {selectedWarTargetGuild.memberCount} members
            </span>
            <button
              onClick={() => onSelectGuild(null)}
              style={{
                background: 'none', border: 'none', color: '#a0a0a0',
                cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '0 0.2rem',
              }}
              aria-label="Clear selection"
            >
              ✕
            </button>
          </div>
        )}

        {/* Search input */}
        <input
          type="search"
          value={warTargetSearch}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search alliances by name…"
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            background: 'var(--bg-card, #0f1923)',
            border: '1px solid var(--border-primary, #334)',
            borderRadius: '6px',
            color: 'var(--text-primary, #fff)',
            boxSizing: 'border-box',
            marginBottom: '0.6rem',
            flexShrink: 0,
          }}
        />

        {/* Guild list */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          marginBottom: '1rem',
          minHeight: '120px',
          maxHeight: '300px',
          border: '1px solid var(--border-primary, #334)',
          borderRadius: '6px',
        }}>
          {warGuildsLoading ? (
            <p style={{ textAlign: 'center', color: '#a0a0a0', padding: '1.5rem', margin: 0 }}>
              Loading guilds…
            </p>
          ) : availableGuilds.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#a0a0a0', padding: '1.5rem', margin: 0 }}>
              No other alliances found.
            </p>
          ) : (
            availableGuilds
              .filter(g => {
                const q = warTargetSearch.trim().toLowerCase();
                return !q || g.name.toLowerCase().includes(q) || g.tag.toLowerCase().includes(q);
              })
              .map(g => {
                const isSelected = selectedWarTargetGuild?.id === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => onSelectGuild(isSelected ? null : g)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      background: isSelected
                        ? 'rgba(239,68,68,0.15)'
                        : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border-primary, #334)',
                      color: 'var(--text-primary, #fff)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      gap: '0.6rem',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    {/* Checkmark column */}
                    <span style={{
                      width: '16px',
                      flexShrink: 0,
                      color: '#ef4444',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                    }}>
                      {isSelected ? '✓' : ''}
                    </span>

                    {/* Tag + Name */}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontSize: '0.72rem',
                        color: '#a0a0a0',
                        marginRight: '0.3rem',
                        fontFamily: 'monospace',
                      }}>
                        [{g.tag}]
                      </span>
                      <span style={{ fontWeight: isSelected ? 600 : 400 }}>{g.name}</span>
                    </span>

                    {/* Members */}
                    <span style={{ fontSize: '0.8rem', color: '#a0a0a0', flexShrink: 0 }}>
                      {g.memberCount}/{g.maxMembers} members
                    </span>

                    {/* Power */}
                    <span style={{ fontSize: '0.8rem', color: '#4ecdc4', flexShrink: 0, marginLeft: '0.5rem' }}>
                      {g.totalPower.toLocaleString()} pw
                    </span>
                  </button>
                );
              })
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--border-primary, #334)',
              color: 'var(--text-secondary, #aaa)',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onDeclare}
            disabled={loading || !selectedWarTargetGuild}
            style={{
              background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '6px',
              cursor: selectedWarTargetGuild && !loading ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              opacity: loading || !selectedWarTargetGuild ? 0.5 : 1,
            }}
          >
            {loading ? 'Declaring…' : 'Declare War'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeclareWarModal;
