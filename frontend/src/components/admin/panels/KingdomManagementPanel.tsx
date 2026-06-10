import React, { useState, useEffect, useCallback } from 'react';
import { getClient } from '../../../utils/amplifyClient';
import toast from 'react-hot-toast';
import { isDemoMode } from '../../../utils/authMode';
import { cleanupKingdom } from '../../../services/amplifyFunctionService';
import { parseResources, calcNetworth, type KingdomRow } from '../adminShared';
import { unwrapAmplifyJson } from '../../../utils/unwrapAmplifyJson';

export function KingdomManagementPanel() {
  const [kingdoms, setKingdoms] = useState<KingdomRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editGold, setEditGold] = useState(0);
  const [editPop, setEditPop] = useState(0);
  const [editTurns, setEditTurns] = useState(0);
  const [applying, setApplying] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      const raw = await getClient().mutations.manageSeason({ action: 'list_kingdoms_admin' });
      const parsed = unwrapAmplifyJson<{ success?: boolean; kingdoms?: KingdomRow[]; error?: string }>(raw);
      if (!parsed?.success) throw new Error(parsed?.error || 'Failed');
      setKingdoms((parsed.kingdoms ?? []) as KingdomRow[]);
    } catch (err) {
      toast.error('Failed to load kingdoms.');
      console.error('[AdminDashboard] KingdomManagement fetchKingdoms error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchKingdoms();
  }, [fetchKingdoms]);

  const openEdit = (k: KingdomRow) => {
    const res = parseResources(k.resources);
    setEditingId(k.id);
    setEditGold(res.gold);
    setEditPop(res.population);
    setEditTurns(res.turns);
  };

  const cancelEdit = () => setEditingId(null);

  const handleApply = async (kingdomId: string) => {
    if (isDemoMode()) {
      toast.success('[Demo] Resources updated (no-op)');
      setEditingId(null);
      return;
    }
    setApplying(true);
    try {
      // The updateResources mutation only accepts `turns` (it runs turn-based
      // income generation server-side); gold/population are derived, not set here.
      await getClient().mutations.updateResources({
        kingdomId,
        turns: editTurns,
      });
      toast.success('Kingdom turns updated (gold/population are server-derived).');
      setEditingId(null);
      await fetchKingdoms();
    } catch (err) {
      toast.error(`Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setApplying(false);
    }
  };

  const handleDelete = async (k: KingdomRow) => {
    if (!window.confirm(`Delete kingdom "${k.name ?? k.id}" and all its data? This cannot be undone.`)) return;
    if (isDemoMode()) {
      toast.success('[Demo] Kingdom deleted (no-op)');
      return;
    }
    setDeletingId(k.id);
    try {
      const result = await cleanupKingdom(k.id);
      if (!result.success) throw new Error(result.error || 'Delete failed');
      toast.success(`Kingdom "${k.name ?? k.id}" deleted.`);
      setKingdoms(prev => prev.filter(kk => kk.id !== k.id));
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = kingdoms.filter(k => !q || (k.name ?? '').toLowerCase().includes(q));
  const top20 = filtered
    .map(k => ({ k, nw: calcNetworth(parseResources(k.resources)) }))
    .sort((a, b) => b.nw - a.nw)
    .slice(0, 20);

  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <h2 className="admin-panel-title">Kingdom Management</h2>
        <button
          className="admin-btn admin-btn--secondary admin-btn--sm"
          onClick={() => { void fetchKingdoms(); }}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="admin-turn-controls" style={{ marginBottom: '1rem' }}>
        <label className="admin-label" htmlFor="km-search">Search kingdoms</label>
        <input
          id="km-search"
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Filter by name…"
          className="admin-number-input"
          style={{ width: '16rem' }}
        />
      </div>

      {top20.length === 0 && !loading && (
        <p className="admin-muted">No kingdoms found.</p>
      )}

      {top20.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Race</th>
              <th>Gold</th>
              <th>Population</th>
              <th>Land</th>
              <th>Turns</th>
              <th>Networth</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {top20.map(({ k, nw }) => {
              const res = parseResources(k.resources);
              const isEditing = editingId === k.id;
              return (
                <React.Fragment key={k.id}>
                  <tr>
                    <td>{k.name ?? '—'}</td>
                    <td>{k.race ?? '—'}</td>
                    <td>{res.gold > 0 ? res.gold.toLocaleString() : '—'}</td>
                    <td>{res.population > 0 ? res.population.toLocaleString() : '—'}</td>
                    <td>{res.land > 0 ? res.land.toLocaleString() : '—'}</td>
                    <td>{res.turns > 0 ? res.turns : '—'}</td>
                    <td className="admin-table-networth">{((k.networth ?? nw) || 0).toLocaleString()}</td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="admin-btn admin-btn--secondary admin-btn--sm"
                        onClick={() => isEditing ? cancelEdit() : openEdit(k)}
                      >
                        {isEditing ? 'Cancel' : 'Edit'}
                      </button>
                      <button
                        className="admin-btn admin-btn--danger admin-btn--sm"
                        onClick={() => { void handleDelete(k); }}
                        disabled={deletingId === k.id}
                      >
                        {deletingId === k.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr>
                      <td colSpan={8} style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <div>
                            <label className="admin-label" htmlFor={`km-gold-${k.id}`}>Gold</label>
                            <input
                              id={`km-gold-${k.id}`}
                              type="number"
                              min={0}
                              value={editGold}
                              onChange={e => setEditGold(parseInt(e.target.value) || 0)}
                              className="admin-number-input"
                              disabled={applying}
                            />
                          </div>
                          <div>
                            <label className="admin-label" htmlFor={`km-pop-${k.id}`}>Population</label>
                            <input
                              id={`km-pop-${k.id}`}
                              type="number"
                              min={0}
                              value={editPop}
                              onChange={e => setEditPop(parseInt(e.target.value) || 0)}
                              className="admin-number-input"
                              disabled={applying}
                            />
                          </div>
                          <div>
                            <label className="admin-label" htmlFor={`km-turns-${k.id}`}>Turns</label>
                            <input
                              id={`km-turns-${k.id}`}
                              type="number"
                              min={0}
                              value={editTurns}
                              onChange={e => setEditTurns(parseInt(e.target.value) || 0)}
                              className="admin-number-input"
                              disabled={applying}
                            />
                          </div>
                          <button
                            className="admin-btn admin-btn--primary"
                            onClick={() => { void handleApply(k.id); }}
                            disabled={applying}
                          >
                            {applying ? 'Applying…' : 'Apply'}
                          </button>
                          <button
                            className="admin-btn admin-btn--secondary"
                            onClick={cancelEdit}
                            disabled={applying}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

