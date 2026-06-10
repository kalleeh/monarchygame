/**
 * AI Kingdom Behavior — Pure Decision Logic
 *
 * Determines what AI kingdoms should do each tick: build, train, or attack.
 * No DynamoDB calls — all side effects happen in the turn-ticker handler.
 *
 * FAIRNESS: AI plays by the SAME server-authoritative rules as human players.
 * It builds the same building types (which feed the same income/troop-cap
 * formulas), pays the same building/unit costs and turn costs, and is bound by
 * the same troop cap (calculateTroopCapGold). It must never use private
 * constants that diverge from the player-facing mechanics.
 */

import { calculateTroopCapGold } from './troop-cap-mechanics';

export type AIPersonality = 'aggressive' | 'builder' | 'balanced';
export type SeasonAge = 'early' | 'middle' | 'late';

export interface AIKingdomState {
  id: string;
  race: string;
  land: number;
  gold: number;
  turnsAvailable: number;
  networth: number;
  buildings: Record<string, number>;
  totalUnits: Record<string, number>;
  guildId?: string | null;
  isAI?: boolean;
  isActive?: boolean;
  currentAge?: string;
  createdAt?: string;
  stats?: Record<string, unknown>;
}

export interface AIBuildAction {
  type: string;
  qty: number;
}

export interface AITrainAction {
  unitType: string;
  qty: number;
  cost: number;
}

export interface AIDecision {
  builds: AIBuildAction[];
  trains: AITrainAction[];
  attackTarget: string | null;
  turnsSpent: number;
  goldSpent: number;
}

// Real building types — MUST match building-constructor VALID_BUILDING_TYPES so
// AI buildings feed the same income/troop-cap formulas players use.
//   mine 20g/turn · farm 8g+10pop · tower 50g · castle 10g(+30 Dwarven)
//   barracks 15g/turn AND raises troop cap · temple elan/tithe · wall fort defense
const BUILDING_TYPES = ['mine', 'farm', 'tower', 'castle', 'barracks', 'temple', 'wall'] as const;

// Gold cost per building (matches building-constructor: flat 250g, 1 turn each)
const BUILDING_GOLD_COST = 250;

// Minimum gold reserve — AI won't spend below this
const GOLD_FLOOR = 10_000;

// Turn cost for one build action
const BUILD_TURN_COST = 1;

// Turn cost for one train action
const TRAIN_TURN_COST = 1;

// Turn cost for an attack
const ATTACK_TURN_COST = 4;

// Tier base gold costs (from unit-costs.ts)
const TIER_BASE_GOLD = [50, 350, 900, 2000];

// Race economic multipliers (from unit-costs.ts)
const RACE_ECON_MULT: Record<string, number> = {
  Human: 1.0, Elven: 1.0, Goblin: 1.0, Droben: 1.0, Vampire: 2.0,
  Elemental: 1.0, Centaur: 1.0, Sidhe: 1.0, Dwarven: 1.0, Fae: 1.0,
};

