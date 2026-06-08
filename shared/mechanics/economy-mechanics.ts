/**
 * Per-turn resource generation — the single source of truth shared by the
 * resource-manager Lambda (which actually grants resources each tick) and the
 * frontend (which displays "+X/turn"). Keeping both on this module guarantees the
 * numbers shown to players match what they receive.
 *
 * Pure functions, no I/O. The Lambda passes in already-loaded buildings/stats/
 * territories/alliance bonuses; the frontend passes whatever it has (territories
 * and alliance bonuses are optional and default to none).
 */

import type { KingdomBuildings } from '../types/kingdom-resources';

export const AGE_INCOME_MULTIPLIERS: Record<string, number> = {
  early: 1.2,   // growth phase
  middle: 1.15, // developed
  late: 1.3,    // peak civilization
};

// Per-category territory production (Tier 2). Mirrors resource-manager.
export const CATEGORY_PRODUCTION: Record<string, { gold: number; population: number; land: number }> = {
  farmland:   { gold: 20, population: 30, land: 50 },
  mine:       { gold: 60, population: 5,  land: 10 },
  forest:     { gold: 10, population: 10, land: 30 },
  port:       { gold: 80, population: 20, land: 5  },
  stronghold: { gold: 5,  population: 0,  land: 0  },
  ruins:      { gold: 0,  population: 0,  land: 0  },
};

export const TERRAIN_MULTIPLIERS: Record<string, Partial<Record<string, number>>> = {
  mountains: { mine: 1.5 },
  coastal:   { port: 1.5 },
  forest:    { forest: 1.5 },
  plains:    {},
};

export const RACE_TERRITORY_BONUS: Record<string, Partial<Record<string, number>>> = {
  Goblin:    { mine: 1.20 },
  Dwarven:   { mine: 1.25, stronghold: 1.15 },
  Elven:     { forest: 1.20 },
  Fae:       { farmland: 1.20 },
  Sidhe:     { farmland: 1.15 },
  Human:     { port: 1.20 },
  Centaur:   { farmland: 1.10 },
  Vampire:   { stronghold: 1.15 },
  Elemental: { mine: 1.10, forest: 1.10 },
  Droben:    {},
};

export interface TerritoryLike {
  category?: string | null;
  terrainType?: string | null;
  defenseLevel?: number | null;
  regionId?: string | null;
}

export interface GenerationInput {
  race: string;
  age: string; // 'early' | 'middle' | 'late'
  buildings: KingdomBuildings;
  /** stats.tithe (0–10 scale). */
  tithe?: number;
  territories?: TerritoryLike[];
  /** Alliance composition income multiplier (default 1.0). */
  compositionIncomeBonus?: number;
  /** Product of active alliance upgrade income multipliers (default 1.0). */
  upgradeIncomeBonus?: number;
  /** True if an ECONOMIC_FOCUS faith effect is active (+20% gold). */
  hasEconomicFocus?: boolean;
}

/** A single labeled contributor to gold income (pre-multiplier base components). */
export interface GoldSource {
  label: string;
  amount: number;
}

export interface GenerationRates {
  /** Total gold per turn (after all multipliers + territories). */
  goldPerTurn: number;
  /** Total population per turn (buildings + territories). */
  populationPerTurn: number;
  /** Elan per turn (temples × race rate). */
  elanPerTurn: number;
  /** Land per turn from territories. */
  landPerTurn: number;
  /** Labeled breakdown for the economy panel/tooltip. */
  breakdown: {
    /** Base gold components before age/alliance/faith multipliers. */
    goldBase: GoldSource[];
    /** Sum of goldBase (base + tithe + caravan) before any multiplier. */
    goldSubtotal: number;
    ageMultiplier: number;
    compositionIncomeBonus: number;
    upgradeIncomeBonus: number;
    economicFocus: boolean;
    /** Faith ECONOMIC_FOCUS multiplier as a number (1.0 or 1.2) for display. */
    economicFocusMultiplier: number;
    /** Gold/turn from buildings after all multipliers, before territory gold is added. */
    goldAfterMultipliers: number;
    territoryGold: number;
    populationSources: GoldSource[];
    elanSources: GoldSource[];
  };
  /**
   * Qualitative lists of what currently AFFECTS each rate — names only, no amounts.
   * Surfaced to players so they see the levers (and can strategise) without the exact
   * formula being handed to them. Only includes factors that are actually active.
   */
  factors: {
    gold: string[];
    population: string[];
    elan: string[];
    land: string[];
  };
}

