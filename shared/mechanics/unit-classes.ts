/**
 * Unit counter system — soft rock-paper-scissors on top of the aggregate
 * total-offense-vs-total-defense combat model.
 *
 * Original Monarchy had no counter system; this is a deliberate added layer
 * (StarCraft-style soft counters) so that mono-spamming one unit is no longer
 * optimal and army COMPOSITION matters. Multipliers are intentionally soft
 * (≤±25%) so they tilt fights without overturning the economy-driven balance.
 *
 * Pure functions, no I/O. Shared by the combat-processor (player + AI combat),
 * the AI strategist (so the AI values composition), and the attack preview
 * (so players can scout and react).
 */

export type UnitClass = 'infantry' | 'cavalry' | 'ranged' | 'mystic';

export const UNIT_CLASSES: UnitClass[] = ['infantry', 'cavalry', 'ranged', 'mystic'];

/**
 * Closed counter loop: each class is favorable vs ONE class and unfavorable vs
 * ONE class, neutral to the rest. No strict ordering, so there is no single
 * "best" class.
 *
 *   infantry > cavalry > ranged > mystic > infantry
 *
 * COUNTER[attacker][defender]: >1 = attacker's offense is amplified vs that
 * defender class; <1 = blunted.
 */
const FAVORABLE = 1.25;
const UNFAVORABLE = 0.8;
const NEUTRAL = 1.0;

const BEATS: Record<UnitClass, UnitClass> = {
  infantry: 'cavalry',
  cavalry: 'ranged',
  ranged: 'mystic',
  mystic: 'infantry',
};

export const COUNTER: Record<UnitClass, Record<UnitClass, number>> = (() => {
  const m = {} as Record<UnitClass, Record<UnitClass, number>>;
  for (const a of UNIT_CLASSES) {
    m[a] = {} as Record<UnitClass, number>;
    for (const d of UNIT_CLASSES) {
      if (BEATS[a] === d) m[a][d] = FAVORABLE;        // a counters d
      else if (BEATS[d] === a) m[a][d] = UNFAVORABLE; // d counters a
      else m[a][d] = NEUTRAL;
    }
  }
  return m;
})();

/**
 * Class tag for every unit key (40 race units + generic fallbacks).
 *
 * Balanced so every race spans ≥3 classes (no race is locked into a single
 * counter), while leaning into race identity: Droben/Goblin tilt melee
 * (infantry/cavalry), Centaur tilts cavalry, Sidhe/Fae tilt mystic, Elven/
 * Dwarven tilt ranged/infantry defense.
 *
 * Tiers per race are [T0, T1, T2, T3]. Unknown keys default to 'infantry'
 * via classOf() — neutral-ish and never throws, so legacy data can't regress.
 */
export const UNIT_CLASS: Record<string, UnitClass> = {
  // Generic / fallback keys
  peasant: 'infantry', peasants: 'infantry',
  militia: 'infantry', infantry: 'infantry',
  archer: 'ranged', knight: 'cavalry', cavalry: 'cavalry', mage: 'mystic',
  scout: 'infantry', scouts: 'infantry',
  tier1: 'infantry', tier2: 'ranged', tier3: 'cavalry', tier4: 'mystic',

  // Human — balanced spread
  // peasants(generic) above; militia/knights/cavalry below
  knights: 'cavalry',

  // Elven — ranged/mystic specialists
  'elven-scouts': 'infantry', 'elven-warriors': 'infantry', 'elven-archers': 'ranged', 'elven-lords': 'mystic',

  // Goblin — melee swarm
  goblins: 'infantry', hobgoblins: 'infantry', kobolds: 'cavalry', 'goblin-riders': 'cavalry',

  // Droben — pure offense, melee/cavalry
  'droben-warriors': 'infantry', 'droben-berserkers': 'infantry', 'droben-bunar': 'cavalry', 'droben-champions': 'cavalry',

  // Vampire — defensive, mystic-leaning elites
  thralls: 'infantry', 'vampire-spawn': 'ranged', 'vampire-lords': 'mystic', 'ancient-vampires': 'mystic',

  // Elemental — ranged/mystic
  'earth-elementals': 'infantry', 'fire-elementals': 'ranged', 'water-elementals': 'mystic', 'air-elementals': 'mystic',

  // Centaur — cavalry specialists
  'centaur-scouts': 'cavalry', 'centaur-warriors': 'cavalry', 'centaur-archers': 'ranged', 'centaur-chiefs': 'cavalry',

  // Sidhe — mystic specialists
  'sidhe-nobles': 'infantry', 'sidhe-elders': 'ranged', 'sidhe-mages': 'mystic', 'sidhe-lords': 'mystic',

  // Dwarven — infantry/defense
  'dwarven-militia': 'infantry', 'dwarven-guards': 'infantry', 'dwarven-warriors': 'ranged', 'dwarven-lords': 'cavalry',

  // Fae — mystic/ranged
  'fae-sprites': 'infantry', 'fae-warriors': 'ranged', 'fae-nobles': 'mystic', 'fae-lords': 'mystic',
};

