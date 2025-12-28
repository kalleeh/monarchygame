/**
 * Combat Service
 * Handles API calls for combat operations - NO authoritative calculations
 */

import { generateClient } from 'aws-amplify/data';
import { AmplifyFunctionService } from './amplifyFunctionService';

// Import the response type from amplifyFunctionService
type LambdaResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};
import type { Schema } from '../../../amplify/data/resource';
import type { AttackRequest, CombatResult, DefenseSettings } from '../types/combat';

const client = generateClient<Schema>();

export class CombatService {
  /**
   * Launch an attack - calls Lambda for authoritative calculation
   */
  static async launchAttack(request: AttackRequest): Promise<CombatResult> {
    try {
      // Call Lambda function for AUTHORITATIVE calculation
      const lambdaResult = await AmplifyFunctionService.processCombat({
        kingdomId: request.attackerId,
        attackerKingdomId: request.attackerId,
        defenderKingdomId: request.defenderId,
        attackType: request.attackType,
        units: request.units
      }) as {
        success: boolean;
        goldLooted: number;
        landGained: number;
        attackerCasualties: Record<string, number>;
        defenderCasualties: Record<string, number>;
        resultType: string;
        timestamp: string;
      };

      // Store Lambda results in database (no client-side calculation)
      const battleReport = await client.models.BattleReport.create({
        attackerId: request.attackerId,
        defenderId: request.defenderId,
        attackType: request.attackType,
        result: lambdaResult.success ? 'attacker_victory' : 'defender_victory',
        casualties: {
          attacker: lambdaResult.attackerCasualties,
          defender: lambdaResult.defenderCasualties
        },
        landGained: lambdaResult.landGained || 0,
        timestamp: lambdaResult.timestamp
      });

      return {
        success: lambdaResult.success,
        landGained: lambdaResult.landGained,
        casualties: {
          attacker: lambdaResult.attackerCasualties,
          defender: lambdaResult.defenderCasualties
        },
        result: lambdaResult.success ? 'victory' : 'defeat',
        battleReportId: battleReport.data?.id
      } as unknown as CombatResult;

    } catch (error) {
      console.error('Combat service error:', error);
      throw error;
    }
  }

  /**
   * Preview attack results - CLIENT-SIDE ONLY for UI feedback
   * NOT used for actual game state changes - simplified preview only
   */
  static previewAttack(
    attackerOffense: number,
    defenderDefense: number,
    targetLand: number
  ): { min: number, max: number, resultType: string } {
    // Simple UI preview - actual calculations done server-side
    const ratio = attackerOffense / Math.max(defenderDefense, 1);
    const baseRate = 0.07;
    const landGained = Math.floor(targetLand * baseRate * Math.min(ratio, 1.5));
    
    return {
      min: Math.max(0, landGained - 5),
      max: landGained + 5,
      resultType: ratio > 1.2 ? 'victory' : ratio > 0.8 ? 'close' : 'defeat'
    };
  }

  /**
   * Claim territory - calls Lambda for authoritative processing
   */
  static async claimTerritory(request: {
    kingdomId: string;
    territoryName: string;
    coordinates: { x: number; y: number };
    terrainType: string;
  }): Promise<LambdaResponse> {
    try {
      return await AmplifyFunctionService.claimTerritory({
        kingdomId: request.kingdomId,
        name: 'New Territory',
        terrainType: 'plains',
        coordinates: { x: 0, y: 0 },
        territoryAmount: 1,
        goldCost: 1000
      }) as LambdaResponse;
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
  }): Promise<LambdaResponse> {
    try {
      return await AmplifyFunctionService.constructBuildings({
        kingdomId: request.kingdomId,
        buildingType: request.buildingType,
        quantity: request.quantity,
        goldCost: request.quantity * 100 // Default cost, should be calculated by Lambda
      }) as LambdaResponse;
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
  }): Promise<LambdaResponse> {
    try {
      return await AmplifyFunctionService.trainUnits({
        kingdomId: request.kingdomId,
        unitType: request.unitType,
        quantity: request.quantity,
        goldCost: request.quantity * 50 // Default cost, should be calculated by Lambda
      }) as LambdaResponse;
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
  }): Promise<LambdaResponse> {
    try {
      return await AmplifyFunctionService.castSpell({
        kingdomId: request.kingdomId,
        action: 'cast_spell',
        spellId: request.spellId,
        targetId: request.targetKingdomId,
      }) as LambdaResponse;
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
  }): Promise<LambdaResponse> {
    try {
      return await AmplifyFunctionService.updateResources({
        kingdomId: request.kingdomId,
        resourceType: request.action,
        operation: 'generate',
        amount: request.encampDuration
      }) as LambdaResponse;
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
            { attackerId: { eq: kingdomId } },
            { defenderId: { eq: kingdomId } }
          ]
        }
      });
      return data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Failed to fetch battle reports:', error);
      return [];
    }
  }

  static async updateDefenseSettings(kingdomId: string, settings: DefenseSettings): Promise<void> {
    try {
      const existingSettings = await client.models.DefenseSettings.list({
        filter: { kingdomId: { eq: kingdomId } }
      });

      if (existingSettings.data.length > 0) {
        await client.models.DefenseSettings.update({
          id: existingSettings.data[0].id,
          kingdomId: kingdomId,
          autoDefend: settings.autoRetaliate ?? false,
          defenseFormation: JSON.stringify(settings.unitDistribution),
          alertSettings: JSON.stringify({ alertAlliance: settings.alertAlliance })
        });
      } else {
        await client.models.DefenseSettings.create({
          kingdomId: kingdomId,
          autoDefend: settings.autoRetaliate ?? false,
          defenseFormation: JSON.stringify(settings.unitDistribution),
          alertSettings: JSON.stringify({ alertAlliance: settings.alertAlliance })
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
