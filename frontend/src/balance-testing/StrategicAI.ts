import type { Kingdom } from '../types/kingdom';

export interface StrategicDecision {
  action: 'build' | 'attack' | 'defend' | 'magic' | 'wait';
  target?: string;
  priority: number;
  reasoning: string;
}

export class StrategicAI {
  private kingdom: Kingdom;
  private gamePhase: 'early' | 'mid' | 'late';
  
  constructor(kingdom: Kingdom) {
    this.kingdom = kingdom;
    this.gamePhase = this.determineGamePhase();
  }

  // Core strategic decision making
  makeDecision(availableTargets: Kingdom[]): StrategicDecision {
    const decisions = [
      this.evaluateEconomicActions(),
      this.evaluateMilitaryActions(availableTargets),
      this.evaluateDefensiveActions(),
      this.evaluateMagicActions()
    ].filter(Boolean) as StrategicDecision[];

    if (decisions.length === 0) {
      // Fallback decision if no strategic actions are viable
      return {
        action: 'wait',
        priority: 10,
        reasoning: 'No strategic actions available, waiting for better conditions'
      };
    }

    return decisions.sort((a, b) => b.priority - a.priority)[0];
  }

  // Economic strategy based on pro player principles AND race characteristics
  private evaluateEconomicActions(): StrategicDecision | null {
    const { resources } = this.kingdom;
    const acres = this.kingdom.land;
    const raceStrategy = this.getRaceStrategy();
    
    // Cash management: maintain 1.0-1.5x acreage in thousands (not millions for testing)
    const targetCash = acres * 1000 * 1.25; // More reasonable for testing
    const buildRate = this.calculateBuildRate();
    
    // Race-specific economic thresholds
    const economicThreshold = this.gamePhase === 'early' ? 
      (raceStrategy.economicPriority * 0.9) : // Early game: 90% of race priority
      (raceStrategy.economicPriority * 0.7);  // Later: 70% of race priority
    
    if (resources.gold < targetCash || buildRate < 16) {
      return {
        action: 'build',
        priority: economicThreshold,
        reasoning: `${this.kingdom.race} economic foundation: BR ${buildRate}, cash ${resources.gold}/${targetCash}`
      };
    }
    
    return null;
  }

  // Combat strategy using "with ease" progression AND race characteristics
  private evaluateMilitaryActions(targets: Kingdom[]): StrategicDecision | null {
    if (targets.length === 0) return null;
    
    const raceStrategy = this.getRaceStrategy();
    const optimalTarget = this.selectOptimalTarget(targets);
    if (!optimalTarget) return null;
    
    const attackStrength = this.calculateAttackStrength(optimalTarget);
    
    // Race-specific attack thresholds
    let attackThreshold = 1.1; // Base threshold
    
    switch (this.kingdom.race) {
      case 'Droben':
        attackThreshold = 1.05; // Very aggressive - attack with slight advantage
        break;
      case 'Goblin':
        attackThreshold = 1.1; // Aggressive early game
        break;
      case 'Human':
        attackThreshold = 1.2; // Balanced - need good advantage
        break;
      case 'Elven':
        attackThreshold = 1.3; // Defensive - need strong advantage
        break;
      case 'Dwarven':
        attackThreshold = 1.4; // Very defensive
        break;
      default:
        attackThreshold = 1.15; // Moderate
    }
    
    if (attackStrength > attackThreshold) { 
      return {
        action: 'attack',
        target: optimalTarget.id,
        priority: raceStrategy.militaryPriority,
        reasoning: `${this.kingdom.race} military strike: ${attackStrength.toFixed(2)}x strength (threshold: ${attackThreshold}x)`
      };
    }
    
    return null;
  }

  // Target selection based on pro strategies
  private selectOptimalTarget(targets: Kingdom[]): Kingdom | null {
    const myNetworth = this.calculateNetworth();
    
    // Filter targets by strategic criteria
    const viableTargets = targets.filter(target => {
      const targetNetworth = this.calculateNetworth(target);
      const ratio = targetNetworth / myNetworth;
      
      // Avoid top realms, target mid-size for maximum impact
      return ratio >= 0.3 && ratio <= 0.8;
    });
    
    if (viableTargets.length === 0) return null;
    
    // Select target with best land/defense ratio
    return viableTargets.reduce((best, current) => {
      const bestRatio = best.land / this.estimateDefense(best);
      const currentRatio = current.land / this.estimateDefense(current);
      return currentRatio > bestRatio ? current : best;
    });
  }

