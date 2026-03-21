import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { isDemoMode } from '../utils/authMode';
import { useCombatStore } from '../stores/combatStore';
import { useThieveryStore } from '../stores/thieveryStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
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

// ── Demo data builder — reads real stores + synthesises AI world events ────

/**
 * Build demo-mode feed events from three sources:
 *  1. Player's real battle history (combatStore)
 *  2. Player's real thievery operations (thieveryStore)
 *  3. Synthetic AI vs AI background events seeded by 5-minute time buckets
 *     so they change each refresh cycle without being random on every render.
 */
function buildDemoEvents(aiKingdomNames: string[]): WorldEvent[] {
  const events: WorldEvent[] = [];
  const now = Date.now();

  // 1. Real player battles
  const aiKingdoms = useAIKingdomStore.getState().aiKingdoms;
  const battles = useCombatStore.getState().battleHistory;
  for (const b of battles.slice(0, 10)) {
    const landPart = b.landGained && b.landGained > 0 ? ` — gained ${b.landGained} acres` : '';
    const defAI = aiKingdoms.find(k => k.id === b.defender);
    const defName = defAI?.name ?? (b.defender === 'current-player' ? 'Unknown' : b.defender.slice(0, 8));
    events.push({
      id: `player-battle-${b.id}`,
      type: 'combat',
      message: `You ${b.result === 'victory' ? 'attacked' : 'attacked'} ${defName}${landPart}`,
      timestamp: new Date(b.timestamp),
    });
  }

  // 2. Real player thievery operations
  const ops = useThieveryStore.getState().operations;
  for (const op of ops.slice(0, 5)) {
    const verb = op.success ? 'successfully ran' : 'failed';
    events.push({
      id: `player-thiev-${op.id}`,
      type: 'thievery',
      message: `You ${verb} a ${op.type.replace(/_/g, ' ')} operation against ${op.targetName}`,
      timestamp: new Date(op.timestamp),
    });
  }

  // 3. Synthetic AI vs AI background events (change each 5-minute bucket)
  const names = aiKingdomNames.length >= 4
    ? aiKingdomNames
    : ['Iron Reach', 'The Thornwood', 'Ember Throne', 'Stonewall', 'Crimson Veil', 'Golden Keep'];

  // Seed with the current 5-minute bucket so events are stable within a window
  const bucket = Math.floor(now / (5 * 60 * 1000));
  const seededRand = (n: number, offset: number) => ((bucket * 2654435761 + offset * 1234567) >>> 0) % n;

  const syntheticTemplates: Array<{ type: EventType; make: (a: string, b: string, seed: number) => string }> = [
    { type: 'combat', make: (a, b, s) => `${a} attacked ${b} — ${a} gained ${20 + (s % 60)} acres` },
    { type: 'combat', make: (a, b, s) => `${a} launched a guerrilla raid against ${b} — ${a} gained ${10 + (s % 30)} acres` },
    { type: 'war',    make: (a, b) => `${a} declared war on ${b}` },
    { type: 'thievery', make: (a, b) => `${a} completed a steal operation against ${b}` },
    { type: 'alliance', make: (a) => `${a} achieved full alliance composition bonus` },
  ];

  const numSynthetic = Math.max(0, 8 - events.length);
  for (let i = 0; i < numSynthetic; i++) {
    const tplIdx = seededRand(syntheticTemplates.length, i * 7);
    const aIdx = seededRand(names.length, i * 13);
    let bIdx = seededRand(names.length, i * 17);
    if (bIdx === aIdx) bIdx = (bIdx + 1) % names.length;
    const tpl = syntheticTemplates[tplIdx];
    const ageMins = 5 + seededRand(240, i * 19); // 5m–4h ago
    events.push({
      id: `synth-${bucket}-${i}`,
      type: tpl.type,
      message: tpl.make(names[aIdx], names[bIdx], seededRand(100, i * 23)),
      timestamp: new Date(now - ageMins * 60 * 1000),
    });
  }

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 20);
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
        const aiNames = useAIKingdomStore.getState().aiKingdoms.map(k => k.name);
        setEvents(buildDemoEvents(aiNames));
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

      setEvents(merged.length > 0 ? merged : buildDemoEvents(useAIKingdomStore.getState().aiKingdoms.map(k => k.name)));
    } catch (err) {
      console.error('[WorldFeed] Failed to load events:', err);
      setEvents(buildDemoEvents(useAIKingdomStore.getState().aiKingdoms.map(k => k.name)));
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
