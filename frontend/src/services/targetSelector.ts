/**
 * Intelligent Target Selection System
 * Uses actual combat mechanics for optimal target selection
 */

import type { AIKingdom } from '../stores/aiKingdomStore';

export interface TargetAnalysis {
  target: AIKingdom;
  combatOutcome: CombatPrediction;
  strategicValue: StrategicValue;
  riskAssessment: RiskAssessment;
  overallScore: number;
  recommendation: 'prime' | 'good' | 'risky' | 'avoid';
}

export interface CombatPrediction {
  successProbability: number;
  expectedLandGain: number;
  turnCost: number;
  efficiency: number; // land per turn
  casualtyRate: number;
  goldLoot: number;
}

export interface StrategicValue {
  threatLevel: number; // How dangerous this target is
  resourceValue: number; // Value of target's resources
  positionValue: number; // Strategic position importance
  allianceRisk: number; // Risk of alliance retaliation
}

export interface RiskAssessment {
  warDeclarationRisk: boolean;
  retaliationRisk: number;
  resourceLossRisk: number;
  opportunityCost: number;
}

export interface AttackPlan {
  primaryTarget: AIKingdom;
  alternativeTargets: AIKingdom[];
  attackSequence: AttackStep[];
  totalTurnsRequired: number;
  expectedGains: { land: number; gold: number };
}

export interface AttackStep {
  target: AIKingdom;
  attackType: 'controlled_strike' | 'full_strike' | 'guerrilla_raid';
  turnCost: number;
  expectedOutcome: string;
}

/**
 * Advanced Target Selection Engine
 */
export class TargetSelector {
  private warDeclarations: Map<string, number> = new Map();
  private attackHistory: Map<string, number[]> = new Map();

