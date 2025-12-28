/**
 * Build Order Optimization System
 * Race-specific optimal building sequences based on game mechanics
 */

export interface BuildStep {
  type: 'economic' | 'military' | 'defensive' | 'expansion';
  priority: number;
  goldCost: number;
  turnCost: number;
  prerequisites?: string[];
  expectedBenefit: number;
  description: string;
}

export interface OptimalBuildOrder {
  race: string;
  phase: 'early' | 'mid' | 'late';
  steps: BuildStep[];
  totalCost: number;
  expectedNetworth: number;
  timeToComplete: number;
}

/**
 * Build Order Optimizer using actual game mechanics
 */
export class BuildOrderOptimizer {
  
  /**
   * Generate optimal build order for a race and game phase
   */
  generateOptimalBuildOrder(
    race: string, 
    phase: 'early' | 'mid' | 'late',
    currentResources: { gold: number; land: number; turns: number }
  ): OptimalBuildOrder {
    const raceTemplate = this.getRaceBuildTemplate(race);
    const phaseModifiers = this.getPhaseModifiers(phase);
    
    const steps = this.calculateOptimalSequence(
      raceTemplate, 
      phaseModifiers, 
      currentResources
    );

    return {
      race,
      phase,
      steps,
      totalCost: steps.reduce((sum, step) => sum + step.goldCost, 0),
      expectedNetworth: this.calculateExpectedNetworth(steps),
      timeToComplete: steps.reduce((sum, step) => sum + step.turnCost, 0)
    };
  }

  /**
   * Race-specific build templates based on racial bonuses
   */
  private getRaceBuildTemplate(race: string): BuildStep[] {
    const templates: Record<string, BuildStep[]> = {
      Human: [
        {
          type: 'economic',
          priority: 10,
          goldCost: 2000,
          turnCost: 2,
          expectedBenefit: 500, // Per turn income boost
          description: 'Tithe buildings (leverage 4 tithe bonus)'
        },
        {
          type: 'economic',
          priority: 9,
          goldCost: 1500,
          turnCost: 1,
          expectedBenefit: 300,
          description: 'Trade infrastructure (caravan frequency bonus)'
        },
        {
          type: 'military',
          priority: 7,
          goldCost: 3000,
          turnCost: 2,
          expectedBenefit: 800,
          description: 'Balanced military training'
        },
        {
          type: 'expansion',
          priority: 8,
          goldCost: 2500,
          turnCost: 3,
          expectedBenefit: 1000,
          description: 'Land expansion for economic base'
        }
      ],

      Droben: [
        {
          type: 'military',
          priority: 10,
          goldCost: 4000,
          turnCost: 2,
          expectedBenefit: 1200,
          description: 'Elite training facilities (5 war offense)'
        },
        {
          type: 'military',
          priority: 9,
          goldCost: 3500,
          turnCost: 2,
          expectedBenefit: 1000,
          description: 'Advanced siege equipment (4 siege)'
        },
        {
          type: 'defensive',
          priority: 8,
          goldCost: 2500,
          turnCost: 1,
          expectedBenefit: 600,
          description: 'Fortifications (4 forts bonus)'
        },
        {
          type: 'expansion',
          priority: 7,
          goldCost: 3000,
          turnCost: 4,
          expectedBenefit: 1500,
          description: 'Aggressive land acquisition'
        }
      ],

      Elven: [
        {
          type: 'military',
          priority: 10,
          goldCost: 3500,
          turnCost: 1,
          expectedBenefit: 1400,
          description: 'Superior training (5 training bonus)'
        },
        {
          type: 'defensive',
          priority: 9,
          goldCost: 3000,
          turnCost: 2,
          expectedBenefit: 900,
          description: 'Defensive positions (4 war defense)'
        },
        {
          type: 'economic',
          priority: 7,
          goldCost: 2000,
          turnCost: 2,
          expectedBenefit: 400,
          description: 'Support infrastructure'
        },
        {
          type: 'expansion',
          priority: 6,
          goldCost: 2500,
          turnCost: 3,
          expectedBenefit: 800,
          description: 'Controlled expansion'
        }
      ],

      Goblin: [
        {
          type: 'military',
          priority: 10,
          goldCost: 2500,
          turnCost: 1,
          expectedBenefit: 1000,
          description: 'Fast military buildup (4 war offense)'
        },
        {
          type: 'military',
          priority: 9,
          goldCost: 2000,
          turnCost: 1,
          expectedBenefit: 800,
          description: 'Mass unit training (4 training)'
        },
        {
          type: 'expansion',
          priority: 8,
          goldCost: 1500,
          turnCost: 2,
          expectedBenefit: 1200,
          description: 'Early land grab'
        },
        {
          type: 'economic',
          priority: 5,
          goldCost: 1000,
          turnCost: 1,
          expectedBenefit: 200,
          description: 'Minimal economic support'
        }
      ],

      Vampire: [
        {
          type: 'military',
          priority: 10,
          goldCost: 5000,
          turnCost: 3,
          expectedBenefit: 1500,
          description: 'Elite vampire units (high cost, high power)'
        },
        {
          type: 'economic',
          priority: 8,
          goldCost: 4000,
          turnCost: 2,
          expectedBenefit: 800,
          description: 'Resource generation (offset high costs)'
        },
        {
          type: 'expansion',
          priority: 7,
          goldCost: 3500,
          turnCost: 4,
          expectedBenefit: 1800,
          description: 'High-value land acquisition'
        }
      ]
    };

    return templates[race] || templates.Human;
  }

