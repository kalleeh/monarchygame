/**
 * Resource Management & Long-term Strategic Planning System
 * Optimizes resource allocation and plans multi-turn strategies
 */

export interface ResourcePlan {
  goldAllocation: GoldAllocation;
  turnAllocation: TurnAllocation;
  emergencyReserves: EmergencyReserves;
  growthProjections: GrowthProjections;
  riskMitigation: RiskMitigation;
}

export interface GoldAllocation {
  economic: { amount: number; percentage: number; reasoning: string };
  military: { amount: number; percentage: number; reasoning: string };
  defensive: { amount: number; percentage: number; reasoning: string };
  emergency: { amount: number; percentage: number; reasoning: string };
  opportunity: { amount: number; percentage: number; reasoning: string };
}

export interface TurnAllocation {
  attacks: { turns: number; targets: number; expectedGains: number };
  building: { turns: number; projects: number; expectedValue: number };
  defense: { turns: number; preparations: number; threatLevel: number };
  scouting: { turns: number; intelligence: number; riskReduction: number };
  reserve: { turns: number; flexibility: number };
}

export interface EmergencyReserves {
  goldReserve: number;
  turnReserve: number;
  triggerConditions: string[];
  responseActions: string[];
}

export interface GrowthProjections {
  shortTerm: { turns: number; expectedNetworth: number; confidence: number };
  mediumTerm: { turns: number; expectedNetworth: number; confidence: number };
  longTerm: { turns: number; expectedNetworth: number; confidence: number };
}

export interface RiskMitigation {
  identifiedRisks: Risk[];
  mitigationStrategies: MitigationStrategy[];
  contingencyPlans: ContingencyPlan[];
}

export interface Risk {
  type: 'military' | 'economic' | 'diplomatic' | 'resource';
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  impact: number;
  description: string;
}

export interface MitigationStrategy {
  riskType: string;
  action: string;
  cost: number;
  effectiveness: number;
  timeframe: number;
}

export interface ContingencyPlan {
  trigger: string;
  actions: string[];
  resourceRequirement: number;
  successProbability: number;
}

/**
 * Advanced Resource Management System
 */
export class ResourceManager {
  
  /**
   * Create comprehensive resource plan
   */
  createResourcePlan(
    kingdom: Record<string, unknown>,
    gameContext: {
      turn: number;
      phase: 'early' | 'mid' | 'late';
      threats: number;
      opportunities: number;
      allianceStatus: string;
    },
    racialBonuses: Record<string, number>
  ): ResourcePlan {
    const goldAllocation = this.optimizeGoldAllocation(kingdom, gameContext, racialBonuses);
    const turnAllocation = this.optimizeTurnAllocation(kingdom, gameContext);
    const emergencyReserves = this.calculateEmergencyReserves(kingdom, gameContext);
    const growthProjections = this.projectGrowth(kingdom, gameContext, goldAllocation);
    const riskMitigation = this.assessAndMitigateRisks(kingdom, gameContext);

    return {
      goldAllocation,
      turnAllocation,
      emergencyReserves,
      growthProjections,
      riskMitigation
    };
  }

