import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import type { KingdomResources } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { configureAmplify } from '../amplify-configure';

const MANA_COST_PER_SPELL = 50;

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
};

export const handler: Schema["castSpell"]["functionHandler"] = async (event) => {
  await configureAmplify();
  const client = generateClient<Schema>({ authMode: 'iam' });
  const { casterId, spellId, targetId } = event.arguments;

  try {
    if (!casterId || !spellId) {
      return { success: false, error: 'Missing required parameters: casterId, spellId', errorCode: ErrorCode.MISSING_PARAMS };
    }

    if (typeof spellId !== 'string' || spellId.length > 64) {
      return { success: false, error: 'Invalid spellId format', errorCode: ErrorCode.INVALID_PARAM };
    }

    const validSpells = ['calming_chant', 'rousing_wind', 'shattering_calm', 'hurricane', 'lightning_lance', 'banshee_deluge', 'foul_light'];
    if (!validSpells.includes(spellId)) {
      return { success: false, error: `Invalid spell. Must be one of: ${validSpells.join(', ')}`, errorCode: ErrorCode.INVALID_PARAM };
    }

    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }

    if (targetId) {
      const targetResult = await client.models.Kingdom.get({ id: targetId });
      if (!targetResult.data) {
        return { success: false, error: 'Target kingdom not found', errorCode: ErrorCode.NOT_FOUND };
      }
    }

    const result = await client.models.Kingdom.get({ id: casterId });

    if (!result.data) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    // Verify kingdom ownership
    const ownerField = (result.data as any).owner as string | null;
    if (!ownerField || (!ownerField.includes(identity.sub) && !ownerField.includes(identity.username ?? ''))) {
      return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
    }

    const resources = (result.data.resources ?? {}) as KingdomResources;
    const currentMana = resources.mana ?? 0;

    if (currentMana < MANA_COST_PER_SPELL) {
      return { success: false, error: `Insufficient mana: need ${MANA_COST_PER_SPELL}, have ${currentMana}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Check and deduct turns
    const currentTurns = resources.turns ?? 72;
    const turnCost = 1;
    if (currentTurns < turnCost) {
      return { success: false, error: `Not enough turns. Need ${turnCost}, have ${currentTurns}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    const updatedResources: KingdomResources = {
      ...resources,
      mana: currentMana - MANA_COST_PER_SPELL,
      turns: Math.max(0, currentTurns - turnCost)
    };

    await client.models.Kingdom.update({
      id: casterId,
      resources: updatedResources
    });

    // --- Apply spell effects to target ---
    const spellEffect = SPELL_DAMAGE[spellId];
    let damageReport: Record<string, unknown> = {};

    if (targetId && spellEffect && spellEffect.type !== 'none' && spellEffect.type !== 'shield_removal') {
      const targetResult = await client.models.Kingdom.get({ id: targetId });
      if (!targetResult.data) {
        // Mana already spent but target disappeared — still return success with warning
        return { success: true, result: JSON.stringify({ spellId, targetId, manaUsed: MANA_COST_PER_SPELL, remainingMana: updatedResources.mana, warning: 'Target kingdom not found, mana spent' }) };
      }

      const targetKingdom = targetResult.data;

      if (spellEffect.type === 'structure_damage') {
        // Reduce all building counts by damage percentage
        const targetBuildings = (targetKingdom.buildings ?? {}) as Record<string, number>;
        const damagedBuildings: Record<string, number> = {};
        let totalDestroyed = 0;

        for (const [buildingType, count] of Object.entries(targetBuildings)) {
          if (typeof count === 'number' && count > 0) {
            const destroyed = Math.floor(count * spellEffect.damage);
            damagedBuildings[buildingType] = count - destroyed;
            totalDestroyed += destroyed;
          } else {
            damagedBuildings[buildingType] = count;
          }
        }

        await client.models.Kingdom.update({
          id: targetId,
          buildings: damagedBuildings
        });

        damageReport = { type: 'structure_damage', totalDestroyed };

      } else if (spellEffect.type === 'fort_damage') {
        // Reduce forts/walls specifically by damage percentage
        const targetBuildings = (targetKingdom.buildings ?? {}) as Record<string, number>;
        const damagedBuildings = { ...targetBuildings };
        let totalDestroyed = 0;

        // Target fort-type buildings: wall and forts
        for (const fortKey of ['wall', 'forts']) {
          const count = damagedBuildings[fortKey];
          if (typeof count === 'number' && count > 0) {
            const destroyed = Math.floor(count * spellEffect.damage);
            damagedBuildings[fortKey] = count - destroyed;
            totalDestroyed += destroyed;
          }
        }

        await client.models.Kingdom.update({
          id: targetId,
          buildings: damagedBuildings
        });

        damageReport = { type: 'fort_damage', totalDestroyed };

      } else if (spellEffect.type === 'peasant_kill') {
        // Reduce population by damage percentage
        const targetResources = (targetKingdom.resources ?? {}) as KingdomResources;
        const currentPop = targetResources.population ?? 0;
        const killed = Math.floor(currentPop * spellEffect.damage);
        const updatedTargetResources: KingdomResources = {
          ...targetResources,
          population: currentPop - killed
        };

        await client.models.Kingdom.update({
          id: targetId,
          resources: updatedTargetResources
        });

        damageReport = { type: 'peasant_kill', killed };
      }
    }

    log.info('spell-caster', 'castSpell', { casterId, spellId, targetId });
    return { success: true, result: JSON.stringify({ spellId, targetId, manaUsed: MANA_COST_PER_SPELL, remainingMana: updatedResources.mana, damageReport }) };
  } catch (error) {
    log.error('spell-caster', error, { casterId, spellId });
    return { success: false, error: 'Spell casting failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
