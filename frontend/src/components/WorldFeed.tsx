import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { isDemoMode } from '../utils/authMode';
import './WorldFeed.css';

// ── Types ──────────────────────────────────────────────────────────────────

type EventType = 'combat' | 'war' | 'thievery' | 'alliance';

interface WorldEvent {
  id: string;
  type: EventType;
  message: string;
  timestamp: Date;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Format a Date as a human-readable relative time string. */
function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 30) return 'just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/** Icon prefix for each event type. */
const EVENT_ICONS: Record<EventType, string> = {
  combat:   '\u2694\uFE0F', // ⚔️
  war:      '\uD83D\uDD25', // 🔥
  thievery: '\uD83D\uDDE1\uFE0F', // 🗡️
  alliance: '\uD83C\uDFF0', // 🏰
};

// ── Demo / mock data ───────────────────────────────────────────────────────

function buildMockEvents(): WorldEvent[] {
  const now = Date.now();
  return [
    {
      id: 'mock-1',
      type: 'combat',
      message: 'Iron Reach attacked The Thornwood — Iron Reach gained 47 acres',
      timestamp: new Date(now - 4 * 60 * 1000),
    },
    {
      id: 'mock-2',
      type: 'war',
      message: 'Order of the Veil declared war on The Goblin Horde',
      timestamp: new Date(now - 22 * 60 * 1000),
    },
    {
      id: 'mock-3',
      type: 'thievery',
      message: 'Shadow Fang completed a steal operation against Golden Keep',
      timestamp: new Date(now - 45 * 60 * 1000),
    },
    {
      id: 'mock-4',
      type: 'alliance',
      message: 'Crimson Council achieved full alliance composition bonus',
      timestamp: new Date(now - 1.5 * 60 * 60 * 1000),
    },
    {
      id: 'mock-5',
      type: 'combat',
      message: 'Ember Throne attacked Stonewall — Ember Throne gained 31 acres',
      timestamp: new Date(now - 2 * 60 * 60 * 1000),
    },
  ];
}

// ── Amplify client (module-level singleton) ────────────────────────────────

const amplifyClient = generateClient<Schema>();

// Name lookup cache to avoid repeated fetches per ID
const nameCache = new Map<string, string>();

async function fetchKingdomName(id: string): Promise<string> {
  if (nameCache.has(id)) return nameCache.get(id)!;
  try {
    const { data } = await amplifyClient.models.Kingdom.get({ id });
    const name = data?.name ?? `Kingdom ${id.slice(0, 6)}`;
    nameCache.set(id, name);
    return name;
  } catch {
    const fallback = `Kingdom ${id.slice(0, 6)}`;
    nameCache.set(id, fallback);
    return fallback;
  }
}

async function fetchAllianceName(id: string): Promise<string> {
  if (nameCache.has(`alliance:${id}`)) return nameCache.get(`alliance:${id}`)!;
  try {
    const { data } = await amplifyClient.models.Alliance.get({ id });
    const name = data?.name ?? `Alliance ${id.slice(0, 6)}`;
    nameCache.set(`alliance:${id}`, name);
    return name;
  } catch {
    const fallback = `Alliance ${id.slice(0, 6)}`;
    nameCache.set(`alliance:${id}`, fallback);
    return fallback;
  }
}

// ── Data fetchers ──────────────────────────────────────────────────────────

async function fetchBattleReportEvents(): Promise<WorldEvent[]> {
  try {
    const { data: reports } = await amplifyClient.models.BattleReport.list({
      limit: 10,
    });

    if (!reports || reports.length === 0) return [];

    // Sort newest-first (timestamp is a required datetime string on the model)
    const sorted = [...reports].sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });

    const events: WorldEvent[] = await Promise.all(
      sorted.slice(0, 10).map(async (report) => {
        const [attackerName, defenderName] = await Promise.all([
          fetchKingdomName(report.attackerId),
          fetchKingdomName(report.defenderId),
        ]);
        const landPart =
          report.landGained != null && report.landGained > 0
            ? ` \u2014 ${attackerName} gained ${report.landGained} acres`
            : '';
        return {
          id: `br-${report.id}`,
          type: 'combat' as EventType,
          message: `${attackerName} attacked ${defenderName}${landPart}`,
          timestamp: new Date(report.timestamp),
        };
      })
    );

    return events;
  } catch (err) {
    console.warn('[WorldFeed] BattleReport fetch failed:', err);
    return [];
  }
}

