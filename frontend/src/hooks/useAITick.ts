/**
 * useAITick — time-based AI kingdom progression hook.
 *
 * Mounted once in App.tsx (not in any per-kingdom component) so AI ticks
 * regardless of which page the player is on. On mount it catches up any
 * missed ticks since the last session; afterwards it ticks every 20 min.
 *
 * NOTE: AI kingdoms live entirely in client-side Zustand memory and are NOT
 * stored in DynamoDB. This means each browser session generates its own
 * independent AI kingdoms. For true multiplayer consistency, AI kingdoms need
 * to be persisted as Kingdom rows in DynamoDB and ticked server-side by the
 * turn-ticker Lambda. See amplify/functions/turn-ticker/handler.ts.
 *
 * Multi-tab safety: a localStorage leader-election mutex ensures only one tab
 * processes ticks at a time. The leader writes its heartbeat every tick cycle;
 * other tabs observe the heartbeat and skip processing while a leader is active.
 */

import { useEffect } from 'react';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { AIActionService } from '../services/aiActionService';
import { RESOURCE_GENERATION } from '../constants/gameConfig';

const TICK_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes — one turn
const STORAGE_KEY = 'ai-last-tick';
const MAX_CATCHUP_TICKS = 72; // cap catch-up at ~24 h of missed ticks

// ── Tab-leader mutex ──────────────────────────────────────────────────────────
// Only the elected leader tab runs AI ticks. Leadership is re-confirmed on
// every tick cycle; if the leader tab closes, the next tab to run takes over.
const LEADER_KEY = 'ai-tick-leader';
const LEADER_TTL_MS = TICK_INTERVAL_MS + 60_000; // leader must renew within 21 min

// Stable per-tab ID generated once at module load.
const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Returns true if this tab is the elected leader (or can claim leadership).
 * Writes the heartbeat on success so other tabs see an up-to-date timestamp.
 */
function claimLeadership(): boolean {
  try {
    const raw = localStorage.getItem(LEADER_KEY);
    if (raw) {
      const { tabId, ts } = JSON.parse(raw) as { tabId: string; ts: number };
      const age = Date.now() - ts;
      // Another tab holds a fresh lease — yield.
      if (tabId !== TAB_ID && age < LEADER_TTL_MS) return false;
    }
    // Either no leader, our own lease, or a stale lease — claim it.
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: TAB_ID, ts: Date.now() }));
    return true;
  } catch {
    // localStorage unavailable (private browsing quota) — allow ticking.
    return true;
  }
}

function applyAITicks(tickCount: number): void {
  if (tickCount <= 0) return;
  const { aiKingdoms, updateAIKingdom } = useAIKingdomStore.getState();
  if (aiKingdoms.length === 0) return;

  // Snapshot used for attack-targeting so stale mid-loop state isn't used
  const snapshot = [...aiKingdoms];

  aiKingdoms.forEach(ai => {
    const updatedAI = {
      ...ai,
      resources: {
        ...ai.resources,
        gold: ai.resources.gold + RESOURCE_GENERATION.BASE_INCOME_PER_TICK * tickCount,
        population: ai.resources.population + RESOURCE_GENERATION.BASE_POPULATION_GROWTH * tickCount,
        turns: Math.min(ai.resources.turns + tickCount, 100),
      },
    };

    // One round of actions per batch regardless of tickCount — keeps it lightweight
    const actions = AIActionService.decideActions(updatedAI, snapshot);
    actions.forEach(action => {
      if (action.type === 'build') {
        const result = AIActionService.executeBuild(updatedAI);
        if (result.resources) updatedAI.resources = result.resources;
      } else if (action.type === 'train') {
        const result = AIActionService.executeTrain(updatedAI);
        if (result.resources) updatedAI.resources = result.resources;
        if (result.units) updatedAI.units = result.units;
      } else if (action.type === 'attack') {
        const target = snapshot.find(t => t.id !== ai.id && t.networth < ai.networth * 1.5);
        if (target) {
          const result = AIActionService.executeAttack(updatedAI, target);
          if (result.attacker.resources) updatedAI.resources = result.attacker.resources;
          if (result.defender.resources) updateAIKingdom(target.id, result.defender);
        }
      }
    });

    const newNetworth =
      updatedAI.resources.land * 1000 +
      updatedAI.resources.gold +
      Object.values(updatedAI.units).reduce((sum, c) => sum + (c as number) * 100, 0);

    updateAIKingdom(ai.id, {
      resources: updatedAI.resources,
      units: updatedAI.units,
      networth: newNetworth,
    });
  });
}

export function useAITick(): void {
  useEffect(() => {
    function tick(): void {
      // Yield to another tab if it holds a fresh leadership lease.
      if (!claimLeadership()) return;

      const now = Date.now();
      const lastRaw = localStorage.getItem(STORAGE_KEY);
      const lastTick = lastRaw ? parseInt(lastRaw, 10) : now - TICK_INTERVAL_MS;

      const missed = Math.floor((now - lastTick) / TICK_INTERVAL_MS);
      if (missed > 0) {
        applyAITicks(Math.min(missed, MAX_CATCHUP_TICKS));
      }

      localStorage.setItem(STORAGE_KEY, String(now));
    }

    // Catch up immediately on mount
    tick();

    const id = setInterval(tick, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
