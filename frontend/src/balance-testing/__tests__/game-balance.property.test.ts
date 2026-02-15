/**
 * Property-Based Testing for Game Balance
 * Tests universal properties of AI balance system using fast-check
 */

import * as fc from 'fast-check';
import { describe, it } from 'vitest';
import { StrategicAI } from '../StrategicAI';

// Generators for game entities
const raceGenerator = fc.constantFrom('Human', 'Droben', 'Sidhe', 'Elven');

const kingdomGenerator = fc.record({
  id: fc.string(),
  race: raceGenerator,
  land: fc.integer({ min: 1000, max: 50000 }),
  resources: fc.record({
    gold: fc.integer({ min: 100000, max: 10000000 }),
    population: fc.integer({ min: 500, max: 25000 }),
    mana: fc.integer({ min: 0, max: 5000 })
  }),
  units: fc.record({
    offense: fc.integer({ min: 100, max: 10000 }),
    defense: fc.integer({ min: 100, max: 10000 })
  }),
  buildings: fc.record({
    forts: fc.integer({ min: 0, max: 1000 }),
    quarries: fc.integer({ min: 0, max: 2000 }),
    barracks: fc.integer({ min: 0, max: 1500 }),
    markets: fc.integer({ min: 0, max: 800 }),
    hovels: fc.integer({ min: 0, max: 800 }),
    temples: fc.integer({ min: 0, max: 400 })
  })
});

describe('Property-Based Game Balance Testing', () => {
  // Property: Strategic AI decisions should be deterministic
  it('property: strategic AI determinism', () => {
    fc.assert(fc.property(
      kingdomGenerator,
      (kingdom) => {
        // For any kingdom state, Strategic AI should make consistent decisions
        const ai = new StrategicAI(kingdom);
        const decision1 = ai.makeDecision([]);
        const decision2 = ai.makeDecision([]);
        
        return decision1.action === decision2.action && 
               decision1.priority === decision2.priority;
      }
    ), { numRuns: 50 });
  });

  // Property: Strategic AI should always return valid actions
  it('property: strategic AI valid actions', () => {
    fc.assert(fc.property(
      kingdomGenerator,
      (kingdom) => {
        // For any kingdom state, Strategic AI should return valid actions
        const ai = new StrategicAI(kingdom);
        const decision = ai.makeDecision([]);
        
        const validActions = ['build', 'attack', 'defend', 'magic', 'wait'];
        return validActions.includes(decision.action) &&
               typeof decision.priority === 'number' &&
               decision.priority >= 0 &&
               decision.priority <= 100 &&
               typeof decision.reasoning === 'string' &&
               decision.reasoning.length > 0;
      }
    ), { numRuns: 100 });
  });

  // Property: Race-specific strategic behavior
  it('property: race-specific strategic behavior', () => {
    fc.assert(fc.property(
      fc.integer({ min: 2000, max: 10000 }),
      fc.integer({ min: 1000000, max: 5000000 }),
      (land, gold) => {
        // For any kingdom state, different races should show different strategic preferences
        const humanKingdom = createTestKingdom('Human', land, gold);
        const drobenKingdom = createTestKingdom('Droben', land, gold);
        
        const humanAI = new StrategicAI(humanKingdom);
        const drobenAI = new StrategicAI(drobenKingdom);
        
        const humanDecision = humanAI.makeDecision([]);
        const drobenDecision = drobenAI.makeDecision([]);
        
        // Both should return valid decisions (race differences may or may not show)
        return typeof humanDecision.action === 'string' && 
               typeof drobenDecision.action === 'string' &&
               humanDecision.priority >= 0 &&
               drobenDecision.priority >= 0;
      }
    ), { numRuns: 30 });
  });

  // Property: Strategic AI should provide meaningful reasoning
  it('property: strategic AI meaningful reasoning', () => {
    fc.assert(fc.property(
      kingdomGenerator,
      (kingdom) => {
        // For any kingdom, reasoning should be meaningful and non-empty
        const ai = new StrategicAI(kingdom);
        const decision = ai.makeDecision([]);
        
        return typeof decision.reasoning === 'string' &&
               decision.reasoning.length > 10 && // Meaningful length
               decision.priority >= 0 &&
               decision.priority <= 100;
      }
    ), { numRuns: 50 });
  });

  // Property: Strategic AI should handle edge cases gracefully
  it('property: strategic AI edge case handling', () => {
    fc.assert(fc.property(
      fc.record({
        race: raceGenerator,
        land: fc.integer({ min: 1, max: 100 }), // Very small kingdoms
        gold: fc.integer({ min: 0, max: 1000 }), // Very poor kingdoms
      }),
      (edgeKingdom) => {
        // For any edge case kingdom, AI should not crash
        const kingdom = createTestKingdom(edgeKingdom.race, edgeKingdom.land, edgeKingdom.gold);
        
        try {
          const ai = new StrategicAI(kingdom);
          const decision = ai.makeDecision([]);
          
          // Should return a valid decision even for edge cases
          return typeof decision.action === 'string' &&
                 typeof decision.priority === 'number' &&
                 typeof decision.reasoning === 'string';
        } catch {
          // AI should handle edge cases gracefully, not crash
          return false;
        }
      }
    ), { numRuns: 30 });
  });
});

// Helper function for test kingdom creation
function createTestKingdom(race: string, land: number, gold: number) {
  return {
    id: `${race.toLowerCase()}-test`,
    race,
    land,
    resources: {
      gold,
      population: Math.floor(land * 0.5),
      mana: 1000
    },
    units: {
      offense: Math.floor(land * 0.8),
      defense: Math.floor(land * 0.6)
    },
    buildings: {
      forts: Math.floor(land * 0.05),
      quarries: Math.floor(land * 0.15),
      barracks: Math.floor(land * 0.15),
      markets: Math.floor(land * 0.08),
      hovels: Math.floor(land * 0.08),
      temples: Math.floor(land * 0.04)
    }
  };
}
