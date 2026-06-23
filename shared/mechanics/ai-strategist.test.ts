import { describe, it, expect } from 'vitest';
import {
  assignPersona,
  assignDifficulty,
  makeRng,
  PERSONAS,
  DIFFICULTY_PARAMS,
  armyCombatPower,
  estimateDefense,
  scoreBuilds,
  threatLevel,
  emptyMemory,
  scoreTrains,
  troopGoldInvested,
  scoreAttack,
  decide,
  type Persona,
  type Difficulty,
} from './ai-strategist';
import { buildingGoldCostPerAcre } from './building-cost';

describe('persona & difficulty assignment', () => {
  it('is deterministic per kingdom id', () => {
    expect(assignPersona('kingdom-abc')).toBe(assignPersona('kingdom-abc'));
    expect(assignDifficulty('kingdom-abc')).toBe(assignDifficulty('kingdom-abc'));
  });

  it('covers all six personas across many ids', () => {
    const seen = new Set<Persona>();
    for (let i = 0; i < 600; i++) seen.add(assignPersona(`k-${i}`));
    expect(seen.size).toBe(6);
  });

  it('is deterministic per (kingdom id, race)', () => {
    expect(assignPersona('kingdom-abc', 'Vampire')).toBe(assignPersona('kingdom-abc', 'Vampire'));
  });

  it('biases toward race strengths but keeps full variety', () => {
    // Vampire: +35% defense, 2× costs → should lean turtle/schemer.
    const vampire: Record<Persona, number> = { warlord: 0, raider: 0, economist: 0, turtle: 0, opportunist: 0, schemer: 0 };
    const droben: Record<Persona, number> = { warlord: 0, raider: 0, economist: 0, turtle: 0, opportunist: 0, schemer: 0 };
    for (let i = 0; i < 1000; i++) {
      vampire[assignPersona(`k-${i}`, 'Vampire')]++;
      droben[assignPersona(`k-${i}`, 'Droben')]++;
    }
    // Bias holds: a Vampire turtles far more than a Droben does.
    expect(vampire.turtle).toBeGreaterThan(droben.turtle);
    // Droben (+20% offense, highest) is the more warlike of the two.
    expect(droben.warlord).toBeGreaterThan(vampire.warlord);
    // Variety survives: every persona still appears for each race.
    for (const p of Object.keys(vampire) as Persona[]) {
      expect(vampire[p]).toBeGreaterThan(0);
      expect(droben[p]).toBeGreaterThan(0);
    }
  });

  it('falls back to a uniform pick for an unknown race', () => {
    const seen = new Set<Persona>();
    for (let i = 0; i < 600; i++) seen.add(assignPersona(`k-${i}`, 'Nonexistent'));
    expect(seen.size).toBe(6);
  });

  it('difficulty distribution is roughly 25/50/25', () => {
    const counts: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    for (let i = 0; i < 2000; i++) counts[assignDifficulty(`k-${i}`)]++;
    expect(counts.easy).toBeGreaterThan(2000 * 0.15);
    expect(counts.easy).toBeLessThan(2000 * 0.35);
    expect(counts.medium).toBeGreaterThan(2000 * 0.40);
    expect(counts.medium).toBeLessThan(2000 * 0.60);
    expect(counts.hard).toBeGreaterThan(2000 * 0.15);
    expect(counts.hard).toBeLessThan(2000 * 0.35);
  });

  it('every persona has complete weights and every difficulty complete params', () => {
    for (const p of Object.values(PERSONAS)) {
      for (const k of ['econ', 'military', 'defense', 'aggression', 'lootFocus', 'vengeance', 'playerFocus'] as const) {
        expect(p[k]).toBeGreaterThan(0);
      }
    }
    for (const d of Object.values(DIFFICULTY_PARAMS)) {
      expect(d.estNoise).toBeGreaterThanOrEqual(0);
      expect(d.actChance).toBeGreaterThan(0);
      expect(d.turnBudgetFrac).toBeGreaterThan(0);
    }
  });
});

