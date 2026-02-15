/**
 * Comprehensive AI Strategy Engine
 * Uses actual game mechanics + AI personalities for intelligent decision making
 */

import type { AIKingdom } from '../stores/aiKingdomStore';
import { AIPersonalitySystem, type AIPersonality } from './aiPersonalitySystem';

export type GamePhase = 'early' | 'mid' | 'late';
export type StrategyType = 'economic' | 'aggressive' | 'defensive' | 'balanced';

export interface StrategicDecision {
  action: 'build' | 'train' | 'attack' | 'defend' | 'wait';
  priority: number;
  reasoning: string;
  target?: AIKingdom;
  resourceAllocation?: ResourceAllocation;
  personalityInfluence?: string; // Why this personality made this decision
}

export interface ResourceAllocation {
  goldSpend: number;
  turnsSpend: number;
  expectedReturn: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CombatAnalysis {
  landGainExpected: number;
  turnCost: number;
  successProbability: number;
  efficiency: number; // land per turn
  warDeclarationRisk: boolean;
}

export interface BuildOrder {
  phase: GamePhase;
  priorities: Array<{
    type: 'economic' | 'military' | 'defensive';
    allocation: number; // percentage
    reasoning: string;
  }>;
}

/**
 * Strategic AI Engine that uses actual game mechanics + AI personalities
 */
export class AIStrategyEngine {
  private gamePhase: GamePhase = 'early';
  private strategyType: StrategyType = 'balanced';
  private warDeclarations: Map<string, number> = new Map();
  private personalitySystem: AIPersonalitySystem = new AIPersonalitySystem();

  /**
   * Main decision engine - analyzes game state and returns optimal action with personality
   */
  makeStrategicDecision(
    ai: AIKingdom, 
    allKingdoms: AIKingdom[], 
    playerNetworth: number,
    currentTurn: number
  ): StrategicDecision {
    // Update game phase
    this.updateGamePhase(currentTurn);
    
    // Get AI personality (generates if new, retrieves if existing)
    const personality = this.personalitySystem.getPersonality(ai.id, ai.race);
    
    // Get race-specific strategy modified by personality
    const raceStrategy = this.getPersonalityStrategy(ai.race, personality);
    
    // Analyze all possible actions with personality influence
    const buildDecision = this.analyzeBuildAction(ai, raceStrategy, personality);
    const trainDecision = this.analyzeTrainAction(ai, raceStrategy, personality);
    const attackDecision = this.analyzeAttackAction(ai, allKingdoms, raceStrategy, personality);
    const defendDecision = this.analyzeDefendAction(ai, allKingdoms, personality);
    
    // Select highest priority action
    const decisions = [buildDecision, trainDecision, attackDecision, defendDecision]
      .filter(d => d !== null)
      .sort((a, b) => b!.priority - a!.priority);
    
    const finalDecision = decisions[0] || {
      action: 'wait' as const,
      priority: 0,
      reasoning: 'No viable actions available',
      personalityInfluence: `${personality.name} ${personality.title} is being cautious`
    };
    
    return finalDecision;
  }

  /**
   * Get personality-modified race strategy
   */
  private getPersonalityStrategy(race: string, personality: AIPersonality): BuildOrder {
    const baseStrategy = this.getRaceStrategy(race);
    
    // Modify strategy based on personality traits
    const modifiedPriorities = baseStrategy.priorities.map(priority => ({
      ...priority,
      allocation: this.adjustAllocationByPersonality(priority, personality)
    }));
    
    return {
      ...baseStrategy,
      priorities: modifiedPriorities
    };
  }
  
  /**
   * Adjust allocation percentages based on personality
   */
  private adjustAllocationByPersonality(
    priority: { type: 'economic' | 'military' | 'defensive'; allocation: number; reasoning: string },
    personality: AIPersonality
  ): number {
    let adjustment = 1.0;
    
    switch (priority.type) {
      case 'economic':
        adjustment = personality.traits.economy;
        break;
      case 'military':
        adjustment = personality.traits.aggression;
        break;
      case 'defensive':
        adjustment = 2.0 - personality.traits.risk; // Risk averse = more defensive
        break;
    }
    
    // Apply adjustment and ensure total doesn't exceed 100%
    return Math.max(10, Math.min(70, priority.allocation * adjustment));
  }