const REGION_SLOT_COUNTS: Record<string, number> = { capital: 5, settlement: 3, outpost: 2, fortress: 4 };
const WORLD_REGION_TYPES: Record<string, string> = {
  'wt-01':'fortress','wt-02':'outpost','wt-03':'capital','wt-04':'settlement','wt-05':'fortress',
  'wt-06':'outpost','wt-07':'capital','wt-08':'settlement','wt-09':'capital','wt-10':'outpost',
  'wt-11':'settlement','wt-12':'outpost','wt-13':'fortress','wt-14':'outpost','wt-15':'settlement',
  'wt-16':'capital','wt-17':'outpost','wt-18':'settlement','wt-19':'settlement','wt-20':'capital',
  'wt-21':'outpost','wt-22':'capital','wt-23':'settlement','wt-24':'outpost','wt-25':'capital',
  'wt-26':'outpost','wt-27':'capital','wt-28':'settlement','wt-29':'outpost','wt-30':'capital',
  'wt-31':'settlement','wt-32':'outpost','wt-33':'outpost','wt-34':'settlement','wt-35':'outpost',
  'wt-36':'settlement','wt-37':'outpost','wt-38':'settlement','wt-39':'outpost','wt-40':'fortress',
  'wt-41':'capital','wt-42':'settlement','wt-43':'settlement','wt-44':'outpost','wt-45':'settlement',
  'wt-46':'outpost','wt-47':'settlement','wt-48':'fortress','wt-49':'capital','wt-50':'outpost',
};

/**
 * Marginal per-turn contribution of ONE building of the given type, before
 * age/alliance multipliers (so it reads as a stable "this is what each adds").
 * Used by the buildings page to explain each structure's value.
 */
export function buildingPerTurnContribution(
  buildingId: string,
  race: string,
): { gold: number; population: number; elan: number } {
  const r = race.toLowerCase();
  switch (buildingId) {
    case 'mine':    return { gold: 20, population: 0, elan: 0 };
    case 'farm':    return { gold: 8,  population: 10, elan: 0 };
    case 'tower':   return { gold: 50, population: 0, elan: 0 };
    case 'castle':  return { gold: 10 + (r === 'dwarven' ? 30 : 0), population: 0, elan: 0 };
    case 'barracks':return { gold: 15, population: 0, elan: 0 };
    case 'temple': {
      const elanRate = (race === 'Sidhe' || race === 'Vampire') ? 0.005 : 0.003;
      // Temple gold is via tithe (scales with the tithe stat); shown separately on the dashboard.
      return { gold: 0, population: 0, elan: elanRate };
    }
    default:        return { gold: 0, population: 0, elan: 0 }; // wall, etc. — no income
  }
}

/**
 * Compute per-turn generation rates. Faithfully reproduces resource-manager's
 * income math (including Math.floor ordering) so display === actual grant.
 */