// Race unit type names by tier (from unit-costs.ts)
const RACE_UNITS: Record<string, string[]> = {
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

// Build ratios per personality, over the REAL building types. Each fraction is
// the share of buildable slots that personality targets for that type.
//   aggressive — leans barracks (troop cap) + tower/mine income to fund war, some walls
//   builder    — economy first (mine/tower/farm), fewer barracks/walls
//   balanced   — even split across economy, military capacity, and defense
const BUILD_RATIOS: Record<AIPersonality, Record<string, number>> = {
  aggressive: { barracks: 0.30, tower: 0.20, mine: 0.20, wall: 0.15, castle: 0.08, farm: 0.05, temple: 0.02 },
  builder:    { mine: 0.28, tower: 0.25, farm: 0.18, castle: 0.12, barracks: 0.10, temple: 0.04, wall: 0.03 },
  balanced:   { mine: 0.22, tower: 0.20, barracks: 0.20, farm: 0.13, wall: 0.13, castle: 0.08, temple: 0.04 },
};

// Train budget as fraction of gold, by personality
const TRAIN_BUDGET_FRAC: Record<AIPersonality, number> = {
  aggressive: 0.60,
  builder: 0.40,
  balanced: 0.50,
};

// Attack chance per tick by personality and age
const ATTACK_CHANCE: Record<AIPersonality, Record<SeasonAge, number>> = {
  aggressive: { early: 0.00, middle: 0.15, late: 0.25 },
  builder:    { early: 0.00, middle: 0.05, late: 0.10 },
  balanced:   { early: 0.00, middle: 0.10, late: 0.15 },
};

// Turn budget fraction by age
const TURN_BUDGET_FRAC: Record<SeasonAge, number> = {
  early: 0.60,
  middle: 0.80,
  late: 0.90,
};

// Target networth ratio windows by personality
const TARGET_NW_RANGE: Record<AIPersonality, [number, number]> = {
  aggressive: [0.5, 0.9],
  builder:    [0.3, 0.6],
  balanced:   [0.6, 1.0],
};

/**
 * Deterministic personality assignment from kingdom ID.
 * Uses a simple hash so the same kingdom always gets the same personality.
 */
export function assignPersonality(kingdomId: string): AIPersonality {
  let hash = 0;
  for (let i = 0; i < kingdomId.length; i++) {
    hash = ((hash << 5) - hash + kingdomId.charCodeAt(i)) | 0;
  }
  const types: AIPersonality[] = ['aggressive', 'builder', 'balanced'];
  return types[((hash % 3) + 3) % 3];
}

/**
 * Get optimal build ratios for a personality.
 */
export function getOptimalBuildRatios(personality: AIPersonality): Record<string, number> {
  return BUILD_RATIOS[personality];
}

// --- Real combat power (mirrors combat-processor TIER_OFFENSE/TIER_DEFENSE) ---
// AI combat must use the SAME per-tier unit values as player combat, not a flat
// "every unit = 10" approximation. Tier index 0..3 = T1..T4.
const TIER_OFFENSE = [1, 3, 6, 10];
const TIER_DEFENSE = [1, 2, 4, 7];

/** Map a unit type id to its tier index (0-3) using the race's unit list; scouts excluded by caller. */
function unitTierIndex(race: string, unitType: string): number {
  const list = RACE_UNITS[race] ?? RACE_UNITS.Human;
  const idx = list.indexOf(unitType);
  if (idx >= 0) return idx;
  // Generic fallbacks shared with combat-processor's UNIT_TIER map.
  const generic: Record<string, number> = { tier1: 0, tier2: 1, tier3: 2, tier4: 3, peasants: 0, militia: 1, knights: 2, cavalry: 3 };
  return generic[unitType] ?? 0;
}

/**
 * Total offense/defense of an army using real per-tier unit values.
 * Scouts/elite_scouts are espionage-only and excluded from combat power.
 * Returned values are pre-race-bonus; the turn-ticker applies race multipliers
 * via the same path player combat uses.
 */
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

/**
 * Determine whether the AI should attempt an attack this tick.
 */
export function shouldAttack(
  personality: AIPersonality,
  seasonAge: SeasonAge,
  remainingTurns: number,
  totalUnitCount: number,
  rand: number = Math.random()
): boolean {
  if (remainingTurns < ATTACK_TURN_COST + 2) return false;
  if (totalUnitCount < 50) return false;
  const chance = ATTACK_CHANCE[personality][seasonAge];
  return rand < chance;
}

/**
 * Select the best attack target from candidates.
 * Returns null if no suitable target exists.
 */
export function selectAttackTarget(
  ai: AIKingdomState,
  candidates: AIKingdomState[],
  personality: AIPersonality,
  rand: number = Math.random()
): string | null {
  const [minRatio, maxRatio] = TARGET_NW_RANGE[personality];
  const aiNW = Math.max(1, ai.networth);
  const aiUnitCount = Object.values(ai.totalUnits).reduce((s, n) => s + (n ?? 0), 0);

  let bestId: string | null = null;
  let bestScore = -Infinity;

  for (const c of candidates) {
    if (c.id === ai.id) continue;
    if (!c.isActive) continue;
    // Don't attack alliance members
    if (ai.guildId && c.guildId && ai.guildId === c.guildId) continue;

    const nwRatio = c.networth / aiNW;
    if (nwRatio < minRatio || nwRatio > maxRatio) continue;

    // Check newbie protection: kingdom < 72h old AND < 3x smaller
    if (c.createdAt) {
      const ageHours = (Date.now() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60);
      if (ageHours < 72 && c.networth < aiNW / 3) continue;
    }

    // Skip kingdoms in restoration (stats.restorationEndTime in the future)
    if (c.stats) {
      const restEnd = c.stats.restorationEndTime as string | undefined;
      if (restEnd && new Date(restEnd).getTime() > Date.now()) continue;
    }

    const cUnitCount = Object.values(c.totalUnits).reduce((s, n) => s + (n ?? 0), 0);
    const defenseScore = cUnitCount / Math.max(1, aiUnitCount);
    const playerBonus = c.isAI ? 0 : 0.2;
    const score = (1 - defenseScore) + playerBonus + rand * 0.3;

    if (score > bestScore) {
      bestScore = score;
      bestId = c.id;
    }
  }

  return bestId;
}

/**
 * Main AI decision function. Returns what the AI should do this tick.
 * Pure function — no side effects.
 */
export function decideAIActions(
  kingdom: AIKingdomState,
  personality: AIPersonality,
  seasonAge: SeasonAge,
  allKingdoms: AIKingdomState[],
  rand: number = Math.random()
): AIDecision {
  const decision: AIDecision = { builds: [], trains: [], attackTarget: null, turnsSpent: 0, goldSpent: 0 };

  const turnsAvailable = Math.min(72, kingdom.turnsAvailable);
  if (turnsAvailable < 3) return decision;

  const turnBudget = Math.floor(turnsAvailable * TURN_BUDGET_FRAC[seasonAge]);
  let turnsLeft = turnBudget;
  let goldLeft = kingdom.gold;

  // --- PHASE 1: BUILD ---
  if (turnsLeft >= BUILD_TURN_COST && goldLeft > GOLD_FLOOR + BUILDING_GOLD_COST) {
    const maxBuildings = Math.floor(kingdom.land * 0.8);
    const currentTotal = Object.values(kingdom.buildings).reduce((s, n) => s + (n ?? 0), 0);
    let buildSlots = Math.max(0, maxBuildings - currentTotal);

    if (buildSlots > 0) {
      const ratios = BUILD_RATIOS[personality];
      for (const bType of BUILDING_TYPES) {
        if (turnsLeft < BUILD_TURN_COST || goldLeft <= GOLD_FLOOR || buildSlots <= 0) break;
        const target = Math.floor(maxBuildings * (ratios[bType] ?? 0));
        const current = kingdom.buildings[bType] ?? 0;
        const deficit = target - current;
        if (deficit <= 0) continue;

        const affordable = Math.floor((goldLeft - GOLD_FLOOR) / BUILDING_GOLD_COST);
        const toBuild = Math.min(deficit, affordable, buildSlots);
        if (toBuild <= 0) continue;

        decision.builds.push({ type: bType, qty: toBuild });
        goldLeft -= toBuild * BUILDING_GOLD_COST;
        buildSlots -= toBuild;
        turnsLeft -= BUILD_TURN_COST;
      }
    }
  }

  // --- PHASE 2: TRAIN ---
  const raceUnits = RACE_UNITS[kingdom.race] ?? RACE_UNITS.Human;
  const econMult = RACE_ECON_MULT[kingdom.race] ?? 1.0;
  const trainBudget = Math.floor((goldLeft - GOLD_FLOOR) * TRAIN_BUDGET_FRAC[personality]);

  // Troop cap — SAME ceiling the unit-trainer Lambda enforces for players:
  // total gold invested in troops cannot exceed land*1000 + barracks*2000 (min 2M).
  // We value existing troops at current per-unit cost and stop when the cap is hit.
  // Count barracks decided this tick too, since they raise the cap for this turn.
  const barracksBuiltThisTick = decision.builds
    .filter(b => b.type === 'barracks')
    .reduce((s, b) => s + b.qty, 0);
  const barracks = (kingdom.buildings.barracks ?? 0) + barracksBuiltThisTick;
  const troopCapGold = calculateTroopCapGold({ land: kingdom.land, barracks });
  let accumulatedTroopGold = 0;
  for (const [type, count] of Object.entries(kingdom.totalUnits)) {
    const tierIdx = raceUnits.indexOf(type);
    const perUnit = tierIdx >= 0 ? Math.round(TIER_BASE_GOLD[tierIdx] * econMult) : 0;
    accumulatedTroopGold += perUnit * (count ?? 0);
  }

  if (turnsLeft >= TRAIN_TURN_COST && trainBudget > 0 && accumulatedTroopGold < troopCapGold) {
    let trainGoldLeft = Math.max(0, trainBudget);
    // Train lower tiers first (index 0 = T1, 1 = T2, etc.)
    // In late age, allow up to T3; in early, only T1-T2
    const maxTier = seasonAge === 'early' ? 2 : seasonAge === 'middle' ? 3 : 4;

    for (let tier = 0; tier < Math.min(maxTier, raceUnits.length); tier++) {
      if (turnsLeft < TRAIN_TURN_COST || trainGoldLeft <= 0) break;
      const unitType = raceUnits[tier];
      const costPerUnit = Math.round(TIER_BASE_GOLD[tier] * econMult);
      if (costPerUnit <= 0) continue;

      // Target: land * ratio based on tier (lower tiers get more)
      const tierRatio = tier === 0 ? 0.5 : tier === 1 ? 0.3 : tier === 2 ? 0.15 : 0.05;
      const targetCount = Math.floor(kingdom.land * tierRatio);
      const current = kingdom.totalUnits[unitType] ?? 0;
      const deficit = targetCount - current;
      if (deficit <= 0) continue;

      // Cap units by gold budget AND remaining troop-cap headroom.
      const capHeadroom = Math.max(0, troopCapGold - accumulatedTroopGold);
      const affordableByGold = Math.floor(trainGoldLeft / costPerUnit);
      const affordableByCap = Math.floor(capHeadroom / costPerUnit);
      const toTrain = Math.min(deficit, affordableByGold, affordableByCap, 500);
      if (toTrain <= 0) {
        // Out of troop-cap room entirely — no point checking higher tiers.
        if (affordableByCap <= 0) break;
        continue;
      }

      const cost = toTrain * costPerUnit;
      decision.trains.push({ unitType, qty: toTrain, cost });
      trainGoldLeft -= cost;
      goldLeft -= cost;
      accumulatedTroopGold += cost;
      turnsLeft -= TRAIN_TURN_COST;
    }
  }

  // --- PHASE 3: ATTACK ---
  const totalUnits = Object.values(kingdom.totalUnits).reduce((s, n) => s + (n ?? 0), 0);
  // Add units we just trained
  const trainedUnits = decision.trains.reduce((s, t) => s + t.qty, 0);
  const effectiveUnits = totalUnits + trainedUnits;

  if (turnsLeft >= ATTACK_TURN_COST && shouldAttack(personality, seasonAge, turnsLeft, effectiveUnits, rand)) {
    const target = selectAttackTarget(kingdom, allKingdoms, personality, rand);
    if (target) {
      decision.attackTarget = target;
      turnsLeft -= ATTACK_TURN_COST;
    }
  }

  decision.turnsSpent = turnBudget - turnsLeft;
  decision.goldSpent = kingdom.gold - goldLeft;
  return decision;
}
