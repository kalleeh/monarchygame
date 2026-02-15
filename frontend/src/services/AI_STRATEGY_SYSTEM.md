# Comprehensive AI Strategy System

## Overview

This document describes the advanced AI strategy system designed for the Monarchy game. The system uses actual game mechanics to make intelligent strategic decisions, replacing the basic AI with a sophisticated multi-layered approach.

## System Architecture

### Core Components

1. **AIStrategyEngine** - Main decision-making engine
2. **BuildOrderOptimizer** - Race-specific build sequence optimization
3. **TargetSelector** - Intelligent combat target selection
4. **ResourceManager** - Long-term resource planning and allocation
5. **ComprehensiveAISystem** - Master coordinator integrating all subsystems

## Key Features

### 1. Strategic Decision Engine (`aiStrategyEngine.ts`)

**Purpose**: Makes high-level strategic decisions based on game phase, race bonuses, and current threats/opportunities.

**Key Capabilities**:
- Game phase detection (early: 1-20 turns, mid: 21-60, late: 61+)
- Race-specific strategy templates
- Dynamic priority adjustment based on threats and opportunities
- Combat analysis using actual game mechanics (6.79%-7.35% land gain)
- War declaration tracking (3 attacks before declaration required)

**Example Decision Logic**:
```typescript
// Analyze attack viability using actual combat mechanics
const networthRatio = attacker.networth / defender.networth;
let turnCost = 4; // Base cost
if (networthRatio >= 1.5) turnCost = 6; // Easy target
else if (networthRatio <= 0.67) turnCost = 8; // Hard target

const landGainExpected = Math.floor(defender.resources.land * 0.0735); // Max gain
const efficiency = landGainExpected / turnCost; // Land per turn
```

### 2. Build Order Optimizer (`buildOrderOptimizer.ts`)

**Purpose**: Creates optimal building sequences based on racial bonuses and game phase.

**Race-Specific Templates**:
- **Human**: Economic focus (tithe buildings → trade infrastructure → balanced military)
- **Droben**: Elite combat (training facilities → siege equipment → aggressive expansion)
- **Elven**: Defensive training (superior training → defensive positions → controlled expansion)
- **Goblin**: Early aggression (fast military → mass training → early land grab)
- **Vampire**: High-cost/high-power (elite units → resource generation → high-value expansion)

**Adaptive Features**:
- Phase-specific modifiers (early: +30% economic, mid: +20% military, late: +40% military)
- Threat-based adjustments (increase defensive spending when threats > 2)
- Resource constraint validation
- Expected return calculations

### 3. Target Selector (`targetSelector.ts`)

**Purpose**: Analyzes potential targets and creates optimal attack plans using actual combat mechanics.

**Advanced Analysis**:
- **Combat Prediction**: Uses networth ratios, racial bonuses, and actual land gain formulas
- **Strategic Value**: Assesses threat level, resource value, and position importance
- **Risk Assessment**: War declaration risk, retaliation probability, resource loss potential
- **Attack Planning**: Controlled strike → full strike progression

**Target Categories**:
- **Prime Targets**: 1.5x+ networth advantage, 8+ land/turn efficiency
- **Good Targets**: 0.8-1.5x networth, 6+ land/turn efficiency
- **Risky Targets**: <0.8x networth, high reward but high cost
- **Avoid**: Targets triggering unwanted war declarations

**Combat Mechanics Integration**:
```typescript
// Actual land gain calculation from game mechanics
let landGainPercent = 0.0679; // Minimum from combat-mechanics.ts
if (adjustedRatio >= 1.5) landGainPercent = 0.0735; // Maximum for dominating
else if (adjustedRatio >= 1.2) landGainPercent = 0.070; // Good fight

const expectedLandGain = Math.floor(target.resources.land * landGainPercent * successProbability);
```

### 4. Resource Manager (`resourceManager.ts`)

**Purpose**: Optimizes resource allocation and creates long-term strategic plans.

**Resource Allocation Framework**:
- **Emergency Reserve**: 15% gold for unexpected situations
- **Growth Investment**: 30-45% for buildings/expansion (phase-dependent)
- **Military Investment**: 25-45% for units/training
- **Opportunity Fund**: 5-10% for immediate tactical needs

**Long-term Planning**:
- **Growth Projections**: Short (10 turns), medium (25 turns), long (50 turns)
- **Risk Mitigation**: Identifies threats and creates contingency plans
- **Adaptive Reallocation**: Adjusts based on performance metrics

