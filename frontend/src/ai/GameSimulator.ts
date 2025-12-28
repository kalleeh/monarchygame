import { GameState, KingdomState, Decision, BalanceMetrics } from './types';
import { AIPlayer } from './AIPlayer';

export class GameSimulator {
  private maxTurns: number = 200;
  private players: Map<string, AIPlayer> = new Map();

  async runBatchSimulation(gameCount: number, raceDistribution: Record<string, number>): Promise<BalanceMetrics> {
    const results: Array<{ winner: string; race: string; turns: number; }> = [];
    
    // Run games in parallel batches for performance
    const batchSize = 10;
    for (let i = 0; i < gameCount; i += batchSize) {
      const batch = Math.min(batchSize, gameCount - i);
      const batchPromises = Array.from({ length: batch }, () => 
        this.runSingleGame(raceDistribution)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return this.analyzeResults(results);
  }

  private async runSingleGame(raceDistribution: Record<string, number>): Promise<{ winner: string; race: string; turns: number; }> {
    const gameState = this.initializeGame(raceDistribution);
    let turn = 0;

    while (turn < this.maxTurns && !this.isGameOver(gameState)) {
      // Process AI turns
      for (const kingdom of gameState.kingdoms.filter(k => k.isAI)) {
        const player = this.players.get(kingdom.id);
        if (player) {
          const decision = player.takeTurn(gameState);
          this.executeDecision(decision, kingdom, gameState);
        }
      }

      turn++;
      gameState.turn = turn;
      gameState.gamePhase = turn < 50 ? 'early' : turn < 150 ? 'mid' : 'late';
    }

    const winner = this.determineWinner(gameState);
    return { winner: winner.id, race: winner.race, turns: turn };
  }

  private initializeGame(raceDistribution: Record<string, number>): GameState {
    const kingdoms: KingdomState[] = [];
    const personalities = AIPlayer.createPersonalities();
    const personalityNames = Object.keys(personalities);

    Object.entries(raceDistribution).forEach(([race, count]) => {
      for (let i = 0; i < count; i++) {
        const kingdomId = `${race}_${i}`;
        const personality = personalities[personalityNames[i % personalityNames.length]];
        
        kingdoms.push({
          id: kingdomId,
          race,
          resources: { gold: 1000, land: 50, mana: 100 },
          military: { units: 100, power: 100 },
          buildings: {},
          alliances: [],
          isAI: true
        });

        this.players.set(kingdomId, new AIPlayer(kingdomId, personality));
      }
    });

    return { kingdoms, turn: 0, gamePhase: 'early' };
  }

  private executeDecision(decision: Decision, kingdom: KingdomState, gameState: GameState): void {
    switch (decision.type) {
      case 'build':
        kingdom.resources.gold -= 500;
        kingdom.military.power += 10;
        break;
      case 'attack':
        if (decision.target) {
          const target = gameState.kingdoms.find(k => k.id === decision.target);
          if (target) this.resolveCombat(kingdom, target);
        }
        break;
      case 'cast':
        kingdom.resources.mana -= 50;
        kingdom.military.power += 5;
        break;
      case 'expand':
        kingdom.resources.gold -= 200;
        kingdom.resources.land += 5;
        break;
    }
  }

  private resolveCombat(attacker: KingdomState, defender: KingdomState): void {
    const attackPower = attacker.military.power;
    const defensePower = defender.military.power * 1.2; // Defensive bonus
    
    if (attackPower > defensePower) {
      // Attacker wins
      const goldStolen = Math.floor(defender.resources.gold * 0.3);
      const landTaken = Math.floor(defender.resources.land * 0.2);
      
      attacker.resources.gold += goldStolen;
      attacker.resources.land += landTaken;
      defender.resources.gold -= goldStolen;
      defender.resources.land -= landTaken;
      
      attacker.military.power *= 0.8; // Combat losses
      defender.military.power *= 0.6;
    } else {
      // Defender wins
      attacker.military.power *= 0.7;
      defender.military.power *= 0.9;
    }
  }

  private isGameOver(gameState: GameState): boolean {
    const activeKingdoms = gameState.kingdoms.filter(k => k.resources.land > 0);
    return activeKingdoms.length <= 1;
  }

  private determineWinner(gameState: GameState): KingdomState {
    return gameState.kingdoms.reduce((winner, current) => 
      current.resources.land > winner.resources.land ? current : winner
    );
  }

  private analyzeResults(results: Array<{ winner: string; race: string; turns: number; }>): BalanceMetrics {
    const raceWins: Record<string, number> = {};
    const raceCounts: Record<string, number> = {};
    
    results.forEach(result => {
      raceWins[result.race] = (raceWins[result.race] || 0) + 1;
      raceCounts[result.race] = (raceCounts[result.race] || 0) + 1;
    });

    const raceWinRates: Record<string, number> = {};
    Object.keys(raceWins).forEach(race => {
      raceWinRates[race] = raceWins[race] / raceCounts[race];
    });

    const avgGameLength = results.reduce((sum, r) => sum + r.turns, 0) / results.length;
    const winRateValues = Object.values(raceWinRates);
    const balanceScore = 100 - (Math.max(...winRateValues) - Math.min(...winRateValues)) * 100;

    return {
      raceWinRates,
      avgGameLength,
      dominantStrategies: this.identifyDominantStrategies(raceWinRates),
      balanceScore
    };
  }

  private identifyDominantStrategies(winRates: Record<string, number>): string[] {
    return Object.entries(winRates)
      .filter(([, rate]) => rate > 0.6)
      .map(([race]) => race);
  }
}