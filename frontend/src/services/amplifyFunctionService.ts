import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

/**
 * Service for invoking Lambda functions through GraphQL mutations (Amplify Gen 2 Best Practice)
 * Uses GraphQL mutations that trigger Lambda functions rather than direct invocation
 */
export class AmplifyFunctionService {
  /**
   * Process combat through GraphQL mutation that triggers combat-processor Lambda
   */
  static async processCombat(payload: {
    attackerId: string;
    defenderId: string;
    attackType: string;
    units: any;
  }): Promise<any> {
    try {
      // Best Practice: Use GraphQL mutation instead of direct Lambda invocation
      const mutation = `
        mutation ProcessCombat($input: CombatInput!) {
          processCombat(input: $input) {
            success
            landGained
            casualties
            battleReport
          }
        }
      `;

      const result = await client.graphql({
        query: mutation,
        variables: {
          input: payload
        }
      });

      return result.data?.processCombat;
    } catch (error) {
      console.error('Error processing combat:', error);
      throw error;
    }
  }

  // Similar pattern for other functions...
  static async claimTerritory(payload: any): Promise<any> {
    const mutation = `
      mutation ClaimTerritory($input: TerritoryInput!) {
        claimTerritory(input: $input) {
          success
          territoryGained
        }
      }
    `;

    const result = await client.graphql({
      query: mutation,
      variables: { input: payload }
    });

    return result.data?.claimTerritory;
  }

  static async constructBuildings(payload: any): Promise<any> {
    const mutation = `
      mutation ConstructBuildings($input: BuildingInput!) {
        constructBuildings(input: $input) {
          success
          buildingsConstructed
        }
      }
    `;

    const result = await client.graphql({
      query: mutation,
      variables: { input: payload }
    });

    return result.data?.constructBuildings;
  }

  static async trainUnits(payload: any): Promise<any> {
    const mutation = `
      mutation TrainUnits($input: UnitInput!) {
        trainUnits(input: $input) {
          success
          unitsTrained
        }
      }
    `;

    const result = await client.graphql({
      query: mutation,
      variables: { input: payload }
    });

    return result.data?.trainUnits;
  }

  static async castSpell(payload: any): Promise<any> {
    const mutation = `
      mutation CastSpell($input: SpellInput!) {
        castSpell(input: $input) {
          success
          spellEffect
        }
      }
    `;

    const result = await client.graphql({
      query: mutation,
      variables: { input: payload }
    });

    return result.data?.castSpell;
  }

  static async updateResources(payload: any): Promise<any> {
    const mutation = `
      mutation UpdateResources($input: ResourceInput!) {
        updateResources(input: $input) {
          success
          resourcesUpdated
        }
      }
    `;

    const result = await client.graphql({
      query: mutation,
      variables: { input: payload }
    });

    return result.data?.updateResources;
  }
}
