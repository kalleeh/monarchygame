import { AIPersonality, GameState, KingdomState } from './types';

export class UtilityEvaluator {
  private personality: AIPersonality;

  constructor(personality: AIPersonality) {
    this.personality = personality;
  }

  evaluateKingdom(kingdom: KingdomState, gameState: GameState): number {
    const economic = this.evaluateEconomic(kingdom);
    const military = this.evaluateMilitary(kingdom, gameState);
    const magical = this.evaluateMagical(kingdom);
    const diplomatic = this.evaluateDiplomatic(kingdom, gameState);
    const territorial = this.evaluateTerritorial(kingdom);

    return (
      economic * this.personality.weights.economic +
      military * this.personality.weights.military +
      magical * this.personality.weights.magical +
      diplomatic * this.personality.weights.diplomatic +
      territorial * this.personality.weights.territorial
    );
  }

  private evaluateEconomic(kingdom: KingdomState): number {
    return Math.log(kingdom.resources.gold + 1) + kingdom.resources.land * 0.1;
  }

  private evaluateMilitary(kingdom: KingdomState, gameState: GameState): number {
    const avgPower = gameState.kingdoms.reduce((sum, k) => sum + k.military.power, 0) / gameState.kingdoms.length;
    return kingdom.military.power / Math.max(avgPower, 1);
  }

  private evaluateMagical(kingdom: KingdomState): number {
    return Math.sqrt(kingdom.resources.mana);
  }

  private evaluateDiplomatic(kingdom: KingdomState, gameState: GameState): number {
    const allianceStrength = kingdom.alliances.length / Math.max(gameState.kingdoms.length - 1, 1);
    return allianceStrength;
  }

  private evaluateTerritorial(kingdom: KingdomState): number {
    return Math.sqrt(kingdom.resources.land);
  }
}