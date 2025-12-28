import { BalanceMetrics } from './types';
import { GameSimulator } from './GameSimulator';

export class BalanceAnalyzer {
  private simulator: GameSimulator;

  constructor() {
    this.simulator = new GameSimulator();
  }

  async runBalanceTest(testConfig: {
    gameCount: number;
    races: string[];
    playersPerRace: number;
  }): Promise<BalanceReport> {
    console.log(`Starting balance test: ${testConfig.gameCount} games`);
    const startTime = Date.now();

    // Create race distribution
    const raceDistribution: Record<string, number> = {};
    testConfig.races.forEach(race => {
      raceDistribution[race] = testConfig.playersPerRace;
    });

    const metrics = await this.simulator.runBatchSimulation(testConfig.gameCount, raceDistribution);
    const duration = Date.now() - startTime;

    return {
      metrics,
      testConfig,
      duration,
      recommendations: this.generateRecommendations(metrics),
      timestamp: new Date().toISOString()
    };
  }

  private generateRecommendations(metrics: BalanceMetrics): string[] {
    const recommendations: string[] = [];

    // Check for overpowered races
    Object.entries(metrics.raceWinRates).forEach(([race, winRate]) => {
      if (winRate > 0.6) {
        recommendations.push(`${race} appears overpowered (${(winRate * 100).toFixed(1)}% win rate) - consider nerfs`);
      } else if (winRate < 0.4) {
        recommendations.push(`${race} appears underpowered (${(winRate * 100).toFixed(1)}% win rate) - consider buffs`);
      }
    });

    // Check game length
    if (metrics.avgGameLength < 50) {
      recommendations.push('Games ending too quickly - consider reducing early game power');
    } else if (metrics.avgGameLength > 180) {
      recommendations.push('Games taking too long - consider increasing late game power');
    }

    // Check balance score
    if (metrics.balanceScore < 70) {
      recommendations.push('Poor overall balance detected - major adjustments needed');
    } else if (metrics.balanceScore > 90) {
      recommendations.push('Excellent balance achieved - minor tweaks only');
    }

    return recommendations;
  }

  generateDetailedReport(report: BalanceReport): string {
    const { metrics, testConfig, duration } = report;
    
    let output = `# Balance Test Report\n\n`;
    output += `**Test Configuration:**\n`;
    output += `- Games: ${testConfig.gameCount}\n`;
    output += `- Races: ${testConfig.races.join(', ')}\n`;
    output += `- Players per race: ${testConfig.playersPerRace}\n`;
    output += `- Duration: ${(duration / 1000).toFixed(1)}s\n\n`;

    output += `**Overall Balance Score: ${metrics.balanceScore.toFixed(1)}/100**\n\n`;

    output += `**Race Win Rates:**\n`;
    Object.entries(metrics.raceWinRates)
      .sort(([,a], [,b]) => b - a)
      .forEach(([race, rate]) => {
        const status = rate > 0.6 ? '🔴' : rate < 0.4 ? '🟡' : '🟢';
        output += `- ${status} ${race}: ${(rate * 100).toFixed(1)}%\n`;
      });

    output += `\n**Game Statistics:**\n`;
    output += `- Average game length: ${metrics.avgGameLength.toFixed(1)} turns\n`;
    output += `- Dominant strategies: ${metrics.dominantStrategies.join(', ') || 'None'}\n\n`;

    output += `**Recommendations:**\n`;
    report.recommendations.forEach(rec => {
      output += `- ${rec}\n`;
    });

    return output;
  }
}

export interface BalanceReport {
  metrics: BalanceMetrics;
  testConfig: {
    gameCount: number;
    races: string[];
    playersPerRace: number;
  };
  duration: number;
  recommendations: string[];
  timestamp: string;
}