import React, { useState } from 'react';
import { GuildService, type GuildData, type AllianceRelationship } from '../../services/GuildService';
import { ToastService } from '../../services/toastService';
import { isDemoMode } from '../../utils/authMode';

interface GuildDiplomacyPanelProps {
  kingdom: { id: string; guildId?: string | null };
  currentGuild: GuildData | undefined;
}

const REL_LABELS: Record<AllianceRelationship['relationship'], string> = {
  neutral: 'Neutral',
  trade_pact: 'Trade Pact',
  non_aggression: 'Non-Aggression',
  allied: 'Allied',
  hostile: 'Hostile',
};

const REL_TOOLTIPS: Partial<Record<AllianceRelationship['relationship'], string>> = {
  trade_pact: '+5% caravan income for both alliances',
  allied: "Can see each other's intel",
};

const REL_COLORS: Record<AllianceRelationship['relationship'], string> = {
  neutral: '#9ca3af',
  trade_pact: '#34d399',
  non_aggression: '#60a5fa',
  allied: '#f59e0b',
  hostile: '#ef4444',
};

const GuildDiplomacyPanel: React.FC<GuildDiplomacyPanelProps> = ({ kingdom, currentGuild }) => {
  const [diplomacyTargetId, setDiplomacyTargetId] = useState('');
  const [diplomacyRelationship, setDiplomacyRelationship] = useState<AllianceRelationship['relationship']>('neutral');
  const [diplomacyLoading, setDiplomacyLoading] = useState(false);

  const relationships: AllianceRelationship[] = currentGuild?.stats?.relationships ?? [];
  const isLeader = currentGuild?.leaderId === kingdom.id;
  const demo = isDemoMode();

  const activeTradePacts = relationships.filter(r => r.relationship === 'trade_pact');

  const handleSetRelationship = async () => {
    if (!kingdom.guildId || !isLeader || demo || !diplomacyTargetId.trim()) return;
    try {
      setDiplomacyLoading(true);
      await GuildService.setInterAllianceRelationship(
        kingdom.guildId,
        kingdom.id,
        diplomacyTargetId.trim(),
        diplomacyRelationship
      );
      ToastService.success(`Relationship updated to ${REL_LABELS[diplomacyRelationship]}`);
      setDiplomacyTargetId('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update relationship';
      ToastService.error(msg);
    } finally {
      setDiplomacyLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '700px' }}>
      {/* Trade pact income indicator */}
      {activeTradePacts.length > 0 && (
        <div style={{
          padding: '0.6rem 1rem',
          background: 'rgba(52, 211, 153, 0.08)',
          border: '1px solid rgba(52, 211, 153, 0.3)',
          borderRadius: '6px',
          marginBottom: '1.25rem',
          fontSize: '0.85rem',
          color: '#34d399',
        }}>
          +5% trade income active ({activeTradePacts.length} trade pact{activeTradePacts.length !== 1 ? 's' : ''})
        </div>
      )}

      {/* Current relationships */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h4 style={{ margin: '0 0 0.75rem', color: '#a0a0a0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Current Relationships
        </h4>
        {relationships.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
            No alliance relationships established yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {relationships.map(rel => (
              <div key={rel.targetAllianceId} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.65rem 1rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '7px',
              }}>
                <span style={{ fontSize: '0.9rem', color: '#e2e8f0' }}>
                  {rel.targetAllianceName ?? rel.targetAllianceId}
                </span>
                <span style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: REL_COLORS[rel.relationship],
                  background: `${REL_COLORS[rel.relationship]}18`,
                  border: `1px solid ${REL_COLORS[rel.relationship]}44`,
                }}>
                  {REL_LABELS[rel.relationship]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Set relationship (leader only) */}
      {(isLeader || demo) && (
        <div style={{
          padding: '1.25rem',
          background: 'rgba(139, 92, 246, 0.05)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          borderRadius: '10px',
        }}>
          <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#e2e8f0' }}>
            Set Relationship
            {!isLeader && <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '0.8rem', marginLeft: '0.5rem' }}>(Leader only)</span>}
          </h4>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.3rem' }}>
                Target Alliance ID
              </label>
              <input
                type="text"
                value={diplomacyTargetId}
                onChange={e => setDiplomacyTargetId(e.target.value)}
                placeholder="Enter alliance ID…"
                disabled={demo}
                title={demo ? 'Sign in for full features' : undefined}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.3rem' }}>
                Relationship Status
              </label>
              <select
                value={diplomacyRelationship}
                onChange={e => setDiplomacyRelationship(e.target.value as AllianceRelationship['relationship'])}
                disabled={demo}
                title={demo ? 'Sign in for full features' : undefined}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: '#1a1a2e',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  boxSizing: 'border-box',
                }}
              >
                {(Object.entries(REL_LABELS) as [AllianceRelationship['relationship'], string][]).map(([val, label]) => (
                  <option key={val} value={val} title={REL_TOOLTIPS[val]}>
                    {label}{REL_TOOLTIPS[val] ? ` — ${REL_TOOLTIPS[val]}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              disabled={demo || !isLeader || diplomacyLoading || !diplomacyTargetId.trim()}
              onClick={() => void handleSetRelationship()}
              title={demo ? 'Sign in for full features' : !isLeader ? 'Only the alliance leader can set relationships' : undefined}
              style={{
                padding: '0.5rem 1.25rem',
                background: demo || !isLeader || !diplomacyTargetId.trim()
                  ? 'rgba(255,255,255,0.05)'
                  : 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(109,40,217,0.4))',
                border: '1px solid rgba(139,92,246,0.4)',
                borderRadius: '6px',
                color: demo || !isLeader || !diplomacyTargetId.trim() ? '#6b7280' : '#e2e8f0',
                cursor: demo || !isLeader || !diplomacyTargetId.trim() || diplomacyLoading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                opacity: diplomacyLoading ? 0.6 : 1,
                alignSelf: 'flex-start',
              }}
            >
              {diplomacyLoading ? 'Updating…' : demo ? 'Sign in for full features' : 'Update Relationship'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuildDiplomacyPanel;
