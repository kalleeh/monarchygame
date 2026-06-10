import { useState, useEffect, useCallback } from 'react';
import { getClient } from '../../../utils/amplifyClient';
import toast from 'react-hot-toast';
import { isDemoMode } from '../../../utils/authMode';
import { parseResources, calcNetworth, type KingdomRow } from '../adminShared';
import { unwrapAmplifyJson } from '../../../utils/unwrapAmplifyJson';

export function KingdomOverviewPanel() {
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
      // Use Lambda to bypass Amplify field-level auth (resources is owner-restricted via AppSync)
      const raw = await getClient().mutations.manageSeason({ action: 'list_kingdoms_admin' });
      const parsed = unwrapAmplifyJson<{ success?: boolean; kingdoms?: KingdomRow[]; error?: string }>(raw);
      if (!parsed?.success) throw new Error(parsed?.error || 'Failed');
      setKingdoms((parsed.kingdoms ?? []) as KingdomRow[]);
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
    .map((k) => ({ k, nw: k.networth ?? calcNetworth(parseResources(k.resources)) }))
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

