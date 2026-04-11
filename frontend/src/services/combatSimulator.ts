/**
 * Combat Simulator — client-side battle simulation for demo mode.
 * Extracted from combatStore to reduce file size.
 */

import { useKingdomStore, getKingdomAge } from '../stores/kingdomStore';
import type { AIKingdom } from '../stores/aiKingdomStore';
import { calculateCombatSummonTroops } from '../../../shared/mechanics/combat-mechanics';
import { isRacialAbilityActive } from '../../../shared/mechanics/age-mechanics';
import { RACES } from '../shared-races';
import { useSummonStore } from '../stores/useSummonStore';
import { TERRAIN_MODIFIERS, FORMATION_MODIFIERS, applyTerrainToUnitPower } from '../../../shared/combat/combatCache';
import { calculateGoldLoot, applyCasualtyRate } from '../utils/combatMechanics';
import type { Unit, Formation } from '../stores/formationStore';

export async function simulateBattle(
  attackerUnits: Unit[],
  defenderKingdom: AIKingdom,
  formation: Formation | null,
  activeFormationId?: string,
  defenderTerrainId?: string,
): Promise<{
  result: 'victory' | 'defeat' | 'draw';
  resultType?: 'with_ease' | 'good_fight' | 'failed';
  casualties: { attacker: Record<string, number>; defender: Record<string, number> };
  defenderUnits: Unit[];
  landGained?: number;
  resourcesGained?: Record<string, number>;
  notes?: string[];
}> {
  // Get attacker (player) race from summon store
  const attackerRace = useSummonStore.getState().currentRace || 'Human';
  const attackerRaceStats = RACES[attackerRace as keyof typeof RACES]?.stats;
  const attackerOffenseScale = attackerRaceStats ? attackerRaceStats.warOffense : 3;
  const attackerDefenseScale = attackerRaceStats ? attackerRaceStats.warDefense : 3;

  // Scale defender unit combat values by race stats (warOffense/warDefense are 1-5)
  const raceStats = RACES[defenderKingdom.race as keyof typeof RACES]?.stats;
  const offenseScale = raceStats ? raceStats.warOffense : 3;
  const defenseScale = raceStats ? raceStats.warDefense : 3;

  // Scale attacker units by player race stats
  const scaledAttackerUnits: Unit[] = attackerUnits.map(u => ({
    ...u,
    attack: u.attack * attackerOffenseScale,
    defense: u.defense * attackerDefenseScale,
  }));

  // Convert defender kingdom units to Unit format with race-scaled values
  const defenderUnits: Unit[] = [
    { id: 'def-tier1', type: 'peasant' as const, count: defenderKingdom.units.tier1, attack: 1 * offenseScale, defense: 1 * defenseScale, health: 10 },
    { id: 'def-tier2', type: 'militia' as const, count: defenderKingdom.units.tier2, attack: 2 * offenseScale, defense: 3 * defenseScale, health: 20 },
    { id: 'def-tier3', type: 'knight' as const, count: defenderKingdom.units.tier3, attack: 4 * offenseScale, defense: 4 * defenseScale, health: 40 },
    { id: 'def-tier4', type: 'cavalry' as const, count: defenderKingdom.units.tier4, attack: 5 * offenseScale, defense: 2 * defenseScale, health: 30 }
  ].filter(u => u.count > 0);

  // Goblin Kobold Rage: 1.5x bonus to T2 units during middle age
  // Try to get age from kingdom's ageStartTime stored in localStorage
  const kingdomId = useKingdomStore.getState().kingdomId;
  let currentAge: 'early' | 'middle' | 'late' = 'early';
  if (kingdomId) {
    const stored = localStorage.getItem(`kingdom-${kingdomId}-ageStartTime`);
    if (stored) {
      currentAge = getKingdomAge(stored).currentAge;
    }
  }

  // Apply Kobold Rage to attacker T2 units if attacker is Goblin
  if (attackerRace.toLowerCase() === 'goblin' && isRacialAbilityActive('goblin', 'kobold_rage', currentAge)) {
    scaledAttackerUnits.forEach(u => {
      if (u.type === 'militia') {
        u.attack *= 1.5;
        u.defense *= 1.5;
      }
    });
  }

  // Apply Kobold Rage to defender T2 units if defender is Goblin
  if (defenderKingdom.race.toLowerCase() === 'goblin' && isRacialAbilityActive('goblin', 'kobold_rage', currentAge)) {
    defenderUnits.forEach(u => {
      if (u.type === 'militia') {
        u.attack *= 1.5;
        u.defense *= 1.5;
      }
    });
  }

  // Elemental fort destruction: 25% bonus to structures destroyed on successful attacks
  const isElementalAttacker = attackerRace.toLowerCase() === 'elemental';

  // Cap: scaled attacker unit counts cannot exceed MAX_OFFENSE_MULTIPLIER × original counts
  const MAX_OFFENSE_MULTIPLIER = 2.5;
  scaledAttackerUnits.forEach(unit => {
    const originalUnit = attackerUnits.find(u => u.id === unit.id);
    if (originalUnit) {
      const cap = originalUnit.count * MAX_OFFENSE_MULTIPLIER;
      if (unit.count > cap) {
        unit.count = cap;
      }
    }
  });

  // ── Terrain & formation modifiers (parity with Lambda handler) ─────────────
  // Look up the shared FORMATION_MODIFIERS by the active formation ID (id field,
  // not the Formation object's bonuses which use a different scale).
  const formMods = activeFormationId ? (FORMATION_MODIFIERS[activeFormationId] ?? null) : null;

  // Formation offense multiplier applied to attacker power.
  // Falls back gracefully to the Formation.bonuses.attack percentage when the
  // formation ID is not in FORMATION_MODIFIERS.
  const formationOffenseBonus = formMods
    ? formMods.offense
    : (formation ? (formation.bonuses.attack / 100) : 0);
  const formationDefenseBonus = formMods
    ? formMods.defense
    : (formation ? (formation.bonuses.defense / 100) : 0);

  // Terrain modifiers for the defender's territory (default to plains = no mods)
  const normalizedTerrain = (defenderTerrainId ?? 'plains').toLowerCase();
  const terrainMods = TERRAIN_MODIFIERS[normalizedTerrain] ?? TERRAIN_MODIFIERS['plains'] ?? {};

  // Build attacker unit map (type → count) for terrain unit-class penalty calc
  const attackerUnitMap: Record<string, number> = {};
  scaledAttackerUnits.forEach(u => {
    attackerUnitMap[u.type] = (attackerUnitMap[u.type] ?? 0) + u.count;
  });

  // Raw power sums from race-scaled units
  const rawAttackerPower = scaledAttackerUnits.reduce((sum, u) => sum + (u.attack * u.count), 0);
  const rawDefenderPower = defenderUnits.reduce((sum, u) => sum + (u.defense * u.count), 0);

  // Compute the terrain modifier ratio for attacker offense:
  // applyTerrainToUnitPower uses shared UNIT_STATS internally. We derive a
  // class-weighted ratio (terrain-adjusted / un-adjusted) from those stats,
  // then apply that same ratio to the race-scaled power so the relative
  // unit-class penalties are preserved while absolute race scaling is kept.
  const terrainAttackerNoMod = applyTerrainToUnitPower(attackerUnitMap, 'attack', {});
  const terrainAttackerWithMod = applyTerrainToUnitPower(attackerUnitMap, 'attack', terrainMods);
  const terrainAttackerRatio = terrainAttackerNoMod > 0
    ? terrainAttackerWithMod / terrainAttackerNoMod
    : 1;

  // Terrain defense bonus: scale defender power by (1 + defense mod).
  // Unit-class modifiers in terrainMods (cavalry/infantry/siege) penalise the
  // attacker only, so only the top-level defense modifier applies to the defender.
  const terrainDefenseFactor = 1 + (terrainMods.defense ?? 0);

  // Final power values with terrain and formation applied (matches Lambda logic)
  const totalAttackerPower = rawAttackerPower * terrainAttackerRatio * (1 + formationOffenseBonus);
  const defenderPower = rawDefenderPower * terrainDefenseFactor;

  // Guard against division by zero when defender has no units
  const offenseRatio = defenderPower === 0 ? 999 : totalAttackerPower / defenderPower;

  // Determine result type based on reference mechanics
  let resultType: 'with_ease' | 'good_fight' | 'failed';
  let attackerCasualtyRate: number;
  let defenderCasualtyRate: number;

  if (offenseRatio >= 2.0) {
    // "With ease" - dominating victory
    resultType = 'with_ease';
    attackerCasualtyRate = 0.05;  // 5% losses
    defenderCasualtyRate = 0.20;  // 20% losses
  } else if (offenseRatio >= 1.2) {
    // "Good fight" - contested victory
    resultType = 'good_fight';
    attackerCasualtyRate = 0.15;  // 15% losses
    defenderCasualtyRate = 0.15;  // 15% losses
  } else {
    // "Failed" - attack failed
    resultType = 'failed';
    attackerCasualtyRate = 0.25;  // 25% losses
    defenderCasualtyRate = 0.05;  // 5% losses
  }

  // Apply formation defense bonus to reduce attacker casualties
  if (formationDefenseBonus > 0) {
    attackerCasualtyRate *= (1 - formationDefenseBonus);
  }

  // Map to UI result type
  const result: 'victory' | 'defeat' | 'draw' =
    resultType === 'with_ease' ? 'victory' :
    resultType === 'good_fight' ? 'victory' :
    'defeat';

  // Calculate actual casualties keyed by unit ID (not type) to avoid data loss
  // when multiple units share the same type
  const attackerCasualties: Record<string, number> = {};
  const defenderCasualties: Record<string, number> = {};

  scaledAttackerUnits.forEach(unit => {
    // Scouts/scum are espionage units — don't take combat casualties
    if (unit.type === 'scouts' || unit.type === 'elite_scouts') return;
    // Weight casualties by unit defense - tougher units take fewer losses
    const defenseModifier = Math.max(0.5, 1 - (unit.defense * 0.05));
    const casualties = applyCasualtyRate(unit.count, attackerCasualtyRate * defenseModifier);
    if (casualties > 0) {
      attackerCasualties[unit.type] = (attackerCasualties[unit.type] ?? 0) + casualties;
    }
  });

  defenderUnits.forEach(unit => {
    if (unit.type === 'scouts' || unit.type === 'elite_scouts') return;
    const defenseModifier = Math.max(0.5, 1 - (unit.defense * 0.05));
    const casualties = applyCasualtyRate(unit.count, defenderCasualtyRate * defenseModifier);
    if (casualties > 0) {
      defenderCasualties[unit.type] = (defenderCasualties[unit.type] ?? 0) + casualties;
    }
  });

  // Calculate land gained using defender's actual land (from reference)
  const defenderLand = defenderKingdom.resources.land;
  let landGained = 0;

  if (resultType === 'with_ease') {
    // 7.0-7.35% of target land (from combat-mechanics.ts)
    const landPercentage = 0.070 + (Math.random() * 0.0035);
    landGained = Math.floor(defenderLand * landPercentage);
  } else if (resultType === 'good_fight') {
    // 6.79-7.0% of target land (from combat-mechanics.ts)
    const landPercentage = 0.0679 + (Math.random() * 0.0021);
    landGained = Math.floor(defenderLand * landPercentage);
  }

  // Gold looted per acre gained (from reference)
  const goldGained = calculateGoldLoot(landGained);

  // Droben boosted summons: bonus troops after a successful attack
  const notes: string[] = [];

  // Elemental fort destruction bonus: +25% structures destroyed on non-defeat
  if (isElementalAttacker && result !== 'defeat') {
    notes.push('Elemental fort destruction: +25% bonus to structures destroyed');
  }

  if (result !== 'defeat' && attackerRace.toLowerCase() === 'droben') {
    const totalNetworth = defenderKingdom.networth || 0;
    const bonusTroops = calculateCombatSummonTroops('Droben', totalNetworth);
    if (bonusTroops > 0) {
      notes.push(`Droben combat summon: +${bonusTroops} bonus troops (3.04% summon rate)`);
    }
  }

  // Sidhe circle summoning: emergency temple creation on successful attacks
  if (attackerRace.toLowerCase() === 'sidhe' && result !== 'defeat') {
    notes.push('Sidhe circle summoning: emergency temple created in conquered territory');
  }

  return {
    result,
    resultType,
    casualties: { attacker: attackerCasualties, defender: defenderCasualties },
    defenderUnits,
    landGained,
    resourcesGained: goldGained > 0 ? { gold: goldGained } : {},
    notes: notes.length > 0 ? notes : undefined
  };
}