async function fetchWarDeclarationEvents(): Promise<WorldEvent[]> {
  try {
    const { data: wars } = await amplifyClient.models.WarDeclaration.list({
      limit: 5,
    });

    if (!wars || wars.length === 0) return [];

    const sorted = [...wars].sort((a, b) => {
      const ta = a.declaredAt ? new Date(a.declaredAt).getTime() : 0;
      const tb = b.declaredAt ? new Date(b.declaredAt).getTime() : 0;
      return tb - ta;
    });

    const events: WorldEvent[] = await Promise.all(
      sorted.slice(0, 5).map(async (war) => {
        const [attackerName, defenderName] = await Promise.all([
          fetchKingdomName(war.attackerId),
          fetchKingdomName(war.defenderId),
        ]);
        return {
          id: `wd-${war.id}`,
          type: 'war' as EventType,
          message: `${attackerName} declared war on ${defenderName}`,
          timestamp: new Date(war.declaredAt),
        };
      })
    );

    return events;
  } catch (err) {
    console.warn('[WorldFeed] WarDeclaration fetch failed:', err);
    return [];
  }
}

async function fetchGuildWarEvents(): Promise<WorldEvent[]> {
  try {
    const { data: guildWars } = await amplifyClient.models.GuildWar.list({
      limit: 5,
    });

    if (!guildWars || guildWars.length === 0) return [];

    const sorted = [...guildWars].sort((a, b) => {
      const ta = a.declaredAt ? new Date(a.declaredAt).getTime() : 0;
      const tb = b.declaredAt ? new Date(b.declaredAt).getTime() : 0;
      return tb - ta;
    });

    const events: WorldEvent[] = sorted.slice(0, 5).map((gw) => ({
      id: `gw-${gw.id}`,
      type: 'war' as EventType,
      message: `Alliance ${gw.attackingGuildName} declared war on Alliance ${gw.defendingGuildName}`,
      timestamp: new Date(gw.declaredAt),
    }));

    return events;
  } catch (err) {
    console.warn('[WorldFeed] GuildWar fetch failed:', err);
    return [];
  }
}

// ── Component ──────────────────────────────────────────────────────────────

interface WorldFeedProps {
  /** Collapse the feed by default on small viewports. Default: false. */
  defaultCollapsed?: boolean;
}

const WorldFeed: React.FC<WorldFeedProps> = ({ defaultCollapsed = false }) => {
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isLoading, setIsLoading] = useState(true);
  // Tick every minute to rerender relative timestamps without a full refetch
  const [, setTick] = useState(0);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isDemoMode()) {
        setEvents(buildMockEvents());
        setIsLoading(false);
        return;
      }

      // Fetch from all available sources in parallel
      const [battleEvents, warEvents, guildWarEvents] = await Promise.all([
        fetchBattleReportEvents(),
        fetchWarDeclarationEvents(),
        fetchGuildWarEvents(),
      ]);

      // Merge all event types, sort newest-first, cap at 20
      const merged = [...battleEvents, ...warEvents, ...guildWarEvents]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 20);

      setEvents(merged.length > 0 ? merged : buildMockEvents());
    } catch (err) {
      console.error('[WorldFeed] Failed to load events:', err);
      setEvents(buildMockEvents());
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // Refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(() => {
      void loadEvents();
    }, 60_000);
    return () => clearInterval(id);
  }, [loadEvents]);

  // Tick every 30 s to keep relative timestamps current without refetching
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="world-feed-panel">
      {/* Header row */}
      <button
        className="world-feed-header"
        onClick={() => setIsCollapsed((c) => !c)}
        aria-expanded={!isCollapsed}
        aria-controls="world-feed-body"
      >
        <span className="world-feed-title">
          <span className="world-feed-title-icon" aria-hidden="true">&#x1F30D;</span>
          World Activity Feed
        </span>
        <span className="world-feed-badge" title="Events in feed">
          {isLoading ? '…' : events.length}
        </span>
        <span className="world-feed-chevron" aria-hidden="true">
          {isCollapsed ? '&#9660;' : '&#9650;'}
        </span>
      </button>

      {/* Body */}
      {!isCollapsed && (
        <div id="world-feed-body" className="world-feed-body">
          {isLoading ? (
            <div className="world-feed-loading">Loading world events…</div>
          ) : events.length === 0 ? (
            <div className="world-feed-empty">No world events yet. The realm is quiet.</div>
          ) : (
            <ul className="world-feed-list" aria-label="World activity events">
              {events.map((event) => (
                <li key={event.id} className={`world-feed-event world-feed-event--${event.type}`}>
                  <span className="world-feed-event-icon" aria-hidden="true">
                    {EVENT_ICONS[event.type]}
                  </span>
                  <span className="world-feed-event-message">{event.message}</span>
                  <span className="world-feed-event-time" title={event.timestamp.toLocaleString()}>
                    {formatRelativeTime(event.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Footer: refresh button */}
          <div className="world-feed-footer">
            <button
              className="world-feed-refresh-btn"
              onClick={() => void loadEvents()}
              disabled={isLoading}
              aria-label="Refresh world activity feed"
            >
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </button>
            {!isDemoMode() && (
              <span className="world-feed-footer-note">Updates every 60s</span>
            )}
            {isDemoMode() && (
              <span className="world-feed-footer-note world-feed-footer-note--demo">Demo</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorldFeed;
