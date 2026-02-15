/**
 * AI Balance Testing System
 * Simulates thousands of games with AI players to test race balance
 * Uses ACTUAL game mechanics from shared modules for authentic testing
 * 
 * ARCHITECTURE:
 * - Uses GameMechanicsAdapter to import actual game mechanics from @shared modules
 * - Uses the same combat formulas, race stats, and calculations as the real game
 * - When game mechanics are updated, balance tests automatically use the new mechanics
 * - Fallback to simplified mechanics only in test environments where imports fail
 * - This ensures balance testing reflects actual gameplay changes
 */

import { initializeGameMechanics, type GameMechanics } from './GameMechanicsAdapter';
import { StrategicAI, type StrategicDecision } from './StrategicAI';
import type { Kingdom } from '../types/kingdom';

export interface AIPlayer {
  id: string;
  name: string;
  race: string;
  resources: {
    gold: number;
    population: number;
    land: number;
    turns: number;
  };
  stats: {
    warOffense: number;
    warDefense: number;
    sorcery: number;
    scum: number;
    forts: number;
    tithe: number;
    training: number;
    siege: number;
    economy: number;
    building: number;
  };
  units: {
    peasants: number;
    militia: number;
    knights: number;
    cavalry: number;
  };
  wins: number;
  losses: number;
  totalLandGained: number;
  totalGoldGained: number;
}

export interface GameSimulationResult {
  winner: AIPlayer;
  loser: AIPlayer;
  landGained: number;
  goldGained: number;
  combatDetails: {
    attackerOffense: number;
    defenderDefense: number;
    attackerLosses: number;
    defenderLosses: number;
  };
}

export interface BalanceTestResult {
  totalGames: number;
  raceStats: Record<string, {
    wins: number;
    losses: number;
    winRate: number;
    avgLandGained: number;
    avgGoldGained: number;
    totalLandGained: number;
    totalGoldGained: number;
  }>;
  imbalanceScore: number; // 0 = perfect balance, higher = more imbalanced
  recommendations: string[];
}

export class AIBalanceTester {
  private players: AIPlayer[] = [];
  private gameResults: GameSimulationResult[] = [];
  private initialized = false;
  private mechanics!: GameMechanics;

