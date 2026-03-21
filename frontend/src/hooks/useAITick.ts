/**
 * useAITick — time-based AI kingdom progression hook.
 *
 * Mounted once in App.tsx (not in any per-kingdom component) so AI ticks
 * regardless of which page the player is on. On mount it catches up any
 * missed ticks since the last session; afterwards it ticks every 20 min.
 *
 * Intentionally decoupled from user actions so the behaviour is the same
 * whether there are 1 or 1000 concurrent players.
 */

import { useEffect } from 'react';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { AIActionService } from '../services/aiActionService';
import { RESOURCE_GENERATION } from '../constants/gameConfig';

const TICK_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes — one turn
const STORAGE_KEY = 'ai-last-tick';
const MAX_CATCHUP_TICKS = 72; // cap catch-up at ~24 h of missed ticks

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