  // Race-specific strategic priorities based on knowledge base
  private getRaceStrategy(): { economicPriority: number; militaryPriority: number; magicPriority: number } {
    switch (this.kingdom.race) {
      case 'Human':
        // Economic masters with balanced approach
        return { economicPriority: 90, militaryPriority: 70, magicPriority: 60 };
      
      case 'Droben':
        // Military supremacy - primary realm breakers
        return { economicPriority: 60, militaryPriority: 95, magicPriority: 30 };
      
      case 'Sidhe':
        // Sorcery masters with strong scum capabilities
        return { economicPriority: 65, militaryPriority: 45, magicPriority: 95 };
      
      case 'Elven':
        // Defensive specialists with moderate magic
        return { economicPriority: 70, militaryPriority: 55, magicPriority: 75 };
      
      case 'Goblin':
        // Early game dominance, land takers and exploiters
        return { economicPriority: 65, militaryPriority: 85, magicPriority: 35 };
      
      case 'Elemental':
        // Fighter-mage combination, versatile
        return { economicPriority: 70, militaryPriority: 85, magicPriority: 80 };
      
      case 'Vampire':
        // Resource-intensive but potentially untouchable
        return { economicPriority: 50, militaryPriority: 70, magicPriority: 85 };
      
      case 'Fae':
        // Versatile magic users, balanced approach
        return { economicPriority: 75, militaryPriority: 65, magicPriority: 80 };
      
      case 'Centaur':
        // Espionage specialists (scum-focused)
        return { economicPriority: 60, militaryPriority: 50, magicPriority: 40 };
      
      case 'Dwarven':
        // Defensive specialists with limited magic
        return { economicPriority: 65, militaryPriority: 75, magicPriority: 35 };
      
      default:
        return { economicPriority: 70, militaryPriority: 70, magicPriority: 50 };
    }
  }

  // Utility functions
  private determineGamePhase(): 'early' | 'mid' | 'late' {
    const acres = this.kingdom.land;
    if (acres < 5000) return 'early';
    if (acres < 20000) return 'mid';
    return 'late';
  }

  private calculateBuildRate(): number {
    // Simplified build rate calculation
    const totalBuildings = Object.values(this.kingdom.buildings).reduce((sum, count) => sum + count, 0);
    return Math.floor((totalBuildings / this.kingdom.land) * 100);
  }

  private calculateNetworth(kingdom: Kingdom = this.kingdom): number {
    // Simplified networth calculation
    return kingdom.resources.gold + (kingdom.land * 1000) + 
           (kingdom.units.offense * 500) + (kingdom.units.defense * 400);
  }

  private calculateAttackStrength(target: Kingdom): number {
    const myOffense = this.kingdom.units.offense;
    const targetDefense = this.estimateDefense(target);
    return myOffense / Math.max(targetDefense, 1);
  }

  private estimateDefense(kingdom: Kingdom): number {
    return kingdom.units.defense + (kingdom.buildings.forts * 100);
  }

  private evaluateDefensiveActions(): StrategicDecision | null {
    const buildRate = this.calculateBuildRate();
    const raceStrategy = this.getRaceStrategy();
    
    // Race-specific defensive priorities
    const isDefensiveRace = ['Elven', 'Dwarven', 'Vampire'].includes(this.kingdom.race);
    const defensiveThreshold = isDefensiveRace ? 20 : 16; // Higher threshold for defensive races
    
    if (buildRate < defensiveThreshold) {
      return {
        action: 'defend',
        priority: isDefensiveRace ? raceStrategy.militaryPriority + 10 : 85, // Boost defensive race priority
        reasoning: `${this.kingdom.race} defensive priority: BR ${buildRate} below ${defensiveThreshold}`
      };
    }
    
    return null;
  }

  private evaluateMagicActions(): StrategicDecision | null {
    const raceStrategy = this.getRaceStrategy();
    
    // Only magic-focused races should prioritize magic actions
    const isMagicRace = ['Sidhe', 'Elemental', 'Vampire', 'Fae'].includes(this.kingdom.race);
    
    if (isMagicRace && this.kingdom.resources.mana > 1000) {
      // Magic races get higher priority for magic actions
      const magicPriority = raceStrategy.magicPriority;
      
      return {
        action: 'magic',
        priority: magicPriority,
        reasoning: `${this.kingdom.race} sorcery focus: ${this.kingdom.resources.mana} mana available`
      };
    }
    
    // Non-magic races rarely use magic
    if (!isMagicRace && this.kingdom.resources.mana > 5000) {
      return {
        action: 'magic',
        priority: 40, // Low priority for non-magic races
        reasoning: `${this.kingdom.race} opportunistic magic: excess mana (${this.kingdom.resources.mana})`
      };
    }
    
    return null;
  }
}
