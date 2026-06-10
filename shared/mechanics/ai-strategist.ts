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
