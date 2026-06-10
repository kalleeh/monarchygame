import { useState, useEffect, useCallback } from 'react';
import { getClient } from '../../../utils/amplifyClient';
import toast from 'react-hot-toast';
import { isDemoMode } from '../../../utils/authMode';
import type { SeasonRow } from '../adminShared';
import { StatusBadge } from '../StatusBadge';
import { unwrapAmplifyJson } from '../../../utils/unwrapAmplifyJson';

export function ActiveSeasonPanel() {
  const [season, setSeason] = useState<SeasonRow | null | undefined>(undefined); // undefined = loading
  const [loading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSeason = useCallback(async () => {
    if (isDemoMode()) {
      setSeason({
        id: 'demo-season-1',
        seasonNumber: 1,
        status: 'active',
        currentAge: 'early',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: null,
        ageTransitions: null,
        participantCount: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: null,
      } as unknown as SeasonRow);
      return;
    }
    try {
      const { data } = await getClient().models.GameSeason.list({
        filter: { status: { eq: 'active' } },
      });
      setSeason(data && data.length > 0 ? data[0] : null);
    } catch (err) {
      console.error('[AdminDashboard] fetchSeason error', err);
      setSeason(null);
      toast.error('Failed to load active season.');
    }
  }, []);

  useEffect(() => {
    void fetchSeason();
  }, [fetchSeason]);

  const handleCreate = async () => {
    if (isDemoMode()) {
      toast.success('[Demo] Season created (no-op)');
      return;
    }
    setActionLoading('create');
    try {
      const raw = await getClient().mutations.manageSeason({ action: 'create' });
      const parsed = unwrapAmplifyJson<{ success?: boolean; error?: string }>(raw);
      if (parsed?.success === false) throw new Error(parsed.error || 'Create failed');
      toast.success('Season created successfully.');
      await fetchSeason();
    } catch (err) {
      toast.error(`Create season failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheck = async () => {
    if (isDemoMode()) {
      toast.success('[Demo] Season ages checked (no-op)');
      return;
    }
    setActionLoading('check');
    try {
      const raw = await getClient().mutations.manageSeason({ action: 'check' });
      const parsed = unwrapAmplifyJson<{ success?: boolean; error?: string; processed?: unknown[] }>(raw);
      if (parsed?.success === false) throw new Error(parsed.error || 'Check failed');
      const count = Array.isArray(parsed?.processed) ? parsed.processed.length : 0;
      toast.success(`Season check complete. ${count} season(s) processed.`);
      await fetchSeason();
    } catch (err) {
      toast.error(`Check ages failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSeedAI = async () => {
    if (!season) return;
    if (isDemoMode()) {
      toast.success('[Demo] AI kingdoms seeded (no-op)');
      return;
    }
    setActionLoading('seedAI');
    try {
      const raw = await getClient().mutations.manageSeason({
        action: 'seed_ai_kingdoms',
        seasonId: season.id,
      });
      const parsed = unwrapAmplifyJson<{ success?: boolean; created?: number; result?: string; error?: string }>(raw);
      if (parsed?.success === false) throw new Error(parsed.error || 'Seed failed');
      // `created` may be top-level or nested inside parsed.result
      const inner = parsed?.result ? unwrapAmplifyJson<{ created?: number }>(parsed.result) : null;
      const created = parsed?.created ?? inner?.created ?? 0;
      toast.success(`Seeded ${created} AI kingdoms for Season #${season.seasonNumber}.`);
    } catch (err) {
      toast.error(`Seed AI kingdoms failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnd = async () => {
    if (!season) return;
    if (!window.confirm(`End Season #${season.seasonNumber}? This will record final rankings and cannot be undone.`)) return;
    if (isDemoMode()) {
      toast.success('[Demo] Season ended (no-op)');
      return;
    }
    setActionLoading('end');
    try {
      const raw = await getClient().mutations.manageSeason({ action: 'end', seasonId: season.id });
      const parsed = unwrapAmplifyJson<{ success?: boolean; error?: string }>(raw);
      if (parsed?.success === false) throw new Error(parsed.error || 'End failed');
      toast.success(`Season #${season.seasonNumber} ended.`);
      // Notify all players about season end (via a broadcast mechanism)
      // For now, use a prominent toast on the admin's screen
      toast.success(`Season #${season.seasonNumber} ended! Final rankings recorded. Check the Leaderboard.`, {
        duration: 8000,
      });
      setSeason(null);
    } catch (err) {
      toast.error(`End season failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <h2 className="admin-panel-title">Active Season</h2>
        <button
          className="admin-btn admin-btn--secondary admin-btn--sm"
          onClick={() => { void fetchSeason(); }}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {season === undefined ? (
        <p className="admin-muted">Loading…</p>
      ) : season === null ? (
        <div className="admin-warning-box">
          <span className="admin-warning-icon">!</span>
          No active season. Create one to begin the game.
        </div>
      ) : (
        <div className="admin-season-info">
          <div className="admin-info-grid">
            <div className="admin-info-item">
              <span className="admin-info-label">Season</span>
              <span className="admin-info-value">#{season.seasonNumber}</span>
            </div>
            <div className="admin-info-item">
              <span className="admin-info-label">Status</span>
              <StatusBadge status={season.status ?? 'active'} />
            </div>
            <div className="admin-info-item">
              <span className="admin-info-label">Current Age</span>
              <span className="admin-info-value admin-info-value--capitalize">{season.currentAge ?? '—'}</span>
            </div>
            <div className="admin-info-item">
              <span className="admin-info-label">Start Date</span>
              <span className="admin-info-value">
                {season.startDate ? new Date(season.startDate).toLocaleDateString() : '—'}
              </span>
            </div>
            <div className="admin-info-item">
              <span className="admin-info-label">Participants</span>
              <span className="admin-info-value">{season.participantCount ?? 0}</span>
            </div>
          </div>
        </div>
      )}

      <div className="admin-btn-row">
        <button
          className="admin-btn admin-btn--primary"
          onClick={() => { void handleCreate(); }}
          disabled={!!actionLoading || season !== null && season !== undefined}
          title={season !== null && season !== undefined ? 'An active season already exists' : 'Create a new season'}
        >
          {actionLoading === 'create' ? 'Creating…' : 'Create Season'}
        </button>
        <button
          className="admin-btn admin-btn--secondary"
          onClick={() => { void handleCheck(); }}
          disabled={!!actionLoading}
        >
          {actionLoading === 'check' ? 'Checking…' : 'Check Ages'}
        </button>
        {season && (
          <button
            className="admin-btn admin-btn--secondary"
            onClick={() => { void handleSeedAI(); }}
            disabled={!!actionLoading}
          >
            {actionLoading === 'seedAI' ? 'Seeding…' : 'Seed AI Kingdoms'}
          </button>
        )}
        {season && (
          <button
            className="admin-btn admin-btn--danger"
            onClick={() => { void handleEnd(); }}
            disabled={!!actionLoading}
          >
            {actionLoading === 'end' ? 'Ending…' : 'End Season'}
          </button>
        )}
      </div>
    </section>
  );
}