/** Class for a unit key — defaults to 'infantry' for unknown/legacy keys. */
export function classOf(unitType: string): UnitClass {
  return UNIT_CLASS[unitType] ?? UNIT_CLASS[unitType.toLowerCase()] ?? 'infantry';
}

/**
 * Aggregate per-class power pools for an army.
 * @param units    unit-key → count
 * @param power    unit-key → that unit's offense (or defense) value
 * Returns class → summed power.
 */
export function classPools(
  units: Record<string, number>,
  power: (unitType: string) => number,
): Record<UnitClass, number> {
  const pools: Record<UnitClass, number> = { infantry: 0, cavalry: 0, ranged: 0, mystic: 0 };
  for (const [type, count] of Object.entries(units)) {
    if (!count) continue;
    pools[classOf(type)] += power(type) * count;
  }
  return pools;
}

/**
 * Compute the attacker's COMPOSITION-ADJUSTED total offense against a defender.
 *
 * Each attacker class's offense pool is scaled by the weighted-average counter
 * multiplier against the defender's defensive class distribution:
 *
 *   defFrac[D] = defenderDefensePool[D] / totalDefenderDefense
 *   effOffense = Σ_A offensePool[A] · Σ_D defFrac[D]·COUNTER[A][D]
 *
 * Order-independent, no per-unit duels — fits the aggregate model. When the
 * defender has no units, returns the raw offense (no counter signal).
 *
 * @returns { effectiveOffense, rawOffense, multiplier } where multiplier =
 *          effectiveOffense / rawOffense (1.0 when neutral / no defender).
 */
export function compositionAdjustedOffense(
  attackerUnits: Record<string, number>,
  defenderUnits: Record<string, number>,
  offenseOf: (unitType: string) => number,
  defenseOf: (unitType: string) => number,
): { effectiveOffense: number; rawOffense: number; multiplier: number } {
  const offPools = classPools(attackerUnits, offenseOf);
  const rawOffense = UNIT_CLASSES.reduce((s, c) => s + offPools[c], 0);

  const defPools = classPools(defenderUnits, defenseOf);
  const totalDef = UNIT_CLASSES.reduce((s, c) => s + defPools[c], 0);

  if (rawOffense <= 0 || totalDef <= 0) {
    return { effectiveOffense: rawOffense, rawOffense, multiplier: 1.0 };
  }

  const defFrac = UNIT_CLASSES.reduce((acc, d) => {
    acc[d] = defPools[d] / totalDef;
    return acc;
  }, {} as Record<UnitClass, number>);

  let effectiveOffense = 0;
  for (const a of UNIT_CLASSES) {
    if (!offPools[a]) continue;
    let weighted = 0;
    for (const d of UNIT_CLASSES) weighted += defFrac[d] * COUNTER[a][d];
    effectiveOffense += offPools[a] * weighted;
  }

  return { effectiveOffense, rawOffense, multiplier: effectiveOffense / rawOffense };
}
