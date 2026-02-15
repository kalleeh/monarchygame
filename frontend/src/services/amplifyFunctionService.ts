/**
 * Amplify Function Service - Fixed Implementation with GraphQL Mutations
 * IQC Compliant: Integrity (proper error handling), Quality (typed), Consistency (Amplify patterns)
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { rateLimiter } from '../utils/rateLimiter';

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
  attackerId?: string;
  resourceType?: string;
  goldCost?: number;
  territoryAmount?: number;
  operation?: string;
  amount?: number;
}

type TerritoryPayload = FunctionPayload & BaseTerritoryPayload;
type SpellPayload = FunctionPayload & BaseSpellPayload;

export class AmplifyFunctionService {
  /**
   * Call a custom function through GraphQL mutations
   */
  static async callFunction(functionName: string, payload: FunctionPayload): Promise<unknown> {
    try {
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
            resources: payload.units || {}
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
            attackType: payload.attackType || 'raid',
            units: payload.units || {}
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
      const { data, errors } = await client.mutations.claimTerritory({
        kingdomId: territoryData.kingdomId,
        territoryName: territoryData.name,
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
   * Generic GraphQL query execution
   */
  static async executeQuery(query: string, variables?: Record<string, unknown>): Promise<unknown> {
    try {
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
