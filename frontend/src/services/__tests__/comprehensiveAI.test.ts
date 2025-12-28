/**
 * Comprehensive AI System Test
 * Demonstrates intelligent strategic decision making using actual game mechanics
 */

import { describe, it, expect } from 'vitest';
import { ComprehensiveAISystem } from '../comprehensiveAI';

describe('ComprehensiveAI', () => {
  it('should exist and be importable', () => {
    expect(ComprehensiveAISystem).toBeDefined();
  });
});

// Mock AI kingdoms for testing
const createMockAIKingdom = (
  id: string,
  race: string,
  networth: number,
  land: number,
  gold: number,
  turns: number
): AIKingdom => ({
  id,
  name: `${race} Kingdom ${id}`,
  race,
  networth,
  resources: {
    land,
    gold,
    population: Math.floor(land * 0.8),
    turns
  },
  units: {
    tier1: Math.floor(land * 0.5),
    tier2: Math.floor(land * 0.3),
    tier3: Math.floor(land * 0.2),
    tier4: Math.floor(land * 0.1)
  }
});

// Mock player kingdom
const createMockPlayerKingdom = () => ({
  id: 'player',
  name: 'Player Kingdom',
  race: 'Human',
  networth: 180000,
  resources: {
    land: 1200,
    gold: 60000,
    population: 1000,
    turns: 48
  },
  units: {
    tier1: 600,
    tier2: 400,
    tier3: 200,
    tier4: 100
  }
});

/**
 * Test the comprehensive AI system
 */
