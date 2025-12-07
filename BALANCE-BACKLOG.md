# Game Balance Testing Backlog - Enhanced with Game Design Principles

## 🎯 **Current Status: Balance System Complete, Testing Required**

### **✅ IMPLEMENTED**
- Comprehensive balance formulas (12,077 lines of exact calculations)
- 10 race balance with precise summon rates and abilities
- Combat, sorcery, thievery, economic balance systems
- Mathematical optimization from pro player documentation

### **🎮 ACTIVE SPRINT: Balance Validation Testing**
**Enhanced with Game Design Skills Principles**

---

## **📋 PHASE 1: Balance Formula Unit Tests** (2-3 hours)
**Priority**: HIGH | **Context**: Validate mathematical correctness

### **Task 1.1: Combat Balance Formula Validation**
**Context**: Test core combat mechanics that determine game outcomes
**Implementation**: 
```typescript
// frontend/src/balance-testing/__tests__/combat-balance.test.ts
import { describe, test, expect } from 'vitest'
import { COMBAT_BALANCE, calculateLandGainRange, calculateSummonTroops } from '../../../game-data/balance'

describe('Combat Balance - Land Acquisition', () => {
  test.concurrent('with ease threshold (2:1 ratio)', () => {
    const result = calculateLandGainRange(2000, 1000, 1000)
    expect(result.resultType).toBe('with_ease')
    expect(result.min).toBeGreaterThanOrEqual(67) // 6.79% of 1000
    expect(result.max).toBeLessThanOrEqual(74)    // 7.35% of 1000
  })

  test.concurrent('good fight threshold (1.2:1 ratio)', () => {
    const result = calculateLandGainRange(1200, 1000, 1000)
    expect(result.resultType).toBe('good_fight')
    expect(result.min).toBeGreaterThanOrEqual(67)
    expect(result.max).toBeLessThanOrEqual(70)
  })

  test.concurrent('failed attack threshold (<1.2:1 ratio)', () => {
    const result = calculateLandGainRange(1100, 1000, 1000)
    expect(result.resultType).toBe('failed')
    expect(result.min).toBe(0)
    expect(result.max).toBe(0)
  })
})
```

### **Task 1.2: Racial Balance Validation**
**Context**: Ensure no race is overpowered or underpowered
**Implementation**:
```typescript
describe('Racial Balance - Summon Rates', () => {
  test.concurrent('Droben advantage within acceptable range', () => {
    const drobenSummons = calculateSummonTroops('DROBEN', 100000)
    const faeSummons = calculateSummonTroops('FAE', 100000)
    
    expect(drobenSummons).toBe(3040) // 3.04% of 100k
    expect(faeSummons).toBe(2000)    // 2.0% of 100k
    
    const advantage = drobenSummons / faeSummons
    expect(advantage).toBeCloseTo(1.52) // 52% advantage
    expect(advantage).toBeLessThan(1.6) // Not more than 60% advantage
  })

  test.concurrent('all races within competitive range', () => {
    const races = ['HUMAN', 'ELVEN', 'GOBLIN', 'DROBEN', 'VAMPIRE', 
                   'ELEMENTAL', 'CENTAUR', 'SIDHE', 'DWARVEN', 'FAE']
    const summons = races.map(race => calculateSummonTroops(race, 100000))
    
    const min = Math.min(...summons)
    const max = Math.max(...summons)
    const variance = (max - min) / min
    
    expect(variance).toBeLessThan(0.6) // Max 60% difference between races
  })
})
```

### **Task 1.3: Economic Balance Validation**
**Context**: Test build rate and resource formulas
**Implementation**:
```typescript
describe('Economic Balance - Build Rates', () => {
  test.concurrent('optimal build rate calculations', () => {
    expect(calculateOptimalBuildRate(1600, 10000)).toBe(16) // 16% BR
    expect(calculateOptimalBuildRate(2000, 10000)).toBe(20) // 20% BR
    expect(isOptimalBR(18)).toBe(true)
    expect(isOptimalBR(15)).toBe(false)
  })
})
```

---

## **📋 PHASE 2: Game Simulation Framework** (4-5 hours)
**Priority**: HIGH | **Context**: Create AI players for automated balance testing

