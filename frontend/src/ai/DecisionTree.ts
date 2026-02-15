import { Decision, GameState, KingdomState, AIPersonality } from './types';
import { UtilityEvaluator } from './UtilityEvaluator';

export class DecisionTree {
  private evaluator: UtilityEvaluator;
  private personality: AIPersonality;

  constructor(personality: AIPersonality) {
    this.personality = personality;
    this.evaluator = new UtilityEvaluator(personality);
  }

  selectAction(kingdom: KingdomState, gameState: GameState): Decision {
    const decisions = this.generatePossibleActions(kingdom, gameState);
    return decisions.reduce((best, current) => 
      current.expectedUtility > best.expectedUtility ? current : best
    );
  }

  private generatePossibleActions(kingdom: KingdomState, gameState: GameState): Decision[] {
    const actions: Decision[] = [];

    // Economic actions
    if (kingdom.resources.gold >= 1000) {
      actions.push({
        type: 'build',
        priority: this.personality.weights.economic,
        expectedUtility: this.calculateBuildUtility(kingdom, gameState)
      });
    }

    // Military actions
    const targets = this.findAttackTargets(kingdom, gameState);
    targets.forEach(target => {
      actions.push({
        type: 'attack',
        target: target.id,
        priority: this.personality.weights.military * this.personality.aggression,
        expectedUtility: this.calculateAttackUtility(kingdom, target, gameState)
      });
    });

    // Magical actions
    if (kingdom.resources.mana >= 50) {
      actions.push({
        type: 'cast',
        priority: this.personality.weights.magical,
        expectedUtility: this.calculateSpellUtility(kingdom, gameState)
      });
    }

    // Expansion
    actions.push({
      type: 'expand',
      priority: this.personality.weights.territorial,
      expectedUtility: this.calculateExpansionUtility(kingdom, gameState)
    });

    return actions;
  }

  private findAttackTargets(kingdom: KingdomState, gameState: GameState): KingdomState[] {
    return gameState.kingdoms
      .filter(k => k.id !== kingdom.id && !kingdom.alliances.includes(k.id))
      .filter(k => k.military.power <= kingdom.military.power * 1.5)
      .sort((a, b) => a.military.power - b.military.power)
      .slice(0, 3);
  }

  private calculateBuildUtility(kingdom: KingdomState, gameState: GameState): number {
    const currentUtility = this.evaluator.evaluateKingdom(kingdom, gameState);
    return currentUtility * 0.1; // Building provides 10% utility boost
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private calculateAttackUtility(kingdom: KingdomState, target: KingdomState, _gameState: GameState): number {
    const winProbability = this.calculateWinProbability(kingdom, target);
    const reward = target.resources.gold * 0.3 + target.resources.land * 0.2;
    const risk = kingdom.military.power * 0.1;
    return winProbability * reward - (1 - winProbability) * risk;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private calculateSpellUtility(kingdom: KingdomState, _gameState: GameState): number {
    return kingdom.resources.mana * 0.01;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private calculateExpansionUtility(kingdom: KingdomState, _gameState: GameState): number {
    return Math.max(0, 100 - kingdom.resources.land) * 0.1;
  }

  private calculateWinProbability(attacker: KingdomState, defender: KingdomState): number {
    const powerRatio = attacker.military.power / Math.max(defender.military.power, 1);
    return Math.min(0.95, Math.max(0.05, powerRatio / (powerRatio + 1)));
  }
}