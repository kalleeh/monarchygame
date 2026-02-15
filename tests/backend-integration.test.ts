import { describe, it, expect } from 'vitest';

describe('Backend Integration Tests', () => {
  describe('Lambda Function Validation', () => {
    it('should validate resource-manager function structure', async () => {
      // Import the handler
      const { handler } = await import('../amplify/functions/resource-manager/handler');
      
      // Test basic function structure
      expect(typeof handler).toBe('function');
      
      // Test with invalid input to check error handling
      const result = await handler({
        kingdomId: 'test-kingdom',
        operation: 'invalid'
      });
      
      // Should return structured response
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('should validate territory-manager function structure', async () => {
      const { handler } = await import('../amplify/functions/territory-manager/handler');
      
      expect(typeof handler).toBe('function');
      
      const result = await handler({
        kingdomId: 'test-kingdom',
        operation: 'invalid'
      });
      
      expect(result).toHaveProperty('success');
    });

    it('should validate building-constructor function structure', async () => {
      const { handler } = await import('../amplify/functions/building-constructor/handler');
      
      expect(typeof handler).toBe('function');
      
      const result = await handler({
        kingdomId: 'test-kingdom',
        operation: 'invalid'
      });
      
      expect(result).toHaveProperty('success');
    });

    it('should validate unit-trainer function structure', async () => {
      const { handler } = await import('../amplify/functions/unit-trainer/handler');
      
      expect(typeof handler).toBe('function');
      
      const result = await handler({
        kingdomId: 'test-kingdom',
        operation: 'invalid'
      });
      
      expect(result).toHaveProperty('success');
    });

    it('should validate spell-caster function structure', async () => {
      const { handler } = await import('../amplify/functions/spell-caster/handler');
      
      expect(typeof handler).toBe('function');
      
      const result = await handler({
        kingdomId: 'test-kingdom',
        operation: 'invalid'
      });
      
      expect(result).toHaveProperty('success');
    });
  });

  describe('Game Data Integration', () => {
    it('should have authentic race data available', async () => {
      const { races } = await import('../game-data/races');
      
      expect(races).toBeDefined();
      expect(Array.isArray(races)).toBe(true);
      expect(races.length).toBeGreaterThan(0);
      
      // Check for authentic Monarchy races
      const raceNames = races.map(r => r.id);
      expect(raceNames).toContain('human');
      expect(raceNames).toContain('elven');
      expect(raceNames).toContain('goblin');
      expect(raceNames).toContain('vampire');
    });

    it('should have authentic building data available', async () => {
      const { buildings } = await import('../game-data/buildings');
      
      expect(buildings).toBeDefined();
      expect(Array.isArray(buildings)).toBe(true);
      
      // Check for authentic Monarchy buildings
      const buildingNames = buildings.map(b => b.id);
      expect(buildingNames).toContain('quarry');
      expect(buildingNames).toContain('waterfall');
      expect(buildingNames).toContain('timoton');
    });

    it('should have authentic spell data available', async () => {
      const { spells } = await import('../game-data/spells');
      
      expect(spells).toBeDefined();
      expect(Array.isArray(spells)).toBe(true);
      
      // Check for authentic Monarchy spells with backlash risks
      const spellsWithBacklash = spells.filter(s => s.backlashRisk > 0);
      expect(spellsWithBacklash.length).toBeGreaterThan(0);
    });
  });

  describe('Frontend Service Integration', () => {
    it('should have combat service with server-side methods', async () => {
      const { CombatService } = await import('../frontend/src/services/combatService');
      
      expect(CombatService).toBeDefined();
      expect(typeof CombatService.claimTerritory).toBe('function');
      expect(typeof CombatService.constructBuildings).toBe('function');
      expect(typeof CombatService.trainUnits).toBe('function');
      expect(typeof CombatService.castSpell).toBe('function');
      expect(typeof CombatService.generateResources).toBe('function');
    });

    it('should have amplify function service', async () => {
      const { AmplifyFunctionService } = await import('../frontend/src/services/amplifyFunctionService');
      
      expect(AmplifyFunctionService).toBeDefined();
      expect(typeof AmplifyFunctionService.invokeFunction).toBe('function');
    });
  });
});
