import React, { useState, useEffect, useCallback } from 'react';
import { GuildService, type GuildData, type GuildWar } from '../../services/GuildService';
import { ToastService } from '../../services/toastService';
import { achievementTriggers } from '../../utils/achievementTriggers';
import ActiveWarCard from './ActiveWarCard';
import WarHistoryCard from './WarHistoryCard';
import DeclareWarModal from './DeclareWarModal';
import { SwordIcon } from '../ui/MenuIcons';

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally triggers only when the modal opens; kingdom.guildId is stable during modal lifecycle
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

  const handleCloseModal = () => {
    setShowDeclareWarModal(false);
    setSelectedWarTargetGuild(null);
    setWarTargetSearch('');
    setDeclareWarTargetId('');
    setDeclareWarTargetName('');
  };

  const isLeader = currentGuild?.leaderId === kingdom.id;

  return (
    <div className="guild-wars" style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>Guild Wars</h3>
        {/* Only guild leader can declare war (leaderId check) */}
        {isLeader && (
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
            activeWars.map(war => (
              <ActiveWarCard
                key={war.id}
                war={war}
                kingdom={kingdom}
                isLeader={isLeader ?? false}
                loading={loading}
                onConcede={warId => void handleConcedeWar(warId)}
                onResolve={warId => void handleResolveWar(warId)}
              />
            ))
          ) : (
            <div style={{ textAlign: 'center', color: '#a0a0a0', padding: '2rem 0', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}><SwordIcon /></div>
              <p style={{ margin: 0 }}>No active wars.</p>
              {isLeader && (
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
              {warHistory.map(war => (
                <WarHistoryCard key={war.id} war={war} kingdom={kingdom} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Declare War Modal ─────────────────────────────────── */}
      <DeclareWarModal
        isOpen={showDeclareWarModal}
        onClose={handleCloseModal}
        availableGuilds={availableGuilds}
        warGuildsLoading={warGuildsLoading}
        loading={loading}
        warTargetSearch={warTargetSearch}
        onSearchChange={setWarTargetSearch}
        selectedWarTargetGuild={selectedWarTargetGuild}
        onSelectGuild={setSelectedWarTargetGuild}
        onDeclare={() => void handleDeclareWar()}
      />
    </div>
  );
};

export default GuildWarsPanel;
