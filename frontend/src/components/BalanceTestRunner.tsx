/* eslint-disable */
import React, { useState, useCallback, useMemo, memo } from 'react';
import { AIBalanceTester } from '../balance-testing/AIBalanceTester';
import type { BalanceTestResult } from '../balance-testing/AIBalanceTester';

interface BalanceTestRunnerProps {
  onClose: () => void;
}

// Memoized result display component
const MemoizedResultDisplay = memo(({ results, getRaceColor }: {
  results: BalanceTestResult;
  getRaceColor: (winRate: number) => string;
}) => (
  <div className="mt-6">
    <h3 className="text-lg font-semibold mb-4">Balance Test Results</h3>
    <div className="grid grid-cols-2 gap-4">
      {Object.entries(results.raceStats).map(([race, stats]) => (
        <div key={race} className="bg-gray-50 p-4 rounded">
          <h4 className="font-medium" style={{ color: getRaceColor(stats.winRate) }}>
            {race}
          </h4>
          <div className="text-sm">
            <div>Win Rate: {(stats.winRate * 100).toFixed(1)}%</div>
            <div>Avg Land: {stats.avgLandGained.toFixed(0)}</div>
            <div>Avg Gold: {stats.avgGoldGained.toFixed(0)}</div>
          </div>
        </div>
      ))}
    </div>
    <div className="mt-4 p-4 bg-blue-50 rounded">
      <div className="text-sm">
        <div>Imbalance Score: {results.imbalanceScore.toFixed(3)}</div>
        <div>Games Simulated: {results.totalGames.toLocaleString()}</div>
      </div>
    </div>
  </div>
));