  /**
   * Analyze build action using race-specific build orders + personality
   */
  private analyzeBuildAction(ai: AIKingdom, strategy: BuildOrder, personality: AIPersonality): StrategicDecision | null {
    const currentPhase = strategy.priorities.find(p => p.type === 'economic');
    if (!currentPhase) return null;

    const buildCost = this.calculateBuildCost(ai);
    
    if (ai.resources.gold < buildCost) return null;

    // Calculate expected return on building investment
    const expectedLandGain = Math.floor(buildCost / 500); // Simplified: 500 gold per land
    const expectedReturn = expectedLandGain * 1000; // Land value multiplier
    
    // Personality influence on priority
    const personalityPriority = this.gamePhase === 'early' ? 8 : 5;
    const adjustedPriority = Math.floor(personalityPriority * personality.modifiers.buildPriority / 10);
    
    return {
      action: 'build',
      priority: adjustedPriority,
      reasoning: `Build ${expectedLandGain} land for economic growth`,
      personalityInfluence: `${personality.name} (${personality.persona}) prioritizes ${personality.behavior.economicStrategy}`,
      resourceAllocation: {
        goldSpend: buildCost,
        turnsSpend: 1,
        expectedReturn,
        riskLevel: personality.traits.risk > 1.2 ? 'high' : personality.traits.risk < 0.8 ? 'low' : 'medium'
      }
    };
  }

  /**
   * Analyze training action based on race strengths + personality
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private analyzeTrainAction(ai: AIKingdom, strategy: BuildOrder, _personality: AIPersonality): StrategicDecision | null {
    const militaryPhase = strategy.priorities.find(p => p.type === 'military');
    if (!militaryPhase) return null;

    const totalUnits = Object.values(ai.units).reduce((sum, count) => sum + count, 0);
    const unitsPerLand = totalUnits / Math.max(ai.resources.land, 1);
    const trainCost = this.calculateTrainCost(ai);

    if (ai.resources.gold < trainCost || unitsPerLand > 3) return null;

    return {
      action: 'train',
      priority: unitsPerLand < 1.5 ? 9 : 6,
      reasoning: `Train units to reach optimal ratio (current: ${unitsPerLand.toFixed(2)}/land)`,
      resourceAllocation: {
        goldSpend: trainCost,
        turnsSpend: 1,
        expectedReturn: trainCost * 1.2, // Military investment return
        riskLevel: 'medium'
      }
    };
  }

  /**
   * Intelligent attack analysis using actual combat mechanics
   */
  private analyzeAttackAction(
    ai: AIKingdom, 
    targets: AIKingdom[], 
    _strategy: BuildOrder
  ): StrategicDecision | null {
    void _strategy; // Explicitly mark as intentionally unused
    if (ai.resources.turns < 4) return null;

    const viableTargets = targets
      .filter(target => target.id !== ai.id)
      .map(target => ({
        target,
        analysis: this.analyzeCombatOutcome(ai, target)
      }))
      .filter(({ analysis }) => analysis.successProbability > 0.7)
      .sort((a, b) => b.analysis.efficiency - a.analysis.efficiency);

    if (viableTargets.length === 0) return null;

    const bestTarget = viableTargets[0];
    const { target, analysis } = bestTarget;

    return {
      action: 'attack',
      priority: analysis.efficiency > 2 ? 10 : 7,
      reasoning: `Attack ${target.name}: ${analysis.landGainExpected} land for ${analysis.turnCost} turns (${analysis.efficiency.toFixed(1)} land/turn)`,
      target,
      resourceAllocation: {
        goldSpend: 0,
        turnsSpend: analysis.turnCost,
        expectedReturn: analysis.landGainExpected * 1000,
        riskLevel: analysis.successProbability > 0.9 ? 'low' : 'medium'
      }
    };
  }