### **Task 2.1: AI Player Implementation**
**Context**: AI players that use balance formulas to make optimal decisions
**Implementation**:
```typescript
// frontend/src/balance-testing/simulation/AIPlayer.ts
export class AIPlayer {
  constructor(
    public race: RaceType,
    public strategy: 'aggressive' | 'defensive' | 'economic' | 'balanced'
  ) {}

  makeDecision(gameState: GameState): Action {
    const networth = this.calculateNetworth(gameState)
    const summonCapacity = calculateSummonTroops(this.race, networth)
    
    switch (this.strategy) {
      case 'aggressive':
        return this.planAttack(gameState, summonCapacity)
      case 'defensive':
        return this.buildDefenses(gameState)
      case 'economic':
        return this.optimizeEconomy(gameState)
      case 'balanced':
        return this.balancedStrategy(gameState, summonCapacity)
    }
  }

  private planAttack(gameState: GameState, summonCapacity: number): Action {
    // Use COMBAT_BALANCE formulas to find optimal targets
    const targets = gameState.availableTargets
    const bestTarget = targets.find(target => {
      const landGain = calculateLandGainRange(
        summonCapacity, 
        target.defense, 
        target.land
      )
      return landGain.resultType === 'with_ease'
    })
    
    return bestTarget ? { type: 'attack', target: bestTarget } : { type: 'build' }
  }
}
```

### **Task 2.2: Game Simulator Engine**
**Context**: Run complete games between AI players
**Implementation**:
```typescript
// frontend/src/balance-testing/simulation/GameSimulator.ts
export class GameSimulator {
  async runGame(player1: AIPlayer, player2: AIPlayer): Promise<GameResult> {
    const gameState = this.initializeGame(player1, player2)
    let turnCount = 0
    const maxTurns = 1000 // Prevent infinite games
    
    while (!gameState.isComplete && turnCount < maxTurns) {
      const action1 = player1.makeDecision(gameState)
      const action2 = player2.makeDecision(gameState)
      
      gameState = this.processActions(gameState, action1, action2)
      turnCount++
    }
    
    return this.analyzeResult(gameState, turnCount)
  }

  private processActions(state: GameState, action1: Action, action2: Action): GameState {
    // Apply balance formulas to determine action outcomes
    const newState = { ...state }
    
    // Process combat using COMBAT_BALANCE formulas
    if (action1.type === 'attack') {
      const result = this.processCombat(action1, newState)
      newState.player1 = this.applyLandGain(newState.player1, result)
    }
    
    return newState
  }
}
```

---

## **📋 PHASE 3: Concurrent Balance Analysis** (3-4 hours)
**Priority**: HIGH | **Context**: Large-scale statistical balance validation

### **Task 3.1: Race vs Race Balance Matrix**
**Context**: Test all race combinations for competitive balance
**Implementation**:
```typescript
// frontend/src/balance-testing/__tests__/race-matrix.test.ts
describe('Race Balance Matrix', () => {
  test.concurrent('comprehensive race balance analysis', async () => {
    const races = ['HUMAN', 'ELVEN', 'GOBLIN', 'DROBEN', 'VAMPIRE', 
                   'ELEMENTAL', 'CENTAUR', 'SIDHE', 'DWARVEN', 'FAE']
    const simulator = new GameSimulator()
    const results = new Map<string, Map<string, number>>()
    
    // Test each race against all others
    for (const race1 of races) {
      results.set(race1, new Map())
      
      for (const race2 of races) {
        if (race1 !== race2) {
          const gameResults = await Promise.all(
            Array.from({ length: 50 }, () => // 50 games per matchup
              simulator.runGame(
                new AIPlayer(race1 as RaceType, 'balanced'),
                new AIPlayer(race2 as RaceType, 'balanced')
              )
            )
          )
          
          const wins = gameResults.filter(r => r.winner === 'player1').length
          const winRate = wins / gameResults.length
          results.get(race1)!.set(race2, winRate)
        }
      }
    }
    
    // Validate balance: no race should dominate
    for (const [race, matchups] of results) {
      const winRates = Array.from(matchups.values())
      const avgWinRate = winRates.reduce((a, b) => a + b, 0) / winRates.length
      
      expect(avgWinRate, `${race} average win rate: ${avgWinRate}`).toBeGreaterThan(0.4)
      expect(avgWinRate, `${race} average win rate: ${avgWinRate}`).toBeLessThan(0.6)
    }
  }, 300000) // 5 minute timeout for comprehensive testing
})
```

### **Task 3.2: Strategy Balance Validation**
**Context**: Test different AI strategies for viability
**Implementation**:
```typescript
describe('Strategy Balance', () => {
  test.concurrent('all strategies competitive', async () => {
    const strategies = ['aggressive', 'defensive', 'economic', 'balanced']
    const simulator = new GameSimulator()
    const results = new Map<string, number>()
    
    // Round-robin tournament between strategies
    for (const strategy1 of strategies) {
      let totalWins = 0
      let totalGames = 0
      
      for (const strategy2 of strategies) {
        if (strategy1 !== strategy2) {
          const gameResults = await Promise.all(
            Array.from({ length: 20 }, () =>
              simulator.runGame(
                new AIPlayer('HUMAN', strategy1 as any),
                new AIPlayer('HUMAN', strategy2 as any)
              )
            )
          )
          totalWins += gameResults.filter(r => r.winner === 'player1').length
          totalGames += gameResults.length
        }
      }
      
      results.set(strategy1, totalWins / totalGames)
    }
    
    // All strategies should be viable (40-60% win rate)
    for (const [strategy, winRate] of results) {
      expect(winRate, `${strategy} win rate: ${winRate}`).toBeGreaterThan(0.35)
      expect(winRate, `${strategy} win rate: ${winRate}`).toBeLessThan(0.65)
    }
  })
})
```

