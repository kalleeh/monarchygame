/**
 * Phase 2: AI Player Implementation
 * IQC: AI players that use balance formulas to make optimal decisions
 */
import { calculateSummonTroops, calculateLandGainRange } from '../../../../shared/balance'

export type RaceType = 'HUMAN' | 'ELVEN' | 'GOBLIN' | 'DROBEN' | 'VAMPIRE' | 
                       'ELEMENTAL' | 'CENTAUR' | 'SIDHE' | 'DWARVEN' | 'FAE'

export type StrategyType = 'aggressive' | 'defensive' | 'economic' | 'balanced'

export interface GameState {
  player1: PlayerState
  player2: PlayerState
  availableTargets: Target[]
  isComplete: boolean
  turn: number
}

export interface PlayerState {
  race: RaceType
  networth: number
  land: number
  gold: number
  population: number
  offense: number
  defense: number
  structures: number
}

export interface Target {
  id: string
  land: number
  defense: number
  networth: number
}

export interface Action {
  type: 'attack' | 'build' | 'defend' | 'economic'
  target?: Target
  amount?: number
}

export class AIPlayer {
  race: RaceType;
  strategy: StrategyType;
  
  constructor(race: RaceType, strategy: StrategyType) {
    this.race = race;
    this.strategy = strategy;
  }

  makeDecision(gameState: GameState, playerId: 'player1' | 'player2'): Action {
    const playerState = gameState[playerId]
    const summonCapacity = calculateSummonTroops(this.race, playerState.networth)
    
    // Add strategy randomness to prevent deterministic outcomes
    const strategyRoll = Math.random()
    
    switch (this.strategy) {
      case 'aggressive':
        return strategyRoll < 0.8 ? this.planAttack(gameState, summonCapacity, playerState) : this.balancedStrategy(gameState, summonCapacity, playerState)
      case 'defensive':
        return strategyRoll < 0.7 ? this.buildDefenses(playerState) : this.optimizeEconomy(playerState)
      case 'economic':
        return strategyRoll < 0.8 ? this.optimizeEconomy(playerState) : this.buildDefenses(playerState)
      case 'balanced':
        return this.balancedStrategy(gameState, summonCapacity, playerState)
    }
  }

  private planAttack(gameState: GameState, summonCapacity: number, playerState: PlayerState): Action {
    // Aggressive strategy: prioritize attacks and military expansion
    const targets = gameState.availableTargets
    
    // Look for any viable target (not just easy ones)
    const viableTarget = targets.find(target => {
      const landGain = calculateLandGainRange(
        summonCapacity, 
        target.defense, 
        target.land
      )
      return landGain.resultType === 'with_ease' || landGain.resultType === 'good_fight'
    })
    
    if (viableTarget) {
      return { type: 'attack', target: viableTarget }
    }
    
    // No viable targets: build military or expand
    const offenseRatio = playerState.offense / playerState.networth
    if (offenseRatio < 0.008) { // Need more military strength
      return { type: 'defend', amount: Math.floor(playerState.gold * 0.4) } // Build offense through defense action
    } else {
      return { type: 'build' } // Expand to increase capacity
    }
  }

  private buildDefenses(playerState: PlayerState): Action {
    // Defensive strategy with intentional weakness: makes poor decisions 30% of the time
    const randomChoice = Math.random()
    
    if (randomChoice < 0.3) {
      // 30% chance of poor decision - waste resources on excessive defense
      return { type: 'defend', amount: Math.floor(playerState.gold * 0.8) }
    } else if (randomChoice < 0.6) {
      // 30% chance of economic focus
      return { type: 'economic', amount: Math.floor(playerState.gold * 0.5) }
    } else {
      // 40% chance of expansion
      return { type: 'build' }
    }
  }

  private optimizeEconomy(playerState: PlayerState): Action {
    // Focus on economic buildings and resource generation
    return { type: 'economic', amount: Math.floor(playerState.gold * 0.8) }
  }

  private balancedStrategy(gameState: GameState, summonCapacity: number, playerState: PlayerState): Action {
    // Balance between attack, defense, and economy based on game state
    const turnRatio = gameState.turn / 100 // Assume 100 turn games
    
    if (turnRatio < 0.3) {
      // Early game: focus on economy
      return this.optimizeEconomy(playerState)
    } else if (turnRatio < 0.7) {
      // Mid game: balanced approach
      const targets = gameState.availableTargets
      const viableTarget = targets.find(target => {
        const landGain = calculateLandGainRange(summonCapacity, target.defense, target.land)
        return landGain.resultType === 'with_ease' || landGain.resultType === 'good_fight'
      })
      
      return viableTarget ? { type: 'attack', target: viableTarget } : { type: 'build' }
    } else {
      // Late game: aggressive expansion
      return this.planAttack(gameState, summonCapacity, playerState)
    }
  }

  calculateNetworth(playerState: PlayerState): number {
    // Simple networth calculation: land * 1000 + gold + units * 100
    return playerState.land * 1000 + playerState.gold + playerState.population * 100
  }
}
