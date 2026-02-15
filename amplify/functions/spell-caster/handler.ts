import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';

// Initialize client outside handler for connection reuse
const client = generateClient<Schema>();

export const handler: Schema["castSpell"]["functionHandler"] = async (event) => {
  const { casterId, spellId, targetId } = event.arguments;

  try {
    if (!casterId || !spellId) {
      return { success: false, error: 'Missing parameters' };
    }

    const result = await client.models.Kingdom.get({ id: casterId });

    if (!result.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    const kingdom = result.data;
    const resources = kingdom.resources as any || {};
    
    if ((resources.mana || 0) < 50) {
      return { success: false, error: 'Insufficient mana' };
    }

    resources.mana -= 50;

    await client.models.Kingdom.update({
      id: casterId,
      resources
    });

    return { success: true, result: JSON.stringify({ spellId, manaUsed: 50 }) };
  } catch (error) {
    console.error('Spell error:', error);
    return { success: false, error: 'Spell failed' };
  }
};
