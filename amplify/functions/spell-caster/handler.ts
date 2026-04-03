import type { Schema } from '../../data/resource';
import type { KingdomResources } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbUpdate, dbQuery, parseJsonField } from '../data-client';
import { verifyOwnership } from '../verify-ownership';
import { checkRateLimit } from '../rate-limiter';

const SPELL_ELAN_COSTS: Record<string, number> = {
  calming_chant: 5,        // No damage, cheapest
  rousing_wind: 10,        // Shield removal, tier 1
  shattering_calm: 15,     // Shield removal, tier 1
  hurricane: 20,           // Structure damage, tier 2
  lightning_lance: 25,     // Fort damage, tier 2
  banshee_deluge: 25,      // Structure damage, tier 2
  foul_light: 30,          // Peasant kill, tier 3
  remote_fog: 20,          // Elven only: FOG_ACTIVE debuff on target
};

// Spell damage definitions duplicated here because Lambda functions cannot import
// browser-targeted frontend modules. When updating spell values, also update:
// frontend/src/shared-spells/index.ts
// Values are approximate averages across races from frontend/src/shared-spells/index.ts
const SPELL_DAMAGE: Record<string, { type: string; damage: number }> = {
  calming_chant: { type: 'none', damage: 0 },
  rousing_wind: { type: 'shield_removal', damage: 0 },
  shattering_calm: { type: 'shield_removal', damage: 0 },
  hurricane: { type: 'structure_damage', damage: 0.05 },
  lightning_lance: { type: 'fort_damage', damage: 0.09 },
  banshee_deluge: { type: 'structure_damage', damage: 0.05 },
  foul_light: { type: 'peasant_kill', damage: 0.06 },
  remote_fog: { type: 'fog', damage: 0 },
};

// Offensive spells by name — require diplomatic/restoration/newbie-protection checks
const OFFENSIVE_SPELL_TYPES = new Set(['rousing_wind', 'shattering_calm', 'hurricane', 'lightning_lance', 'banshee_deluge', 'foul_light']);

type KingdomType = Record<string, unknown>;

