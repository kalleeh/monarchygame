import type { Schema } from '../../data/resource';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';
import { getSpell } from '@shared/spells';

export const handler: Schema["castSpell"]["functionHandler"] = async (event) => {
  const { casterId, spellId, targetId } = event.arguments;

  try {
    if (!casterId || !spellId) {
      return { success: false, error: 'Missing required parameters' };
    }

    const config = await getAmplifyDataClientConfig(process.env);
    const client = generateClient<Schema>({ config });

    const casterResult = await client.models.Kingdom.get({ id: casterId });
    if (!casterResult.data) {
      return { success: false, error: 'Caster kingdom not found' };
    }

    const spell = getSpell(spellId);
    if (!spell) {
      return { success: false, error: 'Invalid spell' };
    }

    const caster = casterResult.data;
    const currentMana = (caster.resources as any)?.mana || 0;

    if (currentMana < spell.cost.mana) {
      return { success: false, error: 'Insufficient mana' };
    }

    // Deduct mana cost
    const resources = caster.resources as any;
    resources.mana = currentMana - spell.cost.mana;

    await client.models.Kingdom.update({
      id: casterId,
      resources: resources
    });

    return { success: true, result: JSON.stringify({ cast: true, spellId, manaCost: spell.cost.mana }) };
  } catch (error) {
    console.error('Spell casting error:', error);
    return { success: false, error: 'Spell casting failed' };
  }
};
