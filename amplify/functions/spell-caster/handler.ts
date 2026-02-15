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

    const validSpells = ['calming_chant', 'rousing_wind', 'shattering_calm', 'hurricane', 'lightning_lance', 'banshee_deluge', 'foul_light'];
    if (!validSpells.includes(spellId)) {
      return { success: false, error: `Invalid spell. Must be one of: ${validSpells.join(', ')}` };
    }

    if (targetId) {
      const targetResult = await client.models.Kingdom.get({ id: targetId });
      if (!targetResult.data) {
        return { success: false, error: 'Target kingdom not found' };
      }
    }

    const result = await client.models.Kingdom.get({ id: casterId });

    if (!result.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    const kingdom = result.data;
    const resources = kingdom.resources as any || {};
    
    // Mana cost per spell: 50 (keep in sync with frontend gameConfig.ts if added there)
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
