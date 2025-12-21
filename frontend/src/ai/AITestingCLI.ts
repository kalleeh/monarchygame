import { BalanceAnalyzer } from './BalanceAnalyzer';

export class AITestingCLI {
  private analyzer: BalanceAnalyzer;

  constructor() {
    this.analyzer = new BalanceAnalyzer();
  }

  async runQuickTest(): Promise<void> {
    console.log('🤖 Running quick balance test...');
    
    const report = await this.analyzer.runBalanceTest({
      gameCount: 100,
      races: ['Human', 'Elven', 'Goblin', 'Droben', 'Vampire'],
      playersPerRace: 2
    });

    console.log(this.analyzer.generateDetailedReport(report));
  }

  async runFullTest(): Promise<void> {
    console.log('🤖 Running comprehensive balance test...');
    
    const report = await this.analyzer.runBalanceTest({
      gameCount: 1000,
      races: ['Human', 'Elven', 'Goblin', 'Droben', 'Vampire', 'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae'],
      playersPerRace: 3
    });

    console.log(this.analyzer.generateDetailedReport(report));
    
    // Save detailed results
    const fs = await import('fs');
    const filename = `balance-report-${Date.now()}.md`;
    fs.writeFileSync(filename, this.analyzer.generateDetailedReport(report));
    console.log(`📊 Detailed report saved to ${filename}`);
  }

  async runCustomTest(config: {
    gameCount: number;
    races: string[];
    playersPerRace: number;
  }): Promise<void> {
    console.log(`🤖 Running custom test: ${config.gameCount} games`);
    
    const report = await this.analyzer.runBalanceTest(config);
    console.log(this.analyzer.generateDetailedReport(report));
  }
}

// CLI Usage
export async function runAITests(testType: 'quick' | 'full' | 'custom' = 'quick'): Promise<void> {
  const cli = new AITestingCLI();
  
  switch (testType) {
    case 'quick':
      await cli.runQuickTest();
      break;
    case 'full':
      await cli.runFullTest();
      break;
    case 'custom':
      await cli.runCustomTest({
        gameCount: 500,
        races: ['Human', 'Elven', 'Goblin'],
        playersPerRace: 4
      });
      break;
  }
}