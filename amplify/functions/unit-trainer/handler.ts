import type { Schema } from '../../data/resource';
import type { KingdomUnits, KingdomResources } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbUpdate, dbQuery, parseJsonField } from '../data-client';
import { verifyOwnership } from '../verify-ownership';
import { checkRateLimit } from '../rate-limiter';

const UNIT_QUANTITY = { min: 1, max: 1000 } as const;

// Minimum gold cost per unit (sanity check to prevent zero-cost exploits)
const MIN_GOLD_COST_PER_UNIT = 1;
const MAX_TOTAL_UNITS = 100000;

type KingdomType = {
  id: string;
  owner?: string | null;
  resources?: KingdomResources | null;
  totalUnits?: KingdomUnits | null;
  turnsBalance?: number | null;
};

export const handler: Schema["trainUnits"]["functionHandler"] = async (event) => {
  const { kingdomId, unitType, quantity, goldCost: goldCostPerUnit } = event.arguments;

  try {
    if (!kingdomId || !unitType || quantity === undefined || quantity === null) {
      return { success: false, error: 'Missing required parameters: kingdomId, unitType, quantity', errorCode: ErrorCode.MISSING_PARAMS };
    }

    // Accept any non-empty unit type string (race-specific types like "militia", "knights",
    // "elven-scouts", etc. are all valid — the frontend determines what units exist per race)
    if (typeof unitType !== 'string' || unitType.trim().length === 0) {
      return { success: false, error: 'Invalid unit type: must be a non-empty string', errorCode: ErrorCode.INVALID_PARAM };
    }

    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < UNIT_QUANTITY.min || quantity > UNIT_QUANTITY.max) {
      return { success: false, error: `Quantity must be an integer between ${UNIT_QUANTITY.min} and ${UNIT_QUANTITY.max}`, errorCode: ErrorCode.INVALID_PARAM };
    }

    // goldCostPerUnit is the per-unit gold cost provided by the frontend.
    // Validate it is a positive integer to prevent exploits.
    const resolvedGoldCostPerUnit = goldCostPerUnit ?? MIN_GOLD_COST_PER_UNIT;
    if (!Number.isInteger(resolvedGoldCostPerUnit) || resolvedGoldCostPerUnit < MIN_GOLD_COST_PER_UNIT) {
      return { success: false, error: 'Invalid goldCost: must be a positive integer', errorCode: ErrorCode.INVALID_PARAM };
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
    const denied = verifyOwnership(identity, kingdom.owner ?? null);
    if (denied) return denied;

    // Rate limit check
    const rateLimited = await checkRateLimit(identity.sub, 'training');
    if (rateLimited) return rateLimited;

    // Check restoration status
    const allRestoration = await dbQuery<{ kingdomId: string; endTime: string; prohibitedActions?: string }>('RestorationStatus', 'restorationStatusesByKingdomIdAndEndTime', { field: 'kingdomId', value: kingdomId });
    const activeRestoration = allRestoration.find(r => r.kingdomId === kingdomId && new Date(r.endTime) > new Date());
    if (activeRestoration) {
      const prohibited: string[] = parseJsonField(activeRestoration.prohibitedActions, []);
      if (prohibited.some(a => ['train'].includes(a))) {
        return { success: false, error: 'Kingdom is in restoration and cannot perform this action', errorCode: ErrorCode.RESTORATION_BLOCKED };
      }
    }

    const resources = parseJsonField(kingdom.resources, {} as KingdomResources);
    const goldCost = quantity * resolvedGoldCostPerUnit;
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

    const units = parseJsonField(kingdom.totalUnits, {} as KingdomUnits);

    // VAL-2: enforce total unit cap
    const currentTotal = Object.values(units).reduce((sum, n) => sum + (n ?? 0), 0);
    if (currentTotal + quantity > MAX_TOTAL_UNITS) {
      const available = Math.max(0, MAX_TOTAL_UNITS - currentTotal);
      return { success: false, error: `Unit limit reached: max ${MAX_TOTAL_UNITS} total units. You can train ${available} more.`, errorCode: ErrorCode.VALIDATION_FAILED };
    }

    const currentCount = units[unitType as keyof KingdomUnits] ?? 0;
    const updatedUnits: KingdomUnits = {
      ...units,
      [unitType]: currentCount + quantity
    };

    const updatedResources: KingdomResources = {
      ...resources,
      gold: currentGold - goldCost,
    };

    const newTurns = Math.max(0, currentTurns - turnCost);

    // Calculate updated networth so leaderboard stays current
    const updatedLand = updatedResources.land ?? 0;
    const updatedGold = updatedResources.gold ?? 0;
    const updatedTotalCount = Object.values(updatedUnits as Record<string, number>).reduce((s, n) => s + (n ?? 0), 0);
    const updatedNetworth = updatedLand * 1000 + updatedGold + updatedTotalCount * 100;

    await dbUpdate('Kingdom', kingdomId, {
      totalUnits: updatedUnits,
      resources: updatedResources,
      turnsBalance: newTurns,
      networth: updatedNetworth,
    });

    log.info('unit-trainer', 'trainUnits', { kingdomId, unitType, quantity });
    return { success: true, units: JSON.stringify(updatedUnits) };
  } catch (error) {
    log.error('unit-trainer', error, { kingdomId, unitType, quantity });
    return { success: false, error: error instanceof Error ? error.message : 'Training failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
