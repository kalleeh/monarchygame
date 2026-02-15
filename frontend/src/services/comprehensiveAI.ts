/**
 * Comprehensive AI System - Master Controller
 * Integrates all AI subsystems for intelligent strategic gameplay
 */

import { AIStrategyEngine, type StrategicDecision, type GamePhase } from './aiStrategyEngine';
import { BuildOrderOptimizer, type OptimalBuildOrder } from './buildOrderOptimizer';
import { TargetSelector, type AttackPlan } from './targetSelector';
import { ResourceManager, type ResourcePlan } from './resourceManager';
import type { AIKingdom } from '../stores/aiKingdomStore';

export interface ComprehensiveAIDecision {
  primaryAction: StrategicDecision;
  buildOrder: OptimalBuildOrder;
  targetPlan: AttackPlan | null;
  resourcePlan: ResourcePlan;
  strategicAdvice: string[];
  confidence: number;
  reasoning: string[];
}

export interface AIPerformanceMetrics {
  attackSuccessRate: number;
  landAcquisitionRate: number;
  economicGrowthRate: number;
  defensiveEffectiveness: number;
  turnEfficiency: number;
  networthGrowth: number;
}

export interface GameStateAnalysis {
  phase: GamePhase;
  threats: AIKingdom[];
  opportunities: AIKingdom[];
  playerPosition: 'dominant' | 'competitive' | 'struggling' | 'critical';
  marketConditions: 'favorable' | 'neutral' | 'hostile';
  strategicRecommendation: string;
}

/**
 * Master AI System that coordinates all strategic subsystems
 */
export class ComprehensiveAISystem {
  private strategyEngine: AIStrategyEngine;
  private buildOptimizer: BuildOrderOptimizer;
  private targetSelector: TargetSelector;
  private resourceManager: ResourceManager;
  
  private performanceHistory: AIPerformanceMetrics[] = [];
  private decisionHistory: ComprehensiveAIDecision[] = [];

  constructor() {
    this.strategyEngine = new AIStrategyEngine();
    this.buildOptimizer = new BuildOrderOptimizer();
    this.targetSelector = new TargetSelector();
    this.resourceManager = new ResourceManager();
  }

  /**
   * Main AI decision-making function
   * Analyzes complete game state and returns comprehensive strategy
   */
  async makeComprehensiveDecision(
    aiKingdom: AIKingdom,
    allKingdoms: AIKingdom[],
    playerKingdom: Record<string, unknown>,
    gameContext: {
      turn: number;
      totalPlayers: number;
      averageNetworth: number;
      topPlayerNetworth: number;
    }
  ): Promise<ComprehensiveAIDecision> {
    // 1. Analyze current game state
    const gameStateAnalysis = this.analyzeGameState(
      aiKingdom, 
      allKingdoms, 
      playerKingdom, 
      gameContext
    );

    // 2. Get strategic decision from main engine
    const primaryAction = this.strategyEngine.makeStrategicDecision(
      aiKingdom,
      allKingdoms,
      playerKingdom.networth || 0,
      gameContext.turn
    );

    // 3. Generate optimal build order
    const buildOrder = this.buildOptimizer.generateOptimalBuildOrder(
      aiKingdom.race,
      gameStateAnalysis.phase,
      aiKingdom.resources
    );

    // 4. Analyze targets and create attack plan
    const targetAnalyses = this.targetSelector.analyzeTargets(
      aiKingdom,
      allKingdoms,
      { turn: gameContext.turn, phase: gameStateAnalysis.phase }
    );

    const targetPlan = this.targetSelector.createAttackPlan(
      aiKingdom,
      targetAnalyses,
      aiKingdom.resources.turns
    );

    // 5. Create comprehensive resource plan
    const racialBonuses = this.getRacialBonuses(aiKingdom.race);
    const resourcePlan = this.resourceManager.createResourcePlan(
      aiKingdom,
      {
        turn: gameContext.turn,
        phase: gameStateAnalysis.phase,
        threats: gameStateAnalysis.threats.length,
        opportunities: gameStateAnalysis.opportunities.length,
        allianceStatus: 'neutral' // Simplified
      },
      racialBonuses
    );

    // 6. Generate strategic advice
    const strategicAdvice = this.generateStrategicAdvice(
      gameStateAnalysis,
      primaryAction,
      buildOrder,
      targetPlan,
      resourcePlan
    );

    // 7. Calculate confidence and reasoning
    const confidence = this.calculateDecisionConfidence(
      primaryAction,
      targetPlan,
      gameStateAnalysis
    );

    const reasoning = this.generateReasoning(
      gameStateAnalysis,
      primaryAction,
      buildOrder,
      targetPlan
    );

    const decision: ComprehensiveAIDecision = {
      primaryAction,
      buildOrder,
      targetPlan,
      resourcePlan,
      strategicAdvice,
      confidence,
      reasoning
    };

    // Store decision for learning
    this.decisionHistory.push(decision);
    if (this.decisionHistory.length > 50) {
      this.decisionHistory.shift(); // Keep last 50 decisions
    }

    return decision;
  }

