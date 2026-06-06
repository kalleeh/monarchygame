import { useState } from 'react';
import { getClient } from '../../../utils/amplifyClient';
import toast from 'react-hot-toast';
import { isDemoMode } from '../../../utils/authMode';

export function TurnManagementPanel() {
  const [turnsToAdd, setTurnsToAdd] = useState(1);
  const [ticking, setTicking] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleTickAll = async () => {
    const turns = Math.max(1, Math.min(10, turnsToAdd));
    if (isDemoMode()) {
      setProgress('Ticking 3 kingdoms (demo)…');
      await new Promise((r) => setTimeout(r, 600));
      setProgress(null);
      setLastResult(`Ticked 3 kingdoms (+${turns} turns each) [Demo Mode]`);
      toast.success(`[Demo] Ticked 3 kingdoms (+${turns} turns each)`);
      return;
    }

    setTicking(true);
    setProgress(null);
    setLastResult(null);

    try {
      const { data: kingdoms } = await getClient().models.Kingdom.list({
        filter: { isActive: { eq: true } },
      });
      if (!kingdoms || kingdoms.length === 0) {
        toast('No active kingdoms to tick.');
        setTicking(false);
        return;
      }

      setProgress(`Ticking ${kingdoms.length} kingdoms…`);
      let successCount = 0;

      for (const kingdom of kingdoms) {
        try {
          await getClient().mutations.updateResources({ kingdomId: kingdom.id, turns });
          successCount++;
          setProgress(`Ticked ${successCount} / ${kingdoms.length} kingdoms…`);
        } catch (err) {
          console.error(`[AdminDashboard] tick failed for ${kingdom.id}`, err);
        }
      }

      setProgress(null);
      setLastResult(`Ticked ${successCount} kingdoms (+${turns} turns each)`);
      toast.success(`Ticked ${successCount} kingdoms (+${turns} turns each)`);
    } catch (err) {
      toast.error(`Failed to tick kingdoms: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setProgress(null);
    } finally {
      setTicking(false);
    }
  };

  return (
    <section className="admin-panel">
      <h2 className="admin-panel-title">Turn Management</h2>
      <p className="admin-muted admin-turn-note">
        Player kingdom turns are generated server-side by the turn-ticker Lambda (EventBridge, every 20 min).
        Use this to manually credit additional turns to all active kingdoms.
        Note: AI kingdoms are simulated client-side only and are not affected here.
      </p>

      <div className="admin-turn-controls">
        <label className="admin-label" htmlFor="turns-input">
          Turns to add
        </label>
        <input
          id="turns-input"
          type="number"
          min={1}
          max={10}
          value={turnsToAdd}
          onChange={(e) => setTurnsToAdd(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
          className="admin-number-input"
          disabled={ticking}
        />
        <button
          className="admin-btn admin-btn--primary"
          onClick={() => { void handleTickAll(); }}
          disabled={ticking}
        >
          {ticking ? 'Ticking…' : 'Tick All Kingdoms'}
        </button>
      </div>

      {progress && (
        <p className="admin-progress">{progress}</p>
      )}
      {lastResult && !ticking && (
        <p className="admin-result">{lastResult}</p>
      )}
    </section>
  );
}

