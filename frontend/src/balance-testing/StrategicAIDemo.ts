/**
 * Strategic AI Demonstration
 * 
 * This script demonstrates strategic AI decision-making
 * in the Monarchy Game balance testing system.
 */

import { StrategicAI } from './StrategicAI';
import type { Kingdom } from '../../types/kingdom';

// Mock kingdom for testing
const createTestKingdom = (race: string, land: number): Kingdom => ({
  id: `${race.toLowerCase()}-kingdom`,
  race,
  land,
  resources: {
    gold: land * 1000, // Reasonable cash amount
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
} as Kingdom);

// Demonstration function
export function demonstrateStrategicAI() {
  console.log('🎮 STRATEGIC AI TEST RESULTS');
  console.log('=' .repeat(40));
  
  // Test different kingdom scenarios
  const scenarios = [
    { name: 'Early Game Human', kingdom: createTestKingdom('Human', 2000) },
    { name: 'Mid Game Droben', kingdom: createTestKingdom('Droben', 8000) },
    { name: 'Late Game Sidhe', kingdom: createTestKingdom('Sidhe', 15000) },
    { name: 'Small Elven', kingdom: createTestKingdom('Elven', 1500) }
  ];
  
  scenarios.forEach(scenario => {
    console.log(`\n${scenario.name} (${scenario.kingdom.land} acres):`);
    
    const strategicAI = new StrategicAI(scenario.kingdom);
    const decision = strategicAI.makeDecision([]);
    
    console.log(`  Action: ${decision.action}`);
    console.log(`  Priority: ${decision.priority}`);
    console.log(`  Reasoning: ${decision.reasoning}`);
  });
}

// Export for use in tests or demonstrations
export { createTestKingdom };
