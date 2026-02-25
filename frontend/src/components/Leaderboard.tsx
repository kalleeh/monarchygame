import { useState, useMemo, useEffect, useRef } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { Kingdom } from '../types/kingdom';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { GuildService } from '../services/GuildService';
import { isDemoMode } from '../utils/authMode';
import '../components/TerritoryExpansion.css';
import '../components/Leaderboard.css';

// Module-level Amplify client — only instantiated once, avoids re-creation on
// every render. This is the same pattern used by useRealtimeNotifications.ts.
const amplifyClient = generateClient<Schema>();

// Transform a raw Amplify Kingdom record into the local Kingdom shape.
function transformSchemaKingdom(k: Schema['Kingdom']['type']): Kingdom {
  const rawStats = (k.stats ?? {}) as Record<string, unknown>;
  return {
    id: k.id,
    name: k.name || 'Unknown',
    race: k.race || 'Human',
    owner: k.owner || undefined,
    resources: {
      gold:       (k.resources as Record<string, number> | null)?.gold       ?? 0,
      population: (k.resources as Record<string, number> | null)?.population ?? 0,
      land:       (k.resources as Record<string, number> | null)?.land       ?? 0,
      turns:      (k.resources as Record<string, number> | null)?.turns      ?? 0,
    },
    stats: {
      warOffense:  Number(rawStats.warOffense  ?? 0),
      warDefense:  Number(rawStats.warDefense  ?? 0),
      sorcery:     Number(rawStats.sorcery     ?? 0),
      scum:        Number(rawStats.scum        ?? 0),
      forts:       Number(rawStats.forts       ?? 0),
      tithe:       Number(rawStats.tithe       ?? 0),
      training:    Number(rawStats.training    ?? 0),
      siege:       Number(rawStats.siege       ?? 0),
      economy:     Number(rawStats.economy     ?? 0),
      building:    Number(rawStats.building    ?? 0),
      previousSeasonRank:      rawStats.previousSeasonRank      != null ? Number(rawStats.previousSeasonRank)      : undefined,
      previousSeasonNetworth:  rawStats.previousSeasonNetworth  != null ? Number(rawStats.previousSeasonNetworth)  : undefined,
      previousSeasonNumber:    rawStats.previousSeasonNumber    != null ? Number(rawStats.previousSeasonNumber)    : undefined,
    },
    totalUnits: ((k.totalUnits as Record<string, number> | null) || { peasants: 0, militia: 0, knights: 0, cavalry: 0 }) as {
      peasants: number; militia: number; knights: number; cavalry: number;
    },
    isOnline:   k.isOnline  ?? false,
    lastActive: k.lastActive ? new Date(k.lastActive) : undefined,
    guildId:    k.guildId   || undefined,
  };
}

// ── Types ──────────────────────────────────────────────────────────────────

interface LeaderboardFilters {
  showOnlyFairTargets: boolean;
  hideNPPKingdoms: boolean;
  showOnlyYourFaith: boolean;
}

interface TargetIndicator {
  indicator: 'easy' | 'fair' | 'hard';
  turnCostModifier: number;
  color: string;
  emoji: string;
}

// All 10 playable races (must stay in sync with RaceType in types/amplify.ts)
const ALL_RACES = [
  'Human', 'Elven', 'Goblin', 'Droben',
  'Vampire', 'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae',
] as const;

type TabId = 'all' | typeof ALL_RACES[number] | 'guilds';

// ── Helpers ────────────────────────────────────────────────────────────────

// Simple networth calculation (land + gold + units value)
const calculateNetworth = (kingdom: Kingdom): number => {
  const landValue = kingdom.resources.land * 1000;
  const goldValue = kingdom.resources.gold;
  const unitsValue = Object.values(kingdom.totalUnits).reduce((sum, count) => sum + count * 100, 0);
  return landValue + goldValue + unitsValue;
};

