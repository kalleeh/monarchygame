/**
 * Property-Based Testing for Game Balance
 * Following Kiro's PBT patterns with fast-check (JS equivalent of Hypothesis)
 */

import * as fc from 'fast-check';
import { describe, it } from 'vitest';
import { AIBalanceTester } from '../AIBalanceTester';

describe('Property-Based Balance Testing', () => {
  // Property: Combat results should be deterministic (invariant)
  it('property: combat determinism invariant', async () => {
    await fc.assert(fc.asyncProperty(
      fc.integer({ min: 100, max: 10000 }),
      fc.integer({ min: 100, max: 10000 }),
      fc.integer({ min: 1000, max: 50000 }),
      async (attackerStr, defenderStr, targetLand) => {
        // For any combat inputs, results should be deterministic
        const tester = new AIBalanceTester();
        await tester.runBalanceTest(1); // Initialize mechanics
        const result1 = tester.calculateLandGained(attackerStr, defenderStr, targetLand);
        const result2 = tester.calculateLandGained(attackerStr, defenderStr, targetLand);
        return result1 === result2;
      }
    ));
  });

  // Property: Stronger attackers gain more land (monotonicity)
  it('property: attack strength monotonicity', async () => {
    await fc.assert(fc.asyncProperty(
      fc.integer({ min: 1000, max: 5000 }),
      fc.integer({ min: 1000, max: 50000 }),
      async (baseStr, targetLand) => {
        // For any base strength, stronger attacks should yield more land
        const tester = new AIBalanceTester();
        await tester.runBalanceTest(1); // Initialize mechanics
        const weakResult = tester.calculateLandGained(baseStr, baseStr, targetLand);
        const strongResult = tester.calculateLandGained(baseStr * 3, baseStr, targetLand);
        return strongResult >= weakResult;
      }
    ));
  });

});
