/**
 * Combat Processor Lambda Function
 * Authoritative combat calculations using game-data mechanics
 */

import type { Handler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { GAME_FORMULAS, COMBAT_MECHANICS } from '../../../game-data';

const logger = new Logger({ serviceName: 'combat-processor' });
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface CombatRequest {
  attackerId: string;
  defenderId: string;
  attackType: 'raid' | 'siege' | 'controlled_strike';
  attackerOffense: number;
  defenderDefense: number;
  targetLand: number;
  army: Record<string, number>;
  defenderArmy: Record<string, number>;
}

export const handler: Handler = async (event) => {
  try {
    const request: CombatRequest = JSON.parse(event.body);
    logger.info('Processing combat', { request });
    
    // Validate request
    if (!request.attackerId || !request.defenderId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid combat request' })
      };
    }

    // Get both kingdoms
    const [attacker, defender] = await Promise.all([
      getKingdom(request.attackerId),
      getKingdom(request.defenderId)
    ]);

    if (!attacker || !defender) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Kingdom not found' })
      };
    }

    // AUTHORITATIVE calculation using game-data
    const landResult = GAME_FORMULAS.calculateLandGained(
      request.attackerOffense,
      request.defenderDefense,
      request.targetLand
    );

    const attackerCasualties = calculateCasualties(request.army, landResult.resultType);
    const defenderCasualties = calculateCasualties(request.defenderArmy, landResult.resultType);
    const goldLooted = calculateGoldLooted(landResult.resultType);

    // Apply results to both kingdoms atomically
    if (landResult.resultType !== 'failed') {
      await applyCombatResults(attacker, defender, landResult.max, goldLooted, attackerCasualties, defenderCasualties);
    }

    const result = {
      success: landResult.resultType !== 'failed',
      landGained: landResult.max,
      resultType: landResult.resultType,
      attackerCasualties,
      defenderCasualties,
      goldLooted,
      timestamp: new Date().toISOString()
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    logger.error('Combat processing error', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Combat processing failed' })
    };
  }
};

async function getKingdom(kingdomId: string): Promise<any> {
  try {
    const result = await ddbClient.send(new GetCommand({
      TableName: process.env.KINGDOM_TABLE_NAME || 'Kingdom',
      Key: { id: kingdomId }
    }));
    return result.Item;
  } catch (error) {
    logger.error('Failed to get kingdom', { kingdomId, error });
    return null;
  }
}

async function applyCombatResults(
  attacker: any,
  defender: any,
  landGained: number,
  goldLooted: number,
  attackerCasualties: Record<string, number>,
  defenderCasualties: Record<string, number>
): Promise<void> {
  try {
    const transactItems = [];

    // Update attacker: gain land and gold, lose units
    const attackerUpdates = [
      'resources.land = resources.land + :landGained',
      'resources.gold = resources.gold + :goldLooted'
    ];
    const attackerValues: any = {
      ':landGained': landGained,
      ':goldLooted': goldLooted
    };

    Object.entries(attackerCasualties).forEach(([unitType, casualties], index) => {
      if (casualties > 0) {
        attackerUpdates.push(`units.${unitType} = units.${unitType} - :casualties${index}`);
        attackerValues[`:casualties${index}`] = casualties;
      }
    });

    transactItems.push({
      Update: {
        TableName: process.env.KINGDOM_TABLE_NAME || 'Kingdom',
        Key: { id: attacker.id },
        UpdateExpression: `SET ${attackerUpdates.join(', ')}`,
        ExpressionAttributeValues: attackerValues
      }
    });

    // Update defender: lose land and gold, lose units
    const defenderUpdates = [
      'resources.land = resources.land - :landLost',
      'resources.gold = resources.gold - :goldLost'
    ];
    const defenderValues: any = {
      ':landLost': landGained,
      ':goldLost': goldLooted
    };

    Object.entries(defenderCasualties).forEach(([unitType, casualties], index) => {
      if (casualties > 0) {
        defenderUpdates.push(`units.${unitType} = units.${unitType} - :casualties${index}`);
        defenderValues[`:casualties${index}`] = casualties;
      }
    });

    transactItems.push({
      Update: {
        TableName: process.env.KINGDOM_TABLE_NAME || 'Kingdom',
        Key: { id: defender.id },
        UpdateExpression: `SET ${defenderUpdates.join(', ')}`,
        ExpressionAttributeValues: defenderValues
      }
    });

    // Execute atomic transaction
    await ddbClient.send(new TransactWriteCommand({
      TransactItems: transactItems
    }));

    logger.info('Combat results applied successfully', { 
      attackerId: attacker.id, 
      defenderId: defender.id, 
      landGained, 
      goldLooted 
    });
  } catch (error) {
    logger.error('Failed to apply combat results', { error });
    throw error;
  }
}

function calculateCasualties(army: Record<string, number>, resultType: string): Record<string, number> {
  const casualtyRate = resultType === 'with_ease' ? 0.05 : 
                      resultType === 'good_fight' ? 0.15 : 0.25;
  
  const casualties: Record<string, number> = {};
  Object.entries(army).forEach(([unitType, count]) => {
    casualties[unitType] = Math.floor(count * casualtyRate);
  });
  return casualties;
}

function calculateGoldLooted(resultType: string): number {
  return resultType === 'with_ease' ? 5000 : 
         resultType === 'good_fight' ? 2000 : 0;
}
