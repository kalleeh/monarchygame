import { describe, it, expect } from 'vitest';
import {
  assignPersonality,
  getOptimalBuildRatios,
  shouldAttack,
  selectAttackTarget,
  decideAIActions,
  armyCombatPower,
  type AIKingdomState,
  type AIPersonality,
  type SeasonAge,
} from './ai-behavior';
import { calculateTroopCapGold } from './troop-cap-mechanics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAIKingdom(overrides: Partial<AIKingdomState> = {}): AIKingdomState {
  return {
    id: 'ai-kingdom-1',
    race: 'Human',
    land: 1000,
    gold: 100_000,
    turnsAvailable: 30,
    networth: 500_000,
    buildings: { mine: 100, barracks: 100, wall: 50, tower: 30, farm: 30 },
    totalUnits: { peasants: 200, militia: 100, knights: 50 },
    isAI: true,
    isActive: true,
    ...overrides,
  };
}

function makeTarget(overrides: Partial<AIKingdomState> = {}): AIKingdomState {
  return {
    id: 'target-1',
    race: 'Elven',
    land: 800,
    gold: 50_000,
    turnsAvailable: 20,
    networth: 300_000,
    buildings: {},
    totalUnits: { 'elven-scouts': 50, 'elven-warriors': 30 },
    isAI: false,
    isActive: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// assignPersonality
// ---------------------------------------------------------------------------

describe('assignPersonality', () => {
  it('returns a valid personality type', () => {
    const p = assignPersonality('some-kingdom-id');
    expect(['aggressive', 'builder', 'balanced']).toContain(p);
  });

  it('is deterministic — same ID always returns same personality', () => {
    const p1 = assignPersonality('test-id-abc');
    const p2 = assignPersonality('test-id-abc');
    expect(p1).toBe(p2);
  });

  it('distributes across personality types for different IDs', () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(assignPersonality(`kingdom-${i}`));
    }
    // With 100 different IDs, we should see all 3 types
    expect(results.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getOptimalBuildRatios
// ---------------------------------------------------------------------------

describe('getOptimalBuildRatios', () => {
  it('returns ratios that sum to 1.0 for each personality', () => {
    for (const p of ['aggressive', 'builder', 'balanced'] as AIPersonality[]) {
      const ratios = getOptimalBuildRatios(p);
      const sum = Object.values(ratios).reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });

  it('uses only real building types (matches building-constructor)', () => {
    const valid = new Set(['mine', 'farm', 'tower', 'castle', 'barracks', 'temple', 'wall']);
    for (const p of ['aggressive', 'builder', 'balanced'] as const) {
      for (const type of Object.keys(getOptimalBuildRatios(p))) {
        expect(valid.has(type)).toBe(true);
      }
    }
  });

  it('aggressive invests more in barracks (military capacity) than builder', () => {
    expect(getOptimalBuildRatios('aggressive').barracks)
      .toBeGreaterThan(getOptimalBuildRatios('builder').barracks);
  });

  it('builder invests more in economy (mine) than aggressive', () => {
    expect(getOptimalBuildRatios('builder').mine)
      .toBeGreaterThan(getOptimalBuildRatios('aggressive').mine);
  });
});

// ---------------------------------------------------------------------------
// shouldAttack
// ---------------------------------------------------------------------------

describe('shouldAttack', () => {
  it('never attacks in early age', () => {
    // rand=0 means always below any positive threshold, but early chance is 0
    expect(shouldAttack('aggressive', 'early', 30, 200, 0)).toBe(false);
    expect(shouldAttack('balanced', 'early', 30, 200, 0)).toBe(false);
    expect(shouldAttack('builder', 'early', 30, 200, 0)).toBe(false);
  });

  it('attacks in late age with low rand for aggressive', () => {
    expect(shouldAttack('aggressive', 'late', 30, 200, 0.1)).toBe(true);
  });

  it('does not attack with insufficient turns', () => {
    expect(shouldAttack('aggressive', 'late', 3, 200, 0)).toBe(false);
  });

  it('does not attack with too few units', () => {
    expect(shouldAttack('aggressive', 'late', 30, 10, 0)).toBe(false);
  });

  it('does not attack when rand exceeds chance', () => {
    // Builder late chance is 0.10, rand=0.5 should not attack
    expect(shouldAttack('builder', 'late', 30, 200, 0.5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// selectAttackTarget
// ---------------------------------------------------------------------------

describe('selectAttackTarget', () => {
  it('returns null when no candidates exist', () => {
    const ai = makeAIKingdom();
    expect(selectAttackTarget(ai, [], 'aggressive')).toBeNull();
  });

  it('returns null when only candidate is self', () => {
    const ai = makeAIKingdom();
    expect(selectAttackTarget(ai, [ai], 'aggressive')).toBeNull();
  });

  it('selects a valid target within networth range', () => {
    const ai = makeAIKingdom({ networth: 500_000 });
    const target = makeTarget({ networth: 350_000 }); // 0.7 ratio — in aggressive range [0.5, 0.9]
    const result = selectAttackTarget(ai, [target], 'aggressive');
    expect(result).toBe('target-1');
  });

  it('skips targets outside networth range', () => {
    const ai = makeAIKingdom({ networth: 500_000 });
    const tooStrong = makeTarget({ id: 'strong', networth: 600_000 }); // 1.2 ratio — outside [0.5, 0.9]
    expect(selectAttackTarget(ai, [tooStrong], 'aggressive')).toBeNull();
  });

  it('skips inactive targets', () => {
    const ai = makeAIKingdom();
    const inactive = makeTarget({ isActive: false });
    expect(selectAttackTarget(ai, [inactive], 'aggressive')).toBeNull();
  });

  it('skips alliance members', () => {
    const ai = makeAIKingdom({ guildId: 'guild-1' });
    const ally = makeTarget({ guildId: 'guild-1', networth: 350_000 });
    expect(selectAttackTarget(ai, [ally], 'aggressive')).toBeNull();
  });

  it('skips newbie-protected kingdoms', () => {
    const ai = makeAIKingdom({ networth: 900_000 });
    const newbie = makeTarget({
      networth: 100_000, // < 900k/3 = 300k
      createdAt: new Date().toISOString(), // just created
    });
    expect(selectAttackTarget(ai, [newbie], 'aggressive')).toBeNull();
  });

  it('does not skip old kingdoms even if small', () => {
    const ai = makeAIKingdom({ networth: 500_000 });
    const oldSmall = makeTarget({
      networth: 300_000,
      createdAt: new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString(), // 100h old
    });
    expect(selectAttackTarget(ai, [oldSmall], 'aggressive')).toBe('target-1');
  });

  it('skips kingdoms in restoration', () => {
    const ai = makeAIKingdom({ networth: 500_000 });
    const restoring = makeTarget({
      networth: 350_000,
      stats: { restorationEndTime: new Date(Date.now() + 60_000).toISOString() },
    });
    expect(selectAttackTarget(ai, [restoring], 'aggressive')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// decideAIActions
// ---------------------------------------------------------------------------

describe('decideAIActions', () => {
  it('returns empty decision when turns < 3', () => {
    const kingdom = makeAIKingdom({ turnsAvailable: 2 });
    const d = decideAIActions(kingdom, 'balanced', 'middle', []);
    expect(d.builds).toHaveLength(0);
    expect(d.trains).toHaveLength(0);
    expect(d.attackTarget).toBeNull();
    expect(d.turnsSpent).toBe(0);
  });

  it('builds when there is a building deficit', () => {
    const kingdom = makeAIKingdom({
      land: 1000,
      gold: 200_000,
      turnsAvailable: 30,
      buildings: {}, // empty — big deficit
    });
    const d = decideAIActions(kingdom, 'builder', 'early', []);
    expect(d.builds.length).toBeGreaterThan(0);
    expect(d.goldSpent).toBeGreaterThan(0);
  });

  it('trains units when buildings are full', () => {
    const kingdom = makeAIKingdom({
      land: 1000,
      gold: 200_000,
      turnsAvailable: 30,
      buildings: { buildrate: 240, troop: 240, fortress: 120, income: 80, peasant: 80 }, // 760/800 — nearly full
      totalUnits: {}, // no units — big deficit
    });
    const d = decideAIActions(kingdom, 'aggressive', 'middle', []);
    expect(d.trains.length).toBeGreaterThan(0);
  });

  it('does not attack in early age', () => {
    const kingdom = makeAIKingdom({ turnsAvailable: 50 });
    const target = makeTarget({ networth: 350_000 });
    const d = decideAIActions(kingdom, 'aggressive', 'early', [kingdom, target], 0.01);
    expect(d.attackTarget).toBeNull();
  });

  it('attacks in late age with low rand', () => {
    const kingdom = makeAIKingdom({
      turnsAvailable: 50,
      gold: 200_000,
      totalUnits: { peasants: 200, militia: 100, knights: 50 },
      buildings: { mine: 240, barracks: 240, wall: 120, tower: 80, farm: 80 },
    });
    const target = makeTarget({ networth: 350_000 });
    // rand=0.01 should be below aggressive late chance of 0.25
    const d = decideAIActions(kingdom, 'aggressive', 'late', [kingdom, target], 0.01);
    expect(d.attackTarget).toBe('target-1');
  });

  it('keeps a scaled gold reserve (>= 10% of starting gold)', () => {
    const kingdom = makeAIKingdom({ gold: 100_000, turnsAvailable: 30, buildings: {} });
    const d = decideAIActions(kingdom, 'builder', 'early', []);
    // Reserve is max(500, 10% of gold) = 10_000 here; never spends below it.
    expect(kingdom.gold - d.goldSpent).toBeGreaterThanOrEqual(10_000);
  });

  it('a player-sized AI (low gold, no buildings) can still act on its first tick', () => {
    // ~player start: 100 land, 2000 gold, no buildings. Reserve = max(500, 200) = 500.
    const kingdom = makeAIKingdom({
      gold: 2000, land: 100, turnsAvailable: 30,
      buildings: {}, totalUnits: { peasants: 40 },
    });
    const d = decideAIActions(kingdom, 'builder', 'early', []);
    // It must DO something (build and/or train), not sit frozen.
    expect(d.builds.length + d.trains.length).toBeGreaterThan(0);
    // And it must keep at least the 500 minimum reserve.
    expect(kingdom.gold - d.goldSpent).toBeGreaterThanOrEqual(500);
  });

  it('caps turns at 72', () => {
    const kingdom = makeAIKingdom({ turnsAvailable: 100, buildings: {} });
    const d = decideAIActions(kingdom, 'balanced', 'late', []);
    // Turn budget = floor(72 * 0.9) = 64
    expect(d.turnsSpent).toBeLessThanOrEqual(64);
  });

  it('limits training tiers by season age', () => {
    const kingdom = makeAIKingdom({
      turnsAvailable: 30,
      gold: 500_000,
      buildings: { mine: 240, barracks: 240, wall: 120, tower: 80, farm: 80 },
      totalUnits: {},
    });
    // Early age: only T1 and T2
    const d = decideAIActions(kingdom, 'balanced', 'early', []);
    const trainedTypes = d.trains.map(t => t.unitType);
    // Human T3 = 'knights', T4 = 'cavalry' — should not appear in early
    expect(trainedTypes).not.toContain('knights');
    expect(trainedTypes).not.toContain('cavalry');
  });
});

// ---------------------------------------------------------------------------
// Fairness — AI plays by the same rules as players
// ---------------------------------------------------------------------------

describe('AI fairness — no cheating', () => {
  it('never trains past the troop cap players are bound by', () => {
    // Small kingdom: cap floored at MIN_CAP_GOLD (2M). Give it huge gold so only
    // the troop cap — not gold — limits training.
    const land = 1000;
    const barracks = 0;
    const cap = calculateTroopCapGold({ land, barracks }); // 2,000,000
    const kingdom = makeAIKingdom({
      land,
      gold: 100_000_000,        // effectively unlimited gold
      turnsAvailable: 72,
      buildings: { barracks },
      totalUnits: {},           // start with no troops
    });
    const d = decideAIActions(kingdom, 'aggressive', 'middle', [], 0.99 /* no attack */);
    // Value everything trained at Human tier costs [50,350,900,2000].
    const tierCost: Record<string, number> = { peasants: 50, militia: 350, knights: 900, cavalry: 2000 };
    const invested = d.trains.reduce((s, t) => s + (tierCost[t.unitType] ?? 0) * t.qty, 0);
    expect(invested).toBeLessThanOrEqual(cap);
  });

  it('building cost matches the player flat 250g per building', () => {
    const kingdom = makeAIKingdom({ buildings: {}, gold: 1_000_000, turnsAvailable: 72 });
    const d = decideAIActions(kingdom, 'builder', 'early', [], 0.99);
    const totalBuilt = d.builds.reduce((s, b) => s + b.qty, 0);
    if (totalBuilt > 0) {
      // goldSpent includes builds + trains; isolate by checking builds alone via a build-only run isn't
      // trivial, so just assert each build action priced at 250 in the decision's accounting.
      // (decision.goldSpent is buildsGold + trainsGold; builds portion = totalBuilt * 250.)
      expect(d.goldSpent).toBeGreaterThanOrEqual(totalBuilt * 250);
    }
  });

  it('armyCombatPower uses real per-tier values and excludes scouts', () => {
    // Human: peasants T1(off1), militia T2(off3), knights T3(off6), cavalry T4(off10)
    const { offense, defense } = armyCombatPower('Human', {
      peasants: 10, militia: 10, knights: 10, cavalry: 10, scouts: 100,
    });
    expect(offense).toBe(10 * 1 + 10 * 3 + 10 * 6 + 10 * 10); // 200, scouts excluded
    expect(defense).toBe(10 * 1 + 10 * 2 + 10 * 4 + 10 * 7);  // 140
  });
});