export async function testComprehensiveAI(): Promise<void> {
  console.log('🤖 Testing Comprehensive AI Strategy System\n');
  console.log('=' .repeat(60));

  const aiSystem = new ComprehensiveAISystem();

  // Create test scenario
  const aiKingdom = createMockAIKingdom('ai1', 'Droben', 150000, 1000, 50000, 44);
  const playerKingdom = createMockPlayerKingdom();
  
  const allKingdoms: AIKingdom[] = [
    aiKingdom,
    createMockAIKingdom('ai2', 'Elven', 120000, 800, 40000, 36),
    createMockAIKingdom('ai3', 'Goblin', 90000, 600, 30000, 40),
    createMockAIKingdom('ai4', 'Human', 200000, 1400, 80000, 32),
    createMockAIKingdom('ai5', 'Vampire', 110000, 700, 35000, 28)
  ];

  const gameContext = {
    turn: 45,
    totalPlayers: 6,
    averageNetworth: 142000,
    topPlayerNetworth: 200000
  };

  console.log('📊 GAME STATE ANALYSIS');
  console.log('-'.repeat(40));
  console.log(`Turn: ${gameContext.turn} (Mid-game phase)`);
  console.log(`AI Kingdom: ${aiKingdom.name} (${aiKingdom.race})`);
  console.log(`Networth: ${aiKingdom.networth.toLocaleString()}`);
  console.log(`Resources: ${aiKingdom.resources.land} land, ${aiKingdom.resources.gold.toLocaleString()} gold, ${aiKingdom.resources.turns} turns`);
  console.log(`Position: 3rd of 6 players\n`);

  // Get comprehensive AI decision
  console.log('🧠 AI STRATEGIC ANALYSIS');
  console.log('-'.repeat(40));
  
  const decision = await aiSystem.makeComprehensiveDecision(
    aiKingdom,
    allKingdoms,
    playerKingdom,
    gameContext
  );

  // Display primary action
  console.log(`Primary Action: ${decision.primaryAction.action.toUpperCase()}`);
  console.log(`Priority: ${decision.primaryAction.priority}/10`);
  console.log(`Reasoning: ${decision.primaryAction.reasoning}`);
  
  if (decision.primaryAction.resourceAllocation) {
    const allocation = decision.primaryAction.resourceAllocation;
    console.log(`Resource Cost: ${allocation.goldSpend.toLocaleString()} gold, ${allocation.turnsSpend} turns`);
    console.log(`Expected Return: ${allocation.expectedReturn.toLocaleString()}`);
    console.log(`Risk Level: ${allocation.riskLevel}\n`);
  }

  // Display build order
  console.log('🏗️ OPTIMAL BUILD ORDER');
  console.log('-'.repeat(40));
  console.log(`Race Strategy: ${decision.buildOrder.race} (${decision.buildOrder.phase} phase)`);
  console.log(`Total Investment: ${decision.buildOrder.totalCost.toLocaleString()} gold`);
  console.log(`Expected Networth: ${decision.buildOrder.expectedNetworth.toLocaleString()}`);
  console.log(`Time to Complete: ${decision.buildOrder.timeToComplete} turns\n`);
  
  decision.buildOrder.steps.slice(0, 3).forEach((step, index) => {
    console.log(`${index + 1}. ${step.description}`);
    console.log(`   Cost: ${step.goldCost.toLocaleString()} gold, ${step.turnCost} turns`);
    console.log(`   Benefit: ${step.expectedBenefit} (Priority: ${step.priority})`);
  });
  console.log();

  // Display target analysis
  if (decision.targetPlan) {
    console.log('🎯 TARGET ANALYSIS & ATTACK PLAN');
    console.log('-'.repeat(40));
    console.log(`Primary Target: ${decision.targetPlan.primaryTarget.name}`);
    console.log(`Target Networth: ${decision.targetPlan.primaryTarget.networth.toLocaleString()}`);
    console.log(`Expected Gains: ${decision.targetPlan.expectedGains.land} land, ${decision.targetPlan.expectedGains.gold.toLocaleString()} gold`);
    console.log(`Total Turns Required: ${decision.targetPlan.totalTurnsRequired}`);
    console.log(`Alternative Targets: ${decision.targetPlan.alternativeTargets.length}\n`);
    
    console.log('Attack Sequence:');
    decision.targetPlan.attackSequence.forEach((step, index) => {
      console.log(`${index + 1}. ${step.attackType} vs ${step.target.name}`);
      console.log(`   Cost: ${step.turnCost} turns`);
      console.log(`   Expected: ${step.expectedOutcome}`);
    });
    console.log();
  }

  // Display resource allocation
  console.log('💰 RESOURCE ALLOCATION PLAN');
  console.log('-'.repeat(40));
  const goldAlloc = decision.resourcePlan.goldAllocation;
  console.log(`Economic: ${goldAlloc.economic.amount.toLocaleString()} (${goldAlloc.economic.percentage}%)`);
  console.log(`Military: ${goldAlloc.military.amount.toLocaleString()} (${goldAlloc.military.percentage}%)`);
  console.log(`Defensive: ${goldAlloc.defensive.amount.toLocaleString()} (${goldAlloc.defensive.percentage}%)`);
  console.log(`Emergency: ${goldAlloc.emergency.amount.toLocaleString()} (${goldAlloc.emergency.percentage}%)`);
  console.log(`Opportunity: ${goldAlloc.opportunity.amount.toLocaleString()} (${goldAlloc.opportunity.percentage}%)\n`);

  // Display growth projections
  console.log('📈 GROWTH PROJECTIONS');
  console.log('-'.repeat(40));
  const growth = decision.resourcePlan.growthProjections;
  console.log(`Short-term (${growth.shortTerm.turns} turns): ${growth.shortTerm.expectedNetworth.toLocaleString()} networth (${Math.round(growth.shortTerm.confidence * 100)}% confidence)`);
  console.log(`Medium-term (${growth.mediumTerm.turns} turns): ${growth.mediumTerm.expectedNetworth.toLocaleString()} networth (${Math.round(growth.mediumTerm.confidence * 100)}% confidence)`);
  console.log(`Long-term (${growth.longTerm.turns} turns): ${growth.longTerm.expectedNetworth.toLocaleString()} networth (${Math.round(growth.longTerm.confidence * 100)}% confidence)\n`);

  // Display risk assessment
  console.log('⚠️ RISK ASSESSMENT');
  console.log('-'.repeat(40));
  const risks = decision.resourcePlan.riskMitigation.identifiedRisks;
  risks.forEach(risk => {
    console.log(`${risk.type.toUpperCase()}: ${risk.severity} severity (${Math.round(risk.probability * 100)}% probability)`);
    console.log(`   ${risk.description}`);
  });
  console.log();

  // Display strategic advice
  console.log('💡 STRATEGIC ADVICE');
  console.log('-'.repeat(40));
  decision.strategicAdvice.forEach(advice => {
    console.log(`${advice}`);
  });
  console.log();

  // Display decision confidence and reasoning
  console.log('🎯 DECISION ANALYSIS');
  console.log('-'.repeat(40));
  console.log(`Overall Confidence: ${Math.round(decision.confidence * 100)}%`);
  console.log('\nDetailed Reasoning:');
  decision.reasoning.forEach((reason, index) => {
    console.log(`${index + 1}. ${reason}`);
  });
  console.log();

  // Test performance tracking
  console.log('📊 PERFORMANCE SIMULATION');
  console.log('-'.repeat(40));
  
  // Simulate some performance metrics
  const mockMetrics = {
    attackSuccessRate: 0.75,
    landAcquisitionRate: 0.068, // 6.8% average land gain
    economicGrowthRate: 0.045,
    defensiveEffectiveness: 0.8,
    turnEfficiency: 1.8, // land per turn
    networthGrowth: 0.052
  };

  aiSystem.updatePerformanceMetrics(mockMetrics);
  console.log(`Attack Success Rate: ${Math.round(mockMetrics.attackSuccessRate * 100)}%`);
  console.log(`Land Acquisition Rate: ${(mockMetrics.landAcquisitionRate * 100).toFixed(1)}% per attack`);
  console.log(`Economic Growth Rate: ${(mockMetrics.economicGrowthRate * 100).toFixed(1)}% per turn`);
  console.log(`Turn Efficiency: ${mockMetrics.turnEfficiency.toFixed(1)} land per turn`);
  console.log(`Networth Growth: ${(mockMetrics.networthGrowth * 100).toFixed(1)}% per turn\n`);

  // Test player advice system
  console.log('🎮 PLAYER ADVICE SYSTEM');
  console.log('-'.repeat(40));
  const playerAdvice = aiSystem.getPlayerAdvice(playerKingdom, allKingdoms, gameContext);
  playerAdvice.forEach(advice => {
    console.log(advice);
  });
  console.log();

  // Export decision data for analysis
  const exportData = aiSystem.exportDecisionData();
  console.log('📋 AI SYSTEM SUMMARY');
  console.log('-'.repeat(40));
  console.log(`Total Decisions Made: ${exportData.summary.totalDecisions}`);
  console.log(`Average Confidence: ${Math.round(exportData.summary.averageConfidence * 100)}%`);
  console.log('Action Distribution:');
  Object.entries(exportData.summary.actionDistribution).forEach(([action, count]) => {
    console.log(`  ${action}: ${count} times`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ Comprehensive AI System Test Complete');
  console.log('🎯 Key Features Demonstrated:');
  console.log('   • Intelligent strategic decision making');
  console.log('   • Race-specific build order optimization');
  console.log('   • Advanced target selection using combat mechanics');
  console.log('   • Comprehensive resource management');
  console.log('   • Risk assessment and mitigation');
  console.log('   • Long-term strategic planning');
  console.log('   • Performance tracking and adaptation');
  console.log('   • Player advice and guidance');
}

/**
 * Test different race strategies
 */
export async function testRaceStrategies(): Promise<void> {
  console.log('\n🏰 TESTING RACE-SPECIFIC STRATEGIES');
  console.log('=' .repeat(60));

  const aiSystem = new ComprehensiveAISystem();
  const races = ['Human', 'Droben', 'Elven', 'Goblin', 'Vampire'];
  
  for (const race of races) {
    console.log(`\n${race.toUpperCase()} STRATEGY ANALYSIS`);
    console.log('-'.repeat(40));
    
    const aiKingdom = createMockAIKingdom(`${race.toLowerCase()}1`, race, 150000, 1000, 50000, 40);
    const allKingdoms = [
      aiKingdom,
      createMockAIKingdom('enemy1', 'Human', 120000, 800, 40000, 36),
      createMockAIKingdom('enemy2', 'Elven', 180000, 1200, 60000, 32)
    ];
    
    const decision = await aiSystem.makeComprehensiveDecision(
      aiKingdom,
      allKingdoms,
      createMockPlayerKingdom(),
      { turn: 30, totalPlayers: 4, averageNetworth: 150000, topPlayerNetworth: 180000 }
    );

    console.log(`Primary Strategy: ${decision.primaryAction.action} (Priority: ${decision.primaryAction.priority})`);
    console.log(`Build Focus: ${decision.buildOrder.steps[0]?.type || 'None'}`);
    console.log(`Resource Allocation: ${decision.resourcePlan.goldAllocation.economic.percentage}% economic, ${decision.resourcePlan.goldAllocation.military.percentage}% military`);
    
    if (decision.targetPlan) {
      console.log(`Attack Plan: ${decision.targetPlan.attackSequence.length} attacks planned`);
    } else {
      console.log('Attack Plan: No viable targets');
    }
    
    console.log(`Confidence: ${Math.round(decision.confidence * 100)}%`);
  }

  console.log('\n✅ Race Strategy Analysis Complete');
}

// Export test functions for use in other files
// Note: Functions already exported above with their declarations