  /**
   * Optimize gold allocation based on race, phase, and threats
   */
  private optimizeGoldAllocation(
    kingdom: Record<string, unknown>,
    gameContext: Record<string, unknown>,
    racialBonuses: Record<string, number>
  ): GoldAllocation {
    const totalGold = kingdom.resources.gold;
    const phase = gameContext.phase;
    const threats = gameContext.threats;
    const opportunities = gameContext.opportunities;

    // Base allocation percentages by phase
    const baseAllocations = {
      early: { economic: 45, military: 25, defensive: 15, emergency: 10, opportunity: 5 },
      mid: { economic: 30, military: 35, defensive: 20, emergency: 10, opportunity: 5 },
      late: { economic: 20, military: 45, defensive: 20, emergency: 10, opportunity: 5 }
    };

    const allocation = { ...baseAllocations[phase] };

    // Adjust for threats
    if (threats > 2) {
      allocation.defensive += 10;
      allocation.military += 5;
      allocation.economic -= 10;
      allocation.opportunity -= 5;
    }

    // Adjust for opportunities
    if (opportunities > 2) {
      allocation.military += 10;
      allocation.opportunity += 5;
      allocation.economic -= 10;
      allocation.defensive -= 5;
    }

    // Apply racial bonuses
    if (racialBonuses.economy > 0) {
      allocation.economic += 5;
      allocation.military -= 5;
    }
    if (racialBonuses.military > 0) {
      allocation.military += 5;
      allocation.economic -= 5;
    }

    // Convert percentages to amounts
    return {
      economic: {
        amount: Math.floor(totalGold * allocation.economic / 100),
        percentage: allocation.economic,
        reasoning: `${phase} phase economic investment with ${racialBonuses.economy || 0} racial bonus`
      },
      military: {
        amount: Math.floor(totalGold * allocation.military / 100),
        percentage: allocation.military,
        reasoning: `Military buildup for ${opportunities} opportunities and ${threats} threats`
      },
      defensive: {
        amount: Math.floor(totalGold * allocation.defensive / 100),
        percentage: allocation.defensive,
        reasoning: `Defensive preparations against ${threats} identified threats`
      },
      emergency: {
        amount: Math.floor(totalGold * allocation.emergency / 100),
        percentage: allocation.emergency,
        reasoning: 'Emergency reserve for unexpected situations'
      },
      opportunity: {
        amount: Math.floor(totalGold * allocation.opportunity / 100),
        percentage: allocation.opportunity,
        reasoning: 'Flexible fund for immediate tactical opportunities'
      }
    };
  }

  /**
   * Optimize turn allocation for maximum efficiency
   */
  private optimizeTurnAllocation(kingdom: Record<string, unknown>, gameContext: Record<string, unknown>): TurnAllocation {
    const totalTurns = kingdom.resources.turns;
    const phase = gameContext.phase;
    const threats = gameContext.threats;
    const opportunities = gameContext.opportunities;

    // Calculate optimal turn distribution
    let attackTurns = Math.min(Math.floor(totalTurns * 0.6), opportunities * 4);
    let buildingTurns = Math.floor(totalTurns * 0.2);
    const defenseTurns = Math.max(Math.floor(totalTurns * 0.1), threats * 2);
    const scoutingTurns = Math.floor(totalTurns * 0.05);
    const reserveTurns = totalTurns - attackTurns - buildingTurns - defenseTurns - scoutingTurns;

    // Adjust for phase
    if (phase === 'early') {
      buildingTurns += Math.floor(attackTurns * 0.3);
      attackTurns = Math.floor(attackTurns * 0.7);
    } else if (phase === 'late') {
      attackTurns += Math.floor(buildingTurns * 0.5);
      buildingTurns = Math.floor(buildingTurns * 0.5);
    }

    return {
      attacks: {
        turns: attackTurns,
        targets: Math.floor(attackTurns / 4),
        expectedGains: this.calculateExpectedAttackGains(attackTurns, opportunities)
      },
      building: {
        turns: buildingTurns,
        projects: Math.floor(buildingTurns / 2),
        expectedValue: buildingTurns * 1000 // Simplified value calculation
      },
      defense: {
        turns: defenseTurns,
        preparations: Math.floor(defenseTurns / 2),
        threatLevel: threats
      },
      scouting: {
        turns: scoutingTurns,
        intelligence: scoutingTurns * 2,
        riskReduction: scoutingTurns * 0.1
      },
      reserve: {
        turns: reserveTurns,
        flexibility: reserveTurns * 0.5
      }
    };
  }

