/* eslint-disable */
/**
 * AdminDashboard — Dark-fantasy styled admin panel for the Monarchy Game.
 * Guarded by VITE_ADMIN_EMAILS env var (comma-separated) or demo mode.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchUserAttributes } from 'aws-amplify/auth';
import toast from 'react-hot-toast';
import type { Schema } from '../../../../amplify/data/resource';
import { isDemoMode } from '../../utils/authMode';
import './AdminDashboard.css';

const client = generateClient<Schema>();

// ─── Types ────────────────────────────────────────────────────────────────────

type KingdomRow = Schema['Kingdom']['type'];
type SeasonRow = Schema['GameSeason']['type'];

interface KingdomResources {
  gold: number;
  population: number;
  land: number;
  turns: number;
}

function parseResources(raw: unknown): KingdomResources {
  try {
    if (typeof raw === 'string') return { gold: 0, population: 0, land: 0, turns: 0, ...JSON.parse(raw) };
    if (raw && typeof raw === 'object') return { gold: 0, population: 0, land: 0, turns: 0, ...(raw as Record<string, number>) };
  } catch {
    /* ignore */
  }
  return { gold: 0, population: 0, land: 0, turns: 0 };
}

function calcNetworth(res: KingdomResources): number {
  return (res.land ?? 0) * 1000 + (res.gold ?? 0);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Season status badge
function StatusBadge({ status }: { status: string }) {
  const cls = status === 'active' ? 'badge badge--active' : status === 'transitioning' ? 'badge badge--transitioning' : 'badge badge--completed';
  return <span className={cls}>{status}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentEmail, setCurrentEmail] = useState('');

  useEffect(() => {
    const demo = isDemoMode();
    if (demo) {
      setIsAdmin(true);
      setCurrentEmail('demo@demo');
      setAuthChecked(true);
      return;
    }
    fetchUserAttributes()
      .then((attrs) => {
        const email = attrs.email || '';
        setCurrentEmail(email);
        const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '')
          .split(',')
          .map((e: string) => e.trim())
          .filter(Boolean);
        setIsAdmin(adminEmails.includes(email));
        setAuthChecked(true);
      })
      .catch(() => {
        setIsAdmin(false);
        setAuthChecked(true);
      });
  }, []);

  if (!authChecked) {
    return (
      <div className="admin-page">
        <div className="admin-loading">Verifying credentials…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-access-denied">
          <h2>Access Denied</h2>
          <p>You do not have permission to view this page.</p>
          <p className="admin-access-email">{currentEmail || 'Not signed in'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1 className="admin-title">
          <span className="admin-title-icon">⚙</span>
          Monarchy Admin
        </h1>
        {isDemoMode() && (
          <span className="admin-demo-badge">Demo Mode — changes won't persist</span>
        )}
      </header>

      <div className="admin-panels">
        <ActiveSeasonPanel />
        <KingdomOverviewPanel />
        <TurnManagementPanel />
        <SeasonHistoryPanel />
      </div>
    </div>
  );
}

// ─── Section 1: Active Season ─────────────────────────────────────────────────

function ActiveSeasonPanel() {
  const [season, setSeason] = useState<SeasonRow | null | undefined>(undefined); // undefined = loading
  const [loading, setLoading] = useState(false);
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
      const { data } = await client.models.GameSeason.list({
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
      const raw = await client.mutations.manageSeason({ action: 'create' });
      const result = typeof raw === 'string' ? JSON.parse(raw) : (raw as { data?: unknown }).data ?? raw;
      const parsed = typeof result === 'string' ? JSON.parse(result) : result as { success?: boolean; error?: string };
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
      const raw = await client.mutations.manageSeason({ action: 'check' });
      const result = typeof raw === 'string' ? JSON.parse(raw) : (raw as { data?: unknown }).data ?? raw;
      const parsed = typeof result === 'string' ? JSON.parse(result) : result as { success?: boolean; error?: string; processed?: unknown[] };
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

  const handleEnd = async () => {
    if (!season) return;
    if (!window.confirm(`End Season #${season.seasonNumber}? This will record final rankings and cannot be undone.`)) return;
    if (isDemoMode()) {
      toast.success('[Demo] Season ended (no-op)');
      return;
    }
    setActionLoading('end');
    try {
      const raw = await client.mutations.manageSeason({ action: 'end', seasonId: season.id });
      const result = typeof raw === 'string' ? JSON.parse(raw) : (raw as { data?: unknown }).data ?? raw;
      const parsed = typeof result === 'string' ? JSON.parse(result) : result as { success?: boolean; error?: string };
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

// ─── Section 2: Kingdom Overview ──────────────────────────────────────────────

function KingdomOverviewPanel() {
  const [kingdoms, setKingdoms] = useState<KingdomRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchKingdoms = useCallback(async () => {
    if (isDemoMode()) {
      setKingdoms([
        { id: 'demo-1', name: 'Iron Throne', race: 'Human', isOnline: true, resources: JSON.stringify({ gold: 50000, population: 5000, land: 300, turns: 20 }), stats: '{}', buildings: '{}', totalUnits: '{}', currentAge: 'early', isActive: true, createdAt: new Date().toISOString(), lastActive: new Date().toISOString(), owner: 'demo', updatedAt: new Date().toISOString() } as unknown as KingdomRow,
        { id: 'demo-2', name: 'Sylvan Vale', race: 'Elven', isOnline: false, resources: JSON.stringify({ gold: 80000, population: 4000, land: 500, turns: 15 }), stats: '{}', buildings: '{}', totalUnits: '{}', currentAge: 'early', isActive: true, createdAt: new Date().toISOString(), lastActive: new Date().toISOString(), owner: 'demo2', updatedAt: new Date().toISOString() } as unknown as KingdomRow,
        { id: 'demo-3', name: 'Goblin Warrens', race: 'Goblin', isOnline: true, resources: JSON.stringify({ gold: 20000, population: 8000, land: 200, turns: 5 }), stats: '{}', buildings: '{}', totalUnits: '{}', currentAge: 'early', isActive: true, createdAt: new Date().toISOString(), lastActive: new Date().toISOString(), owner: 'demo3', updatedAt: new Date().toISOString() } as unknown as KingdomRow,
      ]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await client.models.Kingdom.list();
      setKingdoms(data || []);
    } catch (err) {
      toast.error('Failed to load kingdoms.');
      console.error('[AdminDashboard] fetchKingdoms error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchKingdoms();
  }, [fetchKingdoms]);

  // Compute stats
  const onlineCount = kingdoms.filter((k) => k.isOnline).length;
  const raceCounts: Record<string, number> = {};
  kingdoms.forEach((k) => {
    const race = k.race ?? 'Unknown';
    raceCounts[race] = (raceCounts[race] ?? 0) + 1;
  });

  const top5 = kingdoms
    .map((k) => ({ k, nw: calcNetworth(parseResources(k.resources)) }))
    .sort((a, b) => b.nw - a.nw)
    .slice(0, 5);

  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <h2 className="admin-panel-title">Kingdom Overview</h2>
        <button
          className="admin-btn admin-btn--secondary admin-btn--sm"
          onClick={() => { void fetchKingdoms(); }}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="admin-stats-row">
        <div className="admin-stat-card">
          <span className="admin-stat-value">{kingdoms.length}</span>
          <span className="admin-stat-label">Total Kingdoms</span>
        </div>
        <div className="admin-stat-card admin-stat-card--online">
          <span className="admin-stat-value">{onlineCount}</span>
          <span className="admin-stat-label">Online Now</span>
        </div>
      </div>

      {Object.keys(raceCounts).length > 0 && (
        <div className="admin-race-breakdown">
          <h3 className="admin-sub-heading">Race Breakdown</h3>
          <div className="admin-race-grid">
            {Object.entries(raceCounts).sort((a, b) => b[1] - a[1]).map(([race, count]) => (
              <div key={race} className="admin-race-item">
                <span className="admin-race-name">{race}</span>
                <span className="admin-race-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {top5.length > 0 && (
        <div className="admin-top5">
          <h3 className="admin-sub-heading">Top 5 by Networth</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Kingdom</th>
                <th>Race</th>
                <th>Networth</th>
              </tr>
            </thead>
            <tbody>
              {top5.map(({ k, nw }, i) => (
                <tr key={k.id}>
                  <td className="admin-table-rank">{i + 1}</td>
                  <td>{k.name ?? '—'}</td>
                  <td>{k.race ?? '—'}</td>
                  <td className="admin-table-networth">{nw.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {kingdoms.length === 0 && !loading && (
        <p className="admin-muted">No kingdoms found.</p>
      )}
    </section>
  );
}

// ─── Section 3: Turn Management ───────────────────────────────────────────────

function TurnManagementPanel() {
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
      const { data: kingdoms } = await client.models.Kingdom.list({
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
          await client.mutations.updateResources({ kingdomId: kingdom.id, turns });
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
        Turns are generated client-side (20 min intervals). Use this to manually tick turns for all active kingdoms.
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

// ─── Section 4: Season History ────────────────────────────────────────────────

function SeasonHistoryPanel() {
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    if (isDemoMode()) {
      setSeasons([
        { id: 'old-1', seasonNumber: 0, status: 'completed', startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), endDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), participantCount: 5, currentAge: 'late', ageTransitions: null, createdAt: '', updatedAt: '', owner: null } as unknown as SeasonRow,
      ]);
      return;
    }
    setLoading(true);
    client.models.GameSeason.list({ filter: { status: { eq: 'completed' } } })
      .then(({ data }) => {
        const sorted = (data || [])
          .sort((a, b) => (b.seasonNumber ?? 0) - (a.seasonNumber ?? 0))
          .slice(0, 5);
        setSeasons(sorted);
      })
      .catch((err) => {
        console.error('[AdminDashboard] season history error', err);
        toast.error('Failed to load season history.');
      })
      .finally(() => setLoading(false));
  }, [expanded]);

  return (
    <section className="admin-panel">
      <div
        className="admin-panel-header admin-panel-header--clickable"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <h2 className="admin-panel-title">Season History</h2>
        <span className="admin-collapse-icon">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="admin-history-body">
          {loading ? (
            <p className="admin-muted">Loading…</p>
          ) : seasons.length === 0 ? (
            <p className="admin-muted">No completed seasons yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Season</th>
                  <th>End Date</th>
                  <th>Participants</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((s) => (
                  <tr key={s.id}>
                    <td>#{s.seasonNumber}</td>
                    <td>{s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}</td>
                    <td>{s.participantCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