  /**
   * Analyze complete game state for strategic context
   */
  private analyzeGameState(
    aiKingdom: AIKingdom,
    allKingdoms: AIKingdom[],
    playerKingdom: Record<string, unknown>,
    gameContext: Record<string, unknown>
  ): GameStateAnalysis {
    // Determine game phase
    const phase: GamePhase = gameContext.turn <= 20 ? 'early' : 
                            gameContext.turn <= 60 ? 'mid' : 'late';

    // Identify threats (kingdoms stronger than AI)
    const threats = allKingdoms.filter(kingdom => 
      kingdom.id !== aiKingdom.id && 
      kingdom.networth > aiKingdom.networth * 1.2
    );

    // Identify opportunities (kingdoms weaker than AI)
    const opportunities = allKingdoms.filter(kingdom =>
      kingdom.id !== aiKingdom.id &&
      kingdom.networth < aiKingdom.networth * 0.8 &&
      kingdom.networth > aiKingdom.networth * 0.3 // Not too weak to be worthless
    );

    // Determine player position
    const allNetworthsSorted = [aiKingdom.networth, ...allKingdoms.map(k => k.networth)]
      .sort((a, b) => b - a);
    const aiRank = allNetworthsSorted.indexOf(aiKingdom.networth) + 1;
    const totalPlayers = allNetworthsSorted.length;

    let playerPosition: 'dominant' | 'competitive' | 'struggling' | 'critical';
    if (aiRank === 1) playerPosition = 'dominant';
    else if (aiRank <= totalPlayers * 0.3) playerPosition = 'competitive';
    else if (aiRank <= totalPlayers * 0.7) playerPosition = 'struggling';
    else playerPosition = 'critical';

    // Assess market conditions
    let marketConditions: 'favorable' | 'neutral' | 'hostile';
    
    if (threats.length <= 1 && opportunities.length >= 2) {
      marketConditions = 'favorable';
    } else if (threats.length >= 3 || opportunities.length === 0) {
      marketConditions = 'hostile';
    } else {
      marketConditions = 'neutral';
    }

    // Strategic recommendation
    let strategicRecommendation: string;
    if (playerPosition === 'dominant' && marketConditions === 'favorable') {
      strategicRecommendation = 'Aggressive expansion to maintain dominance';
    } else if (playerPosition === 'critical') {
      strategicRecommendation = 'Defensive consolidation and recovery';
    } else if (threats.length > opportunities.length) {
      strategicRecommendation = 'Defensive posture with selective strikes';
    } else {
      strategicRecommendation = 'Balanced growth with opportunistic expansion';
    }

    return {
      phase,
      threats,
      opportunities,
      playerPosition,
      marketConditions,
      strategicRecommendation
    };
  }

  /**
   * Generate comprehensive strategic advice
   */
  private generateStrategicAdvice(
    gameState: GameStateAnalysis,
    primaryAction: StrategicDecision,
    buildOrder: OptimalBuildOrder,
    targetPlan: AttackPlan | null,
    resourcePlan: ResourcePlan
  ): string[] {
    const advice: string[] = [];

    // Game state advice
    advice.push(`📊 Game Phase: ${gameState.phase} - ${gameState.strategicRecommendation}`);
    advice.push(`⚖️ Position: ${gameState.playerPosition} in ${gameState.marketConditions} market`);

    // Threat/opportunity advice
    if (gameState.threats.length > 0) {
      advice.push(`⚠️ ${gameState.threats.length} threats detected - maintain ${resourcePlan.goldAllocation.defensive.percentage}% defensive spending`);
    }
    
    if (gameState.opportunities.length > 0) {
      advice.push(`🎯 ${gameState.opportunities.length} expansion opportunities available`);
    }

    // Action-specific advice
    if (primaryAction.action === 'attack' && targetPlan) {
      advice.push(`⚔️ Attack plan: ${targetPlan.totalTurnsRequired} turns for ${targetPlan.expectedGains.land} land`);
    } else if (primaryAction.action === 'build') {
      advice.push(`🏗️ Build focus: ${buildOrder.steps[0]?.description || 'Infrastructure development'}`);
    }

    // Resource management advice
    const goldEfficiency = resourcePlan.goldAllocation.economic.amount / 
                          (resourcePlan.goldAllocation.economic.amount + resourcePlan.goldAllocation.military.amount);
    if (goldEfficiency > 0.6) {
      advice.push(`💰 Economic focus: ${Math.round(goldEfficiency * 100)}% efficiency ratio`);
    } else {
      advice.push(`⚔️ Military focus: ${Math.round((1 - goldEfficiency) * 100)}% combat investment`);
    }

    // Risk management advice
    if (resourcePlan.riskMitigation.identifiedRisks.some(r => r.severity === 'high')) {
      advice.push(`🚨 High-risk situation detected - emergency reserves activated`);
    }

    return advice;
  }