  /**
   * Calculate emergency reserves based on risk assessment
   */
  private calculateEmergencyReserves(kingdom: Record<string, unknown>, gameContext: Record<string, unknown>): EmergencyReserves {
    const baseGoldReserve = Math.floor(kingdom.resources.gold * 0.15);
    const baseTurnReserve = Math.floor(kingdom.resources.turns * 0.1);

    // Adjust reserves based on threat level
    const threatMultiplier = 1 + (gameContext.threats * 0.1);
    const goldReserve = Math.floor(baseGoldReserve * threatMultiplier);
    const turnReserve = Math.floor(baseTurnReserve * threatMultiplier);

    return {
      goldReserve,
      turnReserve,
      triggerConditions: [
        'Unexpected attack received',
        'Alliance member requests aid',
        'Critical resource shortage',
        'Opportunity for major acquisition'
      ],
      responseActions: [
        'Emergency military recruitment',
        'Defensive fortification',
        'Counter-attack preparation',
        'Resource redistribution'
      ]
    };
  }

  /**
   * Project growth trajectories
   */
  private projectGrowth(
    kingdom: Record<string, unknown>,
    gameContext: Record<string, unknown>,
    goldAllocation: GoldAllocation
  ): GrowthProjections {
    const currentNetworth = kingdom.resources.land * 1000 + kingdom.resources.gold;
    const economicInvestment = goldAllocation.economic.amount;
    const militaryInvestment = goldAllocation.military.amount;

    // Growth rate calculations
    const baseGrowthRate = 0.05; // 5% per turn base
    const economicBonus = economicInvestment / currentNetworth * 0.1;
    const militaryBonus = militaryInvestment / currentNetworth * 0.05;
    const phaseMultiplier = gameContext.phase === 'early' ? 1.2 : gameContext.phase === 'mid' ? 1.0 : 0.8;

    const totalGrowthRate = (baseGrowthRate + economicBonus + militaryBonus) * phaseMultiplier;

    return {
      shortTerm: {
        turns: 10,
        expectedNetworth: Math.floor(currentNetworth * Math.pow(1 + totalGrowthRate, 10)),
        confidence: 0.8
      },
      mediumTerm: {
        turns: 25,
        expectedNetworth: Math.floor(currentNetworth * Math.pow(1 + totalGrowthRate * 0.9, 25)),
        confidence: 0.6
      },
      longTerm: {
        turns: 50,
        expectedNetworth: Math.floor(currentNetworth * Math.pow(1 + totalGrowthRate * 0.7, 50)),
        confidence: 0.4
      }
    };
  }

  /**
   * Assess and create mitigation strategies for risks
   */
  private assessAndMitigateRisks(kingdom: Record<string, unknown>, gameContext: Record<string, unknown>): RiskMitigation {
    const identifiedRisks: Risk[] = [];
    const mitigationStrategies: MitigationStrategy[] = [];
    const contingencyPlans: ContingencyPlan[] = [];

    // Military risks
    if (gameContext.threats > 2) {
      identifiedRisks.push({
        type: 'military',
        severity: 'high',
        probability: 0.7,
        impact: 0.8,
        description: 'Multiple hostile kingdoms detected'
      });

      mitigationStrategies.push({
        riskType: 'military',
        action: 'Increase defensive spending by 20%',
        cost: Math.floor(kingdom.resources.gold * 0.2),
        effectiveness: 0.6,
        timeframe: 5
      });
    }

    // Economic risks
    const goldPerLand = kingdom.resources.gold / Math.max(kingdom.resources.land, 1);
    if (goldPerLand < 30) {
      identifiedRisks.push({
        type: 'economic',
        severity: 'medium',
        probability: 0.5,
        impact: 0.6,
        description: 'Low gold reserves relative to land holdings'
      });

      mitigationStrategies.push({
        riskType: 'economic',
        action: 'Focus on economic buildings and tithe generation',
        cost: Math.floor(kingdom.resources.gold * 0.3),
        effectiveness: 0.8,
        timeframe: 10
      });
    }

    // Resource risks
    if (kingdom.resources.turns < 10) {
      identifiedRisks.push({
        type: 'resource',
        severity: 'medium',
        probability: 0.8,
        impact: 0.5,
        description: 'Low turn reserves limit strategic options'
      });
    }

    // Contingency plans
    contingencyPlans.push({
      trigger: 'Networth drops below 80% of projection',
      actions: [
        'Halt all non-essential spending',
        'Focus on defensive posture',
        'Seek alliance support',
        'Implement emergency economic measures'
      ],
      resourceRequirement: Math.floor(kingdom.resources.gold * 0.4),
      successProbability: 0.7
    });

    contingencyPlans.push({
      trigger: 'Major attack received',
      actions: [
        'Activate emergency reserves',
        'Call for alliance aid',
        'Implement counter-attack strategy',
        'Fortify critical assets'
      ],
      resourceRequirement: Math.floor(kingdom.resources.gold * 0.6),
      successProbability: 0.6
    });

    return {
      identifiedRisks,
      mitigationStrategies,
      contingencyPlans
    };
  }

