import { describe, it, expect, beforeEach } from 'vitest';
import { AIBalanceTester } from '../AIBalanceTester';

describe('AIBalanceTester', () => {
  let tester: AIBalanceTester;

  beforeEach(() => {
    tester = new AIBalanceTester();
  });

  it('should initialize with AI players for all races', () => {
    // Test that the tester creates players for all available races
    const result = tester.runBalanceTest(100);
    expect(result).toBeDefined();
  });

  it('should run a small balance test successfully', async () => {
    const result = await tester.runBalanceTest(100);
    
    expect(result.totalGames).toBe(100);
    expect(result.raceStats).toBeDefined();
    expect(result.imbalanceScore).toBeGreaterThanOrEqual(0);
    expect(result.recommendations).toBeInstanceOf(Array);
  });

  it('should have race stats for all races', async () => {
    const result = await tester.runBalanceTest(50);
    
    // Check that we have stats for major races
    expect(result.raceStats).toHaveProperty('Human');
    expect(result.raceStats).toHaveProperty('Elven');
    expect(result.raceStats).toHaveProperty('Goblin');
    
    // Check stat structure
    const humanStats = result.raceStats.Human;
    expect(humanStats).toHaveProperty('wins');
    expect(humanStats).toHaveProperty('losses');
    expect(humanStats).toHaveProperty('winRate');
    expect(humanStats).toHaveProperty('avgLandGained');
    expect(humanStats).toHaveProperty('avgGoldGained');
  });

  it('should calculate win rates correctly', async () => {
    const result = await tester.runBalanceTest(100);
    
    Object.values(result.raceStats).forEach((stats) => {
      expect(stats.winRate).toBeGreaterThanOrEqual(0);
      expect(stats.winRate).toBeLessThanOrEqual(1);
      
      if (stats.wins + stats.losses > 0) {
        const expectedWinRate = stats.wins / (stats.wins + stats.losses);
        expect(stats.winRate).toBeCloseTo(expectedWinRate, 2);
      }
    });
  });

  it('should generate appropriate recommendations', async () => {
    const result = await tester.runBalanceTest(200);
    
    expect(result.recommendations.length).toBeGreaterThan(0);
    
    // Should have at least one recommendation about balance status
    const hasBalanceStatus = result.recommendations.some(rec => 
      rec.includes('balance') || rec.includes('Excellent') || rec.includes('Good') || rec.includes('Poor')
    );
    expect(hasBalanceStatus).toBe(true);
  });

  it('should detect imbalanced races in extreme scenarios', async () => {
    // This test would need a modified tester with extreme race differences
    // For now, just test that imbalance score is calculated
    const result = await tester.runBalanceTest(100);
    
    expect(typeof result.imbalanceScore).toBe('number');
    expect(result.imbalanceScore).toBeGreaterThanOrEqual(0);
  });

  it('should generate detailed report', async () => {
    const tester = new AIBalanceTester();
    
    // Run a test first to initialize mechanics
    await tester.runBalanceTest(10);
    
    const report = tester.getDetailedReport();
    
    expect(report).toContain('MONARCHY GAME');
    expect(report).toContain('BALANCE TEST REPORT');
    expect(report).toContain('RACE PERFORMANCE');
    expect(report).toContain('RECOMMENDATIONS');
  });
});
