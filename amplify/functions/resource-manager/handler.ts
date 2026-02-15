import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import type { KingdomResources } from '../../../shared/types/kingdom';

/** Safely parse an Amplify JSON field into the expected type, or return a fallback. */
function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

// Input validation constants
const VALIDATION_RULES = {
  RESOURCE_LIMITS: {
    gold: { min: 0, max: 1000000 },
    population: { min: 0, max: 100000 },
    mana: { min: 0, max: 50000 },
    land: { min: 1000, max: 100000 }
  }
} as const;

// Initialize client outside handler for connection reuse
const client = generateClient<Schema>();

export const handler: Schema["updateResources"]["functionHandler"] = async (event) => {
  const { kingdomId } = event.arguments;

  try {
    if (!kingdomId) {
      return { success: false, error: 'Missing kingdomId' };
    }

    const result = await client.models.Kingdom.get({ id: kingdomId });

    if (!result.data) {
      return { success: false, error: 'Kingdom not found' };
    }

    const kingdom = result.data;
    const resources = parseJsonField<KingdomResources>(kingdom.resources, { gold: 0, population: 0, mana: 0, land: 1000 });

    // Validate current resources are within limits
    const currentGold = resources.gold || 0;
    const currentPop = resources.population || 0;
    const currentMana = resources.mana || 0;
    const currentLand = resources.land || 1000;

    // Simple resource generation with validation
    const updated = {
      gold: Math.min(currentGold + 100, VALIDATION_RULES.RESOURCE_LIMITS.gold.max),
      land: Math.max(currentLand, VALIDATION_RULES.RESOURCE_LIMITS.land.min),
      population: Math.min(currentPop + 10, VALIDATION_RULES.RESOURCE_LIMITS.population.max),
      mana: Math.min(currentMana + 50, VALIDATION_RULES.RESOURCE_LIMITS.mana.max)
    };

    await client.models.Kingdom.update({
      id: kingdomId,
      resources: updated
    });

    return { success: true, resources: JSON.stringify(updated) };
  } catch (error) {
    console.error('Resource update error:', error);
    return { success: false, error: 'Update failed' };
  }
};