  /**
   * Calculate expected gains from attack allocation
   */
  private calculateExpectedAttackGains(attackTurns: number, opportunities: number): number {
    const attacksPerformed = Math.floor(attackTurns / 4);
    const successRate = Math.min(0.8, 0.5 + (opportunities * 0.1));
    const averageLandGain = 50; // Simplified average
    
    return Math.floor(attacksPerformed * successRate * averageLandGain);
  }

  /**
   * Adaptive resource reallocation based on performance
   */
  adaptResourceAllocation(
    currentPlan: ResourcePlan,
    performance: {
      attackSuccessRate: number;
      economicGrowthRate: number;
      defensiveEffectiveness: number;
    }
  ): ResourcePlan {
    const adaptedPlan = { ...currentPlan };

    // Adjust based on attack success rate
    if (performance.attackSuccessRate < 0.6) {
      // Poor attack performance - reduce military, increase economic
      adaptedPlan.goldAllocation.military.amount *= 0.8;
      adaptedPlan.goldAllocation.economic.amount *= 1.2;
    } else if (performance.attackSuccessRate > 0.9) {
      // Excellent attack performance - increase military
      adaptedPlan.goldAllocation.military.amount *= 1.2;
      adaptedPlan.goldAllocation.economic.amount *= 0.9;
    }

    // Adjust based on economic growth
    if (performance.economicGrowthRate < 0.03) {
      // Poor economic growth - increase economic investment
      adaptedPlan.goldAllocation.economic.amount *= 1.3;
      adaptedPlan.goldAllocation.military.amount *= 0.8;
    }

    // Adjust based on defensive effectiveness
    if (performance.defensiveEffectiveness < 0.5) {
      // Poor defense - increase defensive spending
      adaptedPlan.goldAllocation.defensive.amount *= 1.4;
      adaptedPlan.goldAllocation.opportunity.amount *= 0.7;
    }

    return adaptedPlan;
  }

  /**
   * Get resource management advice for human players
   */
  getResourceAdvice(kingdom: Record<string, unknown>, gameContext: Record<string, unknown>): string[] {
    const advice: string[] = [];
    const goldPerLand = kingdom.resources.gold / Math.max(kingdom.resources.land, 1);
    const turnsPerDay = kingdom.resources.turns / 24; // Assuming daily turn generation

    // Gold management advice
    if (goldPerLand < 30) {
      advice.push('💰 Low gold reserves - prioritize economic buildings and tithe generation');
    } else if (goldPerLand > 100) {
      advice.push('💎 High gold reserves - consider military expansion or land acquisition');
    }

    // Turn management advice
    if (turnsPerDay < 2) {
      advice.push('⏰ Low turn efficiency - optimize turn usage for maximum land/turn ratio');
    }

    // Phase-specific advice
    if (gameContext.phase === 'early') {
      advice.push('🌱 Early game - focus 60% resources on economic growth, 40% on military');
    } else if (gameContext.phase === 'late') {
      advice.push('⚔️ Late game - prioritize military expansion and strategic positioning');
    }

    // Emergency reserve advice
    const emergencyRatio = (kingdom.resources.gold * 0.15) / kingdom.resources.gold;
    if (emergencyRatio < 0.1) {
      advice.push('🚨 Maintain 15% gold as emergency reserve for unexpected situations');
    }

    return advice;
  }
}