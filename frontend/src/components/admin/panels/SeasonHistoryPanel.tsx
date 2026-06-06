import { useState, useEffect } from 'react';
import { getClient } from '../../../utils/amplifyClient';
import toast from 'react-hot-toast';
import { isDemoMode } from '../../../utils/authMode';
import SeasonResults from '../../SeasonResults';
import type { SeasonRow } from '../adminShared';

function parseVictoryResults(ageTransitions: string | null | undefined): {
  militaryChampion?: { allianceName: string; totalLandGained: number };
  economicPowerhouse?: { allianceName: string; totalNetworth: number };
  strategistGuild?: { allianceName: string; territoriesControlled: number };
} | undefined {
  if (!ageTransitions) return undefined;
  try {
    const parsed = JSON.parse(ageTransitions) as Record<string, unknown>;
    const vr = parsed.victoryResults as Record<string, Record<string, unknown>> | undefined;
    if (!vr) return undefined;
    // For display: use the allianceName field if present, otherwise truncate the ID to last 6 chars
    const resolveAllianceName = (record: Record<string, unknown>): string => {
      if (record.allianceName) return String(record.allianceName);
      const rawId = String(record.allianceId ?? '');
      return rawId.slice(-6) || 'Unknown Alliance';
    };
    return {
      militaryChampion: vr.militaryChampion
        ? { allianceName: resolveAllianceName(vr.militaryChampion), totalLandGained: Number(vr.militaryChampion.totalLandGained ?? 0) }
        : undefined,
      economicPowerhouse: vr.economicPowerhouse
        ? { allianceName: resolveAllianceName(vr.economicPowerhouse), totalNetworth: Number(vr.economicPowerhouse.totalNetworth ?? 0) }
        : undefined,
      strategistGuild: vr.strategistGuild
        ? { allianceName: resolveAllianceName(vr.strategistGuild), territoriesControlled: Number(vr.strategistGuild.territoriesControlled ?? 0) }
        : undefined,
    };
  } catch {
    return undefined;
  }
}

export function SeasonHistoryPanel() {
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // State for the "View Results" ceremony modal
  const [resultsModal, setResultsModal] = useState<{
    seasonNumber: number;
    victoryTracks: ReturnType<typeof parseVictoryResults>;
  } | null>(null);

  const demoAgeTransitions = JSON.stringify({
    early: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
    middle: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    late: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    victoryResults: {
      militaryChampion:  { allianceId: 'Iron Brotherhood', totalLandGained: 4200 },
      economicPowerhouse:{ allianceId: 'Merchant Council', totalNetworth: 12500000 },
      strategistGuild:   { allianceId: 'Iron Brotherhood', territoriesControlled: 5 },
    },
  });

  useEffect(() => {
    if (!expanded) return;
    if (isDemoMode()) {
      setSeasons([
        { id: 'old-1', seasonNumber: 0, status: 'completed', startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), endDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), participantCount: 5, currentAge: 'late', ageTransitions: demoAgeTransitions, createdAt: '', updatedAt: '', owner: null } as unknown as SeasonRow,
      ]);
      return;
    }
    setLoading(true);
    getClient().models.GameSeason.list({ filter: { status: { eq: 'completed' } } })
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- demoAgeTransitions is a render-time constant; client and isDemoMode are module-level stable references
  }, [expanded]);

  return (
    <section className="admin-panel">
      {/* Victory results ceremony modal */}
      {resultsModal && (
        <SeasonResults
          seasonNumber={resultsModal.seasonNumber}
          topKingdoms={[]}
          victoryTracks={resultsModal.victoryTracks}
          onClose={() => setResultsModal(null)}
        />
      )}

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
                  <th>Results</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((s) => {
                  const victoryTracks = parseVictoryResults(s.ageTransitions as string | null | undefined);
                  return (
                    <tr key={s.id}>
                      <td>#{s.seasonNumber}</td>
                      <td>{s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}</td>
                      <td>{s.participantCount ?? 0}</td>
                      <td>
                        <button
                          className="admin-btn admin-btn--secondary admin-btn--sm"
                          onClick={() => setResultsModal({ seasonNumber: s.seasonNumber ?? 0, victoryTracks })}
                        >
                          View Results
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