function BalanceTestRunner({ onClose }: BalanceTestRunnerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BalanceTestResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [gameCount, setGameCount] = useState(10000);

  // Memoized color calculation
  const getRaceColor = useCallback((winRate: number): string => {
    if (winRate > 0.6) return '#ef4444'; // Red - overpowered
    if (winRate < 0.4) return '#f59e0b'; // Orange - underpowered
    return '#10b981'; // Green - balanced
  }, []);

  // Memoized balance status calculation
  const getBalanceStatus = useMemo(() => (imbalanceScore: number): { text: string; color: string } => {
    if (imbalanceScore < 0.05) return { text: 'Excellent', color: '#10b981' };
    if (imbalanceScore < 0.1) return { text: 'Good', color: '#f59e0b' };
    return { text: 'Poor', color: '#ef4444' };
  }, []);

  const runBalanceTest = useCallback(async () => {
    setIsRunning(true);
    setResults(null);
    setProgress(0);

    try {
      const tester = new AIBalanceTester();
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 1, 95));
      }, 100);

      const result = await tester.runBalanceTest(gameCount);
      
      clearInterval(progressInterval);
      setProgress(100);
      setResults(result);
      
      // Show detailed report in console
      console.log(tester.getDetailedReport());
    } catch (error) {
      console.error('Balance test failed:', error);
    } finally {
      setIsRunning(false);
    }
  }, [gameCount]);

  const handleGameCountChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setGameCount(parseInt(e.target.value));
  }, []);

  const getBalanceRating = (winRate: number) => {
    if (winRate >= 0.45 && winRate <= 0.55) return { text: 'Excellent', color: '#10b981' };
    if (winRate >= 0.40 && winRate <= 0.60) return { text: 'Good', color: '#3b82f6' };
    if (winRate >= 0.35 && winRate <= 0.65) return { text: 'Fair', color: '#f59e0b' };
    return { text: 'Poor', color: '#ef4444' };
  };

  return (
    <div className="balance-test-runner">
      <div className="balance-test-header">
        <h2>🎮 AI Balance Testing System</h2>
        <p>Simulate thousands of AI vs AI games to test race balance</p>
        <button onClick={onClose} className="close-btn">×</button>
      </div>

      <div className="test-controls">
        <div className="input-group">
          <label htmlFor="gameCount">Number of Games:</label>
          <select 
            id="gameCount"
            value={gameCount} 
            onChange={(e) => setGameCount(Number(e.target.value))}
            disabled={isRunning}
          >
            <option value={1000}>1,000 (Quick Test)</option>
            <option value={5000}>5,000 (Standard)</option>
            <option value={10000}>10,000 (Thorough)</option>
            <option value={25000}>25,000 (Comprehensive)</option>
          </select>
        </div>
        
        <button 
          onClick={runBalanceTest}
          disabled={isRunning}
          className="run-test-btn"
        >
          {isRunning ? 'Running Test...' : 'Run Balance Test'}
        </button>
      </div>

      {isRunning && (
        <div className="progress-section">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <p>Simulating {gameCount.toLocaleString()} AI battles... {progress}%</p>
        </div>
      )}

      {results && (
        <div className="results-section">
          <div className="results-header">
            <h3>📊 Balance Test Results</h3>
            <div className="balance-score">
              <span>Overall Balance: </span>
              <span 
                style={{ 
                  color: getBalanceStatus(results.imbalanceScore).color,
                  fontWeight: 'bold'
                }}
              >
                {getBalanceStatus(results.imbalanceScore).text}
              </span>
              <span className="score-detail">
                (Score: {results.imbalanceScore.toFixed(3)})
              </span>
            </div>
          </div>

          <div className="race-results">
            <h4>🏆 Race Performance</h4>
            <div className="race-grid">
              {Object.entries(results.raceStats)
                .sort(([,a], [,b]) => b.winRate - a.winRate)
                .map(([race, stats]) => (
                  <div key={race} className="race-card">
                    <div className="race-header">
                      <h5>{race}</h5>
                      <span 
                        className="win-rate"
                        style={{ color: getRaceColor(stats.winRate) }}
                      >
                        {(stats.winRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="race-stats">
                      <div className="stat">
                        <span>Wins:</span>
                        <span>{stats.wins.toLocaleString()}</span>
                      </div>
                      <div className="stat">
                        <span>Losses:</span>
                        <span>{stats.losses.toLocaleString()}</span>
                      </div>
                      <div className="stat">
                        <span>Avg Land:</span>
                        <span>{stats.avgLandGained.toFixed(1)}</span>
                      </div>
                      <div className="stat">
                        <span>Avg Gold:</span>
                        <span>{stats.avgGoldGained.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="recommendations">
            <h4>📋 Balance Recommendations</h4>
            <ul>
              {results.recommendations.map((rec, index) => (
                <li key={index} className="recommendation">
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          <div className="export-section">
            <button 
              onClick={() => {
                const tester = new AIBalanceTester();
                const report = tester.getDetailedReport();
                const blob = new Blob([report], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `balance-test-${Date.now()}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="export-btn"
            >
              📄 Export Detailed Report
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .balance-test-runner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 2rem;
        }

        .balance-test-runner > div {
          background: #1a1a1a;
          border-radius: 12px;
          padding: 2rem;
          max-width: 1200px;
          max-height: 90vh;
          overflow-y: auto;
          color: white;
          position: relative;
        }

        .balance-test-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .balance-test-header h2 {
          margin: 0 0 0.5rem 0;
          color: #4ecdc4;
        }

        .close-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: none;
          border: none;
          color: #999;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.5rem;
        }

        .close-btn:hover {
          color: white;
        }

        .test-controls {
          display: flex;
          gap: 1rem;
          align-items: end;
          margin-bottom: 2rem;
          justify-content: center;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .input-group label {
          font-size: 0.9rem;
          color: #ccc;
        }

        .input-group select {
          padding: 0.5rem;
          border-radius: 4px;
          border: 1px solid #444;
          background: #2a2a2a;
          color: white;
        }

        .run-test-btn {
          padding: 0.75rem 1.5rem;
          background: #4ecdc4;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }

        .run-test-btn:disabled {
          background: #666;
          cursor: not-allowed;
        }

        .progress-section {
          text-align: center;
          margin: 2rem 0;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #333;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4ecdc4, #44a08d);
          transition: width 0.3s ease;
        }

        .results-section {
          margin-top: 2rem;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .balance-score {
          font-size: 1.1rem;
        }

        .score-detail {
          color: #999;
          font-size: 0.9rem;
          margin-left: 0.5rem;
        }

        .race-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .race-card {
          background: #2a2a2a;
          border-radius: 8px;
          padding: 1rem;
          border: 1px solid #444;
        }

        .race-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .race-header h5 {
          margin: 0;
          color: #4ecdc4;
        }

        .win-rate {
          font-size: 1.2rem;
          font-weight: bold;
        }

        .race-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          font-size: 0.9rem;
        }

        .stat {
          display: flex;
          justify-content: space-between;
        }

        .stat span:first-child {
          color: #999;
        }

        .recommendations {
          margin: 2rem 0;
        }

        .recommendations ul {
          list-style: none;
          padding: 0;
        }

        .recommendation {
          background: #2a2a2a;
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          border-radius: 6px;
          border-left: 3px solid #4ecdc4;
        }

        .export-section {
          text-align: center;
          margin-top: 2rem;
        }

        .export-btn {
          padding: 0.75rem 1.5rem;
          background: #666;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .export-btn:hover {
          background: #777;
        }
      `}</style>
    </div>
  );
}

export default BalanceTestRunner;
export { BalanceTestRunner };
