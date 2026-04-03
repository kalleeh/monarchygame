import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useCombatReplayStore } from '../stores/combatReplayStore';

function ReplaysListRoute({ onNavigate }: { onNavigate: (replayId: string) => void }) {
  const { kingdomId } = useParams<{ kingdomId: string }>();
  const loadReplays = useCombatReplayStore((state) => state.loadReplaysFromBattleReports);
  const getRecentReplays = useCombatReplayStore((state) => state.getRecentReplays);

  useEffect(() => {
    if (kingdomId) void loadReplays(kingdomId);
  }, [kingdomId, loadReplays]);

  const replays = getRecentReplays(20);

  if (replays.length === 0) {
    return (
      <div style={{ padding: '2rem', color: '#9ca3af', textAlign: 'center' }}>
        <p>No replays available yet. Fight a battle to record one.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem 2rem' }}>
      {replays.map((replay) => (
        <div
          key={replay.battleId}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            marginBottom: '0.5rem',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div>
            <span style={{ color: replay.result === 'victory' ? '#22c55e' : '#ef4444', marginRight: '0.5rem' }}>
              {replay.result === 'victory' ? 'Victory' : 'Defeat'}
            </span>
            <span style={{ color: '#d1d5db' }}>vs {replay.defenderName}</span>
            <span style={{ color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.75rem' }}>
              {new Date(replay.timestamp).toLocaleDateString()}
            </span>
          </div>
          <button
            className="action-btn"
            style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}
            onClick={() => onNavigate(replay.battleId)}
          >
            View Replay
          </button>
        </div>
      ))}
    </div>
  );
}

export default ReplaysListRoute;