**Phase-Specific Allocation**:
```typescript
const baseAllocations = {
  early: { economic: 45, military: 25, defensive: 15, emergency: 10, opportunity: 5 },
  mid: { economic: 30, military: 35, defensive: 20, emergency: 10, opportunity: 5 },
  late: { economic: 20, military: 45, defensive: 20, emergency: 10, opportunity: 5 }
};
```

### 5. Comprehensive AI System (`comprehensiveAI.ts`)

**Purpose**: Master coordinator that integrates all subsystems for complete strategic analysis.

**Integration Features**:
- **Game State Analysis**: Determines player position, market conditions, strategic recommendations
- **Multi-System Coordination**: Combines decisions from all subsystems
- **Performance Tracking**: Monitors success rates and adapts strategies
- **Confidence Calculation**: Assesses decision quality based on multiple factors
- **Player Advice**: Provides strategic guidance for human players

## Game Mechanics Integration

### Combat System
- Uses actual land gain ranges (6.79%-7.35%)
- Implements turn cost scaling (4/6/8 turns based on networth ratio)
- Tracks war declarations (3 attacks before required)
- Applies racial combat bonuses

### Economic System
- Leverages racial economic bonuses (Human +20% economy, Vampire -20% economy)
- Calculates optimal resource allocation ratios
- Projects growth based on investment patterns

### Strategic Mechanics
- Implements controlled strike progression (CS1 → CS100)
- Uses "Rule of 0.25%" for army reduction efficiency
- Considers ambush mechanics and counter-strategies

## Performance Metrics

The AI tracks and optimizes based on:
- **Attack Success Rate**: Target >80% for sustainability
- **Land Acquisition Rate**: Target 7%+ per successful attack
- **Turn Efficiency**: Land gained per turn spent
- **Economic Growth Rate**: Networth increase per turn
- **Defensive Effectiveness**: Success in repelling attacks

## Usage Examples

### Basic AI Decision
```typescript
const aiSystem = new ComprehensiveAISystem();
const decision = await aiSystem.makeComprehensiveDecision(
  aiKingdom,
  allKingdoms,
  playerKingdom,
  gameContext
);

console.log(`AI Decision: ${decision.primaryAction.action}`);
console.log(`Confidence: ${Math.round(decision.confidence * 100)}%`);
```

### Player Advice
```typescript
const advice = aiSystem.getPlayerAdvice(playerKingdom, allKingdoms, gameContext);
advice.forEach(tip => console.log(tip));
```

### Performance Tracking
```typescript
aiSystem.updatePerformanceMetrics({
  attackSuccessRate: 0.85,
  landAcquisitionRate: 0.072,
  economicGrowthRate: 0.048,
  defensiveEffectiveness: 0.9,
  turnEfficiency: 2.1,
  networthGrowth: 0.055
});
```

## Testing

Run the comprehensive test suite:
```typescript
import { testComprehensiveAI, testRaceStrategies } from './services/__tests__/comprehensiveAI.test';

await testComprehensiveAI(); // Full system test
await testRaceStrategies(); // Race-specific strategy analysis
```

## Advantages Over Previous AI

### Previous AI Issues:
- Simple priority logic (economy > military > expansion)
- Basic networth comparisons for combat
- No build order optimization
- No long-term planning
- No intelligent target selection

### New AI Advantages:
- **Uses Actual Game Mechanics**: Land gain formulas, turn costs, racial bonuses
- **Strategic Depth**: Multi-phase planning with adaptive strategies
- **Race Specialization**: Unique strategies for each race's strengths
- **Intelligent Combat**: Advanced target selection and attack planning
- **Resource Optimization**: Sophisticated allocation and growth planning
- **Performance Learning**: Adapts strategies based on success/failure
- **Player Guidance**: Provides strategic advice for human players

## Integration with Existing Systems

The AI system integrates seamlessly with existing game components:
- **AIKingdom Store**: Uses existing kingdom data structures
- **Combat Mechanics**: Leverages shared combat calculation functions
- **Race Definitions**: Uses actual racial bonuses and abilities
- **Game Balance**: Respects existing balance formulas and constraints

## Future Enhancements

Potential improvements:
1. **Machine Learning**: Train on player behavior patterns
2. **Alliance Coordination**: Multi-kingdom strategic planning
3. **Market Analysis**: Economic trend prediction and response
4. **Diplomatic AI**: Negotiation and treaty management
5. **Meta-Game Adaptation**: Adjust to changing player strategies

## Conclusion

This comprehensive AI system transforms the game's artificial intelligence from basic heuristics to sophisticated strategic thinking. By using actual game mechanics and implementing multi-layered decision making, the AI can compete at high levels while providing valuable guidance to human players.

The system demonstrates how proper integration of game mechanics, strategic planning, and performance tracking can create AI that feels intelligent and challenging rather than predictable and simplistic.