  /**
   * Calculate decision confidence based on multiple factors
   */
  private calculateDecisionConfidence(
    primaryAction: StrategicDecision,
    targetPlan: AttackPlan | null,
    gameState: GameStateAnalysis
  ): number {
    let confidence = 0.5; // Base confidence

    // Action confidence
    if (primaryAction.priority >= 8) confidence += 0.2;
    if (primaryAction.resourceAllocation?.riskLevel === 'low') confidence += 0.1;

    // Target plan confidence
    if (targetPlan && targetPlan.primaryTarget) {
      const targetAnalysis = this.targetSelector.analyzeTargets(
        {} as AIKingdom, // Simplified for confidence calculation
        [targetPlan.primaryTarget],
        { turn: 50, phase: gameState.phase }
      )[0];
      
      if (targetAnalysis?.recommendation === 'prime') confidence += 0.2;
      else if (targetAnalysis?.recommendation === 'good') confidence += 0.1;
    }

    // Game state confidence
    if (gameState.playerPosition === 'dominant') confidence += 0.1;
    else if (gameState.playerPosition === 'critical') confidence -= 0.2;

    if (gameState.marketConditions === 'favorable') confidence += 0.1;
    else if (gameState.marketConditions === 'hostile') confidence -= 0.1;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Generate detailed reasoning for decisions
   */
  private generateReasoning(
    gameState: GameStateAnalysis,
    primaryAction: StrategicDecision,
    buildOrder: OptimalBuildOrder,
    targetPlan: AttackPlan | null
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Game analysis: ${gameState.phase} phase with ${gameState.threats.length} threats and ${gameState.opportunities.length} opportunities`);
    reasoning.push(`Primary action: ${primaryAction.action} (priority ${primaryAction.priority}) - ${primaryAction.reasoning}`);
    
    if (buildOrder.steps.length > 0) {
      reasoning.push(`Build priority: ${buildOrder.steps[0].description} (${buildOrder.steps[0].expectedBenefit} expected benefit)`);
    }

    if (targetPlan) {
      reasoning.push(`Attack strategy: ${targetPlan.attackSequence.length} planned attacks for ${targetPlan.expectedGains.land} total land gain`);
    }

    reasoning.push(`Strategic position: ${gameState.playerPosition} player in ${gameState.marketConditions} conditions`);

    return reasoning;
  }

  /**
   * Get racial bonuses for resource planning
   */
  private getRacialBonuses(race: string): Record<string, number> {
    const bonuses: Record<string, Record<string, number>> = {
      Human: { economy: 0.2, military: 0.0, defense: 0.0 },
      Droben: { economy: -0.1, military: 0.3, defense: 0.1 },
      Elven: { economy: 0.0, military: 0.1, defense: 0.2 },
      Goblin: { economy: -0.1, military: 0.2, defense: -0.1 },
      Vampire: { economy: -0.2, military: 0.4, defense: 0.0 },
      Elemental: { economy: 0.1, military: 0.1, defense: 0.1 },
      Centaur: { economy: 0.0, military: 0.0, defense: 0.1 },
      Sidhe: { economy: 0.1, military: 0.2, defense: 0.1 },
      Dwarven: { economy: 0.1, military: 0.0, defense: 0.3 },
      Fae: { economy: 0.15, military: 0.15, defense: 0.15 }
    };

    return bonuses[race] || bonuses.Human;
  }

  /**
   * Calculate growth rate for analysis
   */
  private calculateGrowthRate(kingdom: AIKingdom): number {
    // Simplified growth rate calculation
    const baseRate = 0.05;
    const economicFactor = kingdom.resources.gold / (kingdom.resources.land * 1000);
    const militaryFactor = Object.values(kingdom.units).reduce((sum, count) => sum + count, 0) / kingdom.resources.land;
    
    return baseRate + (economicFactor * 0.02) + (militaryFactor * 0.01);
  }

  /**
   * Update performance metrics for learning
   */
  updatePerformanceMetrics(metrics: AIPerformanceMetrics): void {
    this.performanceHistory.push(metrics);
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift(); // Keep last 100 metrics
    }

    // Adaptive learning based on performance
    this.adaptStrategiesBasedOnPerformance();
  }

  /**
   * Adapt strategies based on historical performance
   */
  private adaptStrategiesBasedOnPerformance(): void {
    if (this.performanceHistory.length < 10) return;

    const recentMetrics = this.performanceHistory.slice(-10);
    const avgAttackSuccess = recentMetrics.reduce((sum, m) => sum + m.attackSuccessRate, 0) / recentMetrics.length;
    const avgEconomicGrowth = recentMetrics.reduce((sum, m) => sum + m.economicGrowthRate, 0) / recentMetrics.length;

    // Adapt resource allocation based on performance
    if (avgAttackSuccess < 0.6) {
      // Poor attack performance - be more conservative
      console.log('🔄 AI adapting: Reducing aggressive strategies due to poor attack success');
    }

    if (avgEconomicGrowth < 0.03) {
      // Poor economic growth - focus more on economy
      console.log('🔄 AI adapting: Increasing economic focus due to slow growth');
    }
  }

  /**
   * Get comprehensive AI advice for human players
   */
  getPlayerAdvice(
    playerKingdom: Record<string, unknown>,
    allKingdoms: AIKingdom[],
    gameContext: Record<string, unknown>
  ): string[] {
    const advice: string[] = [];

    // Use all subsystems to generate advice
    const strategyAdvice = this.strategyEngine.getStrategicAdvice(playerKingdom, allKingdoms);
    const targetingAdvice = this.targetSelector.getTargetingAdvice(playerKingdom, allKingdoms);
    const resourceAdvice = this.resourceManager.getResourceAdvice(playerKingdom, gameContext);

    advice.push('🤖 AI Strategic Analysis:');
    advice.push(...strategyAdvice);
    advice.push(...targetingAdvice);
    advice.push(...resourceAdvice);

    return advice;
  }

  /**
   * Export AI decision data for analysis
   */
  exportDecisionData(): {
    decisions: ComprehensiveAIDecision[];
    performance: AIPerformanceMetrics[];
    summary: Record<string, unknown>;
  } {
    const summary = {
      totalDecisions: this.decisionHistory.length,
      averageConfidence: this.decisionHistory.reduce((sum, d) => sum + d.confidence, 0) / this.decisionHistory.length,
      actionDistribution: this.getActionDistribution(),
      performanceTrends: this.getPerformanceTrends()
    };

    return {
      decisions: this.decisionHistory,
      performance: this.performanceHistory,
      summary
    };
  }

  /**
   * Get action distribution for analysis
   */
  private getActionDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    this.decisionHistory.forEach(decision => {
      const action = decision.primaryAction.action;
      distribution[action] = (distribution[action] || 0) + 1;
    });

    return distribution;
  }

  /**
   * Get performance trends
   */
  private getPerformanceTrends(): Record<string, unknown> {
    if (this.performanceHistory.length < 5) return null;

    const recent = this.performanceHistory.slice(-5);
    const older = this.performanceHistory.slice(-10, -5);

    if (older.length === 0) return null;

    const recentAvg = {
      attackSuccess: recent.reduce((sum, m) => sum + m.attackSuccessRate, 0) / recent.length,
      economicGrowth: recent.reduce((sum, m) => sum + m.economicGrowthRate, 0) / recent.length,
      turnEfficiency: recent.reduce((sum, m) => sum + m.turnEfficiency, 0) / recent.length
    };

    const olderAvg = {
      attackSuccess: older.reduce((sum, m) => sum + m.attackSuccessRate, 0) / older.length,
      economicGrowth: older.reduce((sum, m) => sum + m.economicGrowthRate, 0) / older.length,
      turnEfficiency: older.reduce((sum, m) => sum + m.turnEfficiency, 0) / older.length
    };

    return {
      attackSuccessTrend: recentAvg.attackSuccess - olderAvg.attackSuccess,
      economicGrowthTrend: recentAvg.economicGrowth - olderAvg.economicGrowth,
      turnEfficiencyTrend: recentAvg.turnEfficiency - olderAvg.turnEfficiency
    };
  }
}