  /**
   * Combat analysis using actual game mechanics
   */
  private analyzeCombatOutcome(attacker: AIKingdom, defender: AIKingdom): CombatAnalysis {
    const networthRatio = attacker.networth / Math.max(defender.networth, 1);
    
    // Calculate turn cost based on networth difference (from combat-mechanics.ts)
    let turnCost = 4; // Base cost
    if (networthRatio >= 1.5) {
      turnCost = 6; // Easy target multiplier
    } else if (networthRatio <= 0.67) {
      turnCost = 8; // Hard target multiplier
    }

    // Calculate expected land gain (6.79%-7.35% from combat mechanics)
    let landGainPercent = 0.0679; // Minimum
    if (networthRatio >= 1.5) {
      landGainPercent = 0.0735; // Maximum for easy targets
    } else if (networthRatio >= 1.2) {
      landGainPercent = 0.070; // Good fight
    }

    const landGainExpected = Math.floor(defender.resources.land * landGainPercent);
    const efficiency = landGainExpected / Math.max(turnCost, 1);

    // Success probability based on networth ratio
    let successProbability = 0.5;
    if (networthRatio >= 1.5) successProbability = 0.95;
    else if (networthRatio >= 1.2) successProbability = 0.85;
    else if (networthRatio >= 0.8) successProbability = 0.65;

    // Check war declaration risk
    const attackCount = this.warDeclarations.get(defender.id) || 0;
    const warDeclarationRisk = attackCount >= 2; // 3rd attack triggers declaration

    return {
      landGainExpected,
      turnCost,
      successProbability,
      efficiency,
      warDeclarationRisk
    };
  }

  /**
   * Analyze defensive needs
   */
  private analyzeDefendAction(ai: AIKingdom, threats: AIKingdom[]): StrategicDecision | null {
    const immediateThreats = threats.filter(threat => 
      threat.networth > ai.networth * 0.8 && threat.resources.turns >= 4
    );

    if (immediateThreats.length === 0) return null;

    const defenseCost = Math.floor(ai.resources.gold * 0.3);
    
    return {
      action: 'defend',
      priority: immediateThreats.length > 1 ? 11 : 8,
      reasoning: `Strengthen defenses against ${immediateThreats.length} threats`,
      resourceAllocation: {
        goldSpend: defenseCost,
        turnsSpend: 1,
        expectedReturn: defenseCost * 0.8, // Defensive value
        riskLevel: 'low'
      }
    };
  }

  /**
   * Race-specific strategy templates
   */
  private getRaceStrategy(race: string): BuildOrder {
    const strategies: Record<string, BuildOrder> = {
      Human: {
        phase: this.gamePhase,
        priorities: [
          { type: 'economic', allocation: 50, reasoning: 'Leverage tithe bonus' },
          { type: 'military', allocation: 30, reasoning: 'Balanced military' },
          { type: 'defensive', allocation: 20, reasoning: 'Basic defense' }
        ]
      },
      Droben: {
        phase: this.gamePhase,
        priorities: [
          { type: 'military', allocation: 45, reasoning: 'Elite combat focus' },
          { type: 'economic', allocation: 35, reasoning: 'Support military' },
          { type: 'defensive', allocation: 20, reasoning: 'Minimal defense' }
        ]
      },
      Elven: {
        phase: this.gamePhase,
        priorities: [
          { type: 'defensive', allocation: 40, reasoning: 'Defensive specialization' },
          { type: 'military', allocation: 35, reasoning: 'Quality training' },
          { type: 'economic', allocation: 25, reasoning: 'Support infrastructure' }
        ]
      },
      Goblin: {
        phase: this.gamePhase,
        priorities: [
          { type: 'military', allocation: 50, reasoning: 'Early aggression' },
          { type: 'economic', allocation: 25, reasoning: 'Minimal economy' },
          { type: 'defensive', allocation: 25, reasoning: 'Basic defense' }
        ]
      }
    };

    return strategies[race] || strategies.Human;
  }

  /**
   * Update game phase based on turn count
   */
  private updateGamePhase(turn: number): void {
    if (turn <= 20) this.gamePhase = 'early';
    else if (turn <= 60) this.gamePhase = 'mid';
    else this.gamePhase = 'late';
  }

  /**
   * Calculate build costs based on current land
   */
  private calculateBuildCost(ai: AIKingdom): number {
    return Math.floor(ai.resources.land * 2.5); // Scaling cost
  }

