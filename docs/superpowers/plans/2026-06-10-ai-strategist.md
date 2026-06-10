# AI Strategist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scripted dice-roll AI (`ai-behavior.ts`) with a utility-based strategist that plays as intelligently as possible without an LLM, with 3 difficulty tiers and 6 personas — while playing by exactly the rules and information a human player has.

**Architecture:** A new pure module `shared/mechanics/ai-strategist.ts` makes all decisions from (a) the AI's own full state and (b) a `PublicKingdomView` of other kingdoms containing ONLY fields a player can read through AppSync (the type system enforces information fairness — no enemy unit counts, gold, or buildings). Decisions are utility-scored: marginal building value from the real income formulas, gold-efficient training under the real troop/unit caps, and attack expected-value from estimated (noisy) enemy defense. Difficulty = decision quality (estimation noise, utility noise, act-rate), never extra resources. Personas = weight vectors over one engine. The turn-ticker feeds it public battle reports (one query/tick) for grudge memory and persists memory in the kingdom's `stats` JSON. The AI also gains the war rule players are bound by: max 3 attacks per defender, then it must declare war (creating a real `WarDeclaration` row that shows in the World Feed).

**Tech Stack:** TypeScript, vitest. Reuses `economy-mechanics.ts` (`buildingPerTurnContribution`, `calculateGenerationRates`), `troop-cap-mechanics.ts` (`calculateTroopCapGold`), `combat-mechanics.ts` (`RACE_OFFENSE_BONUSES`, `RACE_DEFENSE_BONUSES`, `calculateCombatResult`, `calculateFortDefense`). No schema change, no LLM, no new infra.

---

## Design summary (read first)

**Information fairness (the new rule).** The old AI read enemies' exact `totalUnits` — informational cheating. The strategist sees only what a player sees via AppSync field auth on `Kingdom`: `id, name, race, networth, isActive, isAI, createdAt, reputation`. Battle reports are `authenticated read` → public, so "who attacked whom / who just lost land" is a fair signal. `underRestoration` is passed as a protective-only flag (it can only spare a target, never advantage the attacker). Enemy defense is **estimated** from networth with difficulty-scaled error.

**Difficulty = decision quality.** All tiers get identical resources/rules.

| Param | easy | medium | hard |
|---|---|---|---|
| defense estimation noise (±) | 60% | 30% | 12% |
| utility comparison noise (±) | 35% | 15% | 5% |
| chance to act at all each tick | 0.6 | 0.85 | 1.0 |
| attack safety margin (× ratio needed) | 1.25 | 1.5 | 1.5 |
| turn budget used per tick | 50% | 70% | 90% |

Distribution: 25% easy / 50% medium / 25% hard, deterministic from kingdom id.