const getTargetIndicator = (yourNW: number, theirNW: number): TargetIndicator => {
  const ratio = theirNW / yourNW;
  if (ratio < 0.5)                    return { indicator: 'easy', turnCostModifier: 1.5, color: 'text-yellow-400', emoji: '🟡' };
  if (ratio >= 0.5 && ratio <= 1.5)  return { indicator: 'fair', turnCostModifier: 1.0, color: 'text-green-400', emoji: '🟢' };
  return { indicator: 'hard', turnCostModifier: 2.0, color: 'text-red-400', emoji: '🔴' };
};

// ── Component ──────────────────────────────────────────────────────────────

interface LeaderboardProps {
  kingdoms: Kingdom[];
  currentKingdom: Kingdom;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ kingdoms, currentKingdom }) => {
  // ── State ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [filters, setFilters] = useState<LeaderboardFilters>(() => {
    const saved = localStorage.getItem('leaderboard-filters');
    return saved ? JSON.parse(saved) : {
      showOnlyFairTargets: false,
      hideNPPKingdoms: false,
      showOnlyYourFaith: false
    };
  });

  // ── Live kingdom data (auth mode) / demo refresh indicator ───────────────
  // liveKingdoms overrides the kingdoms prop when auth-mode subscription is active.
  const [liveKingdoms, setLiveKingdoms] = useState<Kingdom[] | null>(null);
  const [isLive, setIsLive] = useState(false);
  // Ref for the 30-second demo-mode refresh interval so we can clear it cleanly.
  const demoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auth-mode: subscribe to all Kingdom changes via observeQuery.
  useEffect(() => {
    if (isDemoMode()) return; // no Amplify queries in demo mode

    const sub = amplifyClient.models.Kingdom.observeQuery().subscribe({
      next: ({ items }) => {
        setLiveKingdoms(items.map(transformSchemaKingdom));
        setIsLive(true);
      },
      error: (err: unknown) => {
        console.error('[Leaderboard] Kingdom subscription error:', err);
        // On error fall back to the prop-supplied snapshot; keep isLive false
        setIsLive(false);
      },
    });

    return () => {
      sub.unsubscribe();
      setIsLive(false);
    };
  }, []); // mount-once — subscription covers all changes

  // Demo-mode: every 30 s re-read AI kingdoms from the Zustand store so the
  // leaderboard doesn't go fully stale during a long session.  We accomplish
  // this via a lightweight interval that bumps a counter; the aiKingdoms
  // selector already returns current state on each render, so we just force a
  // re-render to pick up the latest snapshot.
  const [demoRefreshTick, setDemoRefreshTick] = useState(0);
  useEffect(() => {
    if (!isDemoMode()) return;
    demoRefreshRef.current = setInterval(() => {
      setDemoRefreshTick(t => t + 1);
    }, 30_000);
    return () => {
      if (demoRefreshRef.current !== null) {
        clearInterval(demoRefreshRef.current);
        demoRefreshRef.current = null;
      }
    };
  }, []);

  // ── Guild name lookup map ─────────────────────────────────────────────────
  // Populated from kingdoms' own guildName fields (if present) plus a
  // one-shot fetch from GuildService so we can show real names in the Guilds tab.
  const [guildNamesMap, setGuildNamesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    // Seed from kingdoms that already carry a guildName field
    const seed: Record<string, string> = {};
    for (const k of kingdoms) {
      if (k.guildId && k.guildName) {
        seed[k.guildId] = k.guildName;
      }
    }

    // Extend with data from GuildService (async, best-effort)
    const fetchNames = async () => {
      try {
        const guilds = await GuildService.getPublicGuilds();
        const merged: Record<string, string> = { ...seed };
        for (const g of guilds) {
          merged[g.id] = g.name;
        }
        setGuildNamesMap(merged);
      } catch {
        // GuildService failed — use whatever we seeded from kingdom data
        if (Object.keys(seed).length > 0) {
          setGuildNamesMap(seed);
        }
      }
    };

    void fetchNames();
  // Only re-run when the kingdoms array reference changes (i.e. a new load)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kingdoms]);

  // ── AI kingdoms ──────────────────────────────────────────────────────────
  const aiKingdoms = useAIKingdomStore((state) => state.aiKingdoms);

  const aiAsKingdoms: Kingdom[] = useMemo(() =>
    aiKingdoms.map((ai): Kingdom => ({
      id: ai.id,
      name: `${ai.name} 🤖`,
      race: ai.race,
      owner: 'AI',
      resources: ai.resources,
      stats: {
        warOffense: 0,
        warDefense: 0,
        sorcery: 0,
        scum: 0,
        forts: 0,
        tithe: 0,
        training: 0,
        siege: 0,
        economy: 0,
        building: 0
      },
      territories: [],
      totalUnits: {
        peasants: ai.units.tier1,
        militia: ai.units.tier2,
        knights: ai.units.tier3,
        cavalry: ai.units.tier4
      },
      isOnline: true,
      lastActive: new Date()
    })),
    [aiKingdoms]
  );

  // Use live subscription data in auth mode; fall back to the prop snapshot in
  // demo mode (or before the first subscription event arrives).
  // The demoRefreshTick dependency ensures we pick up fresh aiKingdoms every 30s.
  const baseKingdoms = liveKingdoms ?? kingdoms;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allKingdoms = useMemo(() => [...baseKingdoms, ...aiAsKingdoms], [baseKingdoms, aiAsKingdoms, demoRefreshTick]);

  // ── Persist filters ──────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('leaderboard-filters', JSON.stringify(filters));
  }, [filters]);

  // ── Derived values ───────────────────────────────────────────────────────
  const currentNetworth = useMemo(() => calculateNetworth(currentKingdom), [currentKingdom]);

  // Base filter pipeline (shared by "all" and race tabs)
  const baseFilteredKingdoms = useMemo(() => {
    let result = allKingdoms;

    if (filters.showOnlyFairTargets) {
      result = result.filter(k => {
        const ratio = calculateNetworth(k) / currentNetworth;
        return ratio >= 0.5 && ratio <= 1.5;
      });
    }
    if (filters.hideNPPKingdoms) {
      result = result.filter(k => k.resources.turns > 100);
    }
    if (filters.showOnlyYourFaith) {
      result = result.filter(k => k.race === currentKingdom.race);
    }

    return result.sort((a, b) => calculateNetworth(b) - calculateNetworth(a));
  }, [allKingdoms, currentKingdom, filters, currentNetworth]);

  // Tab-specific list (before search)
  const tabFilteredKingdoms = useMemo(() => {
    if (activeTab === 'all' || activeTab === 'guilds') return baseFilteredKingdoms;
    return baseFilteredKingdoms.filter(k => k.race === activeTab);
  }, [baseFilteredKingdoms, activeTab]);

  // Search filter (applied on top of tab filter, kingdoms view only)
  const visibleKingdoms = useMemo(() => {
    if (activeTab === 'guilds') return tabFilteredKingdoms;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tabFilteredKingdoms;
    return tabFilteredKingdoms.filter(k => k.name.toLowerCase().includes(q));
  }, [tabFilteredKingdoms, searchQuery, activeTab]);

  // Guild aggregation for Guilds tab
  const guildRows = useMemo(() => {
    if (activeTab !== 'guilds') return [];

    const map = new Map<string, { guildId: string; label: string; members: number; totalNW: number }>();
    for (const k of allKingdoms) {
      if (!k.guildId) continue;
      const nw = calculateNetworth(k);
      if (map.has(k.guildId)) {
        const entry = map.get(k.guildId)!;
        entry.members += 1;
        entry.totalNW += nw;
      } else {
        // Prefer: guildName on kingdom > guildNamesMap lookup > truncated-ID fallback
        const resolvedName =
          k.guildName ||
          guildNamesMap[k.guildId] ||
          `Guild ${k.guildId.slice(0, 8)}`;
        map.set(k.guildId, {
          guildId: k.guildId,
          label: resolvedName,
          members: 1,
          totalNW: nw,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalNW - a.totalNW);
  }, [activeTab, allKingdoms, guildNamesMap]);

  // ── Rank-delta helper ────────────────────────────────────────────────────
  const getRankDelta = (kingdom: Kingdom, currentRank: number) => {
    const prev = kingdom.stats.previousSeasonRank;
    if (prev == null) {
      return <span className="lb-rank-new">NEW</span>;
    }
    const delta = prev - currentRank; // positive = improved
    if (delta === 0) return null;
    if (delta > 0) return <span className="lb-rank-up">▲{delta}</span>;
    return <span className="lb-rank-down">▼{Math.abs(delta)}</span>;
  };

  // ── Header label ─────────────────────────────────────────────────────────
  const tabLabel =
    activeTab === 'all'    ? 'All Kingdoms'   :
    activeTab === 'guilds' ? 'Guild Rankings' :
    `${activeTab} Rankings`;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="leaderboard-container">

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="lb-tab-bar" role="tablist" aria-label="Leaderboard categories">
        <button
          role="tab"
          aria-selected={activeTab === 'all'}
          className={`lb-tab ${activeTab === 'all' ? 'lb-tab--active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All
        </button>

        {ALL_RACES.map(race => (
          <button
            key={race}
            role="tab"
            aria-selected={activeTab === race}
            className={`lb-tab ${activeTab === race ? 'lb-tab--active' : ''}`}
            onClick={() => setActiveTab(race)}
          >
            {race}
          </button>
        ))}

        <button
          role="tab"
          aria-selected={activeTab === 'guilds'}
          className={`lb-tab lb-tab--guilds ${activeTab === 'guilds' ? 'lb-tab--active' : ''}`}
          onClick={() => setActiveTab('guilds')}
        >
          Guilds
        </button>
      </div>

      {/* ── Section heading + live badge ────────────────────────────────── */}
      <div className="lb-heading-row">
        <h2 className="lb-section-heading">{tabLabel}</h2>
        {isLive
          ? <span className="lb-status-badge lb-status-badge--live" title="Real-time updates active">&#9679; LIVE</span>
          : <span className="lb-status-badge lb-status-badge--demo" title="Demo mode — AI opponents only">Demo</span>
        }
      </div>

      {/* ── Filters (hidden on guilds tab) ──────────────────────────────── */}
      {activeTab !== 'guilds' && (
        <>
          {/* Search input */}
          <div className="lb-search-wrapper">
            <input
              type="search"
              placeholder="Search kingdoms…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="lb-search-input"
              aria-label="Search kingdoms by name"
            />
          </div>

          {/* Toggle filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '1rem' }}>
            {([
              { key: 'showOnlyFairTargets', label: 'Show fair targets only', checked: filters.showOnlyFairTargets },
              { key: 'hideNPPKingdoms',     label: 'Hide protected players', checked: filters.hideNPPKingdoms },
              { key: 'showOnlyYourFaith',   label: 'Show guild-eligible',    checked: filters.showOnlyYourFaith },
            ] as const).map(({ key, label, checked }) => (
              <label
                key={key}
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', userSelect: 'none', color: '#d1d5db' }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setFilters({ ...filters, [key]: e.target.checked })}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                />
                {/* Toggle track */}
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    position: 'relative',
                    width: '40px',
                    height: '22px',
                    borderRadius: '11px',
                    background: checked ? '#14b8a6' : '#374151',
                    transition: 'background 0.2s ease',
                    flexShrink: 0,
                    boxShadow: checked ? '0 0 6px rgba(20,184,166,0.5)' : 'none',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: '3px',
                      left: checked ? '21px' : '3px',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    }}
                  />
                </span>
                {label}
              </label>
            ))}
          </div>
        </>
      )}

      {/* ── Guilds tab content ───────────────────────────────────────────── */}
      {activeTab === 'guilds' && (
        <div className="lb-guilds-table-wrapper">
          {guildRows.length === 0 ? (
            <p className="lb-empty-state">No guilds found. Kingdoms must have a guild affiliation to appear here.</p>
          ) : (
            <table className="lb-guilds-table" aria-label="Guild rankings">
              <thead>
                <tr>
                  <th className="lb-guilds-th lb-guilds-th--rank">Rank</th>
                  <th className="lb-guilds-th">Guild</th>
                  <th className="lb-guilds-th lb-guilds-th--center">Members</th>
                  <th className="lb-guilds-th lb-guilds-th--right">Combined Networth</th>
                </tr>
              </thead>
              <tbody>
                {guildRows.map((row, idx) => (
                  <tr key={row.guildId} className={`lb-guilds-row ${idx % 2 === 0 ? 'lb-guilds-row--even' : ''}`}>
                    <td className="lb-guilds-td lb-guilds-td--rank">#{idx + 1}</td>
                    <td className="lb-guilds-td lb-guilds-td--name">{row.label}</td>
                    <td className="lb-guilds-td lb-guilds-td--center">{row.members}</td>
                    <td className="lb-guilds-td lb-guilds-td--right">{(row.totalNW / 1_000_000).toFixed(2)}M</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Kingdom grid (all / race tabs) ─────────────────────────────── */}
      {activeTab !== 'guilds' && (
        <>
          {visibleKingdoms.length === 0 && (
            <p className="lb-empty-state">No kingdoms match the current filters.</p>
          )}

          <div className="territory-grid">
            {visibleKingdoms.map((kingdom, index) => {
              const networth = calculateNetworth(kingdom);
              const indicator = getTargetIndicator(currentNetworth, networth);
              const baseTurnCost = 4;
              const totalTurnCost = Math.round(baseTurnCost * indicator.turnCostModifier);
              const isCurrentKingdom = kingdom.id === currentKingdom.id;
              const rankNumber = index + 1;

              return (
                <div key={kingdom.id} className={`kingdom-card ${isCurrentKingdom ? 'owned' : ''}`}>
                  <div className="territory-header">
                    <span className="territory-icon">{isCurrentKingdom ? '⭐' : '👑'}</span>
                    <div className="territory-info">
                      <h4>
                        {/* Online presence dot */}
                        <span
                          style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: kingdom.isOnline ? '#22c55e' : '#64748b',
                            boxShadow: kingdom.isOnline ? '0 0 4px #22c55e' : 'none',
                            marginRight: '6px',
                            verticalAlign: 'middle',
                          }}
                          title={kingdom.isOnline ? 'Online' : 'Offline'}
                        />

                        {/* Rank with delta */}
                        <span className="lb-rank-badge">
                          #{rankNumber}
                          {getRankDelta(kingdom, rankNumber)}
                        </span>
                        {' '}{kingdom.name}{isCurrentKingdom ? ' (You)' : ''}
                      </h4>
                      <span className="territory-type">{kingdom.race}</span>
                    </div>
                  </div>

                  <div className="territory-production">
                    <div className="production-label">Networth</div>
                    <div className="production-items">
                      <span className="production-item">{(networth / 1_000_000).toFixed(2)}M</span>
                    </div>
                  </div>

                  <div className="territory-production">
                    <div className="production-label">Target Difficulty</div>
                    <div className="production-items">
                      <span className="production-item">
                        {indicator.emoji} {indicator.indicator.charAt(0).toUpperCase() + indicator.indicator.slice(1)} ({totalTurnCost} turns)
                      </span>
                    </div>
                  </div>

                  {kingdom.stats.previousSeasonRank != null && (
                    <div className="territory-production">
                      <div className="production-label">
                        Last Season{kingdom.stats.previousSeasonNumber != null ? ` #${kingdom.stats.previousSeasonNumber}` : ''}
                      </div>
                      <div className="production-items">
                        <span className="production-item">
                          Rank #{kingdom.stats.previousSeasonRank}
                          {kingdom.stats.previousSeasonNetworth != null && (
                            <> &mdash; {(kingdom.stats.previousSeasonNetworth / 1_000_000).toFixed(2)}M NW</>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default Leaderboard;
