import { useState, useEffect, useCallback } from 'react';
import { getClient } from '../../../utils/amplifyClient';
import toast from 'react-hot-toast';
import { isDemoMode } from '../../../utils/authMode';

interface ClientErrorRow {
  id: string;
  message: string;
  stack?: string | null;
  source?: string | null;
  url?: string | null;
  kingdomId?: string | null;
  appVersion?: string | null;
  fingerprint?: string | null;
  occurredAt: string;
}

/** Admin view of recently reported client errors/crashes, grouped by fingerprint. */
export function ErrorLogPanel() {
  const [errors, setErrors] = useState<ClientErrorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchErrors = useCallback(async () => {
    if (isDemoMode()) {
      setErrors([]);
      return;
    }
    setLoading(true);
    try {
      // Most recent first via the source+occurredAt index isn't global; a bounded
      // list + client sort is fine for an admin view.
      const { data } = await getClient().models.ClientError.list({ limit: 200 });
      const sorted = [...(data ?? [])]
        .sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''))
        .slice(0, 100) as unknown as ClientErrorRow[];
      setErrors(sorted);
    } catch (err) {
      console.error('[ErrorLogPanel] fetch failed', err);
      toast.error('Failed to load error log.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchErrors(); }, [fetchErrors]);

  // Group by fingerprint to surface the most frequent crashes first.
  const groups = new Map<string, { sample: ClientErrorRow; count: number; latest: string }>();
  for (const e of errors) {
    const key = e.fingerprint || e.message;
    const g = groups.get(key);
    if (g) {
      g.count++;
      if (e.occurredAt > g.latest) g.latest = e.occurredAt;
    } else {
      groups.set(key, { sample: e, count: 1, latest: e.occurredAt });
    }
  }
  const grouped = [...groups.values()].sort((a, b) => b.latest.localeCompare(a.latest));

  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <h2 className="admin-panel-title">Client Error Log</h2>
        <button
          className="admin-btn admin-btn--secondary admin-btn--sm"
          onClick={() => { void fetchErrors(); }}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {isDemoMode() ? (
        <p className="admin-muted">Error log is unavailable in demo mode.</p>
      ) : loading ? (
        <p className="admin-muted">Loading…</p>
      ) : grouped.length === 0 ? (
        <div className="admin-warning-box" style={{ borderColor: '#10b981' }}>
          No client errors reported. 🎉
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>×</th>
              <th>Message</th>
              <th>Source</th>
              <th>URL</th>
              <th>Latest</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ sample, count, latest }) => (
              <tr
                key={sample.fingerprint || sample.id}
                onClick={() => setExpanded(expanded === sample.id ? null : sample.id)}
                style={{ cursor: 'pointer' }}
              >
                <td>{count}</td>
                <td>
                  {sample.message}
                  {expanded === sample.id && sample.stack && (
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.8 }}>
                      {sample.stack}
                    </pre>
                  )}
                </td>
                <td>{sample.source ?? '—'}</td>
                <td>{sample.url ?? '—'}</td>
                <td>{new Date(latest).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
