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

  // Rank types by utility (tiny rng jitter for stable tiebreak).
  const ranked = [...BUILDING_TYPES]
    .map(t => ({ t, u: utility(t) * (1 + (rng() * 2 - 1) * 0.0001) }))
    .sort((a, b) => b.u - a.u);

  const out: Array<{ type: string; qty: number }> = [];
  let gold = goldBudget;
  let turns = turnsBudget;

  // Spend a utility-proportional share (min 15%) of the REMAINING gold budget on
  // each type, weighted against the utility of the types not yet processed.
  let remainingU = ranked.reduce((s, r) => s + Math.max(0, r.u), 0) || 1;
  for (const { t, u } of ranked) {
    if (u <= 0 || slots <= 0 || gold < BUILDING_GOLD_COST || turns < BUILD_TURN_COST) break;
    const share = Math.max(0.15, u / remainingU);
    remainingU = Math.max(1, remainingU - Math.max(0, u));
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
  const t1Cost = Math.round(TIER_BASE_GOLD[0] * mult);
  const goldFitsInSlots = Math.floor(gold / t1Cost) <= unitSlots;
  const startTier = goldFitsInSlots ? 0 : 1; // skip T1 when slots are the bottleneck

  const out: Array<{ unitType: string; qty: number; cost: number }> = [];
  for (let tier = startTier; tier < list.length; tier++) {
    if (gold <= 0 || capRoom <= 0 || unitSlots <= 0 || turns < TRAIN_TURN_COST) break;
    const costPer = Math.round(TIER_BASE_GOLD[tier] * mult);

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

// ── Attack scoring ──────────────────────────────────────────────────────────
//
// Expected value per target (all from public info + own army):
//   EV = P(win) · (estLand·7%·1000 + loot·lootFocus) − casualtyCost
// multiplied by aggression / vengeance(grudge) / playerFocus / wounded bonus.
// Hard AI demand a safety margin on the estimated power ratio; easy AI take
// riskier fights on worse estimates. Early age is peaceful by design.

const ATTACKS_BEFORE_WAR = 3;          // combat-processor war rule
const LAND_GAIN_PCT = 0.07;            // full-strike "with ease" land share
const GOLD_PER_LAND = 1000;            // networth/loot valuation
// Expected own-army value risked per attack, as a fraction of standing army.
// Kept low because troops are continually retrained each tick and a favorable
// attack (the only kind the safety gate allows) loses only a small slice of the
// army — without this, a large standing army makes every attack EV-negative and
// the AI never fights. Deliberate balance choice.
const CASUALTY_FRACTION = 0.02;
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
    // A win yields TWO distinct rewards, both proportional to land taken (~7%):
    //   landValue — the permanent acres captured (valued at GOLD_PER_LAND each)
    //   loot       — one-time gold stolen (combat sets goldLooted ≈ landGained·1000)
    // They share a formula but are separate terms; only loot is weighted by the
    // persona's lootFocus.
    const gainPerLand = estLand * LAND_GAIN_PCT * GOLD_PER_LAND;
    const landValue = gainPerLand;
    const loot = gainPerLand;
    const casualty = armyValue * CASUALTY_FRACTION;

    // Persona multipliers compound intentionally — e.g. a warlord schemer with a
    // grudge against a wounded human player stacks aggression × vengeance ×
    // playerFocus × wounded for a large (3-4x) preference toward that target.
    let personaMult = w.aggression;
    const grudge = ctx.memory.grudges[t.id];
    if (grudge) personaMult *= 1 + w.vengeance * Math.min(grudge.count, 4) * 0.5;
    if (!t.isAI) personaMult *= w.playerFocus;
    if (woundedIds.has(t.id)) personaMult *= WOUNDED_BONUS;

    let ev = (pWin * (landValue + loot * w.lootFocus) - casualty) * personaMult;
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
