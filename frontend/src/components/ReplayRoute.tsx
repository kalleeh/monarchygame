import { useParams } from 'react-router-dom';
import { useCombatReplayStore } from '../stores/combatReplayStore';
import { lazy, Suspense } from 'react';
import { LoadingSkeleton } from './ui/loading/LoadingSkeleton';

const CombatReplayViewer = lazy(() => import('./combat/CombatReplayViewer').then(m => ({ default: m.CombatReplayViewer })));

function ReplayRoute({ onBack }: { onBack: () => void }) {
  const { replayId } = useParams<{ replayId: string }>();
  const getReplay = useCombatReplayStore((state) => state.getReplay);
  const replay = replayId ? getReplay(replayId) : undefined;

  if (!replay) {
    return (
      <div style={{ padding: '2rem', color: '#9ca3af', textAlign: 'center' }}>
        <p>Replay not found.</p>
        <button className="back-btn" onClick={onBack}>← Back to Kingdom</button>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingSkeleton type="card" className="m-8" />}>
      <CombatReplayViewer replay={replay} onClose={onBack} />
    </Suspense>
  );
}

export default ReplayRoute;
