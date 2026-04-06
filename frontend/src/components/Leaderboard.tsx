import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { Kingdom } from '../types/kingdom';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { GuildService } from '../services/GuildService';
import { KingdomSearchService } from '../services/KingdomSearchService';
import type { KingdomPage } from '../services/KingdomSearchService';
import { isDemoMode } from '../utils/authMode';
import toast from 'react-hot-toast';
import SeasonResults from './SeasonResults';
import type { SeasonResultsProps } from './SeasonResults';
import { calculateNetworth, computeGuildRows } from './leaderboard/leaderboardHelpers';
import type { GuildRow } from './leaderboard/leaderboardHelpers';
import KingdomRankRow from './leaderboard/KingdomRankRow';
import LeaderboardFilters from './leaderboard/LeaderboardFilters';
import GuildRankingsTable from './leaderboard/GuildRankingsTable';
import '../components/TerritoryExpansion.css';
import '../components/Leaderboard.css';

// ── Types ──────────────────────────────────────────────────────────────────

interface LeaderboardFilterState {
  showOnlyFairTargets: boolean;
  hideNPPKingdoms: boolean;
  showOnlyYourFaith: boolean;
}

// All 10 playable races (must stay in sync with RaceType in types/amplify.ts)
const ALL_RACES = [
  'Human', 'Elven', 'Goblin', 'Droben',
  'Vampire', 'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae',
] as const;

type TabId = 'all' | typeof ALL_RACES[number] | 'guilds' | 'bounty';

function getBountyCompletions(kingdom: { stats?: unknown }): number {
  try {
    const stats = typeof kingdom.stats === 'string' ? JSON.parse(kingdom.stats) : (kingdom.stats ?? {});
    return typeof stats.bountyCompletions === 'number' ? stats.bountyCompletions : 0;
  } catch { return 0; }
}

// Convert a KingdomPage kingdom entry to the local Kingdom shape
function pageKingdomToKingdom(k: KingdomPage['kingdoms'][number]): Kingdom {
  return {
    id: k.id,
    name: k.name,
    race: k.race,
    owner: k.owner,
    resources: k.resources,
    stats: {
      warOffense: k.stats.warOffense ?? 0,
      warDefense: k.stats.warDefense ?? 0,
      sorcery: k.stats.sorcery ?? 0,
      scum: k.stats.scum ?? 0,
      forts: k.stats.forts ?? 0,
      tithe: k.stats.tithe ?? 0,
      training: k.stats.training ?? 0,
      siege: k.stats.siege ?? 0,
      economy: k.stats.economy ?? 0,
      building: k.stats.building ?? 0,
      previousSeasonRank: k.stats.previousSeasonRank != null ? k.stats.previousSeasonRank : undefined,
      previousSeasonNetworth: k.stats.previousSeasonNetworth != null ? k.stats.previousSeasonNetworth : undefined,
      previousSeasonNumber: k.stats.previousSeasonNumber != null ? k.stats.previousSeasonNumber : undefined,
    },
    totalUnits: k.totalUnits,
    networth: k.networth,
    isOnline: k.isOnline,
    lastActive: k.lastActive,
    guildId: k.guildId,
  };
}

// ── Component ──────────────────────────────────────────────────────────────

interface LeaderboardProps {
  kingdoms: Kingdom[];
  currentKingdom: Kingdom;
  /** Optional callback to open the diplomatic message compose modal for a specific kingdom. */
  onSendMessage?: (target: { id: string; name: string }) => void;
}