export const handler: Schema["castSpell"]["functionHandler"] = async (event) => {
  const { casterId, spellId, targetId } = event.arguments;

  try {
    if (!casterId || !spellId) {
      return { success: false, error: 'Missing required parameters: casterId, spellId', errorCode: ErrorCode.MISSING_PARAMS };
    }

    if (typeof spellId !== 'string' || spellId.length > 64) {
      return { success: false, error: 'Invalid spellId format', errorCode: ErrorCode.INVALID_PARAM };
    }

    const validSpells = ['calming_chant', 'rousing_wind', 'shattering_calm', 'hurricane', 'lightning_lance', 'banshee_deluge', 'foul_light', 'remote_fog'];
    if (!validSpells.includes(spellId)) {
      return { success: false, error: `Invalid spell. Must be one of: ${validSpells.join(', ')}`, errorCode: ErrorCode.INVALID_PARAM };
    }

    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }

    // BL-1: Fetch caster first (precondition check before any resource deduction)
    const casterKingdom = await dbGet<KingdomType>('Kingdom', casterId);

    if (!casterKingdom) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    // Verify kingdom ownership
    const denied = verifyOwnership(identity, (casterKingdom.owner as string | null) ?? null);
    if (denied) return denied;

    // Rate limit check
    const rateLimited = checkRateLimit(identity.sub, 'spell');
    if (rateLimited) return rateLimited;

    // Elven-only: remote_fog
    if (spellId === 'remote_fog') {
      const casterRaceCheck = (casterKingdom.race as string | undefined) ?? '';
      if (casterRaceCheck.toLowerCase() !== 'elven') {
        return { success: false, error: 'Only Elven kingdoms can cast Remote Fog', errorCode: ErrorCode.FORBIDDEN };
      }
    }

    // Check diplomatic ally protection for offensive spells
    if (targetId && OFFENSIVE_SPELL_TYPES.has(spellId)) {
      const allRelations = await dbQuery<{ kingdomId: string; targetKingdomId: string; status: string }>('DiplomaticRelation', 'kingdomId', { field: 'kingdomId', value: casterId });
      const isDiplomaticAlly = allRelations.some(r =>
        ((r.kingdomId === casterId && r.targetKingdomId === targetId) ||
         (r.kingdomId === targetId && r.targetKingdomId === casterId)) &&
        r.status === 'allied'
      );
      if (isDiplomaticAlly) {
        return { success: false, error: 'Cannot cast offensive spells on diplomatic allies', errorCode: ErrorCode.FORBIDDEN };
      }
    }

    const resources = parseJsonField<KingdomResources>(casterKingdom.resources, {} as KingdomResources);
    const currentElan = resources.elan ?? 0;

    // Faith effect: SPELL_POWER_BOOST (+30% spell damage)
    const casterStats = parseJsonField<Record<string, unknown>>(casterKingdom.stats, {});
    const activeFaithEffects = parseJsonField<Array<{ effectType: string; expiresAt: string }>>(
      (typeof casterStats.activeFaithEffects === 'string' ? casterStats.activeFaithEffects : (casterStats.activeFaithEffects ?? [])) as string | unknown[],
      []
    );
    const nowIso = new Date().toISOString();
    const spellPowerMult = (Array.isArray(activeFaithEffects) ? activeFaithEffects : []).some(
      (e: { effectType: string; expiresAt: string }) => e.effectType === 'SPELL_POWER_BOOST' && e.expiresAt > nowIso
    ) ? 1.3 : 1.0;

    const spellElanCost = SPELL_ELAN_COSTS[spellId] ?? 20;
    if (currentElan < spellElanCost) {
      return { success: false, error: `Insufficient elan: need ${spellElanCost}, have ${currentElan}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Check turns (precondition, before deduction)
    const currentTurns = resources.turns ?? 72;
    const turnCost = 1;
    if (currentTurns < turnCost) {
      return { success: false, error: `Not enough turns. Need ${turnCost}, have ${currentTurns}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // SEC-2: Diplomatic/restoration/newbie checks for offensive spells
    const spellEffect = SPELL_DAMAGE[spellId];
    const isOffensiveSpell = spellEffect && OFFENSIVE_SPELL_TYPES.has(spellEffect.type);

    let targetKingdom: KingdomType | null = null;
    if (targetId) {
      targetKingdom = await dbGet<KingdomType>('Kingdom', targetId);
      if (!targetKingdom) {
        return { success: false, error: 'Target kingdom not found', errorCode: ErrorCode.NOT_FOUND };
      }

      if (isOffensiveSpell) {
        // SEC-2a: Restoration/encampment check
        const encampEndTime = targetKingdom.encampEndTime as string | null | undefined;
        if (encampEndTime && new Date(encampEndTime) > new Date()) {
          return { success: false, error: 'Cannot target a kingdom in restoration', errorCode: ErrorCode.FORBIDDEN };
        }

        // SEC-2b: Allied kingdom check (same non-null guildId)
        const casterGuildId = casterKingdom.guildId as string | null | undefined;
        const targetGuildId = targetKingdom.guildId as string | null | undefined;
        if (casterGuildId && casterGuildId === targetGuildId) {
          return { success: false, error: 'Cannot cast offensive spells on allied kingdoms', errorCode: ErrorCode.FORBIDDEN };
        }

        // SEC-2c: Newbie protection (target created less than 24 hours ago)
        const targetCreatedAt = targetKingdom.createdAt as string | null | undefined;
        if (targetCreatedAt) {
          const ageHours = (Date.now() - new Date(targetCreatedAt).getTime()) / (1000 * 60 * 60);
          if (ageHours < 24) {
            return { success: false, error: 'Cannot target newly created kingdoms', errorCode: ErrorCode.FORBIDDEN };
          }
        }
      }
    }

    // BL-1: All preconditions passed — now deduct elan and turns
    const updatedResources: KingdomResources = {
      ...resources,
      elan: currentElan - spellElanCost,
      turns: Math.max(0, currentTurns - turnCost)
    };

    await dbUpdate('Kingdom', casterId, {
      resources: updatedResources
    });

    // --- Apply spell effects to target ---
    let damageReport: Record<string, unknown> = {};

    if (targetId && spellEffect && spellEffect.type !== 'none' && spellEffect.type !== 'shield_removal') {
      // BL-1: targetKingdom was already fetched above; re-fetch only if it wasn't (no target ID path)
      const resolvedTarget = targetKingdom ?? await dbGet<KingdomType>('Kingdom', targetId);
      if (!resolvedTarget) {
        // Elan already spent but target disappeared — still return success with warning
        return { success: true, result: JSON.stringify({ spellId, targetId, elanUsed: spellElanCost, remainingElan: updatedResources.elan, warning: 'Target kingdom not found, elan spent' }) };
      }

      try {
        if (spellEffect.type === 'structure_damage') {
          // BL-2/BL-3: Use parseJsonField for buildings
          const targetBuildings = parseJsonField<Record<string, number>>(resolvedTarget.buildings, {});
          const damagedBuildings: Record<string, number> = {};
          let totalDestroyed = 0;

          for (const [buildingType, count] of Object.entries(targetBuildings)) {
            if (typeof count === 'number' && count > 0) {
              const destroyed = Math.floor(count * spellEffect.damage * spellPowerMult);
              damagedBuildings[buildingType] = count - destroyed;
              totalDestroyed += destroyed;
            } else {
              damagedBuildings[buildingType] = count;
            }
          }

          await dbUpdate('Kingdom', targetId, {
            buildings: damagedBuildings
          });

          damageReport = { type: 'structure_damage', totalDestroyed };

        } else if (spellEffect.type === 'fort_damage') {
          // BL-2/BL-3: Use parseJsonField for buildings
          const targetBuildings = parseJsonField<Record<string, number>>(resolvedTarget.buildings, {});
          const damagedBuildings = { ...targetBuildings };
          let totalDestroyed = 0;

          // Target fort-type buildings: wall and forts
          for (const fortKey of ['wall', 'forts']) {
            const count = damagedBuildings[fortKey];
            if (typeof count === 'number' && count > 0) {
              const destroyed = Math.floor(count * spellEffect.damage * spellPowerMult);
              damagedBuildings[fortKey] = count - destroyed;
              totalDestroyed += destroyed;
            }
          }

          await dbUpdate('Kingdom', targetId, {
            buildings: damagedBuildings
          });

          damageReport = { type: 'fort_damage', totalDestroyed };

        } else if (spellEffect.type === 'peasant_kill') {
          // BL-2/BL-3: Use parseJsonField for resources
          const targetResources = parseJsonField<KingdomResources>(resolvedTarget.resources, {} as KingdomResources);
          const currentPop = targetResources.population ?? 0;
          const killed = Math.floor(currentPop * spellEffect.damage * spellPowerMult);
          const updatedTargetResources: KingdomResources = {
            ...targetResources,
            population: currentPop - killed
          };

          await dbUpdate('Kingdom', targetId, {
            resources: updatedTargetResources
          });

          damageReport = { type: 'peasant_kill', killed };

        } else if (spellEffect.type === 'fog') {
          // Apply FOG_ACTIVE debuff to target's activeFaithEffects (12-hour duration)
          const targetStats = parseJsonField<Record<string, unknown>>(resolvedTarget.stats, {});
          const existingEffects = (targetStats.activeFaithEffects as Array<Record<string, string>>) ?? [];
          const now = new Date().toISOString();
          const activeEffects = existingEffects.filter(e => e.expiresAt > now);
          const fogEffect = {
            effectType: 'FOG_ACTIVE',
            appliedAt: now,
            expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          };
          const updatedTargetStats = { ...targetStats, activeFaithEffects: [...activeEffects, fogEffect] };
          await dbUpdate('Kingdom', targetId, { stats: JSON.stringify(updatedTargetStats) });
          damageReport = { type: 'fog', applied: true };
        }
      } catch (effectError) {
        log.warn('spell-caster', 'spell-effect-failed-after-elan-deducted', { spellId, targetId, error: effectError instanceof Error ? effectError.message : String(effectError) });
      }
    }

    // Vampire Elan Drain: drain 10% of spell cost from target's elan on offensive spells
    const casterRace = (casterKingdom.race as string | undefined) ?? '';
    if (casterRace.toLowerCase() === 'vampire' && targetId && OFFENSIVE_SPELL_TYPES.has(spellId)) {
      try {
        const targetKingdomForDrain = await dbGet<KingdomType>('Kingdom', targetId);
        if (targetKingdomForDrain) {
          const targetResourcesForDrain = (typeof targetKingdomForDrain.resources === 'string' ? JSON.parse(targetKingdomForDrain.resources) : (targetKingdomForDrain.resources ?? {})) as KingdomResources;
          const drainAmount = Math.ceil(spellElanCost * 0.1);
          const targetNewElan = Math.max(0, (targetResourcesForDrain.elan ?? 0) - drainAmount);
          await dbUpdate('Kingdom', targetId, {
            resources: JSON.stringify({ ...targetResourcesForDrain, elan: targetNewElan })
          });
          log.info('spell-caster', 'vampire-elan-drain', { casterId, targetId, drainAmount });
        }
      } catch { /* non-fatal */ }
    }

    log.info('spell-caster', 'castSpell', { casterId, spellId, targetId });
    return { success: true, result: JSON.stringify({ spellId, targetId, elanUsed: spellElanCost, remainingElan: updatedResources.elan, damageReport }) };
  } catch (error) {
    log.error('spell-caster', error, { casterId, spellId });
    return { success: false, error: error instanceof Error ? error.message : 'Spell casting failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
