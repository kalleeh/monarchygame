import type { Schema } from '../../data/resource';
import {
  getCasualtyRates,
  TERRAIN_MODIFIERS,
  FORMATION_MODIFIERS,
  applyTerrainToUnitPower,
  type TerrainModifiers
} from '../../../shared/combat/combatCache';
import { calculateCombatResult } from '../../../shared/mechanics/combat-mechanics';
import type { AttackForce, DefenseForce } from '../../../shared/mechanics/combat-mechanics';
import type { KingdomResources, CombatResultData } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbCreate, dbUpdate, dbAtomicAdd, dbQuery, parseJsonField } from '../data-client';
import { isRacialAbilityActive } from '../../../shared/mechanics/age-mechanics';
import { checkRateLimit } from '../rate-limiter';
import { verifyOwnership } from '../verify-ownership';

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
  'Vampire':   1.35,  // warDefense: 5 effective — fortress race, compensates for 2× building cost handicap
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
    const denied = verifyOwnership(identity, attacker.owner as string | null);
    if (denied) return denied;

    // Rate limit check
    const rateLimited = await checkRateLimit(identity.sub, 'combat');
    if (rateLimited) return rateLimited;

    // Targeted BattleReport queries — reused across alliance bonus, war check, and kill bounty
    let cachedDefenderReports: Array<{ id?: string; attackerId: string; defenderId: string; landGained?: number; timestamp?: string }> | null = null;
    let cachedAttackerReports: Array<{ id?: string; attackerId: string; defenderId: string; landGained?: number; timestamp?: string }> | null = null;

    const getDefenderReports = async () => {
      if (!cachedDefenderReports) {
        cachedDefenderReports = await dbQuery<{ id?: string; attackerId: string; defenderId: string; landGained?: number; timestamp?: string }>('BattleReport', 'battleReportsByDefenderIdAndTimestamp', { field: 'defenderId', value: defenderId });
      }
      return cachedDefenderReports;
    };

    const getAttackerReports = async () => {
      if (!cachedAttackerReports) {
        cachedAttackerReports = await dbQuery<{ id?: string; attackerId: string; defenderId: string; landGained?: number; timestamp?: string }>('BattleReport', 'battleReportsByAttackerIdAndDefenderId', { field: 'attackerId', value: attackerId });
      }
      return cachedAttackerReports;
    };

    // Alliance coordination bonus: +10% if an ally attacked this defender recently
    let allianceCoordBonus = 1.0;
    let attackerGuildId: string | undefined;
    try {
      const attackerKingdomData = await dbGet<{ guildId?: string }>('Kingdom', attackerId);
      attackerGuildId = attackerKingdomData?.guildId;
      const defenderKingdomData = await dbGet<{ guildId?: string }>('Kingdom', defenderId);
      if (attackerKingdomData?.guildId && attackerKingdomData.guildId !== defenderKingdomData?.guildId) {
        const recentBattles = await getDefenderReports();
        const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
        const allyRecentAttack = recentBattles.find(r =>
          r.defenderId === defenderId &&
          r.attackerId !== attackerId &&
          (r.timestamp ?? '') >= twentyMinAgo
        );
        if (allyRecentAttack) {
          // Verify the other attacker is in the same alliance
          const allyKingdom = await dbGet<{ guildId?: string }>('Kingdom', allyRecentAttack.attackerId);
          if (allyKingdom?.guildId === attackerKingdomData.guildId) {
            allianceCoordBonus = 1.10;
            log.info('combat-processor', 'alliance-coord-bonus', { attackerId, allianceBonus: '10%' });
          }
        }
      }
    } catch (err) {
      log.warn('combat-processor', 'alliance-coord-bonus-failed', { attackerId, defenderId, error: err instanceof Error ? err.message : String(err) });
    }

    // Check attacker restoration status — cannot attack while under restoration
    const allRestoration = await dbQuery<{ kingdomId: string; endTime: string; prohibitedActions?: string }>('RestorationStatus', 'restorationStatusesByKingdomIdAndEndTime', { field: 'kingdomId', value: attackerId });
    const attackerRestoration = allRestoration.find(r => new Date(r.endTime) > new Date());
    if (attackerRestoration) {
      const prohibited: string[] = parseJsonField<string[]>(attackerRestoration.prohibitedActions, []);
      if (prohibited.includes('attack')) {
        return { success: false, error: 'Kingdom is in restoration and cannot attack', errorCode: 'RESTORATION_ACTIVE' };
      }
    }

    const attackerUnits: Record<string, number> = parseJsonField<Record<string, number>>(units, {});
    const ownedUnits = parseJsonField<Record<string, number>>(attacker.totalUnits, {});

    // Validate that attacker has enough units
    for (const [unitType, count] of Object.entries(attackerUnits)) {
      if (count > (ownedUnits[unitType] ?? 0)) {
        return { success: false, error: `Insufficient ${unitType}: sending ${count}, but only have ${ownedUnits[unitType] ?? 0}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
      }
    }

    // Newbie protection: kingdoms < 72 hours old that are 3x+ smaller than attacker
    const defenderCreatedAt = new Date((defender.createdAt as string) ?? 0);
    const defenderAgeHours = (Date.now() - defenderCreatedAt.getTime()) / (1000 * 60 * 60);
    const _aRes = parseJsonField<KingdomResources>(attacker.resources, {} as KingdomResources);
    const _dRes = parseJsonField<KingdomResources>(defender.resources, {} as KingdomResources);
    const attackerNetworth = (_aRes.land ?? 100) * 1000 + (_aRes.gold ?? 0);
    const defenderNetworth = (_dRes.land ?? 100) * 1000 + (_dRes.gold ?? 0);
    if (defenderAgeHours < 72 && attackerNetworth > defenderNetworth * 3) {
      return { success: false, error: 'This kingdom is under new player protection (72 hours)', errorCode: 'NEWBIE_PROTECTION' };
    }

    // Check and deduct turns
    const attackerResources = parseJsonField<KingdomResources>(attacker.resources, {} as KingdomResources);
    const currentTurns = (attacker.turnsBalance ?? attackerResources.turns ?? 72) as number;
    const turnCost = 4;
    if (currentTurns < turnCost) {
      return { success: false, error: `Not enough turns. Need ${turnCost}, have ${currentTurns}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Enforce war declaration requirement for repeated attacks
    // After 3 attacks against the same defender (regardless of season), a formal WarDeclaration is required
    const allBattleReports = await getAttackerReports();
    const recentAttacks = allBattleReports.filter(
      (r: BattleReportType) => (r as any).defenderId === defenderId
    );
    const attackCount = recentAttacks.length;

    if (attackCount >= 3) {
      const attackerWars = await dbQuery<WarDeclarationType>(
        'WarDeclaration', 'attackerId', { field: 'attackerId', value: attackerId }
      );
      const activeWar = attackerWars.find(
        (w: WarDeclarationType) => w.defenderId === defenderId && w.status === 'active'
      );
      if (!activeWar) {
        return { success: false, error: 'You must declare war before attacking this kingdom again', errorCode: 'WAR_REQUIRED' };
      }

      // Increment attack count on the active war declaration
      await dbUpdate('WarDeclaration', activeWar.id, {
        attackCount: (activeWar.attackCount ?? 0) + 1
      });
    }

    const defenderResources = parseJsonField<KingdomResources>(defender.resources, {} as KingdomResources);
    const defenderUnits = parseJsonField<Record<string, number>>(defender.totalUnits, {});
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

    // Goblin Kobold Rage: +50% combat bonus in middle age
    const attackerRaceForAbility = (attacker.race as string) ?? 'Human';
    if (attackerRaceForAbility.toLowerCase() === 'goblin' && isRacialAbilityActive('goblin', 'kobold_rage', attackerAge as 'early' | 'middle' | 'late')) {
      effectiveAttackerUnits = Object.fromEntries(
        Object.entries(effectiveAttackerUnits).map(([k, v]) => [k, Math.floor(v * 1.5)])
      );
      log.info('combat-processor', 'kobold-rage-applied', { attackerId, bonus: 1.5 });
    }

    // -------------------------------------------------------------------------
    // Step 3: Read faith effects early so RACIAL_ABILITY_BOOST can influence
    // the race offense bonus below (Step 3 proper).
    // -------------------------------------------------------------------------
    let activeFaithEffects: Array<{ effectType: string; enhancedValue?: number; appliedAt?: string; duration?: number; expiresAt?: string }> = [];
    try {
      const statsObj = parseJsonField<Record<string, unknown>>(attacker.stats, {});
      activeFaithEffects = (statsObj.activeFaithEffects as Array<{ effectType: string; enhancedValue?: number; appliedAt?: string; duration?: number; expiresAt?: string }>) ?? [];
    } catch {
      // Handled below in Step 4a
    }

    // Faith effect: RACIAL_ABILITY_BOOST (+50% to racial ability bonuses)
    const racialBoostActive = activeFaithEffects.some(
      e => e.effectType === 'RACIAL_ABILITY_BOOST' && (e.expiresAt ?? '') > new Date().toISOString()
    );
    const racialBoostMult = racialBoostActive ? 1.5 : 1.0;

    // -------------------------------------------------------------------------
    // Step 3 (cont): Race offense bonus — applied multiplicatively after age bonus
    // -------------------------------------------------------------------------
    const attackerRace = attacker.race as string ?? 'Human';
    const raceOffenseBonus = (RACE_OFFENSE_BONUSES[attackerRace] ?? 1.0) * racialBoostMult;
    effectiveAttackerUnits = Object.fromEntries(
      Object.entries(effectiveAttackerUnits).map(([k, v]) => [k, Math.floor(v * raceOffenseBonus)])
    );

    // -------------------------------------------------------------------------
    // Step 4a: Combat Focus faith effect — applied after race/age bonuses
    // Kingdom stats may contain activeFaithEffects array set by faith-processor
    // -------------------------------------------------------------------------
    try {
      const combatFocusEffect = activeFaithEffects.find(e => e.effectType === 'COMBAT_FOCUS' || e.effectType === 'combat_focus');
      if (combatFocusEffect) {
        // Apply a 20% combat bonus from Combat Focus
        const focusBonus = 1.20;
        effectiveAttackerUnits = Object.fromEntries(
          Object.entries(effectiveAttackerUnits).map(([k, v]) => [k, Math.floor(v * focusBonus)])
        );
        log.info('combat-processor', 'combat-focus-applied', { attackerId, bonus: focusBonus });
      }
    } catch (err) {
      log.warn('combat-processor', 'faith-bonus-failed', { attackerId, error: err instanceof Error ? err.message : String(err) });
    }

    // -------------------------------------------------------------------------
    // Step 4b: Race defense bonus — scale defender unit counts before combat
    // -------------------------------------------------------------------------
    const defenderRace = defender.race as string ?? 'Human';
    const raceDefenseBonus = RACE_DEFENSE_BONUSES[defenderRace] ?? 1.0;
    let effectiveDefenderUnits = Object.fromEntries(
      Object.entries(defenderUnits).map(([k, v]) => [k, Math.floor((v as number) * raceDefenseBonus)])
    );

    // Apply defender's persistent defensive formation if set
    const defenderStats = parseJsonField<Record<string, unknown>>(defender.stats, {});
    const defFormationId = (defenderStats.defensiveFormation as string | undefined) ?? 'balanced';
    const defFormationMods = FORMATION_MODIFIERS[defFormationId] ?? FORMATION_MODIFIERS['balanced'];
    const defFormationDefenseFactor = 1 + defFormationMods.defense;
    if (defFormationDefenseFactor !== 1) {
      effectiveDefenderUnits = Object.fromEntries(
        Object.entries(effectiveDefenderUnits).map(([k, v]) => [k, Math.floor((v as number) * defFormationDefenseFactor)])
      );
    }

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
        const territories = await dbQuery<TerritoryType>('Territory', 'territoriesByKingdomIdAndCreatedAt', { field: 'kingdomId', value: defenderId });
        const capital = territories.find((t: TerritoryType) => t.type === 'capital') ?? territories[0];
        if (capital) {
          resolvedTerrainId = capital.terrainType ?? '';
        }
      } catch (err) {
        log.warn('combat-processor', 'terrain-lookup-failed', { defenderId, error: err instanceof Error ? err.message : String(err) });
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

    // Apply alliance coordination bonus (+10% offense) if an ally recently attacked
    if (allianceCoordBonus !== 1.0) {
      effectiveAttackerUnits = Object.fromEntries(
        Object.entries(effectiveAttackerUnits).map(([k, v]) => [k, Math.floor(v * allianceCoordBonus)])
      );
    }

    // Alliance composition combat bonus (+5% if full mage+warrior+scum roster)
    // Alliance upgrade combat bonuses (war_banner +5%, grand_assault +25%)
    try {
      if (attackerGuildId) {
        const allianceData = await dbGet<{ stats?: string }>('Alliance', attackerGuildId);
        if (allianceData?.stats) {
          const aStats = parseJsonField<Record<string, unknown>>(allianceData.stats, {});
          // Composition bonus
          const compositionBonus = aStats?.compositionBonus as Record<string, number> | undefined;
          const compCombat = compositionBonus?.combat ?? 1.0;
          if (compCombat !== 1.0) {
            effectiveAttackerUnits = Object.fromEntries(
              Object.entries(effectiveAttackerUnits).map(([k, v]) => [k, Math.floor(v * compCombat)])
            );
          }
          // Active upgrade bonuses
          const now = new Date().toISOString();
          const activeUpgrades = (aStats?.activeUpgrades ?? []) as Array<{ type: string; expiresAt: string; effect: Record<string, number> }>;
          for (const u of activeUpgrades.filter(x => x.expiresAt > now)) {
            const combatMult = u.effect.combatBonus ?? u.effect.coordBonus ?? 1.0;
            if (combatMult !== 1.0) {
              effectiveAttackerUnits = Object.fromEntries(
                Object.entries(effectiveAttackerUnits).map(([k, v]) => [k, Math.floor(v * combatMult)])
              );
            }
          }
        }
      }
    } catch (err) {
      log.warn('combat-processor', 'alliance-upgrade-bonus-failed', { attackerId, attackerGuildId, error: err instanceof Error ? err.message : String(err) });
    }

    // Defender alliance upgrade: fortification (+10% defense)
    try {
      const defenderGuildId = (defender as { guildId?: string | null }).guildId ?? null;
      if (defenderGuildId) {
        const defAllianceData = await dbGet<{ stats?: string }>('Alliance', defenderGuildId);
        if (defAllianceData?.stats) {
          const dStats = parseJsonField<Record<string, unknown>>(defAllianceData.stats, {});
          const now = new Date().toISOString();
          const defUpgrades = (dStats?.activeUpgrades ?? []) as Array<{ type: string; expiresAt: string; effect: Record<string, number> }>;
          for (const u of defUpgrades.filter(x => x.expiresAt > now)) {
            const defMult = u.effect.defenseBonus ?? 1.0;
            if (defMult !== 1.0) {
              effectiveDefenderUnits = Object.fromEntries(
                Object.entries(effectiveDefenderUnits).map(([k, v]) => [k, Math.floor(v * defMult)])
              );
            }
          }
        }
      }
    } catch (err) {
      log.warn('combat-processor', 'defender-upgrade-bonus-failed', { defenderId, error: String(err) });
    }

    // Cap: effective attacker units cannot exceed MAX_OFFENSE_MULTIPLIER × original units
    const MAX_OFFENSE_MULTIPLIER = 2.5;
    for (const [unitType, originalCount] of Object.entries(attackerUnits)) {
      const cap = Math.floor((originalCount as number) * MAX_OFFENSE_MULTIPLIER);
      if ((effectiveAttackerUnits[unitType] ?? 0) > cap) {
        effectiveAttackerUnits[unitType] = cap;
      }
    }

    // Cap: effective defender units cannot exceed MAX_DEFENSE_MULTIPLIER × original units
    const MAX_DEFENSE_MULTIPLIER = 2.5;
    for (const [unitType, originalCount] of Object.entries(defenderUnits)) {
      const cap = Math.floor((originalCount as number) * MAX_DEFENSE_MULTIPLIER);
      if ((effectiveDefenderUnits[unitType] ?? 0) > cap) {
        effectiveDefenderUnits[unitType] = cap;
      }
    }

    // Elven Remote Fog: if attacker has FOG_ACTIVE, reduce their effective units by 20%
    const attackerStatsForFog = (typeof attacker.stats === 'string' ? JSON.parse(attacker.stats as string) : (attacker.stats ?? {})) as Record<string, unknown>;
    const attackerFogEffects = (attackerStatsForFog.activeFaithEffects as Array<{ effectType: string; expiresAt?: string }>) ?? [];
    const nowForFog = new Date().toISOString();
    const hasFogActive = attackerFogEffects.some(e => e.effectType === 'FOG_ACTIVE' && (e.expiresAt ?? '') > nowForFog);
    if (hasFogActive) {
      const FOG_PENALTY = 0.80; // 20% reduction
      effectiveAttackerUnits = Object.fromEntries(
        Object.entries(effectiveAttackerUnits).map(([k, v]) => [k, Math.floor((v as number) * FOG_PENALTY)])
      );
    }

    // -------------------------------------------------------------------------
    // Step 6: Resolve combat using terrain-and-formation-adjusted unit counts
    // -------------------------------------------------------------------------

    // Unit stat tables for computing aggregate offense/defense totals
    const UNIT_OFFENSE: Record<string, number> = {
      peasant: 1, infantry: 3, cavalry: 5, archer: 4, knight: 6, mage: 3, scout: 2,
      tier1: 1, tier2: 3, tier3: 5, tier4: 7, militia: 2,
    };
    const UNIT_DEFENSE: Record<string, number> = {
      peasant: 1, infantry: 2, cavalry: 3, archer: 2, knight: 4, mage: 1, scout: 1,
      tier1: 1, tier2: 2, tier3: 3, tier4: 4, militia: 3,
    };

    const totalAttackerOffense = Object.entries(effectiveAttackerUnits).reduce(
      (sum, [type, count]) => sum + (UNIT_OFFENSE[type] ?? 2) * count, 0
    );
    const totalAttackerDefense = Object.entries(effectiveAttackerUnits).reduce(
      (sum, [type, count]) => sum + (UNIT_DEFENSE[type] ?? 1) * count, 0
    );
    const totalDefenderDefense = Object.entries(effectiveDefenderUnits).reduce(
      (sum, [type, count]) => sum + (UNIT_DEFENSE[type] ?? 1) * count, 0
    );

    const attackForce: AttackForce = {
      units: effectiveAttackerUnits,
      totalOffense: totalAttackerOffense,
      totalDefense: totalAttackerDefense,
    };
    const defenseForce: DefenseForce = {
      units: effectiveDefenderUnits,
      forts: 0,
      totalDefense: totalDefenderDefense,
      ambushActive: false,
    };

    const rawCombatResult = calculateCombatResult(attackForce, defenseForce, defenderLand);

    // Distribute flat losses across unit types proportionally
    const distributeCasualties = (units: Record<string, number>, totalLosses: number): Record<string, number> => {
      const totalUnits = Object.values(units).reduce((s, c) => s + c, 0);
      if (totalUnits === 0) return {};
      const result: Record<string, number> = {};
      let remaining = totalLosses;
      for (const [type, count] of Object.entries(units)) {
        const share = Math.floor((count / totalUnits) * totalLosses);
        const capped = Math.min(share, count);
        result[type] = capped;
        remaining -= capped;
      }
      const sorted = Object.entries(units).sort((a, b) => b[1] - a[1]);
      for (const [type] of sorted) {
        if (remaining <= 0) break;
        const canLose = Math.min(remaining, units[type] - (result[type] ?? 0));
        if (canLose > 0) { result[type] += canLose; remaining -= canLose; }
      }
      return result;
    };

    const combatResult: CombatResultData = {
      result: rawCombatResult.resultType,
      powerRatio: totalDefenderDefense > 0 ? totalAttackerOffense / totalDefenderDefense : 999,
      casualties: {
        attacker: distributeCasualties(effectiveAttackerUnits, rawCombatResult.attackerLosses),
        defender: distributeCasualties(effectiveDefenderUnits, rawCombatResult.defenderLosses),
      },
      landGained: rawCombatResult.landGained,
      goldLooted: rawCombatResult.goldLooted,
      success: rawCombatResult.success,
    };

    log.info('combat-processor', 'modifiers-applied', {
      terrainId: resolvedTerrainId || 'plains',
      formationId: formationId || 'none',
      formationOffenseFactor,
      defenseTerrainBonus,
    });

    // -------------------------------------------------------------------------
    // Attack type modifications: raid / pillage
    // Applied after combat calculations but before writing results to DB.
    // -------------------------------------------------------------------------
    let finalLandGained = combatResult.landGained;
    let extraGoldStolen = 0;
    let buildingDestroyed = false;

    if (combatResult.success) {
      if (attackType === 'raid') {
        // Raid: capture half the normal land, steal 5% of defender's gold
        finalLandGained = Math.floor(finalLandGained * 0.5);
        extraGoldStolen = Math.floor((defenderResources.gold ?? 0) * 0.05);
        // Reduce attacker casualties by 20%
        const attackerCasualtiesForRaid = combatResult.casualties?.attacker ?? {};
        for (const unitType of Object.keys(attackerCasualtiesForRaid)) {
          (combatResult.casualties as CombatResultData['casualties'])!.attacker[unitType] =
            Math.floor((attackerCasualtiesForRaid[unitType] ?? 0) * 0.8);
        }
        log.info('combat-processor', 'raid-applied', { attackerId, finalLandGained, extraGoldStolen });
      } else if (attackType === 'pillage') {
        // Pillage: no territory capture, steal 10% of defender's gold, destroy a building
        finalLandGained = 0;
        extraGoldStolen = Math.floor((defenderResources.gold ?? 0) * 0.10);
        // Destroy one random defender building
        const defenderBuildings = parseJsonField<Record<string, number>>(defender.buildings, {});
        const buildingKeys = Object.keys(defenderBuildings).filter(k => (defenderBuildings[k] ?? 0) > 0);
        if (buildingKeys.length > 0) {
          const randomKey = buildingKeys[Math.floor(Math.random() * buildingKeys.length)];
          defenderBuildings[randomKey] = (defenderBuildings[randomKey] ?? 1) - 1;
          defender.buildings = JSON.stringify(defenderBuildings);
          buildingDestroyed = true;
        }
        log.info('combat-processor', 'pillage-applied', { attackerId, extraGoldStolen, buildingDestroyed });
      } else if (attackType === 'siege') {
        // Siege: sustained assault — more land, more casualties, costs 3 turns total
        // Validate minimum unit count (siege requires organized force)
        const totalAttackerUnits = Object.values(attackerUnits).reduce((s, v) => s + (v as number), 0);
        if (totalAttackerUnits < 50) {
          return { success: false, error: 'Siege requires at least 50 units', errorCode: 'VALIDATION_FAILED' };
        }
        // Extra turn cost: 2 more turns (1 already deducted by the standard turn deduction)
        await dbAtomicAdd('Kingdom', attackerId, 'turnsBalance', -2);
        // Land bonus: +50% more land
        finalLandGained = Math.floor(finalLandGained * 1.5);
        // Casualty penalty: +30% attacker casualties (siege is costly)
        const casualties = combatResult.casualties as { attacker: Record<string, number>; defender: Record<string, number> };
        for (const unitType of Object.keys(casualties.attacker)) {
          casualties.attacker[unitType] = Math.ceil((casualties.attacker[unitType] ?? 0) * 1.3);
        }
        log.info('combat-processor', 'siege-applied', { attackerId, finalLandGained });
      }
    }

    const attackerKingdom = attacker;
    const defenderKingdom = defender;

    await dbCreate<BattleReportType>('BattleReport', {
      attackerId,
      defenderId,
      attackType: attackType || 'standard',
      result: JSON.stringify({
        result: combatResult.result,
        powerRatio: combatResult.powerRatio,
        landGained: finalLandGained,
        goldLooted: (combatResult.goldLooted ?? 0) + (extraGoldStolen ?? 0),
        buildingDestroyed: buildingDestroyed ?? false,
        // Replay data
        attackerUnits: attackerUnits,
        defenderUnits: defenderUnits,
        attackerName: (attackerKingdom as Record<string, unknown>).name ?? attackerId,
        defenderName: (defenderKingdom as Record<string, unknown>).name ?? defenderId,
      }),
      casualties: JSON.stringify(combatResult.casualties),
      landGained: finalLandGained,
      timestamp: new Date().toISOString(),
      owner: identity.sub
    });

    // Check if defender should enter restoration after severe damage
    const defenderPostLand = Math.max(1000, (defenderResources.land ?? 1000) - finalLandGained);
    const landLossPercent = finalLandGained / (defenderResources.land ?? 1000);

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

    // Combined kill bounty: notify alliance members who assisted in the last 24h
    if (combatResult.success && defenderPostLand <= 1000) {
      try {
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const allRecent = await getDefenderReports();
        const assists = allRecent.filter(r =>
          r.defenderId === defenderId &&
          r.attackerId !== attackerId &&
          (r.timestamp ?? '') >= last24h
        );
        const attackerGuild = (await dbGet<{ guildId?: string }>('Kingdom', attackerId))?.guildId;
        for (const assist of assists) {
          const assistGuild = (await dbGet<{ guildId?: string }>('Kingdom', assist.attackerId))?.guildId;
          if (attackerGuild && assistGuild === attackerGuild) {
            await dbCreate('CombatNotification', {
              recipientId: assist.attackerId,
              type: 'victory',
              message: `Assist bonus! A kingdom you weakened was finished off by your ally. You contributed to this kill.`,
              data: JSON.stringify({ defenderId, killerKingdomId: attackerId }),
              isRead: false,
              createdAt: new Date().toISOString(),
              owner: identity.sub,
            });
          }
        }
      } catch (err) {
        log.warn('combat-processor', 'kill-bounty-notification-failed', { attackerId, defenderId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Per-unit defense mitigation for defender casualties (higher defense = fewer casualties)
    // The shared calculateCombatResult applies a flat rate; we override the defender side here.
    const UNIT_DEFENSE_STATS: Record<string, number> = {
      peasant: 1, militia: 3, tier2: 2, tier3: 3, tier4: 4, knight: 4, cavalry: 3,
      infantry: 2, archer: 2, scout: 1, mage: 1, tier1: 1
    };
    const defenderCasualtyRate = (getCasualtyRates(combatResult.result) as { attacker: number; defender: number }).defender;
    const mitigatedDefenderCasualties: Record<string, number> = {};
    for (const [unitType, count] of Object.entries(effectiveDefenderUnits)) {
      const defStat = UNIT_DEFENSE_STATS[unitType] ?? 1;
      const defMitigation = Math.max(0.5, 1 - (defStat * 0.05));
      mitigatedDefenderCasualties[unitType] = Math.floor((count as number) * defenderCasualtyRate * defMitigation);
    }

    // Deduct casualties from both sides' units
    const casualties: CombatResultData['casualties'] = combatResult.casualties || { attacker: {}, defender: {} };
    const attackerCasualties = casualties.attacker || {};
    const defenderCasualties = mitigatedDefenderCasualties;

    const updatedAttackerUnits: Record<string, number> = { ...ownedUnits };
    for (const [unitType, lost] of Object.entries(attackerCasualties as Record<string, number>)) {
      updatedAttackerUnits[unitType] = Math.max(0, (updatedAttackerUnits[unitType] ?? 0) - lost);
    }

    const updatedDefenderUnits: Record<string, number> = { ...defenderUnits };
    for (const [unitType, lost] of Object.entries(defenderCasualties as Record<string, number>)) {
      updatedDefenderUnits[unitType] = Math.max(0, (updatedDefenderUnits[unitType] ?? 0) - lost);
    }

    // Droben summon: on successful attack, gain 5% of attacking units as bonus troops
    if (combatResult.success && attackerRace.toLowerCase() === 'droben') {
      const totalAttackerUnitsCount = Object.values(updatedAttackerUnits).reduce((sum, n) => sum + (n ?? 0), 0);
      const bonusTotal = Math.floor(totalAttackerUnitsCount * 0.05);
      if (bonusTotal > 0) {
        // Distribute proportionally across existing unit types
        const unitEntries = Object.entries(updatedAttackerUnits).filter(([, v]) => v > 0);
        if (unitEntries.length > 0) {
          let distributed = 0;
          for (let i = 0; i < unitEntries.length; i++) {
            const [uType, uCount] = unitEntries[i];
            const share = i === unitEntries.length - 1
              ? bonusTotal - distributed
              : Math.floor((uCount / totalAttackerUnitsCount) * bonusTotal);
            updatedAttackerUnits[uType] = (updatedAttackerUnits[uType] ?? 0) + share;
            distributed += share;
          }
          log.info('combat-processor', 'droben-summon', { attackerId, bonusTotal });
        }
      }
    }

    // Sidhe: emergency temple creation on successful attack
    let sidheBuildings: Record<string, number> | undefined;
    if (combatResult.success && attackerRace.toLowerCase() === 'sidhe') {
      const currentBuildings = parseJsonField<Record<string, number>>(attacker.buildings, {});
      sidheBuildings = { ...currentBuildings, temple: (currentBuildings.temple ?? 0) + 1 };
    }

    let degradedTerritoryName: string | null = null;
    if (combatResult.success && (finalLandGained > 0 || extraGoldStolen > 0)) {
      const defenderNewLand = Math.max(1000, (defenderResources.land ?? 1000) - finalLandGained);
      const defenderNewGold = Math.max(0, (defenderResources.gold ?? 0) - combatResult.goldLooted - extraGoldStolen);
      const defenderUnitsCount = Object.values(updatedDefenderUnits).reduce((s, n) => s + (n ?? 0), 0);
      const defenderNetworth = defenderNewLand * 1000 + defenderNewGold + defenderUnitsCount * 100;

      const attackerNewLand = (attackerResources.land ?? 1000) + finalLandGained;
      const attackerNewGold = (attackerResources.gold ?? 0) + combatResult.goldLooted + extraGoldStolen;
      const attackerUnitsCount = Object.values(updatedAttackerUnits).reduce((s, n) => s + (n ?? 0), 0);
      const attackerNetworth = attackerNewLand * 1000 + attackerNewGold + attackerUnitsCount * 100;

      await Promise.all([
        dbUpdate('Kingdom', defenderId, {
          resources: {
            ...defenderResources,
            land: defenderNewLand,
            gold: defenderNewGold,
          },
          totalUnits: updatedDefenderUnits,
          networth: defenderNetworth,
          ...(buildingDestroyed ? { buildings: defender.buildings } : {})
        }),
        dbUpdate('Kingdom', attackerId, {
          resources: {
            ...attackerResources,
            land: attackerNewLand,
            gold: attackerNewGold,
          },
          totalUnits: updatedAttackerUnits,
          networth: attackerNetworth,
          ...(sidheBuildings ? { buildings: JSON.stringify(sidheBuildings) } : {})
        })
      ]);

      // Territory degradation on attacker win (non-fatal) — skip for pillage (no land captured)
      if (finalLandGained > 0) try {
        const allTerrs = await dbQuery<{ id: string; kingdomId?: string; type?: string; name?: string; defenseLevel?: number }>(
          'Territory', 'kingdomId', { field: 'kingdomId', value: defenderId }
        );
        const defenderTerrs = allTerrs.filter(t => (t.defenseLevel ?? 0) > 0);
        // Exclude capital from degradation candidates
        const degradableTerrs = defenderTerrs.filter(t => t.type !== 'capital');
        if (degradableTerrs.length > 0) {
          const weakest = degradableTerrs.reduce((a, b) => (a.defenseLevel ?? 0) <= (b.defenseLevel ?? 0) ? a : b);
          // Elemental: +25% fort/structure destruction — degrade an extra level
          const elementalExtraLevel = attackerRace.toLowerCase() === 'elemental' ? 1 : 0;
          const newLevel = Math.max(0, (weakest.defenseLevel ?? 0) - 1 - elementalExtraLevel);
          await dbUpdate('Territory', weakest.id, { defenseLevel: newLevel });
          degradedTerritoryName = weakest.name ?? null;
          log.info('combat-processor', 'territory-degraded', { defenderId, territoryId: weakest.id, newLevel });
        }
      } catch (err) {
        log.warn('combat-processor', 'territory-degradation-failed', { defenderId, error: err instanceof Error ? err.message : String(err) });
      }

      // Transfer territory: find defender's least important territory and reassign to attacker — skip for pillage
      if (finalLandGained > 0) try {
        const defenderTerritories = await dbQuery<TerritoryType>('Territory', 'territoriesByKingdomIdAndCreatedAt', { field: 'kingdomId', value: defenderId });

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
      const attackerFailUnitsCount = Object.values(updatedAttackerUnits).reduce((s, n) => s + (n ?? 0), 0);
      const attackerFailNetworth = (attackerResources.land ?? 1000) * 1000 + (attackerResources.gold ?? 0) + attackerFailUnitsCount * 100;

      const defenderFailUnitsCount = Object.values(updatedDefenderUnits).reduce((s, n) => s + (n ?? 0), 0);
      const defenderFailNetworth = (defenderResources.land ?? 1000) * 1000 + (defenderResources.gold ?? 0) + defenderFailUnitsCount * 100;

      await Promise.all([
        dbUpdate('Kingdom', attackerId, {
          resources: {
            ...attackerResources,
          },
          totalUnits: updatedAttackerUnits,
          networth: attackerFailNetworth,
        }),
        dbUpdate('Kingdom', defenderId, {
          totalUnits: updatedDefenderUnits,
          networth: defenderFailNetworth,
        })
      ]);
    }

    // Deduct turns atomically after combat resolves (regardless of outcome)
    await dbAtomicAdd('Kingdom', attackerId, 'turnsBalance', -turnCost);

    log.info('combat-processor', 'processCombat', { attackerId, defenderId, attackType, result: combatResult.result });
    return {
      success: true,
      result: JSON.stringify({
        ...combatResult,
        landGained: finalLandGained,
        goldLooted: combatResult.goldLooted + extraGoldStolen,
        buildingDestroyed,
        degradedTerritory: degradedTerritoryName,
        message: `Combat ${combatResult.result}: ${finalLandGained} land gained, ${combatResult.goldLooted + extraGoldStolen} gold looted`
      })
    };
  } catch (error) {
    log.error('combat-processor', error, { attackerId, defenderId });
    return { success: false, error: error instanceof Error ? error.message : 'Combat processing failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