// Loading skeleton — 3 placeholder rows
function LoadingSkeleton() {
  return (
    <div className="territory-grid" aria-busy="true" aria-label="Loading kingdoms">
      {[0, 1, 2].map(i => (
        <div key={i} className="kingdom-card" style={{ opacity: 0.5 }}>
          <div className="territory-header">
            <span className="territory-icon">👑</span>
            <div className="territory-info">
              <h4 style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 4, width: '60%', height: '1.1em', marginBottom: '0.4em' }} />
              <span className="territory-type" style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 4, width: '30%', height: '0.9em', display: 'inline-block' }} />
            </div>
          </div>
          <div className="territory-production">
            <div className="production-label">Networth</div>
            <div className="production-items">
              <span className="production-item" style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 4, width: '4rem', height: '1em', display: 'inline-block' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const Leaderboard: React.FC<LeaderboardProps> = ({ kingdoms, currentKingdom, onSendMessage }) => {
  // ── Tab / filter state ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<LeaderboardFilterState>(() => {
    const saved = localStorage.getItem('leaderboard-filters');
    try { return saved ? JSON.parse(saved) : {
      showOnlyFairTargets: false,
      hideNPPKingdoms: false,
      showOnlyYourFaith: false,
    }; } catch { return {
      showOnlyFairTargets: false,
      hideNPPKingdoms: false,
      showOnlyYourFaith: false,
    }; }
  });

  // ── Season-end ceremony modal ─────────────────────────────────────────────
  const [seasonModal, setSeasonModal] = useState<Omit<SeasonResultsProps, 'onClose'> | null>(null);

  // ── Server-side paginated data (auth mode) ────────────────────────────────
  const [serverKingdoms, setServerKingdoms] = useState<Kingdom[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // Demo-mode 30-second refresh tick
  const [demoRefreshTick, setDemoRefreshTick] = useState(0);
  const demoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track previousSeasonNumber per kingdom to detect season-end
  const prevSeasonNumbersRef = useRef<Record<string, number | undefined>>({});

  // Debounce ref for search
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Persist filters ──────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('leaderboard-filters', JSON.stringify(filters));
  }, [filters]);

  // ── Networth of current kingdom (for fair-target range) ──────────────────
  const currentNetworth = useMemo(() => calculateNetworth(currentKingdom), [currentKingdom]);

  // Compute fair-target networth bounds
  const fairTargetBounds = useMemo((): { min: number; max: number } | null => {
    if (!filters.showOnlyFairTargets) return null;
    return { min: Math.floor(currentNetworth * 0.5), max: Math.ceil(currentNetworth * 1.5) };
  }, [filters.showOnlyFairTargets, currentNetworth]);

  // ── Core fetch function ───────────────────────────────────────────────────
  const fetchPage = useCallback(async (opts: {
    append: boolean;
    token?: string | null;
    race?: string;
    nameSearch?: string;
  }) => {
    setLoading(true);
    try {
      const result = await KingdomSearchService.listByNetworth({
        limit: 50,
        nextToken: opts.token,
        race: opts.race && opts.race !== 'all' ? opts.race : undefined,
        nameSearch: opts.nameSearch,
        minNetworth: fairTargetBounds?.min,
        maxNetworth: fairTargetBounds?.max,
      });

      if (result === null) {
        // Demo mode or error — handled by the demo path
        setIsLive(false);
        return;
      }

      const converted = result.kingdoms.map(pageKingdomToKingdom);

      // Detect season-end on incoming data (skip first load — ref is empty)
      let seasonEndDetected = false;
      let detectedSeasonNumber: number | undefined;
      const isFirstLoad = Object.keys(prevSeasonNumbersRef.current).length === 0;
      for (const k of converted) {
        const newVal = k.stats.previousSeasonNumber;
        const oldVal = prevSeasonNumbersRef.current[k.id];
        if (!isFirstLoad && newVal != null && newVal !== oldVal) {
          seasonEndDetected = true;
          detectedSeasonNumber = newVal;
        }
        prevSeasonNumbersRef.current[k.id] = newVal;
      }
      if (seasonEndDetected && detectedSeasonNumber != null) {
        const sorted = [...converted]
          .sort((a, b) => calculateNetworth(b) - calculateNetworth(a))
          .slice(0, 5)
          .map((k, i) => ({
            name: k.name,
            race: k.race,
            networth: calculateNetworth(k),
            rank: i + 1,
          }));

        // Fetch the completed season record to get victoryResults from ageTransitions
        let victoryTracks: SeasonResultsProps['victoryTracks'] = undefined;
        try {
          const client = generateClient<Schema>();
          const { data: seasons } = await client.models.GameSeason.list({
            filter: { seasonNumber: { eq: detectedSeasonNumber } },
            limit: 1,
          });
          if (seasons && seasons.length > 0) {
            const ageTransitions = (() => {
              const raw = seasons[0].ageTransitions;
              if (!raw) return null;
              if (typeof raw === 'string') {
                try { return JSON.parse(raw); } catch { return null; }
              }
              return raw as Record<string, unknown>;
            })();
            const victoryResults = ageTransitions?.victoryResults as Record<string, unknown> | undefined;
            if (victoryResults) {
              victoryTracks = {
                militaryChampion: victoryResults.militaryChampion as SeasonResultsProps['victoryTracks']['militaryChampion'],
                economicPowerhouse: victoryResults.economicPowerhouse as SeasonResultsProps['victoryTracks']['economicPowerhouse'],
                strategistGuild: victoryResults.strategistGuild as SeasonResultsProps['victoryTracks']['strategistGuild'],
              };
            }
          }
        } catch {
          // Non-fatal — modal shows without track details
        }

        setSeasonModal({
          seasonNumber: detectedSeasonNumber,
          topKingdoms: sorted,
          victoryTracks,
        });
        toast('Season has ended — final rankings recorded!', { icon: '🏆', duration: 6000 });
      }

      if (opts.append) {
        setServerKingdoms(prev => [...prev, ...converted]);
      } else {
        setServerKingdoms(converted);
      }
      setNextToken(result.nextToken);
      setHasMore(result.nextToken !== null);
      setIsLive(true);
    } catch (err) {
      console.error('[Leaderboard] fetchPage error:', err);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, [fairTargetBounds]);

  // ── Initial load (auth mode) ──────────────────────────────────────────────
  useEffect(() => {
    if (isDemoMode()) return;
    void fetchPage({ append: false, token: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchPage is stable; only run on mount
  }, []);

  // ── Tab change: re-fetch for new race (auth mode) ─────────────────────────
  useEffect(() => {
    if (isDemoMode() || activeTab === 'guilds' || activeTab === 'bounty') return;
    const race = activeTab === 'all' ? undefined : activeTab;
    void fetchPage({ append: false, token: null, race });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: re-fetch when tab changes
  }, [activeTab]);

  // ── Fair-target filter change: re-fetch (auth mode) ──────────────────────
  useEffect(() => {
    if (isDemoMode() || activeTab === 'guilds' || activeTab === 'bounty') return;
    const race = activeTab === 'all' ? undefined : activeTab;
    void fetchPage({ append: false, token: null, race, nameSearch: searchQuery || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: re-fetch when fair-target bounds change
  }, [fairTargetBounds]);

  // ── Search debounce (auth mode) ───────────────────────────────────────────
  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    if (isDemoMode()) return;
    if (activeTab === 'bounty') return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      const race = activeTab === 'all' || activeTab === 'guilds' ? undefined : activeTab;
      void fetchPage({ append: false, token: null, race, nameSearch: q || undefined });
    }, 300);
  }, [activeTab, fetchPage]);

  // Cleanup debounce on unmount
  useEffect(() => () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, []);

  // ── Load More ─────────────────────────────────────────────────────────────
  const handleLoadMore = useCallback(() => {
    if (!hasMore || loading) return;
    const race = activeTab === 'all' || activeTab === 'guilds' || activeTab === 'bounty' ? undefined : activeTab;
    void fetchPage({ append: true, token: nextToken, race, nameSearch: searchQuery || undefined });
  }, [hasMore, loading, nextToken, activeTab, searchQuery, fetchPage]);

  // ── Demo-mode: 30s refresh ────────────────────────────────────────────────
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

  // ── Active wars (for guild coordination multiplier) ───────────────────────
  const [activeWarCount, setActiveWarCount] = useState(0);
  useEffect(() => {
    if (isDemoMode() || !currentKingdom.guildId) return;
    const fetchWars = async () => {
      try {
        const { active } = await GuildService.loadGuildWars(currentKingdom.guildId!);
        setActiveWarCount(active.length);
      } catch {
        // non-fatal
      }
    };
    void fetchWars();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKingdom.guildId]);

  // ── Guild name map ────────────────────────────────────────────────────────
  const [guildNamesMap, setGuildNamesMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const seed: Record<string, string> = {};
    for (const k of kingdoms) {
      if (k.guildId && k.guildName) seed[k.guildId] = k.guildName;
    }
    const fetchNames = async () => {
      try {
        const guilds = await GuildService.getPublicGuilds();
        const merged: Record<string, string> = { ...seed };
        for (const g of guilds) merged[g.id] = g.name;
        setGuildNamesMap(merged);
      } catch {
        if (Object.keys(seed).length > 0) setGuildNamesMap(seed);
      }
    };
    void fetchNames();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kingdoms]);

  // ── AI kingdoms (demo mode) ───────────────────────────────────────────────
  const aiKingdoms = useAIKingdomStore((state) => state.aiKingdoms);
  const aiAsKingdoms: Kingdom[] = useMemo(() =>
    aiKingdoms.map((ai): Kingdom => ({
      id: ai.id,
      name: `${ai.name} 🤖`,
      race: ai.race,
      owner: 'AI',
      resources: ai.resources,
      stats: {
        warOffense: Math.min(5, Math.round((ai.units.tier3 * 4 + ai.units.tier4 * 5) / 100)),
        warDefense: Math.min(5, Math.round((ai.units.tier1 * 1 + ai.units.tier2 * 2) / 100)),
        sorcery: 0, scum: 0, forts: 0, tithe: 0, training: 0, siege: 0,
        economy: Math.min(5, Math.round(ai.resources.gold / 50000)),
        building: 0,
      },
      territories: [],
      totalUnits: { peasants: ai.units.tier1, militia: ai.units.tier2, knights: ai.units.tier3, cavalry: ai.units.tier4 },
      isOnline: true,
      lastActive: new Date(),
    })),
    [aiKingdoms]
  );

  // ── Decide which kingdom list to use ─────────────────────────────────────
  // Auth mode: use server-fetched kingdoms (serverKingdoms).
  // Demo mode: use prop kingdoms + AI kingdoms, filtered client-side.
  const isDemo = isDemoMode();

  // eslint-disable-next-line react-hooks/exhaustive-deps -- demoRefreshTick forces re-eval every 30s in demo mode
  const demoAllKingdoms = useMemo(() => [...kingdoms, ...aiAsKingdoms], [kingdoms, aiAsKingdoms, demoRefreshTick]);

  // Demo-mode: apply all filters client-side (same as original behaviour)
  const demoVisibleKingdoms = useMemo(() => {
    if (!isDemo) return [];
    let result = demoAllKingdoms;

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

    // Tab filter
    if (activeTab !== 'all' && activeTab !== 'guilds') {
      result = result.filter(k => k.race === activeTab);
    }

    // Search filter
    const q = searchQuery.trim().toLowerCase();
    if (q) result = result.filter(k => k.name.toLowerCase().includes(q));

    return result.sort((a, b) => calculateNetworth(b) - calculateNetworth(a));
  }, [isDemo, demoAllKingdoms, filters, activeTab, searchQuery, currentKingdom.race, currentNetworth]);

  // Auth mode: server already filtered by race / search / fairTarget bounds;
  // apply remaining client-only filters (hideNPPKingdoms, showOnlyYourFaith)
  const authVisibleKingdoms = useMemo(() => {
    if (isDemo) return [];
    let result = serverKingdoms;
    if (filters.hideNPPKingdoms) {
      result = result.filter(k => k.resources.turns > 100);
    }
    if (filters.showOnlyYourFaith) {
      result = result.filter(k => k.race === currentKingdom.race);
    }
    return result;
  }, [isDemo, serverKingdoms, filters.hideNPPKingdoms, filters.showOnlyYourFaith, currentKingdom.race]);

  const visibleKingdoms = isDemo ? demoVisibleKingdoms : authVisibleKingdoms;

  // ── Guild aggregation (all-kingdoms list needed) ──────────────────────────
  const allKingdomsForGuilds = isDemo ? demoAllKingdoms : serverKingdoms;
  const guildRows = useMemo((): GuildRow[] => {
    if (activeTab !== 'guilds') return [];
    return computeGuildRows(allKingdomsForGuilds, guildNamesMap, activeWarCount, currentKingdom.guildId);
  }, [activeTab, allKingdomsForGuilds, guildNamesMap, activeWarCount, currentKingdom.guildId]);

  // ── Bounty rankings (all active kingdoms sorted by bountyCompletions) ─────
  const bountyKingdoms = useMemo(() => {
    if (activeTab !== 'bounty') return [];
    const source = isDemo ? demoAllKingdoms : serverKingdoms;
    return source
      .filter(k => (k as unknown as { isActive?: boolean }).isActive !== false)
      .sort((a, b) => getBountyCompletions(b) - getBountyCompletions(a));
  }, [activeTab, isDemo, demoAllKingdoms, serverKingdoms]);

  // ── Header label ──────────────────────────────────────────────────────────
  const tabLabel =
    activeTab === 'all'    ? 'All Kingdoms'   :
    activeTab === 'guilds' ? 'Guild Rankings' :
    activeTab === 'bounty' ? 'Bounty Rankings' :
    `${activeTab} Rankings`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="leaderboard-container">

      {/* Season-end ceremony modal */}
      {seasonModal && (
        <SeasonResults
          {...seasonModal}
          onClose={() => setSeasonModal(null)}
        />
      )}

      {/* Tab bar */}
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

        <button
          role="tab"
          aria-selected={activeTab === 'bounty'}
          className={`lb-tab lb-tab--bounty ${activeTab === 'bounty' ? 'lb-tab--active' : ''}`}
          onClick={() => setActiveTab('bounty')}
        >
          Bounty
        </button>
      </div>

      {/* Section heading + live/demo badge */}
      <div className="lb-heading-row">
        <h2 className="lb-section-heading">{tabLabel}</h2>
        {isLive
          ? <span className="lb-status-badge lb-status-badge--live" title="Real-time data active">&#9679; LIVE</span>
          : <span className="lb-status-badge lb-status-badge--demo" title="Demo mode — AI opponents only">Demo</span>
        }
      </div>

      {/* Filters (hidden on guilds and bounty tabs) */}
      {activeTab !== 'guilds' && activeTab !== 'bounty' && (
        <LeaderboardFilters
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}

      {/* Guilds tab content */}
      {activeTab === 'guilds' && (
        <GuildRankingsTable guildRows={guildRows} />
      )}

      {/* Bounty tab content */}
      {activeTab === 'bounty' && (
        bountyKingdoms.length === 0 ? (
          <p className="lb-empty-state">No bounties completed this season yet.</p>
        ) : (
          <table className="lb-bounty-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Kingdom</th>
                <th>Race</th>
                <th>Bounty Completions</th>
                <th>Networth</th>
              </tr>
            </thead>
            <tbody>
              {bountyKingdoms.map((kingdom, index) => (
                <tr key={kingdom.id}>
                  <td>{index + 1}</td>
                  <td>{kingdom.name}</td>
                  <td>{kingdom.race}</td>
                  <td>{getBountyCompletions(kingdom)}</td>
                  <td>{calculateNetworth(kingdom).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {/* Kingdom grid (all / race tabs) */}
      {activeTab !== 'guilds' && activeTab !== 'bounty' && (
        <>
          {loading && serverKingdoms.length === 0 ? (
            <LoadingSkeleton />
          ) : (
            <>
              {visibleKingdoms.length === 0 && !loading && (
                <p className="lb-empty-state">No kingdoms match the current filters.</p>
              )}

              <div className="territory-grid">
                {visibleKingdoms.map((kingdom, index) => (
                  <KingdomRankRow
                    key={kingdom.id}
                    kingdom={kingdom}
                    rankNumber={index + 1}
                    currentKingdom={currentKingdom}
                    currentNetworth={currentNetworth}
                    onSendMessage={onSendMessage}
                  />
                ))}
              </div>

              {/* Loading skeleton appended during "load more" */}
              {loading && serverKingdoms.length > 0 && <LoadingSkeleton />}

              {/* Load more button */}
              {!isDemo && hasMore && !loading && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                  <button
                    className="action-btn"
                    onClick={handleLoadMore}
                    style={{ padding: '0.5rem 2rem', fontSize: '0.9rem' }}
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Leaderboard;
