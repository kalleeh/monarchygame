import React, { useState, useMemo, useEffect, useRef } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { Kingdom } from '../types/kingdom';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { GuildService } from '../services/GuildService';
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

type TabId = 'all' | typeof ALL_RACES[number] | 'guilds';

// ── Component ──────────────────────────────────────────────────────────────

interface LeaderboardProps {
  kingdoms: Kingdom[];
  currentKingdom: Kingdom;
  /** Optional callback to open the diplomatic message compose modal for a specific kingdom. */
  onSendMessage?: (target: { id: string; name: string }) => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ kingdoms, currentKingdom, onSendMessage }) => {
  // ── State ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [filters, setFilters] = useState<LeaderboardFilterState>(() => {
    const saved = localStorage.getItem('leaderboard-filters');
    return saved ? JSON.parse(saved) : {
      showOnlyFairTargets: false,
      hideNPPKingdoms: false,
      showOnlyYourFaith: false
    };
  });

  // ── Season-end ceremony modal ─────────────────────────────────────────────
  const [seasonModal, setSeasonModal] = useState<Omit<SeasonResultsProps, 'onClose'> | null>(null);

  // ── Live kingdom data (auth mode) / demo refresh indicator ───────────────
  // liveKingdoms overrides the kingdoms prop when auth-mode subscription is active.
  const [liveKingdoms, setLiveKingdoms] = useState<Kingdom[] | null>(null);
  const [isLive, setIsLive] = useState(false);
  // Ref for the 30-second demo-mode refresh interval so we can clear it cleanly.
  const demoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref to track previous previousSeasonNumber values per kingdom to detect season-end
  const prevSeasonNumbersRef = useRef<Record<string, number | undefined>>({});

  // Auth-mode: subscribe to all Kingdom changes via observeQuery.
  useEffect(() => {
    if (isDemoMode()) return; // no Amplify queries in demo mode

    const sub = amplifyClient.models.Kingdom.observeQuery().subscribe({
      next: ({ items }) => {
        const transformed = items.map(transformSchemaKingdom);

        // Detect season-end: if any kingdom's previousSeasonNumber just changed
        // (appeared for the first time or incremented), show the ceremony modal.
        let seasonEndDetected = false;
        let detectedSeasonNumber: number | undefined;
        for (const k of transformed) {
          const newVal = k.stats.previousSeasonNumber;
          const oldVal = prevSeasonNumbersRef.current[k.id];
          if (newVal != null && newVal !== oldVal) {
            seasonEndDetected = true;
            detectedSeasonNumber = newVal;
          }
          prevSeasonNumbersRef.current[k.id] = newVal;
        }
        if (seasonEndDetected && detectedSeasonNumber != null) {
          // Build top-5 kingdoms list from current snapshot
          const sorted = [...transformed]
            .sort((a, b) => calculateNetworth(b) - calculateNetworth(a))
            .slice(0, 5)
            .map((k, i) => ({
              name: k.name,
              race: k.race,
              networth: calculateNetworth(k),
              rank: i + 1,
            }));

          setSeasonModal({
            seasonNumber: detectedSeasonNumber,
            topKingdoms: sorted,
            // Victory tracks are fetched from the completed GameSeason record;
            // the admin panel's "View Results" button shows full alliance details.
            victoryTracks: undefined,
          });

          toast('Season has ended — final rankings recorded!', {
            icon: '🏆',
            duration: 6000,
          });
        }

        setLiveKingdoms(transformed);
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

  // ── Active wars (for coordination multiplier) ────────────────────────────
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- isDemoMode is a module-level stable function; intentionally omitted to avoid re-running on every render
  }, [currentKingdom.guildId]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-runs only when kingdoms reference changes; fetchNames is defined inside the effect
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- demoRefreshTick is an intentional extra dep to force re-evaluation every 30s in demo mode; it is not consumed inside the memo body
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
  const guildRows = useMemo((): GuildRow[] => {
    if (activeTab !== 'guilds') return [];
    return computeGuildRows(allKingdoms, guildNamesMap, activeWarCount, currentKingdom.guildId);
  }, [activeTab, allKingdoms, guildNamesMap, activeWarCount, currentKingdom.guildId]);

  // ── Header label ─────────────────────────────────────────────────────────
  const tabLabel =
    activeTab === 'all'    ? 'All Kingdoms'   :
    activeTab === 'guilds' ? 'Guild Rankings' :
    `${activeTab} Rankings`;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="leaderboard-container">

      {/* ── Season-end ceremony modal ────────────────────────────────────── */}
      {seasonModal && (
        <SeasonResults
          {...seasonModal}
          onClose={() => setSeasonModal(null)}
        />
      )}

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
        <LeaderboardFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}

      {/* ── Guilds tab content ───────────────────────────────────────────── */}
      {activeTab === 'guilds' && (
        <GuildRankingsTable guildRows={guildRows} />
      )}

      {/* ── Kingdom grid (all / race tabs) ─────────────────────────────── */}
      {activeTab !== 'guilds' && (
        <>
          {visibleKingdoms.length === 0 && (
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
        </>
      )}
    </div>
  );
};

export default Leaderboard;