  /**
   * Calculate training costs based on current army size
   */
  private calculateTrainCost(ai: AIKingdom): number {
    const totalUnits = Object.values(ai.units).reduce((sum, count) => sum + count, 0);
    return Math.floor(totalUnits * 10 + 1000); // Base cost + scaling
  }

  /**
   * Track war declarations for strategic planning
   */
  recordAttack(defenderId: string): void {
    // Prevent unbounded map growth - evict oldest entries if too large
    if (this.warDeclarations.size > 1000) {
      const firstKey = this.warDeclarations.keys().next().value;
      if (firstKey !== undefined) {
        this.warDeclarations.delete(firstKey);
      }
    }
    const current = this.warDeclarations.get(defenderId) || 0;
    this.warDeclarations.set(defenderId, current + 1);
  }

  /**
   * Get strategic recommendations for human players with personality context
   */
  getStrategicAdvice(
    playerKingdom: Record<string, unknown>, 
    aiKingdoms: AIKingdom[]
  ): string[] {
    const advice: string[] = [];
    const playerNetworth = playerKingdom.resources.land * 1000 + playerKingdom.resources.gold;

    // Analyze player's position
    const strongerEnemies = aiKingdoms.filter(ai => ai.networth > playerNetworth * 1.2);
    const weakerEnemies = aiKingdoms.filter(ai => ai.networth < playerNetworth * 0.8);

    if (strongerEnemies.length > 0) {
      advice.push(`⚠️ ${strongerEnemies.length} stronger enemies detected - focus on defense and growth`);
    }

    if (weakerEnemies.length > 0) {
      advice.push(`🎯 ${weakerEnemies.length} viable targets available - consider expansion`);
    }

    // Resource efficiency advice
    const goldPerLand = playerKingdom.resources.gold / Math.max(playerKingdom.resources.land, 1);
    if (goldPerLand < 50) {
      advice.push('💰 Low gold reserves - prioritize economic buildings');
    }

    return advice;
  }

  /**
   * Calculate combat ratio between two kingdoms
   */
  private calculateCombatRatio(attacker: AIKingdom, defender: AIKingdom): number {
    const attackerStrength = Object.values(attacker.units).reduce((sum, count) => sum + count, 0);
    const defenderStrength = Object.values(defender.units).reduce((sum, count) => sum + count, 0);
    return attackerStrength / Math.max(defenderStrength, 1);
  }

  /**
   * Analyze combat between two kingdoms
   */
  private analyzeCombat(attacker: AIKingdom, defender: AIKingdom): CombatAnalysis {
    const ratio = this.calculateCombatRatio(attacker, defender);
    const successProbability = Math.min(0.95, Math.max(0.1, (ratio - 0.8) / 1.2));
    const landGainExpected = Math.floor(defender.resources.land * 0.1 * successProbability);
    const turnCost = Math.ceil(4 / Math.max(ratio, 0.5));
    
    return {
      landGainExpected,
      turnCost,
      successProbability,
      efficiency: landGainExpected / Math.max(turnCost, 1),
      warDeclarationRisk: this.warDeclarations.get(defender.id) ? true : false
    };
  }

  /**
   * Calculate defense cost
   */
  private calculateDefenseCost(ai: AIKingdom): number {
    return Math.floor(ai.resources.land * 1.5);
  }

  /**
   * Select target based on personality preferences
   */
  private selectTargetByPersonality(targets: AIKingdom[], personality: AIPersonality): AIKingdom {
    // Filter by personality preferences
    const preferredTargets = targets.filter(target => {
      if (personality.behavior.preferredTargets.includes('weak')) {
        return target.networth < targets[0].networth * 0.8;
      }
      if (personality.behavior.preferredTargets.includes('strategic')) {
        return target.resources.land > 5000;
      }
      return true;
    });

    const finalTargets = preferredTargets.length > 0 ? preferredTargets : targets;
    
    // Select based on personality traits
    if (personality.traits.risk > 1.3) {
      // High risk = target strongest
      return finalTargets.reduce((strongest, current) => 
        current.networth > strongest.networth ? current : strongest
      );
    } else {
      // Low risk = target weakest
      return finalTargets.reduce((weakest, current) => 
        current.networth < weakest.networth ? current : weakest
      );
    }
  }
}