import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import type { KingdomResources, KingdomBuildings } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';

const RESOURCE_LIMITS = {
  gold: { min: 0, max: 1000000 },
  population: { min: 0, max: 100000 },
  mana: { min: 0, max: 50000 },
  land: { min: 1000, max: 100000 }
} as const;

const client = generateClient<Schema>();

export const handler: Schema["updateResources"]["functionHandler"] = async (event) => {
  const { kingdomId, turns: rawTurns } = event.arguments;
  const turns = Math.max(1, rawTurns ?? 1);

  try {
    if (!kingdomId) {
      return { success: false, error: 'Missing kingdomId', errorCode: ErrorCode.MISSING_PARAMS };
    }

    if (typeof kingdomId !== 'string' || kingdomId.length > 128) {
      return { success: false, error: 'Invalid kingdomId format', errorCode: ErrorCode.INVALID_PARAM };
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
    const buildings = (result.data.buildings ?? {}) as KingdomBuildings;
    const stats = (result.data.stats ?? {}) as Record<string, unknown>;
    const currentAge = (result.data.currentAge as string) ?? 'early';

    const currentGold = resources.gold ?? 0;
    const currentPop = resources.population ?? 0;
    const currentMana = resources.mana ?? 0;
    const currentLand = resources.land ?? 1000;

    // Tithe income from temples: tithe stat (0–10 scale) acts as a multiplier
    const titheMultiplier = ((stats.tithe as number) ?? 0) / 10; // 0–1.0 range
    const tithePerTurn = Math.floor((buildings.temple ?? 0) * 5 * Math.max(titheMultiplier, 0.5));

    // Age multipliers for income — kingdoms generate more in later ages
    const AGE_INCOME_MULTIPLIERS: Record<string, number> = {
      'early': 1.0,    // Standard income
      'middle': 1.15,  // 15% bonus — kingdoms have developed
      'late': 1.30,    // 30% bonus — peak civilization
    };
    const ageMultiplier = AGE_INCOME_MULTIPLIERS[currentAge] ?? 1.0;

    // Building-based income per turn (tithe is separated so it can be floored before age scaling)
    const baseGoldPerTurn = (buildings.mine ?? 0) * 20 + (buildings.farm ?? 0) * 8 + (buildings.tower ?? 0) * 50 + 100;
    const populationPerTurn = (buildings.farm ?? 0) * 10;
    const manaPerTurn = (buildings.temple ?? 0) * 3;

    // Apply age multiplier to all gold income (base + tithe)
    const totalGoldPerTurn = Math.floor((baseGoldPerTurn + tithePerTurn) * ageMultiplier);

    // Territory-based income (Tier 2 production)
    const CATEGORY_PRODUCTION: Record<string, { gold: number; population: number; land: number }> = {
      farmland:   { gold: 20,  population: 30, land: 50 },
      mine:       { gold: 60,  population: 5,  land: 10 },
      forest:     { gold: 10,  population: 10, land: 30 },
      port:       { gold: 80,  population: 20, land: 5  },
      stronghold: { gold: 5,   population: 0,  land: 0  },
      ruins:      { gold: 0,   population: 0,  land: 0  },
    };

    const TERRAIN_MULTIPLIERS: Record<string, Partial<Record<string, number>>> = {
      mountains: { mine: 1.5 },
      coastal:   { port: 1.5 },
      forest:    { forest: 1.5 },
      plains:    {},
    };

    let territoryGold = 0;
    let territoryPop = 0;
    let territoryLand = 0;

    try {
      const territories = await client.models.Territory.list({
        filter: { kingdomId: { eq: kingdomId } }
      });

      for (const t of (territories.data ?? []) as Array<Record<string, unknown>>) {
        const cat = (t.category as string | undefined) ?? 'farmland';
        const terrain = (t.terrainType as string | undefined) ?? 'plains';
        const base = CATEGORY_PRODUCTION[cat] ?? CATEGORY_PRODUCTION.farmland;
        const mult = TERRAIN_MULTIPLIERS[terrain]?.[cat] ?? 1.0;
        territoryGold += Math.floor(base.gold * mult);
        territoryPop  += Math.floor(base.population * mult);
        territoryLand += Math.floor(base.land * mult);
      }
    } catch (err) {
      log.warn('resource-manager', 'territory-income-failed', { err });
      // Non-fatal — proceed without territory income
    }

    const updated: KingdomResources = {
      gold: Math.min(currentGold + (totalGoldPerTurn + territoryGold) * turns, RESOURCE_LIMITS.gold.max),
      land: Math.max(currentLand + territoryLand * turns, RESOURCE_LIMITS.land.min),
      population: Math.min(currentPop + (populationPerTurn + territoryPop) * turns, RESOURCE_LIMITS.population.max),
      mana: Math.min(currentMana + manaPerTurn * turns, RESOURCE_LIMITS.mana.max)
    };

    await client.models.Kingdom.update({
      id: kingdomId,
      resources: updated,
      lastResourceTick: new Date().toISOString()
    });

    log.info('resource-manager', 'updateResources', { kingdomId, turns });
    return { success: true, resources: JSON.stringify(updated), newTurns: turns };
  } catch (error) {
    log.error('resource-manager', error, { kingdomId });
    return { success: false, error: 'Resource update failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
