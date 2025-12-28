import { generateClient } from 'aws-amplify/data';
// @ts-expect-error Schema import
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export interface TrainableUnit {
  id: string;
  type: string;
  name: string;
  description: string;
  goldCost: number;
  populationCost: number;
  trainingTime: number;
  requirements: string[];
  tier?: number;
  upkeep?: number; // Gold per turn maintenance cost
}

export interface TrainedUnit {
  id: string;
  type: string;
  name: string;
  level: number;
  experience: number;
  stats: {
    attack: number;
    defense: number;
    health: number;
  };
}

export interface TrainingQueueItem {
  id: string;
  type: string;
  name: string;
  completionTime: Date;
  progress: number;
}

export class TrainingService {
  /**
   * Get available units for training
   */
  static async getAvailableUnits(kingdomId: string): Promise<TrainableUnit[]> {
    try {
      const queries = client.queries as Record<string, (args: unknown) => Promise<unknown>>;
      const rawResponse = await queries.getAvailableUnits({ kingdomId });
      const response = rawResponse as Record<string, unknown>;
      
      if (!response.data) {
        throw new Error('Failed to fetch available units');
      }

      return (response.data as Record<string, unknown>[]).map((unit: Record<string, unknown>) => ({
        id: String(unit.id),
        type: String(unit.type),
        name: String(unit.name),
        description: String(unit.description),
        goldCost: Number(unit.goldCost),
        populationCost: Number(unit.populationCost),
        trainingTime: Number(unit.trainingTime),
        requirements: Array.isArray(unit.requirements) ? unit.requirements : []
      }));
    } catch (error) {
      console.error('Failed to get available units:', error);
      return [];
    }
  }

  /**
   * Start training a unit
   */
  static async trainUnit(kingdomId: string, unitType: string, quantity: number = 1): Promise<boolean> {
    try {
      const queries = client.queries as Record<string, (args: unknown) => Promise<unknown>>;
      const rawResponse = await queries.trainUnit({
        kingdomId,
        unitType,
        quantity
      });
      const response = rawResponse as Record<string, unknown>;

      return Boolean(response.success) || false;
    } catch (error) {
      console.error('Failed to train unit:', error);
      return false;
    }
  }

  /**
   * Get trained units for a kingdom
   */
  static async getTrainedUnits(kingdomId: string): Promise<TrainedUnit[]> {
    try {
      const queries = client.queries as Record<string, (args: unknown) => Promise<unknown>>;
      const rawResponse = await queries.getTrainedUnits({ kingdomId });
      const response = rawResponse as Record<string, unknown>;
      
      if (!response.data) {
        return [];
      }

      return (response.data as Record<string, unknown>[]).map((unit: Record<string, unknown>) => ({
        id: String(unit.id),
        type: String(unit.type),
        name: String(unit.name),
        level: Number(unit.level) || 1,
        experience: Number(unit.experience) || 0,
        stats: unit.stats as { attack: number; defense: number; health: number; } || { attack: 0, defense: 0, health: 0 } || { attack: 0, defense: 0, health: 0 }
      }));
    } catch (error) {
      console.error('Failed to get trained units:', error);
      return [];
    }
  }

  /**
   * Cancel training
   */
  static async cancelTraining(queueId: string): Promise<boolean> {
    try {
      const queries = client.queries as Record<string, (args: unknown) => Promise<unknown>>;
      const rawResponse = await queries.cancelTraining({ queueId });
      const response = rawResponse as Record<string, unknown>;
      return Boolean(response.success) || false;
    } catch (error) {
      console.error('Failed to cancel training:', error);
      return false;
    }
  }

  /**
   * Upgrade a unit
   */
  static async upgradeUnit(unitId: string, upgradeType: string): Promise<TrainedUnit> {
    try {
      const queries = client.queries as Record<string, (args: unknown) => Promise<unknown>>;
      const rawResponse = await queries.upgradeUnit({ unitId, upgradeType });
      const response = rawResponse as Record<string, unknown>;
      
      return {
        id: String(response.id),
        type: String(response.type),
        name: String(response.name),
        level: Number(response.level),
        experience: Number(response.experience),
        stats: response.stats as { attack: number; defense: number; health: number; } || { attack: 0, defense: 0, health: 0 }
      };
    } catch (error) {
      console.error('Failed to upgrade unit:', error);
      throw error;
    }
  }

  /**
   * Complete training
   */
  static async completeTraining(kingdomId: string): Promise<TrainedUnit[]> {
    try {
      const queries = client.queries as Record<string, (args: unknown) => Promise<unknown>>;
      const rawResponse = await queries.completeTraining({ kingdomId });
      const response = rawResponse as Record<string, unknown>;
      return (response.completedUnits as TrainedUnit[]) || [];
    } catch (error) {
      console.error('Failed to complete training:', error);
      return [];
    }
  }
}
