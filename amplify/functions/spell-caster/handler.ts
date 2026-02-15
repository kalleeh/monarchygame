import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';

// Initialize client outside handler for connection reuse
const client = generateClient<Schema>();

// Simplified spell damage definitions (can't import shared-spells from Lambda)
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

    // --- Apply spell effects to target ---
    const spellEffect = SPELL_DAMAGE[spellId];
    let damageReport: Record<string, unknown> = {};

    if (targetId && spellEffect && spellEffect.type !== 'none' && spellEffect.type !== 'shield_removal') {
      const targetData = await client.models.Kingdom.get({ id: targetId });
      if (targetData.data) {
        const target = targetData.data;

        if (spellEffect.type === 'structure_damage') {
          const buildings = (target.buildings as Record<string, number>) || {};
          let totalDestroyed = 0;
          for (const [key, count] of Object.entries(buildings)) {
            if (typeof count === 'number' && count > 0) {
              const destroyed = Math.floor(count * spellEffect.damage);
              buildings[key] = count - destroyed;
              totalDestroyed += destroyed;
            }
          }
          await client.models.Kingdom.update({ id: targetId, buildings });
          damageReport = { type: 'structure_damage', totalDestroyed };

        } else if (spellEffect.type === 'fort_damage') {
          const buildings = (target.buildings as Record<string, number>) || {};
          let totalDestroyed = 0;
          for (const fortKey of ['wall', 'forts']) {
            const count = buildings[fortKey];
            if (typeof count === 'number' && count > 0) {
              const destroyed = Math.floor(count * spellEffect.damage);
              buildings[fortKey] = count - destroyed;
              totalDestroyed += destroyed;
            }
          }
          await client.models.Kingdom.update({ id: targetId, buildings });
          damageReport = { type: 'fort_damage', totalDestroyed };

        } else if (spellEffect.type === 'peasant_kill') {
          const targetResources = (target.resources as any) || {};
          const currentPop = targetResources.population || 0;
          const killed = Math.floor(currentPop * spellEffect.damage);
          targetResources.population = currentPop - killed;
          await client.models.Kingdom.update({ id: targetId, resources: targetResources });
          damageReport = { type: 'peasant_kill', killed };
        }
      }
    }

    return { success: true, result: JSON.stringify({ spellId, manaUsed: 50, damageReport }) };
  } catch (error) {
    console.error('Spell error:', error);
    return { success: false, error: 'Spell failed' };
  }
};
