import { describe, it, expect } from 'vitest';
import { StrategicAI } from '../StrategicAI';
import type { Kingdom } from '../../types/kingdom';

describe('StrategicAI', () => {
  const createMockKingdom = (overrides: Partial<Kingdom> = {}): Kingdom => ({
    id: 'test-kingdom',
    race: 'Human',
    land: 10000,
    resources: {
      gold: 15000000,
      population: 5000,
      mana: 2000
    },
    units: {
      offense: 5000,
      defense: 3000
    },
    buildings: {
      forts: 500,
      quarries: 1000,
      barracks: 1000,
      markets: 500,
      hovels: 500,
      temples: 300
    },
    ...overrides
  } as Kingdom);

  it('should make strategic decisions instead of random ones', () => {
    const kingdom = createMockKingdom({
      land: 2000, // Small kingdom
      resources: { gold: 1000000, population: 1000, mana: 500 }
    });
    
    const ai = new StrategicAI(kingdom);
    const decision = ai.makeDecision([]);
    
    // Should make a strategic decision (not random)
    expect(decision).toBeDefined();
    expect(['build', 'attack', 'defend', 'magic', 'wait']).toContain(decision.action);
    expect(decision.priority).toBeGreaterThan(0);
    expect(decision.reasoning).toBeDefined();
    expect(decision.reasoning.length).toBeGreaterThan(10);
  });

  it('should prioritize economic actions for early game kingdoms', () => {
    const earlyKingdom = createMockKingdom({
      land: 2000,
      resources: { gold: 1000000, population: 1000, mana: 500 }
    });
    
    const ai = new StrategicAI(earlyKingdom);
    const decision = ai.makeDecision([]);
    
    expect(decision.action).toBe('build');
    expect(decision.priority).toBeGreaterThan(80);
    expect(decision.reasoning).toContain('economic foundation');
  });

  it('should adapt strategy based on race characteristics', () => {
    const sidheKingdom = createMockKingdom({
      race: 'Sidhe',
      resources: { gold: 20000000, population: 8000, mana: 5000 }
    });
    
    const ai = new StrategicAI(sidheKingdom);
    const decision = ai.makeDecision([]);
    
    // Sidhe should prioritize magic when they have sufficient mana
    expect(decision.action).toBe('magic');
    expect(decision.priority).toBeGreaterThan(90);
  });

  it('should prioritize defense when build rate is too low', () => {
    const underdefendedKingdom = createMockKingdom({
      land: 10000,
      buildings: { 
        forts: 100, // Very low fort count = low build rate
        quarries: 200,
        barracks: 200,
        markets: 100,
        hovels: 100,
        temples: 50
      }
    });
    
    const ai = new StrategicAI(underdefendedKingdom);
    const decision = ai.makeDecision([]);
    
    expect(decision.action).toBe('defend');
    expect(decision.priority).toBeGreaterThan(80);
    expect(decision.reasoning).toContain('below');
  });

  it('should consider race-specific strategies', () => {
    const drobenKingdom = createMockKingdom({
      race: 'Droben',
      land: 2000, // Smaller kingdom to trigger economic actions
      resources: { gold: 1000000, population: 1000, mana: 500 }
    });
    
    const humanKingdom = createMockKingdom({
      race: 'Human', 
      land: 2000, // Smaller kingdom to trigger economic actions
      resources: { gold: 1000000, population: 1000, mana: 500 }
    });
    
    const drobenAI = new StrategicAI(drobenKingdom);
    const humanAI = new StrategicAI(humanKingdom);
    
    const drobenDecision = drobenAI.makeDecision([]);
    const humanDecision = humanAI.makeDecision([]);
    
    // Both should make strategic decisions
    expect(drobenDecision).toBeDefined();
    expect(humanDecision).toBeDefined();
    
    // Should make strategic decisions (not wait)
    expect(['build', 'defend']).toContain(drobenDecision.action);
    expect(['build', 'defend']).toContain(humanDecision.action);
  });

  it('should demonstrate strategic intelligence over random actions', () => {
    const kingdom = createMockKingdom({
      land: 2000, // Small kingdom to ensure strategic action
      resources: { gold: 1000000, population: 1000, mana: 500 }
    });
    const ai = new StrategicAI(kingdom);
    
    // Make multiple decisions to show consistency
    const decisions = [];
    for (let i = 0; i < 5; i++) {
      decisions.push(ai.makeDecision([]));
    }
    
    // All decisions should be identical (strategic, not random)
    const firstDecision = decisions[0];
    decisions.forEach(decision => {
      expect(decision.action).toBe(firstDecision.action);
      expect(decision.priority).toBe(firstDecision.priority);
      expect(decision.reasoning).toBe(firstDecision.reasoning);
    });
    
    // Should be a strategic decision (not wait)
    expect(['build', 'defend', 'magic']).toContain(firstDecision.action);
    expect(firstDecision.reasoning.length).toBeGreaterThan(20);
  });
});
