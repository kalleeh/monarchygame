import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import type { KingdomResources } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';

const MANA_COST_PER_SPELL = 50;

const client = generateClient<Schema>();

export const handler: Schema["castSpell"]["functionHandler"] = async (event) => {
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

    const resources = (result.data.resources ?? {}) as KingdomResources;
    const currentMana = resources.mana ?? 0;

    if (currentMana < MANA_COST_PER_SPELL) {
      return { success: false, error: `Insufficient mana: need ${MANA_COST_PER_SPELL}, have ${currentMana}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    const updatedResources: KingdomResources = {
      ...resources,
      mana: currentMana - MANA_COST_PER_SPELL
    };

    await client.models.Kingdom.update({
      id: casterId,
      resources: updatedResources
    });

    return { success: true, result: JSON.stringify({ spellId, targetId, manaUsed: MANA_COST_PER_SPELL, remainingMana: updatedResources.mana }) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Spell casting error:', { casterId, spellId, error: message });
    return { success: false, error: 'Spell casting failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
