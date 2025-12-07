import type { Schema } from '../../data/resource';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';

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

    // TODO: Validate mana cost and apply spell effects from shared/spells
    // For now, just return success
    return { success: true, result: JSON.stringify({ cast: true, spellId }) };
  } catch (error) {
    console.error('Spell casting error:', error);
    return { success: false, error: 'Spell casting failed' };
  }
};
