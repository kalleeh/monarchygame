import type { Schema } from '../../data/resource';
import {
  calculateCombatResult,
  TERRAIN_MODIFIERS,
  FORMATION_MODIFIERS,
  applyTerrainToUnitPower,
  type TerrainModifiers
} from '../../../shared/combat/combatCache';
import type { KingdomResources, CombatResultData } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbCreate, dbUpdate, dbList } from '../data-client';

// Race offensive combat bonuses (based on warOffense stat 1-5)
const RACE_OFFENSE_BONUSES: Record<string, number> = {
  'Droben':    1.20,  // warOffense: 5 — elite warriors, +20% offense
  'Goblin':    1.10,  // warOffense: 4 — aggressive fighters, +10% offense
  'Elemental': 1.10,  // warOffense: 4 — fighter-mage hybrid
  'Human':     1.05,  // warOffense: 3 — balanced
  'Centaur':   1.05,  // warOffense: 3 — moderate offense
  'Sidhe':     1.00,  // warOffense: 2 — sorcerers, standard
  'Elven':     1.00,  // warOffense: 2 — standard
  'Vampire':   1.05,  // warOffense: 3 — moderate offense
  'Fae':       1.00,  // warOffense: 2 — standard
  'Dwarven':   1.05,  // warOffense: 3 — moderate, fortress breakers
};

// Race defensive combat bonuses (based on warDefense stat 1-5)
const RACE_DEFENSE_BONUSES: Record<string, number> = {
  'Dwarven':   1.20,  // warDefense: 5 — fortress defenders, +20% defense
  'Elven':     1.10,  // warDefense: 4 — defensive specialists
  'Vampire':   1.10,  // warDefense: 4 — resilient
  'Human':     1.05,  // warDefense: 3 — balanced
  'Fae':       1.05,  // warDefense: 3 — moderate defense
  'Goblin':    1.00,  // warDefense: 2 — glass cannon
  'Droben':    1.05,  // warDefense: 3 — tough but offensive-focused
  'Elemental': 1.05,  // warDefense: 3 — moderate
  'Centaur':   1.00,  // warDefense: 2 — low defense
  'Sidhe':     1.00,  // warDefense: 2 — fragile
};

type KingdomType = Record<string, unknown>;
type BattleReportType = Record<string, unknown>;
type TerritoryType = { id: string; kingdomId?: string; type?: string; defenseLevel?: number; terrainType?: string };
type WarDeclarationType = { id: string; attackerId?: string; defenderId?: string; status?: string; attackCount?: number };