  constructor() {
    // Don't initialize players in constructor - do it async
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      this.mechanics = await initializeGameMechanics();
      this.initializePlayers();
      this.initialized = true;
    }
  }

  private initializePlayers(): void {
    const raceNames = Object.keys(this.mechanics.RACES);
    
    // Create multiple AI players for each race to get better statistics
    raceNames.forEach((raceName) => {
      for (let i = 0; i < 3; i++) { // 3 players per race
        const raceData = this.mechanics.RACES[raceName];
        const player: AIPlayer = {
          id: `${raceName.toLowerCase()}_${i + 1}`,
          name: `${raceName} Player ${i + 1}`,
          race: raceName,
          resources: {
            gold: 10000 + Math.random() * 5000, // 10k-15k starting gold
            population: 1000 + Math.random() * 500, // 1k-1.5k population
            land: 500 + Math.random() * 200, // 500-700 land
            turns: 50
          },
          stats: {
            warOffense: Math.floor(1000 * raceData.multipliers.military),
            warDefense: Math.floor(800 * raceData.multipliers.military),
            sorcery: Math.floor(500 * raceData.multipliers.magic),
            scum: Math.floor(300 * (raceData.scum / 3)),
            forts: 50,
            tithe: 100,
            training: 80,
            siege: 60,
            economy: Math.floor(1200 * raceData.multipliers.economy),
            building: 100
          },
          units: {
            peasants: Math.floor(200 + Math.random() * 100),
            militia: Math.floor(150 + Math.random() * 75),
            knights: Math.floor(100 + Math.random() * 50),
            cavalry: Math.floor(50 + Math.random() * 25)
          },
          wins: 0,
          losses: 0,
          totalLandGained: 0,
          totalGoldGained: 0
        };
        this.players.push(player);
      }
    });
  }

  private simulateCombat(attacker: AIPlayer, defender: AIPlayer): GameSimulationResult {
    // Calculate total offense and defense using unit values
    const attackerOffense = this.calculateTotalOffense(attacker);
    const defenderDefense = this.calculateTotalDefense(defender);

    // Use game mechanics for combat calculation
    const combatResult = this.mechanics.calculateCombatResult(
      { units: { warOffense: attackerOffense }, race: attacker.race },
      { units: { defense: defenderDefense }, race: defender.race }
    );

    // Calculate spoils using game mechanics
    const landGained = this.mechanics.calculateLandGained(attackerOffense, defenderDefense, defender.resources.land);
    const goldGained = Math.floor(defender.resources.gold * 0.1 * (combatResult.success ? 1 : 0.3));

    // Update player stats
    if (combatResult.success) {
      attacker.wins++;
      defender.losses++;
      attacker.totalLandGained += landGained;
      attacker.totalGoldGained += goldGained;
      
      // Update resources
      attacker.resources.land += landGained;
      attacker.resources.gold += goldGained;
      defender.resources.land = Math.max(0, defender.resources.land - landGained);
      defender.resources.gold = Math.max(0, defender.resources.gold - goldGained);
    } else {
      attacker.losses++;
      defender.wins++;
    }

    // Apply simplified unit losses (10-20% casualties)
    const attackerLosses = Math.floor(attackerOffense * (0.1 + Math.random() * 0.1));
    const defenderLosses = Math.floor(defenderDefense * (0.1 + Math.random() * 0.1));
    
    // Distribute losses across unit types proportionally
    this.applyUnitLosses(attacker, attackerLosses);
    this.applyUnitLosses(defender, defenderLosses);

    return {
      winner: combatResult.success ? attacker : defender,
      loser: combatResult.success ? defender : attacker,
      landGained,
      goldGained,
      combatDetails: {
        attackerOffense,
        defenderDefense,
        attackerLosses,
        defenderLosses
      }
    };
  }

  private calculateTotalOffense(player: AIPlayer): number {
    // Calculate offense from units and racial bonuses
    const baseOffense = (player.units.peasants * 10) + 
                       (player.units.militia * 25) + 
                       (player.units.knights * 50) + 
                       (player.units.cavalry * 75);
    
    const raceData = this.mechanics.getRacialBonuses(player.race);
    return Math.floor(baseOffense * raceData.multipliers.military);
  }

  private calculateTotalDefense(player: AIPlayer): number {
    // Calculate defense from units, forts, and racial bonuses
    const baseDefense = (player.units.peasants * 8) + 
                       (player.units.militia * 20) + 
                       (player.units.knights * 45) + 
                       (player.units.cavalry * 60) +
                       (player.stats.forts * 100);
    
    const raceData = this.mechanics.getRacialBonuses(player.race);
    return Math.floor(baseDefense * raceData.multipliers.military);
  }

  private applyUnitLosses(player: AIPlayer, totalLosses: number): void {
    // Distribute losses proportionally across unit types
    const totalUnits = player.units.peasants + player.units.militia + player.units.knights + player.units.cavalry;
    if (totalUnits === 0) return;

    const peasantLosses = Math.floor(totalLosses * (player.units.peasants / totalUnits));
    const militiaLosses = Math.floor(totalLosses * (player.units.militia / totalUnits));
    const knightLosses = Math.floor(totalLosses * (player.units.knights / totalUnits));
    const cavalryLosses = Math.floor(totalLosses * (player.units.cavalry / totalUnits));

    player.units.peasants = Math.max(0, player.units.peasants - peasantLosses);
    player.units.militia = Math.max(0, player.units.militia - militiaLosses);
    player.units.knights = Math.max(0, player.units.knights - knightLosses);
    player.units.cavalry = Math.max(0, player.units.cavalry - cavalryLosses);
  }

  private calculateSimpleCombatResult(attackerOffense: number, defenderDefense: number, attackerUnits: AIPlayer['units'], defenderUnits: AIPlayer['units']) {
    const ratio = attackerOffense / Math.max(defenderDefense, 1);
    const success = ratio > 1.2 + Math.random() * 0.6; // Some randomness
    
    // Simple loss calculation
    const attackerLossRate = success ? 0.1 : 0.3;
    const defenderLossRate = success ? 0.4 : 0.2;
    
    return {
      success,
      attackerLosses: {
        peasants: Math.floor(attackerUnits.peasants * attackerLossRate),
        militia: Math.floor(attackerUnits.militia * attackerLossRate),
        knights: Math.floor(attackerUnits.knights * attackerLossRate),
        cavalry: Math.floor(attackerUnits.cavalry * attackerLossRate)
      },
      defenderLosses: {
        peasants: Math.floor(defenderUnits.peasants * defenderLossRate),
        militia: Math.floor(defenderUnits.militia * defenderLossRate),
        knights: Math.floor(defenderUnits.knights * defenderLossRate),
        cavalry: Math.floor(defenderUnits.cavalry * defenderLossRate)
      }
    };
  }

  private calculateSimpleLandGained(attackerOffense: number, defenderDefense: number, defenderLand: number): number {
    const ratio = attackerOffense / Math.max(defenderDefense, 1);
    const baseGain = Math.floor(defenderLand * 0.05); // 5% base
    const bonusGain = Math.floor(baseGain * Math.max(0, ratio - 1));
    return Math.min(baseGain + bonusGain, Math.floor(defenderLand * 0.2)); // Max 20%
  }

  // Public method for property-based testing
  public calculateLandGained(attackerOffense: number, defenderDefense: number, targetLand: number): number {
    return this.mechanics.calculateLandGained(attackerOffense, defenderDefense, targetLand);
  }

  // Public method to get race statistics after running tests
  public getRaceStats(): Record<string, { winRate: number; wins: number; losses: number }> {
    const raceStats: Record<string, { winRate: number; wins: number; losses: number }> = {};
    
    // Group players by race and calculate stats
    const raceNames = Object.keys(this.mechanics.RACES);
    raceNames.forEach(race => {
      const racePlayers = this.players.filter(p => p.race === race);
      const totalWins = racePlayers.reduce((sum, p) => sum + p.wins, 0);
      const totalLosses = racePlayers.reduce((sum, p) => sum + p.losses, 0);
      const totalGames = totalWins + totalLosses;
      
      raceStats[race] = {
        wins: totalWins,
        losses: totalLosses,
        winRate: totalGames > 0 ? totalWins / totalGames : 0
      };
    });
    
    return raceStats;
  }

  public async runBalanceTest(numberOfGames: number = 10000): Promise<BalanceTestResult> {
    console.log(`🎮 Starting AI Balance Test with ${numberOfGames} games...`);
    
    // Ensure we have initialized with actual game mechanics
    await this.ensureInitialized();
    
    this.gameResults = [];
    
    // Reset player stats
    this.players.forEach(player => {
      player.wins = 0;
      player.losses = 0;
      player.totalLandGained = 0;
      player.totalGoldGained = 0;
    });

    // Simulate games with strategic AI
    for (let i = 0; i < numberOfGames; i++) {
      // Each "game" is now a strategic encounter where AI makes intelligent decisions
      const attacker = this.selectStrategicAttacker();
      const availableTargets = this.getAvailableTargets(attacker);
      
      if (availableTargets.length === 0) continue;
      
      // Use strategic AI to select target and attack method
      const strategicAI = new StrategicAI(this.convertToKingdom(attacker));
      const decision = strategicAI.makeDecision(availableTargets.map(t => this.convertToKingdom(t)));
      
      let defender: AIPlayer | undefined;
      
      if (decision.action === 'attack' && decision.target) {
        defender = this.players.find(p => p.id === decision.target);
      }
      
      // Fallback: if strategic AI doesn't attack, pick random target for balance testing
      if (!defender && availableTargets.length > 0) {
        defender = availableTargets[Math.floor(Math.random() * availableTargets.length)];
      }
      
      if (defender) {
        const result = decision.action === 'attack' && decision.target ? 
          this.simulateStrategicCombat(attacker, defender, decision) :
          this.simulateCombat(attacker, defender);
        this.gameResults.push(result);
      }

      // Progress logging
      if ((i + 1) % 1000 === 0) {
        console.log(`⚔️ Simulated ${i + 1}/${numberOfGames} strategic encounters...`);
      }
    }

    return this.analyzeResults();
  }

  private analyzeResults(): BalanceTestResult {
    const raceStats: Record<string, {
      wins: number;
      losses: number;
      winRate: number;
      avgLandGained: number;
      avgGoldGained: number;
      totalLandGained: number;
      totalGoldGained: number;
    }> = {};
    const raceNames = Object.keys(this.mechanics.RACES);

    // Initialize race stats
    raceNames.forEach(race => {
      raceStats[race] = {
        wins: 0,
        losses: 0,
        winRate: 0,
        avgLandGained: 0,
        avgGoldGained: 0,
        totalLandGained: 0,
        totalGoldGained: 0
      };
    });

    // Aggregate stats by race
    this.players.forEach(player => {
      const stats = raceStats[player.race];
      stats.wins += player.wins;
      stats.losses += player.losses;
      stats.totalLandGained += player.totalLandGained;
      stats.totalGoldGained += player.totalGoldGained;
    });

    // Calculate averages and win rates
    raceNames.forEach(race => {
      const stats = raceStats[race];
      const totalGames = stats.wins + stats.losses;
      stats.winRate = totalGames > 0 ? stats.wins / totalGames : 0;
      stats.avgLandGained = totalGames > 0 ? stats.totalLandGained / totalGames : 0;
      stats.avgGoldGained = totalGames > 0 ? stats.totalGoldGained / totalGames : 0;
    });

    // Calculate imbalance score (standard deviation of win rates)
    const winRates = raceNames.map(race => raceStats[race].winRate);
    const avgWinRate = winRates.reduce((sum, rate) => sum + rate, 0) / winRates.length;
    const variance = winRates.reduce((sum, rate) => sum + Math.pow(rate - avgWinRate, 2), 0) / winRates.length;
    const imbalanceScore = Math.sqrt(variance);

    // Generate recommendations
    const recommendations = this.generateRecommendations(raceStats, imbalanceScore);

    return {
      totalGames: this.gameResults.length,
      raceStats,
      imbalanceScore,
      recommendations
    };
  }

  private generateRecommendations(raceStats: Record<string, {
    wins: number;
    losses: number;
    winRate: number;
    avgLandGained: number;
    avgGoldGained: number;
    totalLandGained: number;
    totalGoldGained: number;
  }>, imbalanceScore: number): string[] {
    const recommendations: string[] = [];
    const raceNames = Object.keys(raceStats);

    // Find overpowered and underpowered races
    const sortedByWinRate = raceNames.sort((a, b) => raceStats[b].winRate - raceStats[a].winRate);
    const strongest = sortedByWinRate[0];
    const weakest = sortedByWinRate[sortedByWinRate.length - 1];

    if (imbalanceScore > 0.1) {
      recommendations.push(`⚠️ Significant imbalance detected (score: ${imbalanceScore.toFixed(3)})`);
      
      if (raceStats[strongest].winRate > 0.6) {
        recommendations.push(`🔴 ${strongest} is overpowered (${(raceStats[strongest].winRate * 100).toFixed(1)}% win rate)`);
        recommendations.push(`   Suggestion: Reduce ${strongest} military multiplier from ${this.mechanics.RACES[strongest].multipliers.military} to ${Math.max(0.8, this.mechanics.RACES[strongest].multipliers.military - 0.1).toFixed(1)}`);
      }
      
      if (raceStats[weakest].winRate < 0.4) {
        recommendations.push(`🔴 ${weakest} is underpowered (${(raceStats[weakest].winRate * 100).toFixed(1)}% win rate)`);
        recommendations.push(`   Suggestion: Increase ${weakest} military multiplier from ${this.mechanics.RACES[weakest].multipliers.military} to ${Math.min(1.3, this.mechanics.RACES[weakest].multipliers.military + 0.1).toFixed(1)}`);
      }
    } else if (imbalanceScore < 0.05) {
      recommendations.push(`✅ Excellent balance! All races are competitive (imbalance score: ${imbalanceScore.toFixed(3)})`);
    } else {
      recommendations.push(`✅ Good balance with minor adjustments needed (imbalance score: ${imbalanceScore.toFixed(3)})`);
    }

    // Check for races with extreme land/gold gains
    raceNames.forEach(race => {
      const stats = raceStats[race];
      if (stats.avgLandGained > 50) {
        recommendations.push(`📈 ${race} gains too much land per victory (${stats.avgLandGained.toFixed(1)} avg)`);
      }
      if (stats.avgGoldGained > 2000) {
        recommendations.push(`💰 ${race} gains too much gold per victory (${stats.avgGoldGained.toFixed(0)} avg)`);
      }
    });

    return recommendations;
  }

  public getDetailedReport(): string {
    let report = '\n🏰 MONARCHY GAME - AI BALANCE TEST REPORT\n';
    report += '=' .repeat(50) + '\n\n';
    
    const result = this.analyzeResults();
    
    report += `📊 SIMULATION SUMMARY\n`;
    report += `Total Games Simulated: ${result.totalGames.toLocaleString()}\n`;
    report += `Imbalance Score: ${result.imbalanceScore.toFixed(3)} (lower is better)\n\n`;
    
    report += `🏆 RACE PERFORMANCE\n`;
    report += '-'.repeat(80) + '\n';
    report += `${'Race'.padEnd(12)} ${'Win Rate'.padEnd(10)} ${'Wins'.padEnd(8)} ${'Losses'.padEnd(8)} ${'Avg Land'.padEnd(10)} ${'Avg Gold'.padEnd(10)}\n`;
    report += '-'.repeat(80) + '\n';
    
    Object.entries(result.raceStats)
      .sort(([,a], [,b]) => b.winRate - a.winRate)
      .forEach(([race, stats]) => {
        report += `${race.padEnd(12)} ${(stats.winRate * 100).toFixed(1).padEnd(9)}% ${stats.wins.toString().padEnd(8)} ${stats.losses.toString().padEnd(8)} ${stats.avgLandGained.toFixed(1).padEnd(10)} ${stats.avgGoldGained.toFixed(0).padEnd(10)}\n`;
      });
    
    report += '\n📋 RECOMMENDATIONS\n';
    result.recommendations.forEach(rec => {
      report += `${rec}\n`;
    });
    
    return report;
  }

  // Strategic AI helper methods
  private selectStrategicAttacker(): AIPlayer {
    // Select attacker based on strategic readiness (resources, army strength)
    const viableAttackers = this.players.filter(p => 
      p.resources.gold > 5000 && 
      p.resources.turns > 0 &&
      this.calculateTotalOffense(p) > 1000
    );
    
    if (viableAttackers.length === 0) {
      return this.players[Math.floor(Math.random() * this.players.length)];
    }
    
    // Prefer stronger players for more realistic strategic scenarios
    return viableAttackers.reduce((strongest, current) => 
      this.calculateTotalOffense(current) > this.calculateTotalOffense(strongest) ? current : strongest
    );
  }

  private getAvailableTargets(attacker: AIPlayer): AIPlayer[] {
    return this.players.filter(p => 
      p.id !== attacker.id && 
      p.race !== attacker.race &&
      p.resources.land > 200 // Don't attack tiny kingdoms
    );
  }

  private convertToKingdom(player: AIPlayer): Kingdom {
    return {
      id: player.id,
      race: player.race,
      land: player.resources.land,
      resources: {
        gold: player.resources.gold,
        population: player.resources.population,
        mana: 1000 // Default mana for strategic calculations
      },
      units: {
        offense: this.calculateTotalOffense(player),
        defense: this.calculateTotalDefense(player)
      },
      buildings: {
        forts: player.stats.forts
      }
    } as Kingdom;
  }

  private simulateStrategicCombat(attacker: AIPlayer, defender: AIPlayer, decision: StrategicDecision): GameSimulationResult {
    // Enhanced combat simulation that considers strategic decision context
    const baseResult = this.simulateCombat(attacker, defender);
    
    // Strategic AI gets slight bonuses for good decision making
    if (decision.priority > 80) {
      // High-priority strategic attacks are more effective
      if (baseResult.winner === attacker) {
        baseResult.landGained = Math.floor(baseResult.landGained * 1.1);
        baseResult.goldGained = Math.floor(baseResult.goldGained * 1.1);
      }
    }
    
    return baseResult;
  }
}
