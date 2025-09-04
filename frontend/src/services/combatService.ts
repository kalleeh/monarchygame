/**
 * Combat Service
 * Handles API calls for combat operations - NO authoritative calculations
 */

import { generateClient } from 'aws-amplify/data';
import { AmplifyFunctionService } from './amplifyFunctionService';
import type { Schema } from '../../../amplify/data/resource';
import type { AttackRequest, CombatResult, DefenseSettings } from '../types/combat';

// Minimal game formulas for UI previews only - TODO: Fix import from game-data
const GAME_FORMULAS = {
  combat: { baseAttack: 1.0, baseDefense: 1.0 },
  landAcquisition: { baseRate: 0.07 }
};

const client = generateClient<Schema>();

export class CombatService {
  /**
   * Launch an attack - calls Lambda for authoritative calculation
   */
  static async launchAttack(request: AttackRequest): Promise<CombatResult> {
    try {
      // Call Lambda function for AUTHORITATIVE calculation
      const lambdaResult = await AmplifyFunctionService.processCombat({
        attackerId: request.attackerKingdomId,
        defenderId: request.targetKingdomId,
        attackType: request.attackType,
        units: {
          attackerOffense: request.attackerOffense,
          defenderDefense: request.defenderDefense,
          targetLand: request.targetLand,
          army: request.army,
          defenderArmy: request.defenderArmy || {}
        }
      });

      // Store Lambda results in database (no client-side calculation)
      const battleReport = await client.models.BattleReport.create({
        attackerKingdomId: request.attackerKingdomId,
        defenderKingdomId: request.targetKingdomId,
        attackerName: request.attackerName,
        defenderName: request.defenderName,
        battleType: request.attackType,
        success: lambdaResult.success,
        attackerArmy: request.army,
        defenderArmy: request.defenderArmy || {},
        attackerCasualties: lambdaResult.attackerCasualties,
        defenderCasualties: lambdaResult.defenderCasualties,
        spoils: { 
          gold: lambdaResult.goldLooted,
          population: 0,
          land: lambdaResult.landGained
        },
        battleDuration: 4, // Standard 4 turns from documentation
        terrain: request.terrain || 'plains',
        result: lambdaResult.success ? 'attacker_victory' : 'defender_victory',
        timestamp: lambdaResult.timestamp,
        battleDetails: {
          resultType: lambdaResult.resultType,
          serverCalculated: true // Mark as server-authoritative
        }
      });

      return {
        success: lambdaResult.success,
        landGained: lambdaResult.landGained,
        goldLooted: lambdaResult.goldLooted,
        attackerCasualties: lambdaResult.attackerCasualties,
        defenderCasualties: lambdaResult.defenderCasualties,
        resultType: lambdaResult.resultType,
        battleReportId: battleReport.data?.id
      };

    } catch (error) {
      console.error('Combat service error:', error);
      throw error;
    }
  }

  /**
   * Preview attack results - CLIENT-SIDE ONLY for UI feedback
   * NOT used for actual game state changes
   */
  static previewAttack(
    attackerOffense: number,
    defenderDefense: number,
    targetLand: number
  ): { min: number, max: number, resultType: string } {
    // This is safe - only for UI preview, not authoritative
    return GAME_FORMULAS.calculateLandGained(attackerOffense, defenderDefense, targetLand);
  }

  /**
   * Claim territory - calls Lambda for authoritative processing
   */
  static async claimTerritory(request: {
    kingdomId: string;
    territoryName: string;
    coordinates: { x: number; y: number };
    terrainType: string;
  }): Promise<any> {
    try {
      return await AmplifyFunctionService.claimTerritory({
        kingdomId: request.kingdomId,
        territoryAmount: 1, // Single territory claim
        goldCost: 1000 // Default cost, should be calculated by Lambda
      });
    } catch (error) {
      console.error('Territory claim error:', error);
      throw error;
    }
  }

  /**
   * Construct buildings - calls Lambda for authoritative processing
   */
  static async constructBuildings(request: {
    kingdomId: string;
    buildingType: string;
    quantity: number;
    territoryId?: string;
  }): Promise<any> {
    try {
      return await AmplifyFunctionService.constructBuildings({
        kingdomId: request.kingdomId,
        buildingType: request.buildingType,
        quantity: request.quantity,
        goldCost: request.quantity * 100 // Default cost, should be calculated by Lambda
      });
    } catch (error) {
      console.error('Building construction error:', error);
      throw error;
    }
  }

  /**
   * Train units - calls Lambda for authoritative processing
   */
  static async trainUnits(request: {
    kingdomId: string;
    unitType: string;
    quantity: number;
  }): Promise<any> {
    try {
      return await AmplifyFunctionService.trainUnits({
        kingdomId: request.kingdomId,
        unitType: request.unitType,
        quantity: request.quantity,
        goldCost: request.quantity * 50 // Default cost, should be calculated by Lambda
      });
    } catch (error) {
      console.error('Unit training error:', error);
      throw error;
    }
  }

  /**
   * Cast spell - calls Lambda for authoritative processing
   */
  static async castSpell(request: {
    kingdomId: string;
    spellId: string;
    targetKingdomId?: string;
    repeatCount?: number;
  }): Promise<any> {
    try {
      return await AmplifyFunctionService.castSpell({
        casterId: request.kingdomId,
        targetId: request.targetKingdomId,
        spellType: request.spellId,
        elanCost: 10 // Default cost, should be calculated by Lambda
      });
    } catch (error) {
      console.error('Spell casting error:', error);
      throw error;
    }
  }

  /**
   * Generate resources - calls Lambda for authoritative processing
   */
  static async generateResources(request: {
    kingdomId: string;
    action: 'generate_turns' | 'generate_income' | 'encamp';
    encampDuration?: 16 | 24;
  }): Promise<any> {
    try {
      return await AmplifyFunctionService.updateResources({
        kingdomId: request.kingdomId,
        resourceType: request.action,
        operation: 'generate',
        amount: request.encampDuration
      });
    } catch (error) {
      console.error('Resource generation error:', error);
      throw error;
    }
  }

  // Existing methods remain unchanged...
  static async getBattleReports(kingdomId: string): Promise<Schema['BattleReport']['type'][]> {
    try {
      const { data } = await client.models.BattleReport.list({
        filter: {
          or: [
            { attackerKingdomId: { eq: kingdomId } },
            { defenderKingdomId: { eq: kingdomId } }
          ]
        }
      });
      return data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Failed to fetch battle reports:', error);
      return [];
    }
  }

  static async updateDefenseSettings(settings: DefenseSettings): Promise<void> {
    try {
      const existingSettings = await client.models.DefenseSettings.list({
        filter: { kingdomId: { eq: settings.kingdomId } }
      });

      if (existingSettings.data.length > 0) {
        await client.models.DefenseSettings.update({
          id: existingSettings.data[0].id,
          stance: settings.stance,
          unitDistribution: settings.unitDistribution,
          autoRetaliate: settings.autoRetaliate,
          alertAlliance: settings.alertAlliance
        });
      } else {
        await client.models.DefenseSettings.create({
          kingdomId: settings.kingdomId,
          stance: settings.stance,
          unitDistribution: settings.unitDistribution,
          autoRetaliate: settings.autoRetaliate,
          alertAlliance: settings.alertAlliance
        });
      }
    } catch (error) {
      console.error('Failed to update defense settings:', error);
      throw error;
    }
  }

  static async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await client.models.CombatNotification.update({
        id: notificationId,
        isRead: true
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }
}