export function calculateGenerationRates(input: GenerationInput): GenerationRates {
  const {
    race, age, buildings,
    tithe = 0,
    territories = [],
    compositionIncomeBonus = 1.0,
    upgradeIncomeBonus = 1.0,
    hasEconomicFocus = false,
  } = input;

  const b = buildings ?? {};
  const ageMultiplier = AGE_INCOME_MULTIPLIERS[age] ?? 1.0;

  // --- Base gold components (labeled) ---
  const goldBase: GoldSource[] = [];
  const mineGold = (b.mine ?? 0) * 20;
  const farmGold = (b.farm ?? 0) * 8;
  const towerGold = (b.tower ?? 0) * 50;
  const flatBase = 100;
  // resource-manager floors base at 50, but base always includes the +100 flat, so floor is moot.
  let baseGoldPerTurn = Math.max(50, mineGold + farmGold + towerGold + flatBase);
  if (b.mine) goldBase.push({ label: `Mines (${b.mine})`, amount: mineGold });
  if (b.farm) goldBase.push({ label: `Farms (${b.farm})`, amount: farmGold });
  if (b.tower) goldBase.push({ label: `Towers (${b.tower})`, amount: towerGold });
  goldBase.push({ label: 'Base', amount: flatBase });

  const castleGold = (b.castle ?? 0) * 10;
  baseGoldPerTurn += castleGold;
  if (b.castle) goldBase.push({ label: `Castles (${b.castle})`, amount: castleGold });

  const barracksGold = (b.barracks ?? 0) * 15;
  baseGoldPerTurn += barracksGold;
  if (b.barracks) goldBase.push({ label: `Barracks (${b.barracks})`, amount: barracksGold });

  if (race.toLowerCase() === 'dwarven') {
    const dwarvenCastle = (b.castle ?? 0) * 30;
    baseGoldPerTurn += dwarvenCastle;
    if (dwarvenCastle) goldBase.push({ label: 'Dwarven castle mastery', amount: dwarvenCastle });
  }

  // Tithe from temples
  const titheMultiplier = tithe / 10;
  const tithePerTurn = Math.floor((b.temple ?? 0) * 5 * Math.max(titheMultiplier, 0.5));
  if (tithePerTurn) goldBase.push({ label: `Temple tithe (${b.temple})`, amount: tithePerTurn });

  // Human caravan bonus
  const caravanBonus = race === 'Human' ? Math.floor(baseGoldPerTurn * 0.40) : 0;
  if (caravanBonus) goldBase.push({ label: 'Human caravans (+40%)', amount: caravanBonus });

  // Apply age + alliance multipliers
  const goldSubtotal = baseGoldPerTurn + tithePerTurn + caravanBonus;
  let totalGoldPerTurn = Math.floor(goldSubtotal * ageMultiplier * compositionIncomeBonus * upgradeIncomeBonus);
  if (hasEconomicFocus) totalGoldPerTurn = Math.floor(totalGoldPerTurn * 1.20);
  const goldAfterMultipliers = totalGoldPerTurn;

  // --- Population & elan (buildings) ---
  const populationSources: GoldSource[] = [];
  const farmPop = (b.farm ?? 0) * 10;
  let populationPerTurn = farmPop;
  if (farmPop) populationSources.push({ label: `Farms (${b.farm})`, amount: farmPop });

  const ELAN_RATE = (race === 'Sidhe' || race === 'Vampire') ? 0.005 : 0.003;
  const elanPerTurn = Math.ceil((b.temple ?? 0) * ELAN_RATE);
  const elanSources: GoldSource[] = elanPerTurn
    ? [{ label: `Temples (${b.temple}) × ${ELAN_RATE}`, amount: elanPerTurn }]
    : [];

  // --- Territory production ---
  let territoryGold = 0;
  let territoryPop = 0;
  let territoryLand = 0;
  for (const t of territories) {
    const cat = t.category ?? 'farmland';
    const terrain = t.terrainType ?? 'plains';
    const base = CATEGORY_PRODUCTION[cat] ?? CATEGORY_PRODUCTION.farmland;
    const mult = TERRAIN_MULTIPLIERS[terrain]?.[cat] ?? 1.0;
    const dlvlMult = 1 + 0.1 * (t.defenseLevel ?? 0);
    const raceBonus = RACE_TERRITORY_BONUS[race]?.[cat] ?? 1.0;
    territoryGold += Math.floor(base.gold * mult * dlvlMult * raceBonus);
    territoryPop  += Math.floor(base.population * mult * dlvlMult);
    territoryLand += Math.floor(base.land * mult * dlvlMult);
  }
  // Region completion bonus: +20% gold for fully-controlled regions
  const regionGroups: Record<string, number> = {};
  for (const t of territories) {
    if (t.regionId) regionGroups[t.regionId] = (regionGroups[t.regionId] ?? 0) + 1;
  }
  for (const [regionId, count] of Object.entries(regionGroups)) {
    const rtype = WORLD_REGION_TYPES[regionId];
    if (rtype && count >= (REGION_SLOT_COUNTS[rtype] ?? 99)) {
      const regionGold = territories
        .filter(t => t.regionId === regionId)
        .reduce((sum, t) => {
          const cat = t.category ?? 'farmland';
          const terrain = t.terrainType ?? 'plains';
          const bb = CATEGORY_PRODUCTION[cat] ?? CATEGORY_PRODUCTION.farmland;
          const m = TERRAIN_MULTIPLIERS[terrain]?.[cat] ?? 1.0;
          return sum + Math.floor(bb.gold * m * (1 + 0.1 * (t.defenseLevel ?? 0)));
        }, 0);
      territoryGold += Math.floor(regionGold * 0.20);
    }
  }
  if (territoryPop) populationSources.push({ label: 'Territories', amount: territoryPop });

  // --- Qualitative factor lists (names only, no magnitudes) ---
  const goldFactors: string[] = [];
  if (b.mine) goldFactors.push('Mines');
  if (b.tower) goldFactors.push('Towers');
  if (b.castle) goldFactors.push('Castles');
  if (b.barracks) goldFactors.push('Barracks');
  if (b.temple && tithe > 0) goldFactors.push('Temple tithe');
  if (race === 'Human') goldFactors.push('Human caravans');
  if (race.toLowerCase() === 'dwarven' && b.castle) goldFactors.push('Dwarven stone mastery');
  goldFactors.push('Age of the season');
  if (territoryGold > 0) goldFactors.push('Territories');
  if (compositionIncomeBonus !== 1.0) goldFactors.push('Alliance composition');
  if (upgradeIncomeBonus !== 1.0) goldFactors.push('Alliance upgrades');
  if (hasEconomicFocus) goldFactors.push('Faith: Economic Focus');

  const populationFactors: string[] = [];
  if (farmPop) populationFactors.push('Farms');
  if (territoryPop) populationFactors.push('Territories');

  const elanFactors: string[] = [];
  if (elanPerTurn) elanFactors.push('Temples');
  if (race === 'Sidhe' || race === 'Vampire') elanFactors.push(`${race} affinity`);

  const landFactors: string[] = [];
  if (territoryLand > 0) landFactors.push('Territories');

  return {
    goldPerTurn: totalGoldPerTurn + territoryGold,
    populationPerTurn: populationPerTurn + territoryPop,
    elanPerTurn,
    landPerTurn: territoryLand,
    factors: {
      gold: goldFactors,
      population: populationFactors,
      elan: elanFactors,
      land: landFactors,
    },
    breakdown: {
      goldBase,
      goldSubtotal,
      ageMultiplier,
      compositionIncomeBonus,
      upgradeIncomeBonus,
      economicFocus: hasEconomicFocus,
      economicFocusMultiplier: hasEconomicFocus ? 1.2 : 1.0,
      goldAfterMultipliers,
      territoryGold,
      populationSources,
      elanSources,
    },
  };
}