**Personas** (weight vectors, deterministic from kingdom id): `warlord` (army+attacks), `raider` (loot-focused, hits the wounded), `economist` (income-optimal, attacks only golden opportunities), `turtle` (walls/defense, retaliates), `opportunist` (player-focused, kicks them while they're down), `schemer` (grudge-driven vengeance).

**What "smart" actually does:**
- **Build:** greedy on marginal gold/turn per 250g from the REAL `buildingPerTurnContribution` (tower 50 > mine 20 > barracks 15 > castle 10 > farm 8), persona-weighted; barracks utility spikes when troop-cap headroom < 20%; wall utility scales with threat (grudges + being attacked recently).
- **Train:** gold-efficiency (T1 maximizes power-per-gold) until the 100k unit-count cap forces tier escalation — the same optimization a sharp player makes. Respects troop cap AND unit cap.
- **Attack:** expected value = P(win)·(land×1000 + loot·lootFocus) − casualties − turn opportunity cost, computed from estimated defense; grudge/wounded/player multipliers; hard AI demands a safety margin. Early age stays peaceful (existing design). Newbie protection self-enforced from public createdAt+networth.
- **War rule:** tracks `attacksMade` per defender in memory; on the 4th desire to attack, declares war instead (real `WarDeclaration` row → feed).
- **Memory** (`stats.aiMemory`): grudges `{kingdomId: {count, lastAt}}` built from public battle reports (incl. player attacks via combat-processor), `attacksMade`, `warsDeclared`. Grudges decay after 7 days.

**Proof of intelligence:** a deterministic 40-tick simulation asserts hard AI out-grow easy AI on identical starts.

## File structure

- **Create** `shared/mechanics/ai-strategist.ts` — the entire engine (types, assignment, estimation, scoring, `decide()`); pure functions, no I/O.
- **Create** `shared/mechanics/ai-strategist.test.ts` — unit tests.
- **Create** `shared/mechanics/ai-strategist-sim.test.ts` — simulation/intelligence test.
- **Modify** `amplify/functions/data-client.ts` — add `dbQueryRange` (sort-key `>=` query) for time-bounded battle-report reads.
- **Modify** `amplify/functions/turn-ticker/handler.ts` — build public views, one battle-report query/tick, call strategist, persist memory, create WarDeclarations.
- **Modify** `amplify/functions/turn-ticker/handler.test.ts` — update mocks/assertions.
- **Delete** `shared/mechanics/ai-behavior.ts` + `ai-behavior.test.ts` — fully replaced (its `armyCombatPower` etc. move into the strategist).

---

### Task 1: Module skeleton — types, constants, persona & difficulty assignment

**Files:**
- Create: `shared/mechanics/ai-strategist.ts`
- Test: `shared/mechanics/ai-strategist.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// shared/mechanics/ai-strategist.test.ts
import { describe, it, expect } from 'vitest';
import {
  assignPersona,
  assignDifficulty,
  makeRng,
  PERSONAS,
  DIFFICULTY_PARAMS,
  type Persona,
  type Difficulty,
} from './ai-strategist';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ubuntu/projects/monarchygame && npx vitest run shared/mechanics/ai-strategist.test.ts --config vitest.shared.config.ts`
Expected: FAIL — `Cannot find module './ai-strategist'`

- [ ] **Step 3: Write the implementation (module skeleton)**

```typescript
// shared/mechanics/ai-strategist.ts
/**
 * AI Strategist — utility-based decision engine for AI kingdoms.
 *
 * FAIRNESS CONTRACT (both economic and informational):
 *  - Economic: AI pays the same costs, earns via the same income formulas, and
 *    is bound by the same caps (troop cap, unit cap, turn costs) as players.
 *  - Informational: the engine sees other kingdoms ONLY through
 *    PublicKingdomView — the fields a player can read via AppSync. Enemy units,
 *    gold, and buildings are NOT in the type; defense must be ESTIMATED.
 *    Battle reports are authenticated-read (public), so "who attacked whom" is
 *    a fair signal. `underRestoration` is protective-only: it can spare a
 *    target but never advantage the attacker.
 *
 * Difficulty changes DECISION QUALITY (noise, act-rate), never resources.
 * Personas are weight vectors over one engine. Pure functions, no I/O.
 */

import { calculateTroopCapGold } from './troop-cap-mechanics';
import { buildingPerTurnContribution } from './economy-mechanics';
import { RACE_OFFENSE_BONUSES, RACE_DEFENSE_BONUSES } from './combat-mechanics';

// ── Types ───────────────────────────────────────────────────────────────────

export type Persona = 'warlord' | 'raider' | 'economist' | 'turtle' | 'opportunist' | 'schemer';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type SeasonAge = 'early' | 'middle' | 'late';

/** What a PLAYER can see about another kingdom (Kingdom fields with authenticated read). */
export interface PublicKingdomView {
  id: string;
  name?: string;
  race: string;
  networth: number;
  isActive: boolean;
  isAI: boolean;
  createdAt?: string;
  reputation?: number;
  /** Protective-only flag computed server-side (RestorationStatus is public anyway). */
  underRestoration?: boolean;
}

/** A public battle report row (BattleReport is authenticated-read). */
export interface PublicBattleEvent {
  attackerId: string;
  defenderId: string;
  landGained: number;
  timestamp: string;
}

/** Persistent per-kingdom memory, stored in Kingdom.stats.aiMemory. */
export interface AIMemory {
  /** Who attacked me: kingdomId -> count + last time. Decays after GRUDGE_TTL_MS. */
  grudges: Record<string, { count: number; lastAt: string }>;
  /** My attacks per defender this season (war rule: 3 max without a declaration). */
  attacksMade: Record<string, number>;
  /** Defenders I have declared war on. */
  warsDeclared: string[];
}

export function emptyMemory(): AIMemory {
  return { grudges: {}, attacksMade: {}, warsDeclared: [] };
}

/** The AI's OWN state — full knowledge of self is fair. */
export interface SelfState {
  id: string;
  race: string;
  land: number;
  gold: number;
  turnsAvailable: number;
  networth: number;
  buildings: Record<string, number>;
  totalUnits: Record<string, number>;
  /** Discoverable via the public Alliance.memberIds — player-equivalent info. */
  guildmateIds?: string[];
}

export interface StrategistContext {
  age: SeasonAge;
  persona: Persona;
  difficulty: Difficulty;
  memory: AIMemory;
  /** Public battle reports since roughly the last tick. */
  recentBattles: PublicBattleEvent[];
  /** Seeded rng for reproducibility: makeRng(hash(kingdomId) ^ tickBucket). */
  rng: () => number;
  nowMs: number;
}

export interface StrategistDecision {
  builds: Array<{ type: string; qty: number }>;
  trains: Array<{ unitType: string; qty: number; cost: number }>;
  attackTarget: string | null;
  /** Set when the war rule forces a declaration before further attacks. */
  declareWarOn: string | null;
  turnsSpent: number;
  goldSpent: number;
  memory: AIMemory;
}

// ── Game constants (must mirror the server-authoritative values) ───────────

/** Real building types — building-constructor VALID_BUILDING_TYPES. */
export const BUILDING_TYPES = ['mine', 'farm', 'tower', 'castle', 'barracks', 'temple', 'wall'] as const;
export const BUILDING_GOLD_COST = 250;           // building-constructor
export const BUILD_TURN_COST = 1;
export const TRAIN_TURN_COST = 1;
export const ATTACK_TURN_COST = 4;               // combat base cost
export const MAX_TOTAL_UNITS = 100_000;          // unit-trainer MAX_TOTAL_UNITS
export const TIER_BASE_GOLD = [50, 350, 900, 2000];   // unit-costs.ts
export const TIER_OFFENSE = [1, 3, 6, 10];       // combat-processor
export const TIER_DEFENSE = [1, 2, 4, 7];

export const RACE_ECON_MULT: Record<string, number> = {
  Human: 1.0, Elven: 1.0, Goblin: 1.0, Droben: 1.0, Vampire: 2.0,
  Elemental: 1.0, Centaur: 1.0, Sidhe: 1.0, Dwarven: 1.0, Fae: 1.0,
};

export const RACE_UNITS: Record<string, string[]> = {
  Human:     ['peasants', 'militia', 'knights', 'cavalry'],
  Elven:     ['elven-scouts', 'elven-warriors', 'elven-archers', 'elven-lords'],
  Goblin:    ['goblins', 'hobgoblins', 'kobolds', 'goblin-riders'],
  Droben:    ['droben-warriors', 'droben-berserkers', 'droben-bunar', 'droben-champions'],
  Vampire:   ['thralls', 'vampire-spawn', 'vampire-lords', 'ancient-vampires'],
  Elemental: ['earth-elementals', 'fire-elementals', 'water-elementals', 'air-elementals'],
  Centaur:   ['centaur-scouts', 'centaur-warriors', 'centaur-archers', 'centaur-chiefs'],
  Sidhe:     ['sidhe-nobles', 'sidhe-elders', 'sidhe-mages', 'sidhe-lords'],
  Dwarven:   ['dwarven-militia', 'dwarven-guards', 'dwarven-warriors', 'dwarven-lords'],
  Fae:       ['fae-sprites', 'fae-warriors', 'fae-nobles', 'fae-lords'],
};

// ── Personas & difficulty ───────────────────────────────────────────────────

export interface PersonaWeights {
  econ: number;        // weight on income-producing buildings
  military: number;    // share of spare gold to training
  defense: number;     // weight on walls / defensive posture
  aggression: number;  // scales attack expected value
  lootFocus: number;   // weight of gold loot inside attack EV
  vengeance: number;   // grudge multiplier on targets that attacked me
  playerFocus: number; // extra weight on human targets
}

export const PERSONAS: Record<Persona, PersonaWeights> = {
  warlord:     { econ: 0.7, military: 1.5, defense: 0.6, aggression: 1.4, lootFocus: 0.8, vengeance: 1.2, playerFocus: 1.1 },
  raider:      { econ: 0.8, military: 1.1, defense: 0.4, aggression: 1.3, lootFocus: 1.8, vengeance: 0.8, playerFocus: 1.2 },
  economist:   { econ: 1.6, military: 0.6, defense: 0.8, aggression: 0.5, lootFocus: 1.0, vengeance: 0.5, playerFocus: 0.9 },
  turtle:      { econ: 1.1, military: 0.8, defense: 1.7, aggression: 0.3, lootFocus: 0.5, vengeance: 1.5, playerFocus: 0.8 },
  opportunist: { econ: 1.0, military: 1.0, defense: 0.8, aggression: 1.0, lootFocus: 1.2, vengeance: 1.0, playerFocus: 1.5 },
  schemer:     { econ: 1.0, military: 1.0, defense: 1.0, aggression: 0.8, lootFocus: 0.7, vengeance: 2.5, playerFocus: 1.0 },
};

export interface DifficultyParams {
  estNoise: number;       // ± fraction on defense estimates
  utilityNoise: number;   // ± fraction jitter when comparing options
  actChance: number;      // probability of doing anything at all this tick
  attackMargin: number;   // required estimated power ratio before attacking
  turnBudgetFrac: number; // fraction of stored turns it is willing to spend
}

export const DIFFICULTY_PARAMS: Record<Difficulty, DifficultyParams> = {
  easy:   { estNoise: 0.60, utilityNoise: 0.35, actChance: 0.60, attackMargin: 1.25, turnBudgetFrac: 0.50 },
  medium: { estNoise: 0.30, utilityNoise: 0.15, actChance: 0.85, attackMargin: 1.50, turnBudgetFrac: 0.70 },
  hard:   { estNoise: 0.12, utilityNoise: 0.05, actChance: 1.00, attackMargin: 1.50, turnBudgetFrac: 0.90 },
};

// ── Deterministic helpers ───────────────────────────────────────────────────

function hashString(s: string, salt: number): number {
  let h = salt | 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h >>> 0; // unsigned
}

/** mulberry32 — small deterministic PRNG for reproducible decisions/tests. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PERSONA_LIST: Persona[] = ['warlord', 'raider', 'economist', 'turtle', 'opportunist', 'schemer'];

export function assignPersona(kingdomId: string): Persona {
  return PERSONA_LIST[hashString(kingdomId, 0x9e3779b9) % PERSONA_LIST.length];
}

/** 25% easy / 50% medium / 25% hard, deterministic per kingdom. */
export function assignDifficulty(kingdomId: string): Difficulty {
  const r = hashString(kingdomId, 0x85ebca6b) % 4;
  if (r === 0) return 'easy';
  if (r === 3) return 'hard';
  return 'medium';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/mechanics/ai-strategist.test.ts --config vitest.shared.config.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add shared/mechanics/ai-strategist.ts shared/mechanics/ai-strategist.test.ts
git commit -m "feat(ai): strategist skeleton — types, personas, difficulties, seeded rng"
```

---

### Task 2: Combat power + fair defense estimation

**Files:**
- Modify: `shared/mechanics/ai-strategist.ts` (append)
- Modify: `shared/mechanics/ai-strategist.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

```typescript
// append to shared/mechanics/ai-strategist.test.ts
import {
  armyCombatPower,
  estimateDefense,
} from './ai-strategist';

describe('armyCombatPower', () => {
  it('uses real per-tier values and excludes scouts', () => {
    const { offense, defense } = armyCombatPower('Human', {
      peasants: 10, militia: 10, knights: 10, cavalry: 10, scouts: 100,
    });
    expect(offense).toBe(10 * 1 + 10 * 3 + 10 * 6 + 10 * 10); // 200
    expect(defense).toBe(10 * 1 + 10 * 2 + 10 * 4 + 10 * 7);  // 140
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run shared/mechanics/ai-strategist.test.ts --config vitest.shared.config.ts`
Expected: FAIL — `armyCombatPower is not exported` / `estimateDefense is not exported`

- [ ] **Step 3: Append the implementation**

```typescript
// append to shared/mechanics/ai-strategist.ts

// ── Combat power (self — full knowledge of own army is fair) ───────────────

function unitTierIndex(race: string, unitType: string): number {
  const list = RACE_UNITS[race] ?? RACE_UNITS.Human;
  const idx = list.indexOf(unitType);
  if (idx >= 0) return idx;
  const generic: Record<string, number> = {
    tier1: 0, tier2: 1, tier3: 2, tier4: 3,
    peasants: 0, militia: 1, knights: 2, cavalry: 3,
  };
  return generic[unitType] ?? 0;
}

/** Real per-tier army power. Scouts are espionage-only and excluded. */
export function armyCombatPower(
  race: string,
  units: Record<string, number>,
): { offense: number; defense: number } {
  let offense = 0;
  let defense = 0;
  for (const [type, count] of Object.entries(units)) {
    if (type === 'scouts' || type === 'elite_scouts') continue;
    const n = count ?? 0;
    if (n <= 0) continue;
    const tier = unitTierIndex(race, type);
    offense += n * (TIER_OFFENSE[tier] ?? 1);
    defense += n * (TIER_DEFENSE[tier] ?? 1);
  }
  return { offense, defense };
}

// ── Defense estimation (enemies — public info ONLY) ────────────────────────
//
// A player sizing up a target sees networth and race. Land dominates networth
// (land × 1000), so estLand ≈ networth / 1100 (the rest is gold + units).
// Typical kingdoms train toward ~0.5L T1 + 0.3L T2 (+ T3 later) ≈ 1.7 def/land,
// and keep some walls (fort defense ~265 each) ≈ +8 def/land. These are
// calibration heuristics — exactly the rough math a human makes — and the
// difficulty noise dominates them anyway.

const EST_LAND_PER_NETWORTH = 1 / 1100;
const EST_ARMY_DEF_PER_LAND = 1.7;
const EST_WALL_DEF_PER_LAND = 8;

export function estimateDefense(
  target: PublicKingdomView,
  difficulty: Difficulty,
  rng: () => number,
): number {
  const params = DIFFICULTY_PARAMS[difficulty];
  const estLand = Math.max(50, target.networth * EST_LAND_PER_NETWORTH);
  const raceBonus = RACE_DEFENSE_BONUSES[target.race] ?? 1.0;
  const base = estLand * (EST_ARMY_DEF_PER_LAND + EST_WALL_DEF_PER_LAND) * raceBonus;
  const noise = 1 + (rng() * 2 - 1) * params.estNoise;
  return Math.max(1, base * noise);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run shared/mechanics/ai-strategist.test.ts --config vitest.shared.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/mechanics/ai-strategist.ts shared/mechanics/ai-strategist.test.ts
git commit -m "feat(ai): real combat power + information-fair noisy defense estimation"
```

---

### Task 3: Build scoring — marginal utility from real income formulas

**Files:**
- Modify: `shared/mechanics/ai-strategist.ts` (append)
- Modify: `shared/mechanics/ai-strategist.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

```typescript
// append to shared/mechanics/ai-strategist.test.ts
import { scoreBuilds, threatLevel, emptyMemory } from './ai-strategist';

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
    expect(total * 250).toBeLessThanOrEqual(5_000);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run shared/mechanics/ai-strategist.test.ts --config vitest.shared.config.ts`
Expected: FAIL — `scoreBuilds is not exported`

- [ ] **Step 3: Append the implementation**

```typescript
// append to shared/mechanics/ai-strategist.ts

// ── Threat assessment ───────────────────────────────────────────────────────

export const GRUDGE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // grudges decay after 7 days

/** 1 = calm. +1 per remembered grudge, +2 per attack on me this tick window. */
export function threatLevel(
  selfId: string,
  memory: AIMemory,
  recentBattles: PublicBattleEvent[],
): number {
  const grudgeCount = Object.values(memory.grudges).reduce((s, g) => s + g.count, 0);
  const justAttacked = recentBattles.filter(b => b.defenderId === selfId).length;
  return 1 + grudgeCount + justAttacked * 2;
}

// ── Build scoring ───────────────────────────────────────────────────────────
//
// Utility per building = persona-weighted value over a payback horizon, per
// 250g spent. Income value comes from the REAL buildingPerTurnContribution so
// the AI optimizes the same numbers players face. Greedy allocation.

const PAYBACK_HORIZON_TURNS = 50;   // value income ~50 turns out
const GOLD_PER_POP = 0.5;           // population is a weak resource currently
const GOLD_PER_ELAN = 300;          // elan is scarce (cap 500)
const WALL_THREAT_GOLD = 120;       // gold-equivalent of one wall per threat point
const BARRACKS_CAP_GOLD = 350;      // gold-equivalent of +2000 troop-cap headroom when tight

export function scoreBuilds(
  me: SelfState,
  w: PersonaWeights,
  threat: number,
  turnsBudget: number,
  goldBudget: number,
  rng: () => number,
  troopGoldInvested: number,
): Array<{ type: string; qty: number }> {
  const maxBuildings = Math.floor(me.land * 0.8);
  const currentTotal = Object.values(me.buildings).reduce((s, n) => s + (n ?? 0), 0);
  let slots = Math.max(0, maxBuildings - currentTotal);
  if (slots <= 0 || turnsBudget < BUILD_TURN_COST || goldBudget < BUILDING_GOLD_COST) return [];

  const troopCap = calculateTroopCapGold({ land: me.land, barracks: me.buildings.barracks ?? 0 });
  const capPressure = troopGoldInvested / Math.max(1, troopCap); // 0..1+

  const utility = (type: string): number => {
    const c = buildingPerTurnContribution(type, me.race);
    let u = (c.gold * PAYBACK_HORIZON_TURNS) * w.econ
          + (c.population * GOLD_PER_POP * PAYBACK_HORIZON_TURNS) * w.econ
          + (c.elan * GOLD_PER_ELAN * PAYBACK_HORIZON_TURNS) * w.econ;
    if (type === 'wall') u += threat * WALL_THREAT_GOLD * w.defense;
    if (type === 'barracks' && capPressure > 0.8) u += BARRACKS_CAP_GOLD * w.military;
    return u;
  };

  // Rank types by utility (with difficulty noise applied by the caller via rng
  // jitter here so easy AI mis-rank options).
  const ranked = [...BUILDING_TYPES]
    .map(t => ({ t, u: utility(t) * (1 + (rng() * 2 - 1) * 0.0001) })) // stable tiebreak
    .sort((a, b) => b.u - a.u);

  const out: Array<{ type: string; qty: number }> = [];
  let gold = goldBudget;
  let turns = turnsBudget;

  for (const { t, u } of ranked) {
    if (u <= 0 || slots <= 0 || gold < BUILDING_GOLD_COST || turns < BUILD_TURN_COST) break;
    // Spend a utility-proportional share of remaining budget on this type.
    const totalU = ranked.reduce((s, r) => s + Math.max(0, r.u), 0) || 1;
    const share = Math.max(0.15, u / totalU);
    const byGold = Math.floor((gold * share) / BUILDING_GOLD_COST);
    const qty = Math.min(byGold, slots);
    if (qty <= 0) continue;
    out.push({ type: t, qty });
    gold -= qty * BUILDING_GOLD_COST;
    slots -= qty;
    turns -= BUILD_TURN_COST;
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run shared/mechanics/ai-strategist.test.ts --config vitest.shared.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/mechanics/ai-strategist.ts shared/mechanics/ai-strategist.test.ts
git commit -m "feat(ai): build scoring from real marginal income + threat-scaled defense"
```

---

### Task 4: Train scoring — gold-efficiency under both caps

**Files:**
- Modify: `shared/mechanics/ai-strategist.ts` (append)
- Modify: `shared/mechanics/ai-strategist.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

```typescript
// append to shared/mechanics/ai-strategist.test.ts
import { scoreTrains, troopGoldInvested } from './ai-strategist';

describe('scoreTrains', () => {
  it('prefers T1 (best power-per-gold) when unit-count headroom is ample', () => {
    const trains = scoreTrains(self(), PERSONAS.warlord, 30, 50_000, makeRng(1));
    expect(trains.length).toBeGreaterThan(0);
    expect(trains[0].unitType).toBe('peasants');
  });

  it('escalates to higher tiers when the 100k unit cap binds', () => {
    // 99k units already: only 1k unit slots left, but lots of gold/cap room ->
    // higher tiers pack more power per unit slot.
    const crowded = self({
      land: 30_000,
      totalUnits: { peasants: 99_000 },
      buildings: { barracks: 10_000 },
      gold: 5_000_000,
    });
    const trains = scoreTrains(crowded, PERSONAS.warlord, 30, 4_000_000, makeRng(2));
    const t1 = trains.find(t => t.unitType === 'peasants')?.qty ?? 0;
    const higher = trains.filter(t => t.unitType !== 'peasants').reduce((s, t) => s + t.qty, 0);
    expect(t1 + higher).toBeLessThanOrEqual(1_000); // never exceeds unit cap
    expect(higher).toBeGreaterThan(0);              // shifted up-tier
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run shared/mechanics/ai-strategist.test.ts --config vitest.shared.config.ts`
Expected: FAIL — `scoreTrains is not exported`

- [ ] **Step 3: Append the implementation**

```typescript
// append to shared/mechanics/ai-strategist.ts

// ── Train scoring ───────────────────────────────────────────────────────────
//
// Optimal play: T1 maximizes power-per-gold (1/50 > 3/350 > 6/900 > 10/2000),
// so train T1 until the 100k unit-count cap starts binding, then escalate to
// tiers with more power per UNIT SLOT. Both the troop (gold) cap and the unit
// cap are the same limits the unit-trainer Lambda enforces on players.

export function troopGoldInvested(race: string, units: Record<string, number>): number {
  const list = RACE_UNITS[race] ?? RACE_UNITS.Human;
  const mult = RACE_ECON_MULT[race] ?? 1.0;
  let invested = 0;
  for (const [type, count] of Object.entries(units)) {
    const tier = list.indexOf(type);
    if (tier >= 0) invested += Math.round(TIER_BASE_GOLD[tier] * mult) * (count ?? 0);
  }
  return invested;
}

const MAX_TRAIN_PER_ACTION = 1000; // unit-trainer per-action quantity limit

export function scoreTrains(
  me: SelfState,
  w: PersonaWeights,
  turnsBudget: number,
  goldBudget: number,
  rng: () => number,
): Array<{ unitType: string; qty: number; cost: number }> {
  if (turnsBudget < TRAIN_TURN_COST || goldBudget <= 0) return [];

  const list = RACE_UNITS[me.race] ?? RACE_UNITS.Human;
  const mult = RACE_ECON_MULT[me.race] ?? 1.0;

  const troopCap = calculateTroopCapGold({ land: me.land, barracks: me.buildings.barracks ?? 0 });
  let invested = troopGoldInvested(me.race, me.totalUnits);
  let capRoom = Math.max(0, troopCap - invested);

  const currentCount = Object.values(me.totalUnits).reduce((s, n) => s + (n ?? 0), 0);
  let unitSlots = Math.max(0, MAX_TOTAL_UNITS - currentCount);

  let gold = Math.floor(goldBudget * Math.min(1, w.military));
  let turns = turnsBudget;

  // If T1 alone can spend the gold within unit slots, T1 is optimal. When unit
  // slots are scarce relative to gold, higher tiers carry more power per slot.
  // Order tiers: T1 first, escalate only as slots bind.
  const out: Array<{ unitType: string; qty: number; cost: number }> = [];
  for (let tier = 0; tier < list.length; tier++) {
    if (gold <= 0 || capRoom <= 0 || unitSlots <= 0 || turns < TRAIN_TURN_COST) break;
    const costPer = Math.round(TIER_BASE_GOLD[tier] * mult);

    // Skip up-tiering while T1-by-gold fits in available unit slots.
    if (tier > 0) {
      const goldFitsInSlots = Math.floor(gold / Math.round(TIER_BASE_GOLD[0] * mult)) <= unitSlots;
      if (goldFitsInSlots) break; // T1 already absorbed optimal spend
    }

    const byGold = Math.floor(gold / costPer);
    const byCap = Math.floor(capRoom / costPer);
    const qty = Math.min(byGold, byCap, unitSlots, MAX_TRAIN_PER_ACTION);
    if (qty <= 0) continue;

    const cost = qty * costPer;
    out.push({ unitType: list[tier], qty, cost });
    gold -= cost;
    capRoom -= cost;
    invested += cost;
    unitSlots -= qty;
    turns -= TRAIN_TURN_COST;
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run shared/mechanics/ai-strategist.test.ts --config vitest.shared.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/mechanics/ai-strategist.ts shared/mechanics/ai-strategist.test.ts
git commit -m "feat(ai): gold-efficient training under troop cap and unit cap"
```

---

### Task 5: Attack scoring — expected value, grudges, war rule

**Files:**
- Modify: `shared/mechanics/ai-strategist.ts` (append)
- Modify: `shared/mechanics/ai-strategist.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

```typescript
// append to shared/mechanics/ai-strategist.test.ts
import { scoreAttack } from './ai-strategist';

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
    const r = scoreAttack(
      strongSelf(),
      [mkView('attacker', 900_000), mkView('richer', 700_000)],
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run shared/mechanics/ai-strategist.test.ts --config vitest.shared.config.ts`
Expected: FAIL — `scoreAttack is not exported`

- [ ] **Step 3: Append the implementation**

```typescript
// append to shared/mechanics/ai-strategist.ts

// ── Attack scoring ──────────────────────────────────────────────────────────
//
// Expected value per target (all from public info + own army):
//   EV = P(win) · (estLand·7%·1000 + loot·lootFocus) − casualtyCost − turnCost
// multiplied by aggression / vengeance(grudge) / playerFocus / wounded bonus.
// Hard AI demand a safety margin on the estimated power ratio; easy AI take
// riskier fights on worse estimates. Early age is peaceful by design.

const ATTACKS_BEFORE_WAR = 3;          // combat-processor war rule
const LAND_GAIN_PCT = 0.07;            // full-strike "with ease" land share
const GOLD_PER_LAND = 1000;            // networth/loot valuation
const CASUALTY_FRACTION = 0.10;        // expected own-army value lost
const WOUNDED_BONUS = 1.2;             // target that just lost land

export interface AttackChoice {
  attackTarget: string | null;
  declareWarOn: string | null;
}

export function scoreAttack(
  me: SelfState,
  world: PublicKingdomView[],
  ctx: StrategistContext,
): AttackChoice {
  const none: AttackChoice = { attackTarget: null, declareWarOn: null };
  if (ctx.age === 'early') return none;                       // peaceful early age
  if (me.turnsAvailable < ATTACK_TURN_COST + 2) return none;

  const w = PERSONAS[ctx.persona];
  const params = DIFFICULTY_PARAMS[ctx.difficulty];

  const myPower = armyCombatPower(me.race, me.totalUnits);
  const myOffense = myPower.offense * 0.7 * (RACE_OFFENSE_BONUSES[me.race] ?? 1.0);
  if (myOffense <= 0) return none;

  const armyValue = troopGoldInvested(me.race, me.totalUnits);
  const guildmates = new Set(me.guildmateIds ?? []);
  const woundedIds = new Set(ctx.recentBattles.filter(b => b.landGained > 0).map(b => b.defenderId));

  let best: { id: string; ev: number; needsWar: boolean } | null = null;

  for (const t of world) {
    if (t.id === me.id || !t.isActive) continue;
    if (guildmates.has(t.id)) continue;
    if (t.underRestoration) continue;
    // Newbie protection (public createdAt + networth) — same rule the
    // combat-processor enforces on players.
    if (t.createdAt) {
      const ageHours = (ctx.nowMs - new Date(t.createdAt).getTime()) / 3_600_000;
      if (ageHours < 72 && t.networth < me.networth / 3) continue;
    }

    const estDef = estimateDefense(t, ctx.difficulty, ctx.rng);
    const ratio = myOffense / estDef;
    if (ratio < 1.2 * params.attackMargin) continue;          // not winnable safely

    const pWin = ratio >= 2.0 * params.attackMargin ? 0.9 : 0.6;
    const estLand = Math.max(50, t.networth * EST_LAND_PER_NETWORTH);
    const landValue = estLand * LAND_GAIN_PCT * GOLD_PER_LAND;
    const loot = estLand * LAND_GAIN_PCT * GOLD_PER_LAND;     // goldLooted ≈ landGained·1000
    const casualty = armyValue * CASUALTY_FRACTION;

    let ev = pWin * (landValue + loot * w.lootFocus) - casualty;
    ev *= w.aggression;
    const grudge = ctx.memory.grudges[t.id];
    if (grudge) ev *= 1 + w.vengeance * Math.min(grudge.count, 4) * 0.5;
    if (!t.isAI) ev *= w.playerFocus;
    if (woundedIds.has(t.id)) ev *= WOUNDED_BONUS;
    ev *= 1 + (ctx.rng() * 2 - 1) * params.utilityNoise;      // judgment jitter

    if (ev <= 0) continue;

    const made = ctx.memory.attacksMade[t.id] ?? 0;
    const atWar = ctx.memory.warsDeclared.includes(t.id);
    const needsWar = made >= ATTACKS_BEFORE_WAR && !atWar;

    if (!best || ev > best.ev) best = { id: t.id, ev, needsWar };
  }

  if (!best) return none;
  return best.needsWar
    ? { attackTarget: null, declareWarOn: best.id }
    : { attackTarget: best.id, declareWarOn: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run shared/mechanics/ai-strategist.test.ts --config vitest.shared.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/mechanics/ai-strategist.ts shared/mechanics/ai-strategist.test.ts
git commit -m "feat(ai): EV-based attack scoring with grudges, newbie protection, war rule"
```

---

### Task 6: `decide()` orchestrator + memory update

**Files:**
- Modify: `shared/mechanics/ai-strategist.ts` (append)
- Modify: `shared/mechanics/ai-strategist.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

```typescript
// append to shared/mechanics/ai-strategist.test.ts
import { decide } from './ai-strategist';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run shared/mechanics/ai-strategist.test.ts --config vitest.shared.config.ts`
Expected: FAIL — `decide is not exported`

- [ ] **Step 3: Append the implementation**

```typescript
// append to shared/mechanics/ai-strategist.ts

// ── Gold reserve (scales so player-sized AI can act from tick 1) ────────────

const GOLD_FLOOR_MIN = 500;
const GOLD_FLOOR_FRACTION = 0.10;
export function goldFloor(gold: number): number {
  return Math.max(GOLD_FLOOR_MIN, Math.floor(gold * GOLD_FLOOR_FRACTION));
}

// ── Memory maintenance ──────────────────────────────────────────────────────

function refreshMemory(selfId: string, memory: AIMemory, battles: PublicBattleEvent[], nowMs: number): AIMemory {
  const next: AIMemory = {
    grudges: { ...memory.grudges },
    attacksMade: { ...memory.attacksMade },
    warsDeclared: [...memory.warsDeclared],
  };
  // Ingest new grudges from public reports (anyone who hit me — AI or player).
  for (const b of battles) {
    if (b.defenderId !== selfId) continue;
    const g = next.grudges[b.attackerId];
    next.grudges[b.attackerId] = { count: (g?.count ?? 0) + 1, lastAt: b.timestamp };
  }
  // Expire old grudges.
  for (const [id, g] of Object.entries(next.grudges)) {
    if (nowMs - new Date(g.lastAt).getTime() > GRUDGE_TTL_MS) delete next.grudges[id];
  }
  return next;
}

// ── Orchestrator ────────────────────────────────────────────────────────────

export function decide(
  me: SelfState,
  world: PublicKingdomView[],
  ctx: StrategistContext,
): StrategistDecision {
  const params = DIFFICULTY_PARAMS[ctx.difficulty];
  const w = PERSONAS[ctx.persona];
  const memory = refreshMemory(me.id, ctx.memory, ctx.recentBattles, ctx.nowMs);

  const idle: StrategistDecision = {
    builds: [], trains: [], attackTarget: null, declareWarOn: null,
    turnsSpent: 0, goldSpent: 0, memory,
  };

  // Easy/medium AI sometimes just don't get around to it this tick.
  if (ctx.rng() > params.actChance) return idle;

  const turnsAvailable = Math.min(72, me.turnsAvailable);
  if (turnsAvailable < 3) return idle;
  const turnBudget = Math.floor(turnsAvailable * params.turnBudgetFrac);
  let turnsLeft = turnBudget;

  const reserve = goldFloor(me.gold);
  let goldLeft = me.gold;

  const threat = threatLevel(me.id, memory, ctx.recentBattles);
  const invested = troopGoldInvested(me.race, me.totalUnits);

  // Persona splits spendable gold between economy and military; threat shifts
  // the split toward military (a player under attack does the same).
  const spendable = Math.max(0, goldLeft - reserve);
  const milShare = Math.min(0.85, (w.military / (w.military + w.econ)) * (1 + (threat - 1) * 0.15));
  const buildBudget = Math.floor(spendable * (1 - milShare));
  const trainBudget = Math.floor(spendable * milShare);

  // BUILD
  const builds = scoreBuilds(me, w, threat, turnsLeft, buildBudget, ctx.rng, invested);
  const buildGold = builds.reduce((s, b) => s + b.qty * BUILDING_GOLD_COST, 0);
  goldLeft -= buildGold;
  turnsLeft -= builds.length * BUILD_TURN_COST;

  // TRAIN — account for barracks built this tick raising the cap.
  const barracksBuilt = builds.find(b => b.type === 'barracks')?.qty ?? 0;
  const meAfterBuild: SelfState = {
    ...me,
    buildings: { ...me.buildings, barracks: (me.buildings.barracks ?? 0) + barracksBuilt },
  };
  const trains = turnsLeft >= TRAIN_TURN_COST
    ? scoreTrains(meAfterBuild, w, turnsLeft, Math.min(trainBudget, goldLeft - reserve), ctx.rng)
    : [];
  const trainGold = trains.reduce((s, t) => s + t.cost, 0);
  goldLeft -= trainGold;
  turnsLeft -= trains.length * TRAIN_TURN_COST;

  // ATTACK / DECLARE WAR — use the post-training army.
  const meAfterTrain: SelfState = {
    ...meAfterBuild,
    totalUnits: trains.reduce(
      (u, t) => ({ ...u, [t.unitType]: (u[t.unitType] ?? 0) + t.qty }),
      { ...me.totalUnits },
    ),
    turnsAvailable: turnsLeft,
  };
  let attackTarget: string | null = null;
  let declareWarOn: string | null = null;
  if (turnsLeft >= ATTACK_TURN_COST) {
    const choice = scoreAttack(meAfterTrain, world, { ...ctx, memory });
    attackTarget = choice.attackTarget;
    declareWarOn = choice.declareWarOn;
    if (attackTarget) {
      turnsLeft -= ATTACK_TURN_COST;
      memory.attacksMade[attackTarget] = (memory.attacksMade[attackTarget] ?? 0) + 1;
    }
    if (declareWarOn && !memory.warsDeclared.includes(declareWarOn)) {
      memory.warsDeclared.push(declareWarOn);
      turnsLeft -= 1; // diplomatic action costs 1 turn (turn-mechanics)
    }
  }

  return {
    builds, trains, attackTarget, declareWarOn,
    turnsSpent: turnBudget - turnsLeft,
    goldSpent: me.gold - goldLeft,
    memory,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run shared/mechanics/ai-strategist.test.ts --config vitest.shared.config.ts`
Expected: PASS (all tests in file)

- [ ] **Step 5: Commit**

```bash
git add shared/mechanics/ai-strategist.ts shared/mechanics/ai-strategist.test.ts
git commit -m "feat(ai): decide() orchestrator with memory, budgets, difficulty gating"
```

---

### Task 7: Simulation test — prove hard beats easy

**Files:**
- Create: `shared/mechanics/ai-strategist-sim.test.ts`

- [ ] **Step 1: Write the simulation test (it should pass immediately if the engine is sound — if it fails, the ENGINE needs tuning, not the test)**

```typescript
// shared/mechanics/ai-strategist-sim.test.ts
/**
 * Intelligence proof: identical starting kingdoms, identical rules and income.
 * After N simulated ticks, hard-difficulty AI must out-grow easy-difficulty AI.
 * The sim resolves income with the REAL calculateGenerationRates and combat
 * with the REAL calculateCombatResult — the AI only ever sees public views.
 */
import { describe, it, expect } from 'vitest';
import {
  decide, makeRng, emptyMemory, armyCombatPower, BUILDING_GOLD_COST,
  type SelfState, type PublicKingdomView, type AIMemory, type Difficulty, type Persona,
} from './ai-strategist';
import { calculateGenerationRates } from './economy-mechanics';
import { calculateCombatResult, calculateFortDefense, RACE_OFFENSE_BONUSES, RACE_DEFENSE_BONUSES } from './combat-mechanics';
import type { AttackForce, DefenseForce } from './combat-mechanics';

interface SimKingdom extends SelfState {
  memory: AIMemory;
  difficulty: Difficulty;
  persona: Persona;
}

function mkKingdom(i: number, difficulty: Difficulty): SimKingdom {
  return {
    id: `sim-${difficulty}-${i}`,
    race: 'Human',
    land: 100, gold: 2000, turnsAvailable: 20, networth: 102_000,
    buildings: {}, totalUnits: { peasants: 40, militia: 10 },
    memory: emptyMemory(),
    difficulty,
    persona: (['warlord', 'economist', 'opportunist'] as Persona[])[i % 3],
  };
}

function networthOf(k: SimKingdom): number {
  const units = Object.values(k.totalUnits).reduce((s, n) => s + (n ?? 0), 0);
  return k.land * 1000 + k.gold + units * 100;
}

describe('strategist simulation', () => {
  it('hard AI out-grow easy AI over 40 ticks under identical rules', () => {
    const kingdoms: SimKingdom[] = [
      ...Array.from({ length: 10 }, (_, i) => mkKingdom(i, 'easy')),
      ...Array.from({ length: 10 }, (_, i) => mkKingdom(i, 'hard')),
    ];
    const nowBase = Date.UTC(2026, 5, 1);
    const battles: Array<{ attackerId: string; defenderId: string; landGained: number; timestamp: string }> = [];

    for (let tick = 0; tick < 40; tick++) {
      const age = tick < 15 ? 'early' : 'middle';
      const nowMs = nowBase + tick * 20 * 60_000;
      const views: PublicKingdomView[] = kingdoms.map(k => ({
        id: k.id, race: k.race, networth: k.networth,
        isActive: true, isAI: true, createdAt: new Date(nowBase - 100 * 3600_000).toISOString(),
      }));
      const recent = battles.filter(b => nowMs - new Date(b.timestamp).getTime() < 21 * 60_000);

      for (const k of kingdoms) {
        // Real income from own buildings (same as resource-manager grants).
        const rates = calculateGenerationRates({ race: k.race, age, buildings: k.buildings });
        k.gold = Math.min(1_000_000, k.gold + rates.goldPerTurn);
        k.turnsAvailable = Math.min(72, k.turnsAvailable + 1);

        const d = decide(k, views, {
          age, persona: k.persona, difficulty: k.difficulty,
          memory: k.memory, recentBattles: recent,
          rng: makeRng(tick * 1000 + k.id.length + k.id.charCodeAt(4)),
          nowMs,
        });

        for (const b of d.builds) k.buildings[b.type] = (k.buildings[b.type] ?? 0) + b.qty;
        for (const t of d.trains) k.totalUnits[t.unitType] = (k.totalUnits[t.unitType] ?? 0) + t.qty;
        k.gold -= d.goldSpent;
        k.turnsAvailable -= d.turnsSpent;
        k.memory = d.memory;
        expect(k.gold).toBeGreaterThanOrEqual(0); // never overspends

        if (d.attackTarget) {
          const target = kingdoms.find(x => x.id === d.attackTarget)!;
          const atk = armyCombatPower(k.race, k.totalUnits);
          const def = armyCombatPower(target.race, target.totalUnits);
          const attackForce: AttackForce = {
            units: k.totalUnits,
            totalOffense: Math.floor(atk.offense * 0.7 * (RACE_OFFENSE_BONUSES[k.race] ?? 1)),
            totalDefense: 0,
          };
          const defenseForce: DefenseForce = {
            units: target.totalUnits,
            forts: target.buildings.wall ?? 0,
            totalDefense: Math.floor(def.defense * (RACE_DEFENSE_BONUSES[target.race] ?? 1))
              + calculateFortDefense(target.race, target.buildings.wall ?? 0),
            ambushActive: false,
          };
          const result = calculateCombatResult(attackForce, defenseForce, target.land);
          if (result.landGained > 0) {
            target.land = Math.max(100, target.land - result.landGained);
            k.land += result.landGained;
            const loot = Math.min(target.gold, result.goldLooted ?? 0);
            target.gold -= loot; k.gold += loot;
            battles.push({
              attackerId: k.id, defenderId: target.id,
              landGained: result.landGained, timestamp: new Date(nowMs).toISOString(),
            });
          }
        }
        k.networth = networthOf(k);
      }
    }

    const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const hardNW = median(kingdoms.filter(k => k.difficulty === 'hard').map(networthOf));
    const easyNW = median(kingdoms.filter(k => k.difficulty === 'easy').map(networthOf));
    expect(hardNW).toBeGreaterThan(easyNW);
  });
});
```

- [ ] **Step 2: Run the simulation**

Run: `npx vitest run shared/mechanics/ai-strategist-sim.test.ts --config vitest.shared.config.ts`
Expected: PASS. **If it fails:** the engine is not actually smarter at hard — debug the engine (most likely culprits: turn budget not consumed, gold not flowing into builds, or attack EV always negative). Do not weaken the assertion.

- [ ] **Step 3: Commit**

```bash
git add shared/mechanics/ai-strategist-sim.test.ts
git commit -m "test(ai): simulation proves hard difficulty out-grows easy under identical rules"
```

---

### Task 8: `dbQueryRange` helper for time-bounded battle reports

**Files:**
- Modify: `amplify/functions/data-client.ts` (append after `dbQueryFilter`, around line 140)
- Test: `amplify/functions/data-client.test.ts` does not exist — this helper matches the existing untested query helpers; verified through turn-ticker tests in Task 9.

- [ ] **Step 1: Append the implementation**

```typescript
// append to amplify/functions/data-client.ts after dbQueryFilter

/**
 * Queries a GSI by partition key with a sort-key lower bound (sk >= since).
 * Used for time-windowed reads, e.g. battle reports since the last tick.
 */
export async function dbQueryRange<T>(
  modelName: string,
  indexName: string,
  partitionKey: { field: string; value: unknown },
  sortKey: { field: string; gte: unknown },
): Promise<T[]> {
  const TableName = await getTableName(modelName);
  const items: T[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(new QueryCommand({
      TableName,
      IndexName: indexName,
      KeyConditionExpression: '#pk = :pk AND #sk >= :sk',
      ExpressionAttributeNames: { '#pk': partitionKey.field, '#sk': sortKey.field },
      ExpressionAttributeValues: { ':pk': partitionKey.value, ':sk': sortKey.gte },
      ExclusiveStartKey,
    }));
    items.push(...((result.Items ?? []) as T[]));
    ExclusiveStartKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p amplify/tsconfig.json`
Expected: clean exit (no output)

- [ ] **Step 3: Commit**

```bash
git add amplify/functions/data-client.ts
git commit -m "feat(data): dbQueryRange — GSI query with sort-key lower bound"
```

---

### Task 9: Turn-ticker integration

**Files:**
- Modify: `amplify/functions/turn-ticker/handler.ts`
- Modify: `amplify/functions/turn-ticker/handler.test.ts`

The handler currently (a) builds `allKingdomStates` with PRIVATE fields and passes them to `decideAIActions`, (b) has no memory, no war declarations, no battle-report ingestion. Replace the AI section.

- [ ] **Step 1: Update imports (top of handler.ts)**

Replace the `ai-behavior` import block:

```typescript
// REMOVE:
import {
  decideAIActions,
  assignPersonality,
  armyCombatPower,
  type AIKingdomState,
  type AIPersonality,
  type SeasonAge,
} from '../../../shared/mechanics/ai-behavior';

// ADD:
import {
  decide,
  assignPersona,
  assignDifficulty,
  armyCombatPower,
  emptyMemory,
  makeRng,
  type PublicKingdomView,
  type PublicBattleEvent,
  type AIMemory,
  type SelfState,
  type SeasonAge,
} from '../../../shared/mechanics/ai-strategist';
```

And extend the data-client import on line 10 with `dbQueryRange`:

```typescript
import { dbList, dbAtomicAdd, dbUpdate, dbCreate, dbGet, dbQuery, dbQueryRange, parseJsonField } from '../data-client';
```

- [ ] **Step 2: Replace the AI world-state construction**

Replace the `allKingdomStates` block (currently `const allKingdomStates: AIKingdomState[] = active.map(...)` with private fields) with public views + one battle query:

```typescript
    // Process AI kingdoms: AI decision loop (build, train, attack)
    const aiKingdoms = active.filter(k => k.isAI === true);
    let aiTicked = 0;
    const aiMilestones: AIMilestone[] = [];

    // INFORMATION FAIRNESS: the strategist sees other kingdoms only through
    // the same fields a player can read via AppSync (no units/gold/buildings).
    const publicViews: PublicKingdomView[] = active.map(k => ({
      id: k.id,
      name: (k as KingdomRow).name ?? undefined,
      race: (k.race as string) ?? 'Human',
      networth: (k as KingdomRow).networth ?? 0,
      isActive: k.isActive ?? true,
      isAI: k.isAI ?? false,
      createdAt: (k as KingdomRow).createdAt ?? undefined,
      // Protective-only flag (RestorationStatus is public; this can only spare
      // a target, never advantage the attacker).
      underRestoration: (() => {
        const stats = parseJsonField<Record<string, unknown>>((k as KingdomRow).stats, {});
        const end = stats.restorationEndTime as string | undefined;
        return !!end && new Date(end).getTime() > Date.now();
      })(),
    }));

    // One public battle-report query per tick (reports are authenticated-read,
    // i.e. player-visible info). Used for grudges + wounded-target detection.
    const seasonIdForTick = (aiKingdoms[0] as KingdomRow | undefined)?.seasonId;
    let recentBattles: PublicBattleEvent[] = [];
    if (seasonIdForTick) {
      try {
        const since = new Date(Date.now() - 25 * 60 * 1000).toISOString(); // last tick + margin
        recentBattles = await dbQueryRange<PublicBattleEvent>(
          'BattleReport', 'battleReportsBySeasonIdAndTimestamp',
          { field: 'seasonId', value: seasonIdForTick },
          { field: 'timestamp', gte: since },
        );
      } catch (brErr) {
        log.error('turn-ticker', brErr, { context: 'recent-battles' });
      }
    }
```

- [ ] **Step 3: Replace the per-AI decision block**

Inside the `for (const kingdom of aiKingdoms)` loop, replace from the personality determination through the `decideAIActions` call:

```typescript
        // Persona + difficulty are deterministic per kingdom (decision quality
        // differs by difficulty; resources/rules never do).
        const persona = assignPersona(kingdom.id);
        const difficulty = assignDifficulty(kingdom.id);
        const seasonAge: SeasonAge = ((kingdom as KingdomRow).currentAge as SeasonAge) ?? 'early';

        // ... (income block stays exactly as-is: calculateGenerationRates etc.)

        const selfState: SelfState = {
          id: kingdom.id,
          race: aiRace,
          land: resources.land ?? 800,
          gold: newGold,
          turnsAvailable: kingdom.turnsBalance ?? 0,
          networth: (kingdom as KingdomRow).networth ?? 0,
          buildings: { ...buildingsMap },
          totalUnits: { ...totalUnitsMap },
        };

        // Memory persists in stats.aiMemory across ticks.
        const memory: AIMemory = (statsMap.aiMemory as AIMemory | undefined) ?? emptyMemory();

        // Deterministic per kingdom+tick (reproducible, no Math.random drift).
        const tickBucket = Math.floor(Date.now() / (20 * 60 * 1000));
        let seed = tickBucket;
        for (let i = 0; i < kingdom.id.length; i++) seed = ((seed << 5) - seed + kingdom.id.charCodeAt(i)) | 0;

        const decision = decide(selfState, publicViews, {
          age: seasonAge,
          persona,
          difficulty,
          memory,
          recentBattles,
          rng: makeRng(seed >>> 0),
          nowMs: Date.now(),
        });
```

- [ ] **Step 4: Keep build/train/combat application; add war declarations and memory persistence**

The existing apply-builds / apply-trains / combat-execution code is reused unchanged (it already uses `armyCombatPower` + race bonuses + `wall` forts). After the combat block, add war-declaration handling, and extend the write-back:

```typescript
        // War rule: the AI has hit this defender 3 times — it must declare war
        // (the same rule combat-processor enforces on players). Real row, shows
        // in the World Feed via warDeclarationsBySeasonIdAndDeclaredAt.
        if (decision.declareWarOn && (kingdom as KingdomRow).seasonId) {
          try {
            await dbCreate('WarDeclaration', {
              attackerId: kingdom.id,
              defenderId: decision.declareWarOn,
              seasonId: (kingdom as KingdomRow).seasonId,
              status: 'active',
              attackCount: 0,
              declaredAt: new Date().toISOString(),
              reason: 'Sustained campaign — formal declaration of war',
              owner: 'AI_SYSTEM',
            });
            await dbCreate('CombatNotification', {
              recipientId: decision.declareWarOn,
              type: 'defense',
              message: `${(kingdom as KingdomRow).name ?? 'A kingdom'} has declared war on you!`,
              data: JSON.stringify({ attackerId: kingdom.id }),
              isRead: false,
              createdAt: new Date().toISOString(),
              owner: decision.declareWarOn,
            });
          } catch (warErr) {
            log.error('turn-ticker', warErr, { kingdomId: kingdom.id, context: 'ai-declare-war' });
          }
        }
```

In the write-back `updateFields`, persist memory (merged into stats) and the persona label:

```typescript
        const updateFields: Record<string, unknown> = {
          resources: { ...resources, gold: finalGold, population: newPopulation, land: finalLand },
          buildings: updatedBuildings,
          totalUnits: updatedUnits,
          networth,
          stats: { ...statsMap, aiMemory: decision.memory },
          aiPersonality: persona, // admin/debug visibility; harmless string field
        };
```

(Remove the old `if (!(kingdom as KingdomRow).aiPersonality)` block — we now always write the persona.)

Update the `ai-decision` log line to include the new dimensions:

```typescript
        if (decision.builds.length > 0 || decision.trains.length > 0 || decision.attackTarget || decision.declareWarOn) {
          log.info('turn-ticker', 'ai-decision', {
            kingdomId: kingdom.id,
            persona,
            difficulty,
            seasonAge,
            builds: decision.builds.length,
            trains: decision.trains.length,
            attacked: !!decision.attackTarget,
            declaredWar: !!decision.declareWarOn,
            turnsSpent: decision.turnsSpent,
            goldSpent: decision.goldSpent,
          });
        }
```

Note: the combat-execution block references `decision.attackTarget` — the new decision type keeps that field name, so it compiles unchanged.

- [ ] **Step 5: Fix the handler tests**

In `amplify/functions/turn-ticker/handler.test.ts`, the existing AI tests (`earns income from its own buildings…`, `does NOT hand free gold…`) still pass — income is untouched. But mocks must tolerate the new battle-report query: `mockDbQueryRange` (or however dbQuery is mocked — extend the data-client mock with `dbQueryRange: vi.fn().mockResolvedValue([])`). Find the `vi.mock('../data-client', ...)` block and add:

```typescript
dbQueryRange: vi.fn().mockResolvedValue([]),
```

Add one new test:

```typescript
  it('persists AI memory and persona to the kingdom row', async () => {
    const aiKingdom = makeKingdom({
      isAI: true,
      seasonId: 'season-1',
      currentAge: 'early',
      resources: JSON.stringify({ gold: 10000, population: 5000, land: 1000 }),
      buildings: JSON.stringify({ mine: 50 }),
      totalUnits: JSON.stringify({ peasants: 100 }),
    });
    mockDbList.mockResolvedValue([aiKingdom]);

    const result = await callHandler({});
    expect(result.success).toBe(true);

    const aiUpdateCall = mockDbUpdate.mock.calls.find(
      (call: unknown[]) => call[0] === 'Kingdom' && call[1] === 'kingdom-1'
        && (call[2] as Record<string, unknown>)?.stats !== undefined
    );
    expect(aiUpdateCall).toBeDefined();
    const stats = (aiUpdateCall![2] as Record<string, unknown>).stats as Record<string, unknown>;
    expect(stats.aiMemory).toBeDefined();
    const persona = (aiUpdateCall![2] as Record<string, unknown>).aiPersonality;
    expect(['warlord', 'raider', 'economist', 'turtle', 'opportunist', 'schemer']).toContain(persona);
  });
```

- [ ] **Step 6: Run turn-ticker tests + typecheck**

Run: `npx vitest run amplify/functions/turn-ticker/handler.test.ts --config vitest.config.ts && npx tsc --noEmit -p amplify/tsconfig.json`
Expected: PASS, clean typecheck

- [ ] **Step 7: Commit**

```bash
git add amplify/functions/turn-ticker/handler.ts amplify/functions/turn-ticker/handler.test.ts
git commit -m "feat(ai): turn-ticker drives the strategist — public views, memory, AI war declarations"
```

---

### Task 10: Delete ai-behavior.ts, fix stragglers, full verification

**Files:**
- Delete: `shared/mechanics/ai-behavior.ts`, `shared/mechanics/ai-behavior.test.ts`
- Possibly modify: any other importer found by grep

- [ ] **Step 1: Find remaining importers**

Run: `grep -rn "ai-behavior" --include="*.ts" --include="*.tsx" /home/ubuntu/projects/monarchygame/shared /home/ubuntu/projects/monarchygame/amplify /home/ubuntu/projects/monarchygame/frontend | grep -v node_modules`
Expected: only `ai-behavior.ts`/`ai-behavior.test.ts` themselves (turn-ticker was migrated in Task 9). If any other file imports it, switch the import to `ai-strategist` (all moved exports kept their names: `armyCombatPower`, `SeasonAge`).

- [ ] **Step 2: Delete the old module**

```bash
git rm shared/mechanics/ai-behavior.ts shared/mechanics/ai-behavior.test.ts
```

- [ ] **Step 3: Full verification — all suites, typecheck, lint, build**

```bash
cd /home/ubuntu/projects/monarchygame
npx tsc --noEmit -p amplify/tsconfig.json
npx vitest run --config vitest.config.ts
npx vitest run --config vitest.shared.config.ts
cd frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```
Expected: everything green. (Frontend is untouched by this plan; the run guards against accidental coupling.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(ai): remove scripted ai-behavior, fully replaced by ai-strategist"
```

---

### Task 11: Deploy + live verification

- [ ] **Step 1: Push (deploy is automatic on CodeCommit main)**

```bash
git push origin main && git push codecommit main
```

- [ ] **Step 2: Watch the build**

```bash
aws amplify list-jobs --app-id d2plhaotxy4zdr --branch-name main --region eu-west-1 --max-results 1
# poll get-job until SUCCEED (~5-12 min; no schema change so no GSI wait)
```

- [ ] **Step 3: Live verification (no re-seed needed — same kingdoms, new brain)**

```bash
# Trigger a tick manually
aws lambda invoke --function-name amplify-d2plhaotxy4zdr-ma-turntickerlambdaA31E55A8-faZFjF0uaX1v \
  --region eu-west-1 --cli-binary-format raw-in-base64-out \
  --payload '{"source":"manual-verify"}' /tmp/tick.json && cat /tmp/tick.json
```

Then check CloudWatch for `ai-decision` lines containing `persona` and `difficulty` fields:

```bash
LG="/aws/lambda/amplify-d2plhaotxy4zdr-ma-turntickerlambdaA31E55A8-faZFjF0uaX1v"
aws logs filter-log-events --region eu-west-1 --log-group-name "$LG" \
  --start-time $(( ($(date +%s) - 600) * 1000 )) \
  --filter-pattern '"ai-decision"' --max-items 5 --query 'events[].message' --output text
```

Expected: decisions logged with `persona` (one of the six) and `difficulty` (easy/medium/hard); `tick` summary shows `aiTicked: 500`, no errors.

- [ ] **Step 4: Update project memory**

Update `/home/ubuntu/.claude/projects/-home-ubuntu-projects-monarchygame/memory/ai-fairness-rework.md`: note that `ai-behavior.ts` was replaced by `ai-strategist.ts` (utility-based, 6 personas, 3 difficulties, information-fair PublicKingdomView, grudge memory in stats.aiMemory, AI war declarations).

---

## Self-review notes

- **Spec coverage:** smart (utility EV, real marginal values, cap-aware training, memory) ✓; difficulties (3 tiers, decision-quality only) ✓; personas (6 weight vectors) ✓; no LLM ✓; no cheating — economic (existing) + informational (PublicKingdomView) + rules (war rule added) ✓; reacts to player (playerFocus, grudges from player attacks via public battle reports, retaliation) ✓.
- **Type consistency:** `StrategistDecision.attackTarget` keeps the old field name so turn-ticker combat execution compiles unchanged; `armyCombatPower`/`SeasonAge` keep names across the module move.
- **Known judgment calls:** defense-estimation coefficients are calibration heuristics (documented in code); the war-declaration turn cost (1) follows turn-mechanics DIPLOMATIC_ACTION; `guildmateIds` defaults empty since seeded AI have no guilds (hook exists for later).
