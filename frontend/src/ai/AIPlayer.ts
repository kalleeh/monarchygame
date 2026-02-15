import { AIPersonality, GameState, Decision } from './types';
import { DecisionTree } from './DecisionTree';

export class AIPlayer {
  private personality: AIPersonality;
  private decisionTree: DecisionTree;
  private kingdomId: string;

  constructor(kingdomId: string, personality: AIPersonality) {
    this.kingdomId = kingdomId;
    this.personality = personality;
    this.decisionTree = new DecisionTree(personality);
  }

  takeTurn(gameState: GameState): Decision {
    const kingdom = gameState.kingdoms.find(k => k.id === this.kingdomId);
    if (!kingdom) throw new Error(`Kingdom ${this.kingdomId} not found`);

    return this.decisionTree.selectAction(kingdom, gameState);
  }

  static createPersonalities(): Record<string, AIPersonality> {
    return {
      aggressive: {
        name: 'Aggressive',
        weights: { economic: 0.1, military: 0.6, magical: 0.1, diplomatic: 0.1, territorial: 0.1 },
        aggression: 0.9,
        riskTolerance: 0.8
      },
      economic: {
        name: 'Economic',
        weights: { economic: 0.5, military: 0.2, magical: 0.1, diplomatic: 0.1, territorial: 0.1 },
        aggression: 0.2,
        riskTolerance: 0.3
      },
      magical: {
        name: 'Magical',
        weights: { economic: 0.2, military: 0.1, magical: 0.5, diplomatic: 0.1, territorial: 0.1 },
        aggression: 0.4,
        riskTolerance: 0.6
      },
      diplomatic: {
        name: 'Diplomatic',
        weights: { economic: 0.2, military: 0.1, magical: 0.1, diplomatic: 0.5, territorial: 0.1 },
        aggression: 0.1,
        riskTolerance: 0.2
      },
      balanced: {
        name: 'Balanced',
        weights: { economic: 0.2, military: 0.2, magical: 0.2, diplomatic: 0.2, territorial: 0.2 },
        aggression: 0.5,
        riskTolerance: 0.5
      }
    };
  }
}