export const handler: Schema["processCombat"]["functionHandler"] = async (event) => {
  const { attackerId, defenderId, attackType, units, formationId, terrainId } = event.arguments;

  try {
    if (!attackerId || !defenderId) {
      return { success: false, error: 'Missing attacker or defender ID', errorCode: ErrorCode.MISSING_PARAMS };
    }

    if (attackerId === defenderId) {
      return { success: false, error: 'Cannot attack your own kingdom', errorCode: ErrorCode.INVALID_PARAM };
    }

    if (!units) {
      return { success: false, error: 'No units specified for attack', errorCode: ErrorCode.MISSING_PARAMS };
    }

    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }

    const [attacker, defender] = await Promise.all([
      dbGet<KingdomType>('Kingdom', attackerId),
      dbGet<KingdomType>('Kingdom', defenderId)
    ]);

    if (!attacker) {
      return { success: false, error: 'Attacker kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }
    if (!defender) {
      return { success: false, error: 'Defender kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    // Verify kingdom ownership (attacker only)
    const attackerOwnerField = attacker.owner as string | null;
    if (!attackerOwnerField || (!attackerOwnerField.includes(identity.sub) && !attackerOwnerField.includes(identity.username ?? ''))) {
      return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
    }

    const attackerUnits: Record<string, number> = typeof units === 'string' ? JSON.parse(units) : units;
    const ownedUnits = (attacker.totalUnits ?? {}) as Record<string, number>;

    // Validate that attacker has enough units
    for (const [unitType, count] of Object.entries(attackerUnits)) {
      if (count > (ownedUnits[unitType] ?? 0)) {
        return { success: false, error: `Insufficient ${unitType}: sending ${count}, but only have ${ownedUnits[unitType] ?? 0}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
      }
    }

    // Check and deduct turns
    const attackerResources = (attacker.resources ?? {}) as KingdomResources;
    const currentTurns = attackerResources.turns ?? 72;
    const turnCost = 4;
    if (currentTurns < turnCost) {
      return { success: false, error: `Not enough turns. Need ${turnCost}, have ${currentTurns}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Enforce war declaration requirement for repeated attacks
    // After 3 attacks against the same defender (regardless of season), a formal WarDeclaration is required
    const allBattleReports = await dbList<BattleReportType>('BattleReport');
    const recentAttacks = allBattleReports.filter(
      (r: BattleReportType) => (r as any).attackerId === attackerId && (r as any).defenderId === defenderId
    );
    const attackCount = recentAttacks.length;

    if (attackCount >= 3) {
      const allWars = await dbList<WarDeclarationType>('WarDeclaration');
      const activeWar = allWars.find(
        (w: WarDeclarationType) => w.attackerId === attackerId && w.defenderId === defenderId && w.status === 'active'
      );
      if (!activeWar) {
        return JSON.stringify({ success: false, error: 'You must declare war before attacking this kingdom again', errorCode: 'WAR_REQUIRED' });
      }

      // Increment attack count on the active war declaration
      await dbUpdate('WarDeclaration', activeWar.id, {
        attackCount: (activeWar.attackCount ?? 0) + 1
      });
    }

    const defenderResources = (defender.resources ?? {}) as KingdomResources;
    const defenderUnits = (defender.totalUnits ?? {}) as Record<string, number>;
    const defenderLand = defenderResources.land ?? 1000;

    // -------------------------------------------------------------------------
    // Step 1: Resolve the formation modifiers for the attacker.
    // formationId may be the id string ('defensive-wall'), the enum value
    // ('DEFENSIVE_WALL'), or a legacy key ('aggressive', 'standard', etc.).
    // -------------------------------------------------------------------------
    const formationMods = formationId
      ? (FORMATION_MODIFIERS[formationId] ?? FORMATION_MODIFIERS['standard'])
      : FORMATION_MODIFIERS['standard'];

    // Apply formation offense modifier to attacker unit counts
    let effectiveAttackerUnits: Record<string, number> = {};
    const formationOffenseFactor = 1 + formationMods.offense;
    for (const [unitType, count] of Object.entries(attackerUnits)) {
      effectiveAttackerUnits[unitType] = count * formationOffenseFactor;
    }

    // -------------------------------------------------------------------------
    // Step 2: Age combat bonus — more experienced kingdoms fight better in later ages
    // -------------------------------------------------------------------------
    const AGE_COMBAT_BONUSES: Record<string, number> = {
      'early': 1.0,
      'middle': 1.05,   // 5% combat bonus
      'late': 1.10,     // 10% combat bonus
    };
    const attackerAge = (attacker.currentAge as string) ?? 'early';
    const ageCombatBonus = AGE_COMBAT_BONUSES[attackerAge] ?? 1.0;
    effectiveAttackerUnits = Object.fromEntries(
      Object.entries(effectiveAttackerUnits).map(([k, v]) => [k, Math.floor(v * ageCombatBonus)])
    );

    // -------------------------------------------------------------------------
    // Step 3: Race offense bonus — applied multiplicatively after age bonus
    // -------------------------------------------------------------------------
    const attackerRace = attacker.race as string ?? 'Human';
    const raceOffenseBonus = RACE_OFFENSE_BONUSES[attackerRace] ?? 1.0;
    effectiveAttackerUnits = Object.fromEntries(
      Object.entries(effectiveAttackerUnits).map(([k, v]) => [k, Math.floor(v * raceOffenseBonus)])
    );

    // -------------------------------------------------------------------------
    // Step 4a: Combat Focus faith effect — applied after race/age bonuses
    // Kingdom stats may contain activeFaithEffects array set by faith-processor
    // -------------------------------------------------------------------------
    try {
      const statsObj = typeof attacker.stats === 'string'
        ? JSON.parse(attacker.stats as string) as Record<string, unknown>
        : ((attacker.stats ?? {}) as Record<string, unknown>);
      const activeEffects = (statsObj.activeFaithEffects as Array<{ effectType: string; enhancedValue?: number; appliedAt?: string; duration?: number }>) ?? [];
      const combatFocusEffect = activeEffects.find(e => e.effectType === 'COMBAT_FOCUS' || e.effectType === 'combat_focus');
      if (combatFocusEffect) {
        // Apply a 20% combat bonus from Combat Focus
        const focusBonus = 1.20;
        effectiveAttackerUnits = Object.fromEntries(
          Object.entries(effectiveAttackerUnits).map(([k, v]) => [k, Math.floor(v * focusBonus)])
        );
        log.info('combat-processor', 'combat-focus-applied', { attackerId, bonus: focusBonus });
      }
    } catch {
      // Non-fatal — skip faith bonus if stats parsing fails
    }

    // -------------------------------------------------------------------------
    // Step 4b: Race defense bonus — scale defender unit counts before combat
    // -------------------------------------------------------------------------
    const defenderRace = defender.race as string ?? 'Human';
    const raceDefenseBonus = RACE_DEFENSE_BONUSES[defenderRace] ?? 1.0;
    let effectiveDefenderUnits = Object.fromEntries(
      Object.entries(defenderUnits).map(([k, v]) => [k, Math.floor((v as number) * raceDefenseBonus)])
    );

    // -------------------------------------------------------------------------
    // Step 5: Terrain modifiers.
    // The defender always fights on their home terrain.  We resolve the terrain
    // in order of precedence:
    //   a) terrainId passed explicitly in the request (caller can derive this
    //      from the target territory's stored terrainType)
    //   b) The terrainType on the defender's capital/first territory (fetched below)
    //   c) Default to 'plains' (no modifier)
    //
    // The attacker fights on that same terrain (they are the invader).
    // Terrain modifiers therefore affect both sides symmetrically via the same
    // terrain table, except the 'defense' key — which only boosts the defender's
    // effective units (home-field defensive advantage).
    // -------------------------------------------------------------------------
    let resolvedTerrainId: string = (terrainId as string | undefined | null) ?? '';

    if (!resolvedTerrainId) {
      // Attempt to read terrain from the defender's first non-capital territory
      try {
        const allTerritories = await dbList<TerritoryType>('Territory');
        const territories = allTerritories.filter(t => t.kingdomId === defenderId);
        const capital = territories.find((t: TerritoryType) => t.type === 'capital') ?? territories[0];
        if (capital) {
          resolvedTerrainId = capital.terrainType ?? '';
        }
      } catch {
        // Non-fatal — terrain lookup is a best-effort enhancement
      }
    }

    const terrainMods: TerrainModifiers =
      TERRAIN_MODIFIERS[resolvedTerrainId] ??
      TERRAIN_MODIFIERS[resolvedTerrainId.toLowerCase()] ??
      {}; // plains / no modifier

    // --- Apply terrain to DEFENDER (home-field advantage) ---
    // The 'defense' modifier boosts defender effective unit counts.
    // The 'cavalry' / 'infantry' / 'siege' modifiers apply per unit class.
    // The 'offense' modifier (swamp) also penalises the attacker below.
    const defenseTerrainBonus = 1 + (terrainMods.defense ?? 0);
    if (defenseTerrainBonus !== 1) {
      // Simple approach: scale all defender units by the defense terrain bonus.
      // Per-class modifiers (cavalry, infantry, siege) are applied via
      // applyTerrainToUnitPower when computing power ratios.
      effectiveDefenderUnits = Object.fromEntries(
        Object.entries(effectiveDefenderUnits).map(([k, v]) => [
          k,
          Math.floor(v * defenseTerrainBonus)
        ])
      );
    }

    // --- Apply terrain offense/unit-class penalty to ATTACKER ---
    // Swamp gives offense: -0.15 globally; desert gives cavalry +0.15 / infantry -0.1.
    // We use applyTerrainToUnitPower to compute the true effective attacker power,
    // then derive a scalar to rescale effectiveAttackerUnits proportionally.
    const rawAttackerPower = Object.entries(effectiveAttackerUnits).reduce((sum, [type, cnt]) => {
      // Use UNIT_STATS-based power (attack value) — mirrors combatCache logic
      const UNIT_STATS_LOCAL: Record<string, { attack: number; defense: number }> = {
        peasant: { attack: 1, defense: 1 },
        infantry: { attack: 3, defense: 2 },
        cavalry: { attack: 5, defense: 3 },
        archer: { attack: 4, defense: 2 },
        knight: { attack: 6, defense: 4 },
        mage: { attack: 3, defense: 1 },
        scout: { attack: 2, defense: 1 },
        tier1: { attack: 1, defense: 1 },
        tier2: { attack: 3, defense: 2 },
        tier3: { attack: 5, defense: 3 },
        tier4: { attack: 7, defense: 4 },
        militia: { attack: 2, defense: 3 },
      };
      const stats = UNIT_STATS_LOCAL[type] ?? { attack: 2, defense: 2 };
      return sum + stats.attack * cnt;
    }, 0);

    const terrainAdjustedAttackerPower = applyTerrainToUnitPower(
      effectiveAttackerUnits,
      'attack',
      { ...terrainMods, defense: 0 } // strip defense key — only applies to defender
    );

    // Scale attacker units proportionally by the terrain power adjustment ratio
    if (rawAttackerPower > 0 && terrainAdjustedAttackerPower !== rawAttackerPower) {
      const terrainAttackerRatio = terrainAdjustedAttackerPower / rawAttackerPower;
      effectiveAttackerUnits = Object.fromEntries(
        Object.entries(effectiveAttackerUnits).map(([k, v]) => [
          k,
          Math.floor(v * terrainAttackerRatio)
        ])
      );
    }

    // -------------------------------------------------------------------------
    // Step 6: Resolve combat using terrain-and-formation-adjusted unit counts
    // -------------------------------------------------------------------------
    const combatResult = calculateCombatResult(
      effectiveAttackerUnits,
      effectiveDefenderUnits,
      defenderLand
    ) as CombatResultData;

    log.info('combat-processor', 'modifiers-applied', {
      terrainId: resolvedTerrainId || 'plains',
      formationId: formationId || 'none',
      formationOffenseFactor,
      defenseTerrainBonus,
    });

    await dbCreate<BattleReportType>('BattleReport', {
      attackerId,
      defenderId,
      attackType: attackType || 'standard',
      result: JSON.stringify({
        result: combatResult.result,
        powerRatio: combatResult.powerRatio,
        landGained: combatResult.landGained,
        goldLooted: combatResult.goldLooted
      }),
      casualties: JSON.stringify(combatResult.casualties),
      landGained: combatResult.landGained,
      timestamp: new Date().toISOString()
    });

    // Check if defender should enter restoration after severe damage
    const defenderPostLand = Math.max(1000, (defenderResources.land ?? 1000) - combatResult.landGained);
    const landLossPercent = combatResult.landGained / (defenderResources.land ?? 1000);

    if (landLossPercent >= 0.5 || defenderPostLand <= 1000) {
      // Trigger restoration for severely damaged defender
      const restorationType = defenderPostLand <= 1000 ? 'death_based' : 'damage_based';
      const durationHours = restorationType === 'death_based' ? 72 : 48;
      const endTime = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

      await dbCreate<Record<string, unknown>>('RestorationStatus', {
        kingdomId: defenderId,
        type: restorationType,
        startTime: new Date().toISOString(),
        endTime,
        allowedActions: JSON.stringify(['view', 'message', 'diplomacy']),
        prohibitedActions: JSON.stringify(['attack', 'trade', 'build', 'train'])
      });
    }

    // Deduct casualties from both sides' units
    const casualties: CombatResultData['casualties'] = combatResult.casualties || { attacker: {}, defender: {} };
    const attackerCasualties = casualties.attacker || {};
    const defenderCasualties = casualties.defender || {};

    const updatedAttackerUnits: Record<string, number> = { ...ownedUnits };
    for (const [unitType, lost] of Object.entries(attackerCasualties as Record<string, number>)) {
      updatedAttackerUnits[unitType] = Math.max(0, (updatedAttackerUnits[unitType] ?? 0) - lost);
    }

    const updatedDefenderUnits: Record<string, number> = { ...defenderUnits };
    for (const [unitType, lost] of Object.entries(defenderCasualties as Record<string, number>)) {
      updatedDefenderUnits[unitType] = Math.max(0, (updatedDefenderUnits[unitType] ?? 0) - lost);
    }

    if (combatResult.success && combatResult.landGained > 0) {
      await Promise.all([
        dbUpdate('Kingdom', defenderId, {
          resources: {
            ...defenderResources,
            land: Math.max(1000, (defenderResources.land ?? 1000) - combatResult.landGained),
            gold: Math.max(0, (defenderResources.gold ?? 0) - combatResult.goldLooted)
          },
          totalUnits: updatedDefenderUnits
        }),
        dbUpdate('Kingdom', attackerId, {
          resources: {
            ...attackerResources,
            land: (attackerResources.land ?? 1000) + combatResult.landGained,
            gold: (attackerResources.gold ?? 0) + combatResult.goldLooted,
            turns: Math.max(0, currentTurns - turnCost)
          },
          totalUnits: updatedAttackerUnits
        })
      ]);

      // Transfer territory: find defender's least important territory and reassign to attacker
      try {
        const allTerritories = await dbList<TerritoryType>('Territory');
        const defenderTerritories = allTerritories.filter(t => t.kingdomId === defenderId);

        // Sort by defense level ascending (take least developed first), never take the capital
        const sorted = defenderTerritories
          .filter((t: TerritoryType) => t.type !== 'capital')
          .sort((a: TerritoryType, b: TerritoryType) =>
            (a.defenseLevel ?? 0) - (b.defenseLevel ?? 0)
          );

        if (sorted.length > 0) {
          const toTransfer = sorted[0];
          await dbUpdate('Territory', toTransfer.id, {
            kingdomId: attackerId,
          });
          log.info('combat-processor', 'territory-transferred', {
            territoryId: toTransfer.id,
            from: defenderId,
            to: attackerId
          });
        }
      } catch (err) {
        log.warn('combat-processor', 'territory-transfer-failed', { err });
        // Non-fatal
      }
    } else {
      // Even if combat was not successful, still deduct casualties and turns
      await Promise.all([
        dbUpdate('Kingdom', attackerId, {
          resources: {
            ...attackerResources,
            turns: Math.max(0, currentTurns - turnCost)
          },
          totalUnits: updatedAttackerUnits
        }),
        dbUpdate('Kingdom', defenderId, {
          totalUnits: updatedDefenderUnits
        })
      ]);
    }

    log.info('combat-processor', 'processCombat', { attackerId, defenderId, attackType, result: combatResult.result });
    return {
      success: true,
      result: JSON.stringify({
        ...combatResult,
        message: `Combat ${combatResult.result}: ${combatResult.landGained} land gained, ${combatResult.goldLooted} gold looted`
      })
    };
  } catch (error) {
    log.error('combat-processor', error, { attackerId, defenderId });
    return { success: false, error: 'Combat processing failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
