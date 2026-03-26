import type { Schema } from '../../data/resource';
import {
  calculateCombatResult,
  getCasualtyRates,
  TERRAIN_MODIFIERS,
  FORMATION_MODIFIERS,
  applyTerrainToUnitPower,
  type TerrainModifiers
} from '../../../shared/combat/combatCache';
import type { KingdomResources, CombatResultData } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbCreate, dbUpdate, dbList, dbAtomicAdd, parseJsonField } from '../data-client';
import { isRacialAbilityActive } from '../../../shared/mechanics/age-mechanics';

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
    const attackerOwnerField = attacker.owner as string | null;
    const _attackerIds = [identity.sub ?? '', (identity as any).username ?? '',
      (identity as any).claims?.email ?? '', (identity as any).claims?.['preferred_username'] ?? '',
      (identity as any).claims?.['cognito:username'] ?? ''].filter(Boolean);
    if (!attackerOwnerField || !_attackerIds.some((id: string) => attackerOwnerField!.includes(id))) {
      return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
    }

    // Shared BattleReport scan — reused across alliance bonus, war check, and kill bounty
    let cachedBattleReports: Array<{ id?: string; attackerId: string; defenderId: string; landGained?: number; timestamp?: string }> | null = null;

    const getBattleReports = async () => {
      if (!cachedBattleReports) {
        cachedBattleReports = await dbList<{ id?: string; attackerId: string; defenderId: string; landGained?: number; timestamp?: string }>('BattleReport');
      }
      return cachedBattleReports;
    };

    // Alliance coordination bonus: +10% if an ally attacked this defender recently
    let allianceCoordBonus = 1.0;
    let attackerGuildId: string | undefined;
    try {
      const attackerKingdomData = await dbGet<{ guildId?: string }>('Kingdom', attackerId);
      attackerGuildId = attackerKingdomData?.guildId;
      const defenderKingdomData = await dbGet<{ guildId?: string }>('Kingdom', defenderId);
      if (attackerKingdomData?.guildId && attackerKingdomData.guildId !== defenderKingdomData?.guildId) {
        const recentBattles = await getBattleReports();
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
    const allRestoration = await dbList<{ kingdomId: string; endTime: string; prohibitedActions?: string }>('RestorationStatus');
    const attackerRestoration = allRestoration.find(r => r.kingdomId === attackerId && new Date(r.endTime) > new Date());
    if (attackerRestoration) {
      const prohibited: string[] = parseJsonField<string[]>(attackerRestoration.prohibitedActions, []);
      if (prohibited.includes('attack')) {
        return JSON.stringify({ success: false, error: 'Kingdom is in restoration and cannot attack', errorCode: 'RESTORATION_ACTIVE' });
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
      return JSON.stringify({ success: false, error: 'This kingdom is under new player protection (72 hours)', errorCode: 'NEWBIE_PROTECTION' });
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
    const allBattleReports = await getBattleReports();
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
      const statsObj = parseJsonField<Record<string, unknown>>(attacker.stats, {});
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
        const allTerritories = await dbList<TerritoryType>('Territory');
        const territories = allTerritories.filter(t => t.kingdomId === defenderId);
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
      timestamp: new Date().toISOString(),
      owner: identity.sub
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

    // Combined kill bounty: notify alliance members who assisted in the last 24h
    if (combatResult.success && defenderPostLand <= 1000) {
      try {
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const allRecent = await getBattleReports();
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

    let degradedTerritoryName: string | null = null;
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
          },
          totalUnits: updatedAttackerUnits
        })
      ]);

      // Territory degradation on attacker win (non-fatal)
      try {
        const allTerrs = await dbList<{ id: string; kingdomId?: string; type?: string; name?: string; defenseLevel?: number }>('Territory');
        const defenderTerrs = allTerrs.filter(t => t.kingdomId === defenderId && (t.defenseLevel ?? 0) > 0);
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
          },
          totalUnits: updatedAttackerUnits
        }),
        dbUpdate('Kingdom', defenderId, {
          totalUnits: updatedDefenderUnits
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
        degradedTerritory: degradedTerritoryName,
        message: `Combat ${combatResult.result}: ${combatResult.landGained} land gained, ${combatResult.goldLooted} gold looted`
      })
    };
  } catch (error) {
    log.error('combat-processor', error, { attackerId, defenderId });
    return { success: false, error: error instanceof Error ? error.message : 'Combat processing failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