  /**
   * Phase-specific modifiers
   */
  private getPhaseModifiers(phase: 'early' | 'mid' | 'late'): Record<string, number> {
    const modifiers: Record<string, Record<string, number>> = {
      early: {
        economic: 1.3,  // Prioritize economy early
        military: 0.8,
        defensive: 0.7,
        expansion: 1.1
      },
      mid: {
        economic: 1.0,
        military: 1.2,  // Military becomes important
        defensive: 1.0,
        expansion: 1.3  // Peak expansion phase
      },
      late: {
        economic: 0.8,
        military: 1.4,  // Military critical
        defensive: 1.2,
        expansion: 0.9
      }
    };

    return modifiers[phase];
  }

  /**
   * Calculate optimal sequence considering dependencies and resources
   */
  private calculateOptimalSequence(
    template: BuildStep[],
    phaseModifiers: Record<string, number>,
    resources: { gold: number; land: number; turns: number }
  ): BuildStep[] {
    // Apply phase modifiers to priorities
    const modifiedSteps = template.map(step => ({
      ...step,
      priority: step.priority * (phaseModifiers[step.type] || 1.0)
    }));

    // Filter affordable steps
    const affordableSteps = modifiedSteps.filter(step => 
      step.goldCost <= resources.gold && step.turnCost <= resources.turns
    );

    // Sort by priority and efficiency
    return affordableSteps
      .map(step => ({
        ...step,
        efficiency: step.expectedBenefit / (step.goldCost + step.turnCost * 100)
      }))
      .sort((a, b) => {
        // Primary sort: priority
        if (Math.abs(a.priority - b.priority) > 0.5) {
          return b.priority - a.priority;
        }
        // Secondary sort: efficiency
        return (b as BuildStep).efficiency - (a as BuildStep).efficiency;
      });
  }

  /**
   * Calculate expected networth gain from build sequence
   */
  private calculateExpectedNetworth(steps: BuildStep[]): number {
    let totalBenefit = 0;
    const compoundingTurns = 10; // Assume 10 turns to see benefits

    steps.forEach(step => {
      if (step.type === 'economic') {
        // Economic buildings compound over time
        totalBenefit += step.expectedBenefit * compoundingTurns;
      } else if (step.type === 'expansion') {
        // Land has immediate networth value
        totalBenefit += step.expectedBenefit;
      } else {
        // Military/defensive have strategic value
        totalBenefit += step.expectedBenefit * 0.5;
      }
    });

    return totalBenefit;
  }

  /**
   * Adaptive build order based on current game state
   */
  adaptBuildOrder(
    baseOrder: OptimalBuildOrder,
    threats: number,
    opportunities: number,
    resourcePressure: 'low' | 'medium' | 'high'
  ): OptimalBuildOrder {
    const adaptedSteps = baseOrder.steps.map(step => {
      let newPriority = step.priority;

      // Adapt to threats
      if (threats > 2 && step.type === 'defensive') {
        newPriority *= 1.5;
      }

      // Adapt to opportunities
      if (opportunities > 2 && step.type === 'military') {
        newPriority *= 1.3;
      }

      // Adapt to resource pressure
      if (resourcePressure === 'high' && step.type === 'economic') {
        newPriority *= 1.4;
      }

      return { ...step, priority: newPriority };
    });

    return {
      ...baseOrder,
      steps: adaptedSteps.sort((a, b) => b.priority - a.priority)
    };
  }

  /**
   * Get next recommended build step
   */
  getNextBuildStep(
    race: string,
    phase: 'early' | 'mid' | 'late',
    currentResources: { gold: number; land: number; turns: number },
    gameState: { threats: number; opportunities: number; resourcePressure: 'low' | 'medium' | 'high' }
  ): BuildStep | null {
    const baseOrder = this.generateOptimalBuildOrder(race, phase, currentResources);
    const adaptedOrder = this.adaptBuildOrder(
      baseOrder, 
      gameState.threats, 
      gameState.opportunities, 
      gameState.resourcePressure
    );

    return adaptedOrder.steps[0] || null;
  }

  /**
   * Validate build order feasibility
   */
  validateBuildOrder(
    buildOrder: OptimalBuildOrder,
    currentResources: { gold: number; land: number; turns: number }
  ): { feasible: boolean; issues: string[] } {
    const issues: string[] = [];
    let remainingGold = currentResources.gold;
    let remainingTurns = currentResources.turns;

    for (const step of buildOrder.steps) {
      if (step.goldCost > remainingGold) {
        issues.push(`Insufficient gold for ${step.description} (need ${step.goldCost}, have ${remainingGold})`);
      }
      if (step.turnCost > remainingTurns) {
        issues.push(`Insufficient turns for ${step.description} (need ${step.turnCost}, have ${remainingTurns})`);
      }

      remainingGold -= step.goldCost;
      remainingTurns -= step.turnCost;
    }

    return {
      feasible: issues.length === 0,
      issues
    };
  }
}