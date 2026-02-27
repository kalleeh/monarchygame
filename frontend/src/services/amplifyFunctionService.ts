/**
 * Amplify Function Service - Fixed Implementation with GraphQL Mutations
 * IQC Compliant: Integrity (proper error handling), Quality (typed), Consistency (Amplify patterns)
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { rateLimiter } from '../utils/rateLimiter';
import { isDemoMode } from '../utils/authMode';

// Generate the typed client
const client = generateClient<Schema>();

// Type definitions for service payloads
interface BaseSpellPayload {
  action: string;
  spellId: string;
  kingdomId: string;
  targetId?: string;
  timestamp?: number;
}

interface BaseTerritoryPayload {
  kingdomId: string;
  name: string;
  terrainType: string;
  coordinates: { x: number; y: number };
}

interface FunctionPayload {
  kingdomId: string;
  action?: string;
  buildingType?: string;
  unitType?: string;
  quantity?: number;
  territoryId?: string;
  buildingBonus?: number;
  attackerKingdomId?: string;
  defenderKingdomId?: string;
  attackType?: string;
  units?: Record<string, unknown>;
  formationId?: string;
  terrainId?: string;
  attackerId?: string;
  resourceType?: string;
  goldCost?: number;
  territoryAmount?: number;
  operation?: string;
  amount?: number;
  // New multiplayer fields
  seasonId?: string;
  reason?: string;
  offerId?: string;
  pricePerUnit?: number;
  treatyId?: string;
  accepted?: boolean;
  treatyType?: string;
  terms?: unknown;
  // Thievery / Faith / Bounty fields
  targetId?: string;
  alignment?: string;
  abilityType?: string;
  // Alliance treasury fields
  allianceId?: string;
  // Alliance manager fields
  name?: string;
  description?: string;
  isPublic?: boolean;
  targetKingdomId?: string;
}

type TerritoryPayload = FunctionPayload & BaseTerritoryPayload;
type SpellPayload = FunctionPayload & BaseSpellPayload;

export class AmplifyFunctionService {
  /**
   * Call a custom function through GraphQL mutations
   */
  static async callFunction(functionName: string, payload: FunctionPayload): Promise<unknown> {
    try {
      // In demo mode, return mock success without calling Lambda
      if (isDemoMode()) {
        switch (functionName) {
          case 'building-constructor': {
            // Persist building construction to localStorage
            const kingdomKey = `kingdom-${payload.kingdomId}`;
            const kingdomData = JSON.parse(localStorage.getItem(kingdomKey) || '{}');
            const buildings = kingdomData.buildings ? (typeof kingdomData.buildings === 'string' ? JSON.parse(kingdomData.buildings) : kingdomData.buildings) : {};
            const buildingType = payload.buildingType || 'unknown';
            const quantity = payload.quantity || 1;
            buildings[buildingType] = (buildings[buildingType] || 0) + quantity;
            kingdomData.buildings = buildings;
            localStorage.setItem(kingdomKey, JSON.stringify(kingdomData));
            return { success: true, buildings: JSON.stringify(buildings) };
          }
          case 'unit-trainer':
            return { success: true, units: '{}' };
          case 'resource-manager':
            return { success: true, newTurns: payload.amount ?? 1 };
          case 'combat-processor':
            return { success: true, result: 'victory', casualties: '{}' };
          case 'spell-processor':
            return { success: true, spellResult: 'cast' };
          case 'season-manager':
            return { success: true, season: { id: 'demo-season', seasonNumber: 1, status: 'active', currentAge: 'early', weeksRemaining: 6 } };
          case 'war-manager':
            return { success: true, warDeclaration: { id: `war-${Date.now()}`, status: 'active', declaredAt: new Date().toISOString() } };
          case 'trade-processor':
            return { success: true, offer: { id: `offer-${Date.now()}`, status: 'open' } };
          case 'diplomacy-processor':
            return { success: true, treaty: { id: `treaty-${Date.now()}`, status: 'proposed' } };
          case 'season-lifecycle':
            return { success: true, season: { id: 'demo-season', seasonNumber: 1, status: 'active', currentAge: 'early' } };
          case 'thievery-processor':
            return { success: true, result: JSON.stringify({ operation: payload.action || 'scout', succeeded: true, casualties: 5, goldStolen: payload.action === 'steal' ? 50000 : 0, intelligence: null }) };
          case 'faith-processor':
            return { success: true, result: JSON.stringify({ action: payload.action, alignment: payload.alignment, remainingFocusPoints: 50 }) };
          case 'bounty-processor':
            return { success: true, result: JSON.stringify({ action: payload.action ?? 'claim', goldReward: 500000, populationReward: 100 }) };
          case 'alliance-treasury':
            return { success: true, result: JSON.stringify({ contributed: payload.amount, newTreasuryBalance: 5000 }) };
          case 'alliance-manager':
            return { success: true, result: JSON.stringify({ action: payload.action, allianceId: `alliance-${Date.now()}` }) };
          default:
            return { success: true };
        }
      }

      // Rate limit check before calling Lambda
      if (!rateLimiter.tryConsume(functionName)) {
        const waitTime = rateLimiter.getTimeUntilAvailable(functionName);
        throw new Error(`Rate limited: ${functionName}. Try again in ${Math.ceil(waitTime / 1000)}s.`);
      }

      // Map function names to actual GraphQL operations
      switch (functionName) {
        case 'spell-processor':
          return await this.handleSpellProcessor(payload as SpellPayload);
        case 'resource-manager':
          return await client.mutations.updateResources({
            kingdomId: payload.kingdomId,
            turns: payload.amount ?? 1
          });
        case 'building-constructor':
          return await client.mutations.constructBuildings({
            kingdomId: payload.kingdomId,
            buildingType: payload.buildingType || '',
            quantity: payload.quantity || 1
          });
        case 'unit-trainer':
          return await client.mutations.trainUnits({
            kingdomId: payload.kingdomId,
            unitType: payload.unitType || '',
            quantity: payload.quantity || 1
          });
        case 'combat-processor':
          return await client.mutations.processCombat({
            attackerId: payload.attackerKingdomId || '',
            defenderId: payload.defenderKingdomId || '',
            attackType: (payload.attackType || 'raid') as 'standard' | 'raid' | 'siege' | 'pillage',
            units: payload.units || {},
            formationId: payload.formationId as string | undefined,
            terrainId: payload.terrainId as string | undefined,
          });
        case 'season-manager':
          return await client.queries.getActiveSeason({});
        case 'war-manager':
          return await client.mutations.declareWar({
            attackerId: payload.attackerId || payload.kingdomId,
            defenderId: payload.defenderKingdomId || '',
            seasonId: payload.seasonId || '',
            reason: payload.reason as string | undefined
          });
        case 'trade-processor':
          if (payload.action === 'accept') {
            return await client.mutations.buyTradeOffer({
              offerId: payload.offerId || '',
              buyerId: payload.kingdomId
            });
          }
          if (payload.action === 'cancel') {
            return await client.mutations.revokeTradeOffer({
              offerId: payload.offerId || '',
              sellerId: payload.kingdomId
            });
          }
          return await client.mutations.postTradeOffer({
            sellerId: payload.kingdomId,
            seasonId: payload.seasonId || '',
            resourceType: payload.resourceType || '',
            quantity: payload.quantity || 0,
            pricePerUnit: payload.pricePerUnit || 0
          });
        case 'diplomacy-processor':
          if (payload.action === 'respond') {
            return await client.mutations.respondToTreaty({
              treatyId: payload.treatyId || '',
              accepted: payload.accepted as boolean
            });
          }
          if (payload.action === 'declare-war') {
            return await client.mutations.declareDiplomaticWar({
              kingdomId: payload.kingdomId,
              targetKingdomId: payload.defenderKingdomId || '',
              seasonId: payload.seasonId || ''
            });
          }
          if (payload.action === 'peace') {
            return await client.mutations.makeDiplomaticPeace({
              kingdomId: payload.kingdomId,
              targetKingdomId: payload.defenderKingdomId || ''
            });
          }
          return await client.mutations.sendTreatyProposal({
            proposerId: payload.kingdomId,
            recipientId: payload.defenderKingdomId || '',
            seasonId: payload.seasonId || '',
            treatyType: payload.treatyType as string || '',
            terms: payload.terms || {}
          });
        case 'season-lifecycle':
          return await client.mutations.manageSeason({
            action: payload.action || 'check',
            seasonId: payload.seasonId
          });
        case 'thievery-processor':
          return await client.mutations.executeThievery({
            kingdomId: payload.kingdomId,
            operation: (payload.action as string) || 'scout',
            targetKingdomId: (payload.targetId as string) || ''
          });
        case 'faith-processor':
          return await client.mutations.updateFaith({
            kingdomId: payload.kingdomId,
            action: (payload.action as string) || 'selectAlignment',
            alignment: payload.alignment as string | undefined,
            abilityType: payload.abilityType as string | undefined
          });
        case 'bounty-processor':
          if (payload.action === 'complete') {
            return await client.mutations.completeBounty({
              kingdomId: payload.kingdomId,
              targetId: (payload.targetId as string) || '',
              landGained: (payload.amount as number) ?? 0
            });
          }
          return await client.mutations.claimBounty({
            kingdomId: payload.kingdomId,
            targetId: (payload.targetId as string) || ''
          });
        case 'alliance-treasury':
          return await client.mutations.manageAllianceTreasury({
            allianceId: payload.allianceId || '',
            kingdomId: payload.kingdomId,
            action: payload.action || 'contribute',
            amount: (payload.amount as number) ?? 0
          });
        case 'alliance-manager':
          return await client.mutations.manageAlliance({
            kingdomId: payload.kingdomId,
            action: payload.action || 'create',
            allianceId: payload.allianceId as string | undefined,
            name: payload.name as string | undefined,
            description: payload.description as string | undefined,
            isPublic: payload.isPublic as boolean | undefined,
            targetKingdomId: (payload.targetKingdomId ?? payload.targetId) as string | undefined,
          });
        default:
          throw new Error(`Unknown function: ${functionName}`);
      }
    } catch (error) {
      console.error(`AmplifyFunctionService.callFunction error for ${functionName}:`, error);
      throw error;
    }
  }

  /**
   * Process combat - expected by CombatInterface
   */
  static async processCombat(payload: FunctionPayload): Promise<unknown> {
    return await this.callFunction('combat-processor', payload);
  }

  /**
   * Update resources - expected by KingdomDashboard
   */
  static async updateResources(payload: FunctionPayload): Promise<unknown> {
    return await this.callFunction('resource-manager', payload);
  }

  /**
   * Construct buildings - expected by TerritoryManagement
   */
  static async constructBuildings(payload: FunctionPayload): Promise<unknown> {
    return await this.callFunction('building-constructor', payload);
  }

  /**
   * Train units - expected by various components
   */
  static async trainUnits(payload: FunctionPayload): Promise<unknown> {
    return await this.callFunction('unit-trainer', payload);
  }

  /**
   * Cast spell - expected by spell components
   */
  static async castSpell(payload: SpellPayload): Promise<unknown> {
    return await this.handleSpellProcessor(payload);
  }

  /**
   * Handle spell processor operations
   */
  private static async handleSpellProcessor(payload: SpellPayload): Promise<unknown> {
    const { action, spellId, kingdomId, targetId } = payload;

    // In demo mode, return mock success without calling Lambda
    if (isDemoMode()) {
      switch (action) {
        case 'cast':
          return { success: true, spellResult: 'cast', spellId, casterId: kingdomId, elanCost: this.getSpellManaCost(spellId), damage: 0 };
        default:
          return this.getMockSpellData(action, spellId);
      }
    }

    switch (action) {
      case 'cast':
        return await client.mutations.castSpell({
          casterId: kingdomId,
          spellId,
          targetId: targetId || ''
        });
      
      case 'validate':
      case 'status':
      case 'history':
        // For now, return mock data until we implement these as queries
        return this.getMockSpellData(action, spellId);
      
      default:
        throw new Error(`Unknown spell action: ${action}`);
    }
  }

  /**
   * Territory claiming operation using GraphQL mutation
   */
  static async claimTerritory(territoryData: TerritoryPayload): Promise<unknown> {
    try {
      // In demo mode, return mock success without calling Lambda
      if (isDemoMode()) {
        return {
          success: true,
          territoryId: `territory-${Date.now()}`,
          kingdomId: territoryData.kingdomId,
          name: territoryData.name,
          terrainType: territoryData.terrainType
        };
      }

      const { data, errors } = await client.mutations.claimTerritory({
        kingdomId: territoryData.kingdomId,
        territoryName: territoryData.name,
        territoryType: (territoryData as any).territoryType || 'settlement',
        terrainType: (territoryData.terrainType || 'plains') as 'plains' | 'forest' | 'mountains' | 'desert' | 'swamp' | 'coastal',
        coordinates: territoryData.coordinates || { x: 0, y: 0 }
      });

      if (errors && errors.length > 0) {
        throw new Error(`Territory claim failed: ${errors.map(e => e.message).join(', ')}`);
      }

      return data;
    } catch (error) {
      console.error('Territory claim error:', error);
      throw error;
    }
  }

  /**
   * Mock spell data for operations not yet implemented as mutations
   */
  private static getMockSpellData(action: string, spellId?: string): Record<string, unknown> {
    switch (action) {
      case 'validate':
        return {
          canCast: true,
          requiredMana: this.getSpellManaCost(spellId || ''),
          currentElan: 200
        };
      
      case 'status':
        return {
          currentElan: 200,
          maxElan: 300,
          elan: 0,
          activeCooldowns: [],
          activeEffects: []
        };
      
      case 'history':
        return {
          history: []
        };
      
      default:
        return {};
    }
  }

  /**
   * Get spell mana cost helper
   */
  private static getSpellManaCost(spellId: string): number {
    const costs: Record<string, number> = {
      'calming_chant': 0,
      'rousing_wind': 1,
      'shattering_calm': 2,
      'hurricane': 3,
      'lightning_lance': 3,
      'banshee_deluge': 5,
      'foul_light': 8
    };
    return costs[spellId] || 1;
  }

  /**
   * Refresh kingdom resources from the server and sync into kingdomStore.
   * Call this after any Lambda that deducts turns server-side so the client
   * stays consistent with the authoritative server state.
   */
  static async refreshKingdomResources(kingdomId: string): Promise<void> {
    if (isDemoMode()) return;
    try {
      const { data } = await client.models.Kingdom.get({ id: kingdomId });
      if (data?.resources) {
        const resources = typeof data.resources === 'string'
          ? JSON.parse(data.resources)
          : data.resources;
        // Lazy import to avoid circular dependency
        const { useKingdomStore } = await import('../stores/kingdomStore');
        useKingdomStore.getState().syncFromServer({ resources, units: [] });
      }
    } catch (e) {
      console.error('[refreshKingdomResources] failed:', e);
    }
  }

  /**
   * Generic GraphQL query execution
   */
  static async executeQuery(query: string, variables?: Record<string, unknown>): Promise<unknown> {
    try {
      // In demo mode, return empty data without calling GraphQL
      if (isDemoMode()) {
        return {};
      }

      const result = await client.graphql({
        query,
        variables
      });
      const { data, errors } = result as { data: unknown; errors?: Array<{ message: string }> };

      if (errors && errors.length > 0) {
        throw new Error(`GraphQL errors: ${errors.map((e: { message: string }) => e.message).join(', ')}`);
      }

      return data;
    } catch (error) {
      console.error('GraphQL query execution error:', error);
      throw error;
    }
  }

  /**
   * Generic GraphQL mutation execution
   */
  static async executeMutation(mutation: string, variables?: Record<string, unknown>): Promise<unknown> {
    try {
      // In demo mode, return mock success without calling GraphQL
      if (isDemoMode()) {
        return { success: true };
      }

      const result = await client.graphql({
        query: mutation,
        variables
      });
      const { data, errors } = result as { data: unknown; errors?: Array<{ message: string }> };

      if (errors && errors.length > 0) {
        throw new Error(`GraphQL errors: ${errors.map((e: { message: string }) => e.message).join(', ')}`);
      }

      return data;
    } catch (error) {
      console.error('GraphQL mutation execution error:', error);
      throw error;
    }
  }
}
