import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import type { KingdomBuildings, KingdomResources } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { configureAmplify } from '../amplify-configure';

const VALID_BUILDING_TYPES = ['castle', 'barracks', 'farm', 'mine', 'temple', 'tower', 'wall'] as const;
type BuildingType = typeof VALID_BUILDING_TYPES[number];

const BUILDING_QUANTITY = { min: 1, max: 100 } as const;

configureAmplify();
const client = generateClient<Schema>({ authMode: 'iam' });

export const handler: Schema["constructBuildings"]["functionHandler"] = async (event) => {
  const { kingdomId, buildingType, quantity } = event.arguments;

  try {
    if (!kingdomId || !buildingType || quantity === undefined || quantity === null) {
      return { success: false, error: 'Missing required parameters: kingdomId, buildingType, quantity', errorCode: ErrorCode.MISSING_PARAMS };
    }

    if (!VALID_BUILDING_TYPES.includes(buildingType as BuildingType)) {
      return { success: false, error: `Invalid building type. Must be one of: ${VALID_BUILDING_TYPES.join(', ')}`, errorCode: ErrorCode.INVALID_PARAM };
    }

    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < BUILDING_QUANTITY.min || quantity > BUILDING_QUANTITY.max) {
      return { success: false, error: `Quantity must be an integer between ${BUILDING_QUANTITY.min} and ${BUILDING_QUANTITY.max}`, errorCode: ErrorCode.INVALID_PARAM };
    }

    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }

    const result = await client.models.Kingdom.get({ id: kingdomId });

    if (!result.data) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    // Verify kingdom ownership
    const ownerField = (result.data as any).owner as string | null;
    if (!ownerField || (!ownerField.includes(identity.sub) && !ownerField.includes(identity.username ?? ''))) {
      return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
    }

    const resources = (result.data.resources ?? {}) as KingdomResources;
    const goldCost = quantity * 250;
    const currentGold = resources.gold ?? 0;

    if (currentGold < goldCost) {
      return { success: false, error: `Insufficient gold: need ${goldCost}, have ${currentGold}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Check and deduct turns
    const currentTurns = resources.turns ?? 72;
    const turnCost = 1;
    if (currentTurns < turnCost) {
      return { success: false, error: `Not enough turns. Need ${turnCost}, have ${currentTurns}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    const buildings = (result.data.buildings ?? {}) as KingdomBuildings;
    const currentCount = buildings[buildingType as keyof KingdomBuildings] ?? 0;
    const updatedBuildings: KingdomBuildings = {
      ...buildings,
      [buildingType]: currentCount + quantity
    };

    const updatedResources: KingdomResources = {
      ...resources,
      gold: currentGold - goldCost,
      turns: Math.max(0, currentTurns - turnCost)
    };

    await client.models.Kingdom.update({
      id: kingdomId,
      buildings: updatedBuildings,
      resources: updatedResources
    });

    log.info('building-constructor', 'constructBuildings', { kingdomId, buildingType, quantity });
    return { success: true, buildings: JSON.stringify(updatedBuildings) };
  } catch (error) {
    log.error('building-constructor', error, { kingdomId, buildingType, quantity });
    return { success: false, error: 'Construction failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
