import React, { useState, useEffect, useCallback } from 'react';
import { GuildService, type GuildData, type GuildWar } from '../../services/GuildService';
import { ToastService } from '../../services/toastService';
import { achievementTriggers } from '../../utils/achievementTriggers';

interface GuildWarsPanelProps {
  kingdom: { id: string; guildId?: string | null };
  currentGuild: GuildData | undefined;
  isVisible: boolean;
}

const GuildWarsPanel: React.FC<GuildWarsPanelProps> = ({ kingdom, currentGuild, isVisible }) => {
  const [activeWars, setActiveWars] = useState<GuildWar[]>([]);
  const [warHistory, setWarHistory] = useState<GuildWar[]>([]);
  const [warsLoading, setWarsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeclareWarModal, setShowDeclareWarModal] = useState(false);
  const [declareWarTargetId, setDeclareWarTargetId] = useState('');
  const [declareWarTargetName, setDeclareWarTargetName] = useState('');
  const [availableGuilds, setAvailableGuilds] = useState<GuildData[]>([]);
  const [warTargetSearch, setWarTargetSearch] = useState('');
  const [selectedWarTargetGuild, setSelectedWarTargetGuild] = useState<GuildData | null>(null);
  const [warGuildsLoading, setWarGuildsLoading] = useState(false);

  const loadWars = useCallback(async () => {
    if (!kingdom.guildId) return;
    try {
      setWarsLoading(true);
      const { active, history } = await GuildService.loadGuildWars(kingdom.guildId);
      setActiveWars(active);
      setWarHistory(history);
    } catch (error) {
      console.error('Failed to load guild wars:', error);
    } finally {
      setWarsLoading(false);
    }
  }, [kingdom.guildId]);

  // Load wars when panel becomes visible
  useEffect(() => {
    if (isVisible && kingdom.guildId) {
      void loadWars();
    }
  }, [isVisible, kingdom.guildId, loadWars]);

  // When the declare-war modal opens, fetch the guild list for the picker.
  useEffect(() => {
    if (!showDeclareWarModal) return;

    setWarTargetSearch('');
    setSelectedWarTargetGuild(null);

    const populate = async () => {
      try {
        setWarGuildsLoading(true);
        const fetched = await GuildService.getPublicGuilds();
        setAvailableGuilds(fetched.filter(g => g.id !== kingdom.guildId));
      } catch (err) {
        console.error('[GuildWarsPanel] Failed to load guilds for war picker:', err);
        setAvailableGuilds([]);
      } finally {
        setWarGuildsLoading(false);
      }
    };
    void populate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeclareWarModal]);

  const handleDeclareWar = async () => {
    if (!kingdom.guildId || !currentGuild) return;

    const targetId   = selectedWarTargetGuild ? selectedWarTargetGuild.id   : declareWarTargetId.trim();
    const targetName = selectedWarTargetGuild ? selectedWarTargetGuild.name : declareWarTargetName.trim();

    if (!targetId || !targetName) {
      ToastService.error('Select a guild to declare war on');
      return;
    }
    try {
      setLoading(true);
      await GuildService.declareGuildWar({
        attackingGuildId: kingdom.guildId,
        defendingGuildId: targetId,
        declaringKingdomId: kingdom.id,
        attackingGuildName: currentGuild.name,
        defendingGuildName: targetName,
      });
      achievementTriggers.onGuildWarDeclared();
      ToastService.success(`War declared on ${targetName}!`);
      setShowDeclareWarModal(false);
      setSelectedWarTargetGuild(null);
      setDeclareWarTargetId('');
      setDeclareWarTargetName('');
      setWarTargetSearch('');
      await loadWars();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to declare war';
      ToastService.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConcedeWar = async (warId: string) => {
    if (!kingdom.guildId) return;
    if (!window.confirm('Are you sure you want to concede this war? The enemy guild will be declared the winner.')) return;
    try {
      setLoading(true);
      await GuildService.concedeGuildWar(warId, kingdom.guildId);
      ToastService.success('War conceded');
      await loadWars();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to concede war';
      ToastService.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveWar = async (warId: string) => {
    try {
      setLoading(true);
      const resolved = await GuildService.resolveGuildWar(warId);
      if (resolved.winnerId === kingdom.guildId) {
        ToastService.success('War resolved — your guild wins!');
      } else if (resolved.winnerId) {
        ToastService.error('War resolved — your guild lost.');
      } else {
        ToastService.success("War resolved — it's a tie!");
      }
      await loadWars();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to resolve war';
      ToastService.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="guild-wars" style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>Guild Wars</h3>
        {/* Only guild leader can declare war (leaderId check) */}
        {currentGuild?.leaderId === kingdom.id && (
          <button
            onClick={() => setShowDeclareWarModal(true)}
            disabled={loading || activeWars.length > 0}
            style={{
              background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '6px',
              cursor: activeWars.length > 0 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: activeWars.length > 0 ? 0.5 : 1,
            }}
            title={activeWars.length > 0 ? 'Already in an active war' : 'Declare war on a guild'}
          >
            Declare War
          </button>
        )}
      </div>

      {warsLoading ? (
        <p style={{ color: '#a0a0a0', textAlign: 'center', padding: '2rem' }}>Loading wars...</p>
      ) : (
        <>
          {/* ── Active Wars ────────────────────────────────────── */}
          {activeWars.length > 0 ? (
            activeWars.map(war => {
              const isAttacker = war.attackingGuildId === kingdom.guildId;
              const ourScore = isAttacker ? war.attackingScore : war.defendingScore;
              const theirScore = isAttacker ? war.defendingScore : war.attackingScore;
              const enemyName = isAttacker ? war.defendingGuildName : war.attackingGuildName;
              const endsAt = new Date(war.endsAt);
              const msLeft = endsAt.getTime() - Date.now();
              const hoursLeft = Math.max(0, Math.floor(msLeft / 3600000));
              const minutesLeft = Math.max(0, Math.floor((msLeft % 3600000) / 60000));
              const isExpired = msLeft <= 0;

              const ourContribs = war.contributions
                .filter(c => c.guildId === kingdom.guildId)
                .sort((a, b) => b.score - a.score);

              return (
                <div key={war.id} style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                }}>
                  {/* War header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                        War vs {enemyName}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#a0a0a0' }}>
                        Declared {new Date(war.declaredAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                    }}>
                      ACTIVE
                    </span>
                  </div>

                  {/* Score */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    marginBottom: '1rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                  }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ecdc4' }}>{ourScore}</div>
                      <div style={{ fontSize: '0.75rem', color: '#a0a0a0' }}>Our Score</div>
                    </div>
                    <div style={{ color: '#666', fontSize: '1.25rem' }}>vs</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{theirScore}</div>
                      <div style={{ fontSize: '0.75rem', color: '#a0a0a0' }}>{enemyName}</div>
                    </div>
                  </div>

                  {/* Time remaining */}
                  <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: isExpired ? '#ef4444' : '#a0a0a0' }}>
                    {isExpired
                      ? 'War has expired — awaiting resolution'
                      : `Ends in: ${hoursLeft}h ${minutesLeft}m`}
                  </div>

                  {/* Member contributions */}
                  {ourContribs.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#ccc' }}>
                        Member Contributions
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', color: '#a0a0a0' }}>Kingdom</th>
                            <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', color: '#a0a0a0' }}>Attacks</th>
                            <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', color: '#a0a0a0' }}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ourContribs.map(c => (
                            <tr key={c.kingdomId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '0.25rem 0.5rem' }}>{c.kingdomName}</td>
                              <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>{c.attackCount}</td>
                              <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right', color: '#4ecdc4' }}>{c.score}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Actions — leader only */}
                  {currentGuild?.leaderId === kingdom.id && (
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {isExpired && (
                        <button
                          onClick={() => void handleResolveWar(war.id)}
                          disabled={loading}
                          style={{
                            background: 'rgba(78, 205, 196, 0.2)',
                            border: '1px solid rgba(78, 205, 196, 0.5)',
                            color: '#4ecdc4',
                            padding: '0.4rem 1rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          Resolve War
                        </button>
                      )}
                      <button
                        onClick={() => void handleConcedeWar(war.id)}
                        disabled={loading}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#ef4444',
                          padding: '0.4rem 1rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Concede War
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', color: '#a0a0a0', padding: '2rem 0', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚔️</div>
              <p style={{ margin: 0 }}>No active wars.</p>
              {currentGuild?.leaderId === kingdom.id && (
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  Use the <strong>Declare War</strong> button to challenge another guild.
                </p>
              )}
            </div>
          )}

          {/* ── War History ────────────────────────────────────── */}
          {warHistory.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ color: '#a0a0a0', marginBottom: '0.75rem', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Past Wars
              </h4>
              {warHistory.map(war => {
                const isAttacker = war.attackingGuildId === kingdom.guildId;
                const ourScore = isAttacker ? war.attackingScore : war.defendingScore;
                const theirScore = isAttacker ? war.defendingScore : war.attackingScore;
                const enemyName = isAttacker ? war.defendingGuildName : war.attackingGuildName;
                const won = war.winnerId === kingdom.guildId;
                const tied = !war.winnerId;

                return (
                  <div key={war.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.6rem 0.75rem',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '6px',
                    marginBottom: '0.4rem',
                    fontSize: '0.875rem',
                  }}>
                    <span style={{ color: '#ccc' }}>{enemyName}</span>
                    <span style={{
                      color: tied ? '#a0a0a0' : won ? '#4ecdc4' : '#ef4444',
                      fontWeight: 600,
                      margin: '0 1rem',
                    }}>
                      {tied ? 'Tied' : won ? 'Won' : 'Lost'}
                    </span>
                    <span style={{ color: '#a0a0a0' }}>{ourScore} — {theirScore}</span>
                    <span style={{ color: '#666', marginLeft: '1rem' }}>
                      {new Date(war.declaredAt).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Declare War Modal ─────────────────────────────────── */}
      {showDeclareWarModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
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
            <h4 style={{ marginTop: 0, color: '#ef4444', flexShrink: 0 }}>Declare Guild War</h4>
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
                  onClick={() => setSelectedWarTargetGuild(null)}
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
              onChange={e => setWarTargetSearch(e.target.value)}
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
                        onClick={() => setSelectedWarTargetGuild(isSelected ? null : g)}
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
                onClick={() => {
                  setShowDeclareWarModal(false);
                  setSelectedWarTargetGuild(null);
                  setWarTargetSearch('');
                  setDeclareWarTargetId('');
                  setDeclareWarTargetName('');
                }}
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
                onClick={() => void handleDeclareWar()}
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
      )}
    </div>
  );
};

export default GuildWarsPanel;
