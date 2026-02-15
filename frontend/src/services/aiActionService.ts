/**
 * AI Action Service - Priority-based decision making for AI kingdoms
 * Based on turn-based strategy AI best practices
 */

import type { AIKingdom } from '../stores/aiKingdomStore';

export interface AIAction {
  type: 'build' | 'train' | 'attack';
  priority: number;
  description: string;
}

/**
 * Evaluate AI kingdom state and decide actions
 * Priority: Economy > Military > Expansion
 */
export class AIActionService {
  /**
   * Decide what actions AI should take based on current state
   */
  static decideActions(ai: AIKingdom, allAIKingdoms: AIKingdom[]): AIAction[] {
    const actions: AIAction[] = [];
    
    // Calculate AI strength metrics
    const totalUnits = Object.values(ai.units).reduce((sum, count) => sum + count, 0);
    const goldPerLand = ai.resources.gold / Math.max(ai.resources.land, 1);
    const unitsPerLand = totalUnits / Math.max(ai.resources.land, 1);
    
    // Priority 1: Economy - Build if poor
    if (goldPerLand < 50 && ai.resources.gold > 500) {
      actions.push({
        type: 'build',
        priority: 10,
        description: 'Build economic structures'
      });
    }
    
    // Priority 2: Military - Train if weak
    if (unitsPerLand < 2 && ai.resources.gold > 1000) {
      actions.push({
        type: 'train',
        priority: 8,
        description: 'Train military units'
      });
    }
    
    // Priority 3: Attack - If strong and has turns
    if (unitsPerLand >= 2 && ai.resources.turns >= 4) {
      const target = this.findWeakestTarget(ai, allAIKingdoms);
      if (target) {
        actions.push({
          type: 'attack',
          priority: 6,
          description: `Attack ${target.name}`
        });
      }
    }
    
    // Sort by priority (highest first)
    return actions.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Find weakest target for AI to attack
   */
  private static findWeakestTarget(ai: AIKingdom, allAI: AIKingdom[]): AIKingdom | null {
    const potentialTargets = allAI.filter(target => 
      target.id !== ai.id && 
      target.networth < ai.networth * 1.5 // Only attack if not too strong
    );
    
    if (potentialTargets.length === 0) return null;
    
    // Find weakest target
    return potentialTargets.reduce((weakest, current) => 
      current.networth < weakest.networth ? current : weakest
    );
  }
  
  /**
   * Execute build action - increase land and structures
   */
  static executeBuild(ai: AIKingdom): Partial<AIKingdom> {
    const buildCost = 500;
    if (ai.resources.gold < buildCost) return {};
    
    const landGain = Math.floor(Math.random() * 5) + 3; // 3-7 land
    
    return {
      resources: {
        ...ai.resources,
        gold: Math.max(0, ai.resources.gold - buildCost),
        land: ai.resources.land + landGain
      }
    };
  }
  
  /**
   * Execute train action - recruit units
   */
  static executeTrain(ai: AIKingdom): Partial<AIKingdom> {
    const trainCost = 1000;
    if (ai.resources.gold < trainCost) return {};
    
    const tier = Math.random();
    const unitGain = Math.floor(Math.random() * 20) + 10; // 10-30 units
    
    const newUnits = { ...ai.units };
    if (tier < 0.5) {
      newUnits.tier1 += unitGain;
    } else if (tier < 0.8) {
      newUnits.tier2 += Math.floor(unitGain / 2);
    } else {
      newUnits.tier3 += Math.floor(unitGain / 4);
    }
    
    return {
      resources: {
        ...ai.resources,
        gold: Math.max(0, ai.resources.gold - trainCost)
      },
      units: newUnits
    };
  }
  
  /**
   * Execute attack action - combat simulation
   */
  static executeAttack(
    attacker: AIKingdom, 
    defender: AIKingdom
  ): { attacker: Partial<AIKingdom>; defender: Partial<AIKingdom> } {
    if (attacker.resources.turns < 4) {
      return { attacker: {}, defender: {} };
    }
    
    // Simple combat: compare networth
    const attackerStrength = attacker.networth;
    const defenderStrength = defender.networth;
    const ratio = attackerStrength / Math.max(defenderStrength, 1);
    
    // Attacker wins if 1.2x stronger
    if (ratio >= 1.2) {
      const landGain = Math.floor(defender.resources.land * 0.07); // 7% land gain
      const goldGain = Math.floor(defender.resources.gold * 0.1); // 10% gold steal
      
      return {
        attacker: {
          resources: {
            ...attacker.resources,
            turns: Math.max(0, attacker.resources.turns - 4),
            land: attacker.resources.land + landGain,
            gold: attacker.resources.gold + goldGain
          }
        },
        defender: {
          resources: {
            ...defender.resources,
            land: Math.max(0, defender.resources.land - landGain),
            gold: Math.max(0, defender.resources.gold - goldGain)
          }
        }
      };
    }
    
    // Failed attack - just lose turns
    return {
      attacker: {
        resources: {
          ...attacker.resources,
          turns: Math.max(0, attacker.resources.turns - 4)
        }
      },
      defender: {}
    };
  }
}
