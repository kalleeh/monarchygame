import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import type { KingdomResources } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';

const RESOURCE_LIMITS = {
  gold: { min: 0, max: 1000000 },
  population: { min: 0, max: 100000 },
  mana: { min: 0, max: 50000 },
  land: { min: 1000, max: 100000 }
} as const;

const client = generateClient<Schema>();

export const handler: Schema["updateResources"]["functionHandler"] = async (event) => {
  const { kingdomId } = event.arguments;

  try {
    if (!kingdomId) {
      return { success: false, error: 'Missing kingdomId', errorCode: ErrorCode.MISSING_PARAMS };
    }

    if (typeof kingdomId !== 'string' || kingdomId.length > 128) {
      return { success: false, error: 'Invalid kingdomId format', errorCode: ErrorCode.INVALID_PARAM };
    }

    const result = await client.models.Kingdom.get({ id: kingdomId });

    if (!result.data) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    const resources = (result.data.resources ?? {}) as KingdomResources;

    const currentGold = resources.gold ?? 0;
    const currentPop = resources.population ?? 0;
    const currentMana = resources.mana ?? 0;
    const currentLand = resources.land ?? 1000;

    const updated: KingdomResources = {
      gold: Math.min(currentGold + 100, RESOURCE_LIMITS.gold.max),
      land: Math.max(currentLand, RESOURCE_LIMITS.land.min),
      population: Math.min(currentPop + 10, RESOURCE_LIMITS.population.max),
      mana: Math.min(currentMana + 50, RESOURCE_LIMITS.mana.max)
    };

    await client.models.Kingdom.update({
      id: kingdomId,
      resources: updated
    });

    return { success: true, resources: JSON.stringify(updated) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Resource update error:', { kingdomId, error: message });
    return { success: false, error: 'Resource update failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