  /**
   * Analyze all potential targets and rank them
   */
  analyzeTargets(
    attacker: AIKingdom,
    potentialTargets: AIKingdom[],
    gameContext: { turn: number; phase: 'early' | 'mid' | 'late' }
  ): TargetAnalysis[] {
    return potentialTargets
      .filter(target => target.id !== attacker.id)
      .map(target => this.analyzeTarget(attacker, target, gameContext))
      .sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Comprehensive target analysis
   */
  private analyzeTarget(
    attacker: AIKingdom,
    target: AIKingdom,
    gameContext: { turn: number; phase: 'early' | 'mid' | 'late' }
  ): TargetAnalysis {
    const combatOutcome = this.predictCombatOutcome(attacker, target);
    const strategicValue = this.assessStrategicValue(target, gameContext);
    const riskAssessment = this.assessRisks(attacker, target);

    const overallScore = this.calculateOverallScore(
      combatOutcome,
      strategicValue,
      riskAssessment
    );

    const recommendation = this.getRecommendation(overallScore, combatOutcome, riskAssessment);

    return {
      target,
      combatOutcome,
      strategicValue,
      riskAssessment,
      overallScore,
      recommendation
    };
  }

  /**
   * Predict combat outcome using actual game mechanics
   */
  private predictCombatOutcome(attacker: AIKingdom, target: AIKingdom): CombatPrediction {
    const networthRatio = attacker.networth / target.networth;
    
    // Turn cost calculation (from combat-mechanics.ts)
    let turnCost = 4; // Base cost
    if (networthRatio >= 1.5) {
      turnCost = 6; // Easy target (1.5x multiplier)
    } else if (networthRatio <= 0.67) {
      turnCost = 8; // Hard target (2.0x multiplier)
    }

    // Success probability based on networth ratio and racial bonuses
    let successProbability = 0.5;
    const attackerOffenseBonus = this.getRacialCombatBonus(attacker.race, 'offense');
    const defenderDefenseBonus = this.getRacialCombatBonus(target.race, 'defense');
    
    const adjustedRatio = networthRatio * (1 + attackerOffenseBonus) / (1 + defenderDefenseBonus);
    
    if (adjustedRatio >= 1.5) successProbability = 0.95;
    else if (adjustedRatio >= 1.2) successProbability = 0.85;
    else if (adjustedRatio >= 0.8) successProbability = 0.65;
    else successProbability = 0.35;

    // Land gain calculation (6.79%-7.35% from combat mechanics)
    let landGainPercent = 0.0679; // Minimum
    if (adjustedRatio >= 1.5) {
      landGainPercent = 0.0735; // Maximum for dominating
    } else if (adjustedRatio >= 1.2) {
      landGainPercent = 0.070; // Good fight
    }

    const expectedLandGain = Math.floor(target.resources.land * landGainPercent * successProbability);
    const efficiency = expectedLandGain / turnCost;

    // Casualty rate based on combat difficulty
    let casualtyRate = 0.15; // Base 15%
    if (adjustedRatio >= 1.5) casualtyRate = 0.05; // Easy victory
    else if (adjustedRatio < 0.8) casualtyRate = 0.30; // Difficult battle

    // Gold loot (10% of target's gold)
    const goldLoot = Math.floor(target.resources.gold * 0.1 * successProbability);

    return {
      successProbability,
      expectedLandGain,
      turnCost,
      efficiency,
      casualtyRate,
      goldLoot
    };
  }

  /**
   * Assess strategic value of target
   */
  private assessStrategicValue(
    target: AIKingdom,
    gameContext: { turn: number; phase: 'early' | 'mid' | 'late' }
  ): StrategicValue {
    // Threat level based on target's growth potential
    const threatLevel = this.calculateThreatLevel(target, gameContext);
    
    // Resource value based on target's assets
    const resourceValue = (target.resources.land * 1000 + target.resources.gold) / 100000;
    
    // Position value (simplified - could be enhanced with actual map data)
    const positionValue = target.resources.land > 1000 ? 0.8 : 0.5;
    
    // Alliance risk (simplified - would need actual alliance data)
    const allianceRisk = 0.3; // Assume moderate alliance risk

    return {
      threatLevel,
      resourceValue,
      positionValue,
      allianceRisk
    };
  }

  /**
   * Calculate threat level of target
   */
  private calculateThreatLevel(
    target: AIKingdom,
    gameContext: { turn: number; phase: 'early' | 'mid' | 'late' }
  ): number {
    const growthRate = target.networth / Math.max(gameContext.turn, 1);
    const militaryStrength = Object.values(target.units).reduce((sum, count) => sum + count, 0);
    const resourceBase = target.resources.land + target.resources.gold / 1000;

    // Normalize to 0-1 scale
    const normalizedGrowth = Math.min(growthRate / 5000, 1);
    const normalizedMilitary = Math.min(militaryStrength / 2000, 1);
    const normalizedResources = Math.min(resourceBase / 2000, 1);

    return (normalizedGrowth + normalizedMilitary + normalizedResources) / 3;
  }

  /**
   * Assess risks of attacking target
   */
  private assessRisks(attacker: AIKingdom, target: AIKingdom): RiskAssessment {
    // War declaration risk
    const attackCount = this.warDeclarations.get(target.id) || 0;
    const warDeclarationRisk = attackCount >= 2; // 3rd attack triggers declaration

    // Retaliation risk based on target's military capability
    const retaliationRisk = Math.min(target.networth / attacker.networth, 1);

    // Resource loss risk (potential casualties and failed attack costs)
    const resourceLossRisk = 1 - (attacker.networth / (attacker.networth + target.networth));

    // Opportunity cost (other targets might be better)
    const opportunityCost = 0.2; // Base opportunity cost

    return {
      warDeclarationRisk,
      retaliationRisk,
      resourceLossRisk,
      opportunityCost
    };
  }

  /**
   * Calculate overall target score
   */
  private calculateOverallScore(
    combat: CombatPrediction,
    strategic: StrategicValue,
    risk: RiskAssessment
  ): number {
    // Weighted scoring system
    const efficiencyScore = Math.min(combat.efficiency / 3, 1) * 40; // Max 40 points
    const successScore = combat.successProbability * 30; // Max 30 points
    const strategicScore = (strategic.threatLevel + strategic.resourceValue) * 15; // Max 15 points
    const riskPenalty = (risk.retaliationRisk + risk.resourceLossRisk) * -10; // Max -10 points
    const warDeclarationPenalty = risk.warDeclarationRisk ? -20 : 0; // -20 if war declaration

    return Math.max(0, efficiencyScore + successScore + strategicScore + riskPenalty + warDeclarationPenalty);
  }

  /**
   * Get recommendation category
   */
  private getRecommendation(
    score: number,
    combat: CombatPrediction,
    risk: RiskAssessment
  ): 'prime' | 'good' | 'risky' | 'avoid' {
    if (risk.warDeclarationRisk && combat.successProbability < 0.9) {
      return 'avoid';
    }
    
    if (score >= 70 && combat.efficiency >= 2) {
      return 'prime';
    } else if (score >= 50 && combat.successProbability >= 0.7) {
      return 'good';
    } else if (score >= 30) {
      return 'risky';
    } else {
      return 'avoid';
    }
  }

  /**
   * Create comprehensive attack plan
   */
  createAttackPlan(
    attacker: AIKingdom,
    targetAnalyses: TargetAnalysis[],
    availableTurns: number
  ): AttackPlan | null {
    const primeTargets = targetAnalyses.filter(t => t.recommendation === 'prime');
    const goodTargets = targetAnalyses.filter(t => t.recommendation === 'good');

    if (primeTargets.length === 0 && goodTargets.length === 0) {
      return null;
    }

    const primaryTarget = (primeTargets[0] || goodTargets[0]).target;
    const alternativeTargets = [...primeTargets, ...goodTargets]
      .slice(1, 4)
      .map(t => t.target);

    const attackSequence = this.planAttackSequence(
      attacker,
      primaryTarget,
      availableTurns
    );

    const totalTurnsRequired = attackSequence.reduce((sum, step) => sum + step.turnCost, 0);
    const expectedGains = this.calculateExpectedGains(attackSequence);

    return {
      primaryTarget,
      alternativeTargets,
      attackSequence,
      totalTurnsRequired,
      expectedGains
    };
  }

  /**
   * Plan optimal attack sequence (controlled strikes → full strikes)
   */
  private planAttackSequence(
    attacker: AIKingdom,
    target: AIKingdom,
    availableTurns: number
  ): AttackStep[] {
    const sequence: AttackStep[] = [];
    const networthRatio = attacker.networth / target.networth;

    // Start with controlled strike to test defenses
    if (availableTurns >= 4 && networthRatio >= 1.2) {
      sequence.push({
        target,
        attackType: 'controlled_strike',
        turnCost: 4,
        expectedOutcome: 'Test defenses, minimal land gain'
      });
      availableTurns -= 4;
    }

    // Follow with full strikes if "with ease" confirmed
    while (availableTurns >= 4 && networthRatio >= 1.3) {
      sequence.push({
        target,
        attackType: 'full_strike',
        turnCost: 4,
        expectedOutcome: `${Math.floor(target.resources.land * 0.07)} land gain expected`
      });
      availableTurns -= 4;
      
      // Simulate land gain for next iteration
      target.resources.land = Math.floor(target.resources.land * 0.93);
    }

    return sequence;
  }

  /**
   * Calculate expected gains from attack sequence
   */
  private calculateExpectedGains(sequence: AttackStep[]): { land: number; gold: number } {
    let totalLand = 0;
    let totalGold = 0;

    sequence.forEach(step => {
      if (step.attackType === 'full_strike') {
        totalLand += Math.floor(step.target.resources.land * 0.07);
        totalGold += Math.floor(step.target.resources.gold * 0.1);
      } else if (step.attackType === 'controlled_strike') {
        totalLand += Math.floor(step.target.resources.land * 0.01);
        totalGold += Math.floor(step.target.resources.gold * 0.02);
      }
    });

    return { land: totalLand, gold: totalGold };
  }

  /**
   * Get racial combat bonuses
   */
  private getRacialCombatBonus(race: string, type: 'offense' | 'defense'): number {
    const bonuses: Record<string, { offense: number; defense: number }> = {
      Human: { offense: 0.0, defense: 0.0 }, // Balanced
      Droben: { offense: 0.2, defense: 0.1 }, // Elite combat
      Elven: { offense: -0.1, defense: 0.3 }, // Defensive
      Goblin: { offense: 0.1, defense: -0.2 }, // Aggressive
      Vampire: { offense: 0.3, defense: 0.0 }, // High offense
      Elemental: { offense: 0.1, defense: 0.1 }, // Balanced hybrid
      Centaur: { offense: 0.0, defense: 0.1 }, // Slight defensive
      Sidhe: { offense: 0.1, defense: 0.2 }, // Magic-enhanced
      Dwarven: { offense: 0.0, defense: 0.4 }, // Defensive specialists
      Fae: { offense: 0.15, defense: 0.15 } // Versatile
    };

    return bonuses[race]?.[type] || 0;
  }

  /**
   * Record attack for war declaration tracking
   */
  recordAttack(targetId: string): void {
    const current = this.warDeclarations.get(targetId) || 0;
    this.warDeclarations.set(targetId, current + 1);

    // Record attack history for pattern analysis
    const history = this.attackHistory.get(targetId) || [];
    history.push(Date.now());
    this.attackHistory.set(targetId, history.slice(-10)); // Keep last 10 attacks
  }

  /**
   * Get target selection advice for human players
   */
  getTargetingAdvice(
    playerKingdom: Record<string, unknown>,
    aiKingdoms: AIKingdom[]
  ): string[] {
    const advice: string[] = [];
    const playerNetworth = playerKingdom.resources.land * 1000 + playerKingdom.resources.gold;

    const analyses = this.analyzeTargets(
      { ...playerKingdom, networth: playerNetworth } as AIKingdom,
      aiKingdoms,
      { turn: 50, phase: 'mid' }
    );

    const primeTargets = analyses.filter(a => a.recommendation === 'prime');
    const goodTargets = analyses.filter(a => a.recommendation === 'good');

    if (primeTargets.length > 0) {
      advice.push(`🎯 ${primeTargets.length} prime targets available with ${primeTargets[0].combatOutcome.efficiency.toFixed(1)} land/turn efficiency`);
    }

    if (goodTargets.length > 0) {
      advice.push(`✅ ${goodTargets.length} good targets available for expansion`);
    }

    if (analyses.some(a => a.riskAssessment.warDeclarationRisk)) {
      advice.push(`⚠️ War declaration risk detected - consider diplomatic approach`);
    }

    return advice;
  }
}