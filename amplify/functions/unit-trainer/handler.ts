import type { Schema } from '../../data/resource';
import type { KingdomUnits, KingdomResources } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbUpdate, dbList, dbAtomicAdd } from '../data-client';

const VALID_UNIT_TYPES = ['infantry', 'archers', 'cavalry', 'siege', 'mages', 'scouts', 'scum', 'elite_scum'] as const;
type UnitType = typeof VALID_UNIT_TYPES[number];

const UNIT_QUANTITY = { min: 1, max: 1000 } as const;

const UNIT_GOLD_COST: Record<UnitType, number> = {
  infantry: 100,
  archers: 100,
  cavalry: 100,
  siege: 100,
  mages: 100,
  scouts: 100,
  scum: 100,
  elite_scum: 200,
};

type KingdomType = {
  id: string;
  owner?: string | null;
  resources?: KingdomResources | null;
  totalUnits?: KingdomUnits | null;
  turnsBalance?: number | null;
};

export const handler: Schema["trainUnits"]["functionHandler"] = async (event) => {
  const { kingdomId, unitType, quantity } = event.arguments;

  try {
    if (!kingdomId || !unitType || quantity === undefined || quantity === null) {
      return { success: false, error: 'Missing required parameters: kingdomId, unitType, quantity', errorCode: ErrorCode.MISSING_PARAMS };
    }

    if (!VALID_UNIT_TYPES.includes(unitType as UnitType)) {
      return { success: false, error: `Invalid unit type. Must be one of: ${VALID_UNIT_TYPES.join(', ')}`, errorCode: ErrorCode.INVALID_PARAM };
    }

    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < UNIT_QUANTITY.min || quantity > UNIT_QUANTITY.max) {
      return { success: false, error: `Quantity must be an integer between ${UNIT_QUANTITY.min} and ${UNIT_QUANTITY.max}`, errorCode: ErrorCode.INVALID_PARAM };
    }

    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }

    const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);

    if (!kingdom) {
      return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
    }

    // Verify kingdom ownership
    const ownerField = kingdom.owner ?? null;
    if (!ownerField || (!ownerField.includes(identity.sub) && !ownerField.includes(identity.username ?? ''))) {
      return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
    }

    // Check restoration status
    const allRestoration = await dbList<{ kingdomId: string; endTime: string; prohibitedActions?: string }>('RestorationStatus');
    const activeRestoration = allRestoration.find(r => r.kingdomId === kingdomId && new Date(r.endTime) > new Date());
    if (activeRestoration) {
      const prohibited: string[] = typeof activeRestoration.prohibitedActions === 'string'
        ? JSON.parse(activeRestoration.prohibitedActions)
        : (activeRestoration.prohibitedActions ?? []);
      if (prohibited.some(a => ['train'].includes(a))) {
        return { success: false, error: 'Kingdom is in restoration and cannot perform this action', errorCode: ErrorCode.RESTORATION_BLOCKED };
      }
    }

    const resources = (kingdom.resources ?? {}) as KingdomResources;
    const goldCost = quantity * UNIT_GOLD_COST[unitType as UnitType];
    const currentGold = resources.gold ?? 0;

    if (currentGold < goldCost) {
      return { success: false, error: `Insufficient gold: need ${goldCost}, have ${currentGold}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    // Check and deduct turns from turnsBalance (server-side pool), falling back to resources.turns
    const currentTurns = kingdom.turnsBalance ?? resources.turns ?? 72;
    const turnCost = 1;
    if (currentTurns < turnCost) {
      return { success: false, error: `Not enough turns. Need ${turnCost}, have ${currentTurns}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
    }

    const units = (kingdom.totalUnits ?? {}) as KingdomUnits;
    const currentCount = units[unitType as keyof KingdomUnits] ?? 0;
    const updatedUnits: KingdomUnits = {
      ...units,
      [unitType]: currentCount + quantity
    };

    const updatedResources: KingdomResources = {
      ...resources,
      gold: currentGold - goldCost,
    };

    await dbUpdate('Kingdom', kingdomId, {
      totalUnits: updatedUnits,
      resources: updatedResources
    });
    await dbAtomicAdd('Kingdom', kingdomId, 'turnsBalance', -turnCost);

    log.info('unit-trainer', 'trainUnits', { kingdomId, unitType, quantity });
    return { success: true, units: JSON.stringify(updatedUnits) };
  } catch (error) {
    log.error('unit-trainer', error, { kingdomId, unitType, quantity });
    return { success: false, error: 'Training failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
