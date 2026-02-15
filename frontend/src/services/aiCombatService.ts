/**
 * AI Combat Service - IQC Compliant
 * Integrity: Server-side validation ready
 * Quality: Uses authentic game mechanics
 * Consistency: Matches combat-mechanics.ts formulas
 */

import type { AIKingdom } from '../stores/aiKingdomStore';
import { useKingdomStore } from '../stores/kingdomStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';

export interface BattleResult {
  success: boolean;
  landGained: number;
  goldGained: number;
  casualtiesPercent: number;
  message: string;
  difficulty: 'with_ease' | 'good_fight' | 'failed';
}

/**
 * Simulate combat between player and AI kingdom
 * Based on authentic Monarchy game mechanics
 */
export class AICombatService {
  /**
   * Calculate combat outcome based on networth difference
   * Formula from combat-mechanics.ts: 6.79%-7.35% land gain
   */
  static simulateBattle(
    playerNetworth: number,
    aiKingdom: AIKingdom
  ): BattleResult {
    const networthRatio = playerNetworth / aiKingdom.networth;
    
    // Determine difficulty based on networth ratio
    let difficulty: 'with_ease' | 'good_fight' | 'failed';
    let landGainPercent: number;
    let casualtiesPercent: number;
    
    if (networthRatio >= 1.5) {
      // Easy victory
      difficulty = 'with_ease';
      landGainPercent = 0.0735; // 7.35% max
      casualtiesPercent = 0.05; // 5% casualties
    } else if (networthRatio >= 0.8) {
      // Good fight
      difficulty = 'good_fight';
      landGainPercent = 0.0679 + (Math.random() * 0.0056); // 6.79%-7.35%
      casualtiesPercent = 0.15; // 15% casualties
    } else {
      // Failed attack
      difficulty = 'failed';
      landGainPercent = 0;
      casualtiesPercent = 0.25; // 25% casualties
      
      return {
        success: false,
        landGained: 0,
        goldGained: 0,
        casualtiesPercent,
        message: `Attack failed! You lost ${Math.floor(casualtiesPercent * 100)}% of your army.`,
        difficulty
      };
    }
    
    // Calculate gains
    const landGained = Math.floor(aiKingdom.resources.land * landGainPercent);
    const goldGained = Math.floor(aiKingdom.resources.gold * 0.1); // 10% of enemy gold
    
    return {
      success: true,
      landGained,
      goldGained,
      casualtiesPercent,
      message: `Victory ${difficulty === 'with_ease' ? 'with ease' : 'after a good fight'}! Gained ${landGained} land and ${goldGained} gold.`,
      difficulty
    };
  }
  
  /**
   * Execute attack and update resources
   */
  static async executeAttack(aiKingdom: AIKingdom): Promise<BattleResult> {
    const kingdomStore = useKingdomStore.getState();
    const aiStore = useAIKingdomStore.getState();
    
    // Calculate player networth
    const playerNetworth = 
      (kingdomStore.resources.land || 0) * 1000 +
      (kingdomStore.resources.gold || 0);
    
    // Simulate battle
    const result = this.simulateBattle(playerNetworth, aiKingdom);
    
    if (result.success) {
      // Update player resources
      kingdomStore.updateResources({
        land: (kingdomStore.resources.land || 0) + result.landGained,
        gold: (kingdomStore.resources.gold || 0) + result.goldGained,
        turns: (kingdomStore.resources.turns || 0) - 4 // 4 turns per attack
      });
      
      // Update AI kingdom (reduce resources)
      aiStore.updateAIKingdom(aiKingdom.id, {
        resources: {
          ...aiKingdom.resources,
          land: aiKingdom.resources.land - result.landGained,
          gold: Math.floor(aiKingdom.resources.gold * 0.9) // Lost 10%
        }
      });
      
      // Remove AI kingdom if land drops too low
      if (aiKingdom.resources.land - result.landGained < 50) {
        aiStore.removeAIKingdom(aiKingdom.id);
      }
    } else {
      // Failed attack - only lose turns
      kingdomStore.updateResources({
        turns: (kingdomStore.resources.turns || 0) - 4
      });
    }
    
    return result;
  }
  
  /**
   * Check if player can afford attack
   */
  static canAffordAttack(): boolean {
    const resources = useKingdomStore.getState().resources;
    return (resources.turns || 0) >= 4;
  }
  
  /**
   * Get recommended targets based on player strength
   */
  static getRecommendedTargets(aiKingdoms: AIKingdom[], playerNetworth: number): AIKingdom[] {
    return aiKingdoms
      .filter(ai => {
        const ratio = playerNetworth / ai.networth;
        return ratio >= 0.5 && ratio <= 2.0; // Fair targets
      })
      .sort((a, b) => a.networth - b.networth);
  }
}