describe('makeRng', () => {
  it('same seed gives same sequence; different seeds differ', () => {
    const a = makeRng(42), b = makeRng(42), c = makeRng(43);
    const seqA = [a(), a(), a()], seqB = [b(), b(), b()], seqC = [c(), c(), c()];
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const v of seqA) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

describe('armyCombatPower', () => {
  it('uses real per-tier values and excludes scouts', () => {
    const { offense, defense } = armyCombatPower('Human', {
      peasants: 10, militia: 10, knights: 10, cavalry: 10, scouts: 100,
    });
    // Flattened curve: TIER_STATS.OFFENSE = [1,7,18,40], DEFENSE = [1,5,13,30]
    expect(offense).toBe(10 * 1 + 10 * 7 + 10 * 18 + 10 * 40); // 660
    expect(defense).toBe(10 * 1 + 10 * 5 + 10 * 13 + 10 * 30); // 490
  });
});

describe('estimateDefense (information-fair)', () => {
  const view = (networth: number, race = 'Human') => ({
    id: 't1', race, networth, isActive: true, isAI: true,
  });

  it('scales with networth', () => {
    const rng = makeRng(1);
    const small = estimateDefense(view(100_000), 'hard', rng);
    const big = estimateDefense(view(1_000_000), 'hard', makeRng(1));
    expect(big).toBeGreaterThan(small * 5);
  });

  it('hard estimates are tighter than easy estimates', () => {
    // Sample many estimates; spread (max/min) must be wider for easy.
    const spread = (d: 'easy' | 'hard') => {
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < 200; i++) {
        const e = estimateDefense(view(500_000), d, makeRng(i));
        mn = Math.min(mn, e); mx = Math.max(mx, e);
      }
      return mx / mn;
    };
    expect(spread('easy')).toBeGreaterThan(spread('hard') * 1.5);
  });

  it('applies the public race defense bonus (Vampire > Human at equal networth)', () => {
    const h = estimateDefense(view(500_000, 'Human'), 'hard', makeRng(7));
    const v = estimateDefense(view(500_000, 'Vampire'), 'hard', makeRng(7));
    expect(v).toBeGreaterThan(h);
  });
});

function self(over: Partial<import('./ai-strategist').SelfState> = {}) {
  return {
    id: 'me', race: 'Human', land: 1000, gold: 100_000, turnsAvailable: 50,
    networth: 1_000_000, buildings: {}, totalUnits: {},
    ...over,
  };
}

describe('scoreBuilds', () => {
  it('economist concentrates on income buildings (tower has highest marginal gold)', () => {
    const builds = scoreBuilds(self(), PERSONAS.economist, 1, 30, 90_000, makeRng(1), 0);
    const total = builds.reduce((s, b) => s + b.qty, 0);
    const towers = builds.find(b => b.type === 'tower')?.qty ?? 0;
    expect(total).toBeGreaterThan(0);
    expect(towers / total).toBeGreaterThan(0.4); // towers dominate econ value
  });

  it('turtle under threat builds far more walls than a safe economist', () => {
    const turtleBuilds = scoreBuilds(self(), PERSONAS.turtle, 5, 30, 90_000, makeRng(2), 0);
    const econBuilds = scoreBuilds(self(), PERSONAS.economist, 1, 30, 90_000, makeRng(2), 0);
    const walls = (bs: Array<{ type: string; qty: number }>) =>
      bs.find(b => b.type === 'wall')?.qty ?? 0;
    expect(walls(turtleBuilds)).toBeGreaterThan(walls(econBuilds));
  });

  it('barracks utility spikes when troop-cap headroom is low', () => {
    // troopGoldInvested near cap (land 1000, 0 barracks -> cap 2M floor; invested 1.9M)
    const tight = scoreBuilds(self(), PERSONAS.warlord, 1, 30, 90_000, makeRng(3), 1_900_000);
    const loose = scoreBuilds(self(), PERSONAS.warlord, 1, 30, 90_000, makeRng(3), 0);
    const barracks = (bs: Array<{ type: string; qty: number }>) =>
      bs.find(b => b.type === 'barracks')?.qty ?? 0;
    expect(barracks(tight)).toBeGreaterThan(barracks(loose));
  });

  it('never exceeds buildable slots (80% of land) or the gold budget', () => {
    const small = self({ land: 100, buildings: { mine: 70 } }); // 80 slots, 70 used
    const builds = scoreBuilds(small, PERSONAS.economist, 1, 30, 5_000, makeRng(4), 0);
    const total = builds.reduce((s, b) => s + b.qty, 0);
    expect(total).toBeLessThanOrEqual(10);
    expect(total * buildingGoldCostPerAcre(small.land)).toBeLessThanOrEqual(5_000);
  });
});

describe('threatLevel', () => {
  it('rises with grudges and recent attacks on me', () => {
    const mem = emptyMemory();
    mem.grudges['enemy'] = { count: 2, lastAt: new Date().toISOString() };
    const recent = [{ attackerId: 'enemy', defenderId: 'me', landGained: 50, timestamp: new Date().toISOString() }];
    expect(threatLevel('me', mem, recent)).toBeGreaterThan(threatLevel('me', emptyMemory(), []));
  });
});

describe('scoreTrains', () => {
  it('builds a MIXED army across tiers rather than mono-spamming the cheapest unit', () => {
    // Ample land + gold + turns: the AI should spread across multiple tiers.
    const k = self({ land: 30_000, gold: 5_000_000, buildings: { barracks: 5_000 }, totalUnits: {} });
    const trains = scoreTrains(k, PERSONAS.warlord, 72, 4_000_000, makeRng(1));
    const tiersUsed = new Set(trains.map(t => t.unitType));
    expect(trains.length).toBeGreaterThan(0);
    expect(tiersUsed.size).toBeGreaterThanOrEqual(3); // not a single-tier wall
    // No single tier should dominate the whole gold spend.
    const totalCost = trains.reduce((s, t) => s + t.cost, 0);
    const maxTierCost = Math.max(...trains.map(t => t.cost));
    expect(maxTierCost / totalCost).toBeLessThan(0.6);
  });

  it('respects the land-based unit-count cap (no mega-wall on small land)', () => {
    // 100 land → cap 5,000 units. Already at 4,900 → at most 100 more, despite huge gold.
    const tight = self({ land: 100, totalUnits: { peasants: 4_900 }, gold: 10_000_000, buildings: {} });
    const trains = scoreTrains(tight, PERSONAS.warlord, 72, 5_000_000, makeRng(2));
    const trained = trains.reduce((s, t) => s + t.qty, 0);
    expect(trained).toBeLessThanOrEqual(100);
  });

  it('never exceeds the troop cap players are bound by', () => {
    const k = self({ land: 1000, buildings: {}, totalUnits: {} }); // cap = 2M floor
    const trains = scoreTrains(k, PERSONAS.warlord, 72, 100_000_000, makeRng(3));
    const invested = trains.reduce((s, t) => s + t.cost, 0);
    expect(invested).toBeLessThanOrEqual(2_000_000);
  });

  it('Vampire pays double (economicMultiplier 2.0)', () => {
    const v = self({ race: 'Vampire' });
    const trains = scoreTrains(v, PERSONAS.warlord, 30, 10_000, makeRng(4));
    const thralls = trains.find(t => t.unitType === 'thralls');
    expect(thralls).toBeDefined();
    expect(thralls!.cost / thralls!.qty).toBe(100); // 50 * 2.0
  });
});

describe('troopGoldInvested', () => {
  it('values existing units at real per-unit cost', () => {
    expect(troopGoldInvested('Human', { peasants: 10, militia: 2 })).toBe(10 * 50 + 2 * 350);
  });
});

const mkView = (id: string, networth: number, over: Partial<import('./ai-strategist').PublicKingdomView> = {}) => ({
  id, race: 'Human', networth, isActive: true, isAI: true, ...over,
});

function attackCtx(over: Partial<import('./ai-strategist').StrategistContext> = {}) {
  return {
    age: 'middle' as const,
    persona: 'warlord' as const,
    difficulty: 'hard' as const,
    memory: emptyMemory(),
    recentBattles: [] as import('./ai-strategist').PublicBattleEvent[],
    rng: makeRng(11),
    nowMs: Date.now(),
    ...over,
  };
}

const strongSelf = () => self({
  totalUnits: { peasants: 5000, militia: 2000, knights: 500 },
  land: 2000, networth: 2_500_000,
});

describe('scoreAttack', () => {
  it('never attacks in early age', () => {
    const r = scoreAttack(strongSelf(), [mkView('t', 500_000)], attackCtx({ age: 'early' }));
    expect(r.attackTarget).toBeNull();
    expect(r.declareWarOn).toBeNull();
  });

  it('attacks a clearly weaker target when strong (hard, middle age)', () => {
    const r = scoreAttack(strongSelf(), [mkView('weak', 300_000)], attackCtx());
    expect(r.attackTarget).toBe('weak');
  });

  it('does NOT attack when estimated defense leaves no safety margin', () => {
    const weakSelf = self({ totalUnits: { peasants: 100 }, networth: 150_000 });
    const r = scoreAttack(weakSelf, [mkView('big', 5_000_000)], attackCtx());
    expect(r.attackTarget).toBeNull();
  });

  it('respects newbie protection (under 72h old AND under a third of my networth)', () => {
    const fresh = mkView('newbie', 100_000, { createdAt: new Date().toISOString(), isAI: false });
    const r = scoreAttack(strongSelf(), [fresh], attackCtx());
    expect(r.attackTarget).toBeNull();
  });

  it('skips targets under restoration', () => {
    const t = mkView('rest', 600_000, { underRestoration: true });
    const r = scoreAttack(strongSelf(), [t], attackCtx());
    expect(r.attackTarget).toBeNull();
  });

  it('schemer prioritizes its grudge over a juicier neutral target', () => {
    const mem = emptyMemory();
    mem.grudges['attacker'] = { count: 2, lastAt: new Date().toISOString() };
    // Both targets are safely attackable; 'richer' (600k) is the juicier neutral
    // (more land = more loot), but the schemer's grudge multiplier on 'attacker'
    // (500k) overrides that. This tests grudge priority, not the safety gate.
    const r = scoreAttack(
      strongSelf(),
      [mkView('attacker', 500_000), mkView('richer', 600_000)],
      attackCtx({ persona: 'schemer', memory: mem }),
    );
    expect(r.attackTarget).toBe('attacker');
  });

  it('war rule: 4th attack on the same defender becomes a war declaration', () => {
    const mem = emptyMemory();
    mem.attacksMade['weak'] = 3;
    const r = scoreAttack(strongSelf(), [mkView('weak', 300_000)], attackCtx({ memory: mem }));
    expect(r.attackTarget).toBeNull();
    expect(r.declareWarOn).toBe('weak');
  });

  it('after declaring war, attacks may continue', () => {
    const mem = emptyMemory();
    mem.attacksMade['weak'] = 5;
    mem.warsDeclared = ['weak'];
    const r = scoreAttack(strongSelf(), [mkView('weak', 300_000)], attackCtx({ memory: mem }));
    expect(r.attackTarget).toBe('weak');
  });
});

describe('decide()', () => {
  it('a player-sized hard economist acts on its first tick (builds and/or trains)', () => {
    const k = self({ land: 100, gold: 2000, buildings: {}, totalUnits: { peasants: 40 } });
    const d = decide(k, [], attackCtx({ persona: 'economist', age: 'early', rng: makeRng(5) }));
    expect(d.builds.length + d.trains.length).toBeGreaterThan(0);
    expect(d.goldSpent).toBeLessThanOrEqual(2000);
    expect(d.goldSpent).toBeGreaterThan(0);
  });

  it('easy AI sometimes idles (actChance < 1)', () => {
    const k = self();
    let idles = 0;
    for (let i = 0; i < 100; i++) {
      const d = decide(k, [], attackCtx({ difficulty: 'easy', rng: makeRng(1000 + i) }));
      if (d.builds.length + d.trains.length === 0 && !d.attackTarget) idles++;
    }
    expect(idles).toBeGreaterThan(10); // ~40% expected
  });

  it('updates memory: records my attack and ingests grudges from public reports', () => {
    const reports = [
      { attackerId: 'bully', defenderId: 'me', landGained: 30, timestamp: new Date().toISOString() },
    ];
    const d = decide(strongSelf(), [mkView('weak', 300_000)], attackCtx({ recentBattles: reports }));
    expect(d.memory.grudges['bully']?.count).toBe(1);
    if (d.attackTarget) expect(d.memory.attacksMade[d.attackTarget]).toBe(1);
  });

  it('expires grudges older than 7 days', () => {
    const mem = emptyMemory();
    mem.grudges['old'] = { count: 3, lastAt: new Date(Date.now() - 8 * 24 * 3600_000).toISOString() };
    const d = decide(self(), [], attackCtx({ memory: mem }));
    expect(d.memory.grudges['old']).toBeUndefined();
  });

  it('turn spending never exceeds the difficulty turn budget', () => {
    const k = self({ turnsAvailable: 72 });
    const d = decide(k, [], attackCtx({ difficulty: 'easy', rng: makeRng(2) }));
    expect(d.turnsSpent).toBeLessThanOrEqual(Math.floor(72 * 0.5));
  });

  it('records the war declaration in memory', () => {
    const mem = emptyMemory();
    mem.attacksMade['weak'] = 3;
    const d = decide(strongSelf(), [mkView('weak', 300_000)], attackCtx({ memory: mem }));
    expect(d.declareWarOn).toBe('weak');
    expect(d.memory.warsDeclared).toContain('weak');
  });
});