---

## **📋 PHASE 4: Integration & UI Testing** (2-3 hours)
**Priority**: MEDIUM | **Context**: Ensure UI reflects balance calculations correctly

### **Task 4.1: Balance Formula Integration Tests**
**Context**: Test UI components use balance formulas correctly
**Implementation**:
```typescript
// frontend/src/balance-testing/__tests__/ui-integration.test.ts
import { test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KingdomDashboard } from '../../components/KingdomDashboard'
import { calculateSummonTroops } from '../../../game-data/balance'

test('UI displays correct summon calculations', async () => {
  const user = userEvent.setup()
  const mockElvenKingdom = {
    race: 'ELVEN',
    networth: 50000,
    // ... other properties
  }
  
  render(<KingdomDashboard kingdom={mockElvenKingdom} />)
  
  // Navigate to combat interface
  await user.click(screen.getByText('Combat Operations'))
  
  // Verify summon calculation matches balance formula
  const expectedSummons = calculateSummonTroops('ELVEN', 50000)
  const displayedSummons = screen.getByTestId('summon-capacity')
  
  expect(displayedSummons).toHaveTextContent(expectedSummons.toString())
})

test('combat preview uses correct land gain formulas', async () => {
  const user = userEvent.setup()
  // Test that combat preview calculations match COMBAT_BALANCE formulas
  // ... implementation
})
```

---

## **📋 PHASE 5: Balance Analytics & Reporting** (2-3 hours)
**Priority**: LOW | **Context**: Tools for ongoing balance monitoring

### **Task 5.1: Balance Analytics Dashboard**
**Context**: Real-time balance monitoring tools
**Implementation**:
```typescript
// frontend/src/balance-testing/analytics/BalanceAnalyzer.ts
export class BalanceAnalyzer {
  analyzeRaceBalance(gameResults: GameResult[]): BalanceReport {
    const raceStats = new Map<string, RaceStats>()
    
    for (const result of gameResults) {
      // Analyze win rates, average game length, resource efficiency
      this.updateRaceStats(raceStats, result)
    }
    
    return {
      overallBalance: this.calculateOverallBalance(raceStats),
      raceRankings: this.rankRaces(raceStats),
      recommendations: this.generateRecommendations(raceStats)
    }
  }

  detectBalanceIssues(report: BalanceReport): BalanceIssue[] {
    const issues: BalanceIssue[] = []
    
    // Detect overpowered races (>60% win rate)
    for (const [race, stats] of report.raceRankings) {
      if (stats.winRate > 0.6) {
        issues.push({
          type: 'overpowered_race',
          race,
          severity: 'high',
          recommendation: `Reduce ${race} summon rate or combat effectiveness`
        })
      }
    }
    
    return issues
  }
}
```

---

## **🎯 SUCCESS METRICS & VALIDATION**

### **Balance Quality Gates**
1. **Race Balance**: No race >60% or <40% win rate across 1000+ games
2. **Strategy Viability**: All 4 strategies competitive (35-65% win rate)
3. **Formula Accuracy**: UI calculations match balance formulas 100%
4. **Performance**: Complete test suite runs in <10 minutes
5. **Regression Prevention**: Automated balance tests in CI/CD

### **Game Design Principles Applied**
1. **Meaningful Choices**: Each race/strategy has distinct advantages
2. **Skill Expression**: Better players can overcome racial disadvantages
3. **Counterplay**: Every strategy has viable counters
4. **Progression**: Clear power curves and upgrade paths
5. **Accessibility**: New players can compete with simpler strategies

### **Balance Testing Tools**
```bash
# Run balance test suite
npm run test:balance

# Generate balance report
npm run balance:analyze

# Run race balance matrix
npm run balance:race-matrix

# Performance benchmark
npm run balance:benchmark
```

---

## **📊 IMPLEMENTATION TIMELINE**

**Week 1**: Phase 1 & 2 (Formula tests + AI framework)
**Week 2**: Phase 3 (Large-scale simulation testing)  
**Week 3**: Phase 4 & 5 (Integration tests + Analytics)

**Total Effort**: 13-17 hours over 3 weeks
**Deliverables**: 
- Comprehensive balance test suite
- AI simulation framework  
- Balance analytics dashboard
- Automated balance monitoring

This enhanced approach combines your existing mathematical balance system with modern game design principles and comprehensive testing methodology, ensuring your Monarchy game achieves competitive balance across all races and strategies.
