/**
 * Phase 2: Game Simulator Engine
 * IQC: Run complete games between AI players using balance formulas
 */
import { AIPlayer, type GameState, type PlayerState, type Action, type RaceType } from './AIPlayer'
import { calculateLandGainRange } from '../../../../shared/balance'

export interface GameResult {
  winner: 'player1' | 'player2' | 'draw'
  turns: number
  finalState: GameState
  player1Race: RaceType
  player2Race: RaceType
  winCondition: 'elimination' | 'land_advantage' | 'timeout'
}

export class GameSimulator {
  async runGame(player1: AIPlayer, player2: AIPlayer): Promise<GameResult> {
    const gameState = this.initializeGame(player1, player2)
    let turnCount = 0
    const maxTurns = 200 // Prevent infinite games
    
    while (!gameState.isComplete && turnCount < maxTurns) {
      const action1 = player1.makeDecision(gameState, 'player1')
      const action2 = player2.makeDecision(gameState, 'player2')
      
      this.processActions(gameState, action1, action2)
      turnCount++
      
      // Check win conditions
      this.checkWinConditions(gameState)
    }
    
    return this.analyzeResult(gameState, turnCount, player1.race, player2.race)
  }

  private initializeGame(player1: AIPlayer, player2: AIPlayer): GameState {
    const createInitialState = (race: RaceType): PlayerState => {
      const baseState = {
        race,
        networth: 150000,
        land: 1000,
        gold: 50000,
        population: 500,
        offense: 1000,
        defense: 1000,
        structures: 800
      }
      
      // Apply racial bonuses
      return this.applyRacialBonuses(baseState)
    }

    return {
      player1: createInitialState(player1.race),
      player2: createInitialState(player2.race),
      availableTargets: [
        { id: 'npc1', land: 800, defense: 800, networth: 120000 },
        { id: 'npc2', land: 1200, defense: 1200, networth: 180000 }
      ],
      isComplete: false,
      turn: 0
    }
  }

  private applyRacialBonuses(state: PlayerState): PlayerState {
    switch (state.race) {
      case 'DROBEN':
        // Elite combat: +4% offense, +3% defense (reduced)
        state.offense *= 1.04
        state.defense *= 1.03
        break
      case 'HUMAN':
        // Economic: +6% gold, +5% structures, +2% all (reduced)
        state.gold *= 1.06
        state.structures *= 1.05
        state.offense *= 1.02
        state.defense *= 1.02
        break
      case 'ELVEN':
        // Defensive: +8% defense, +4% population (reduced)
        state.defense *= 1.08
        state.population *= 1.04
        break
      case 'GOBLIN':
        // Warriors: +4% offense, +6% population (balanced)
        state.offense *= 1.04
        state.population *= 1.06
        break
      case 'VAMPIRE':
        // Powerful: +8% offense, -2% gold (reduced)
        state.offense *= 1.08
        state.gold *= 0.98
        break
      case 'ELEMENTAL':
        // Hybrid: +4% offense, +4% defense (reduced)
        state.offense *= 1.04
        state.defense *= 1.04
        break
      case 'CENTAUR':
        // Balanced: +3% all stats (reduced)
        state.offense *= 1.03
        state.defense *= 1.03
        state.gold *= 1.03
        break
      case 'SIDHE':
        // Sorcerers: +8% defense, +8% structures (reduced)
        state.defense *= 1.08
        state.structures *= 1.08
        break
      case 'DWARVEN':
        // Defensive: +10% defense, +6% structures (reduced)
        state.defense *= 1.10
        state.structures *= 1.06
        break
      case 'FAE':
        // Versatile: +3% all stats (reduced)
        state.offense *= 1.03
        state.defense *= 1.03
        state.gold *= 1.03
        state.population *= 1.05
        break
    }
    
    state.networth = state.land * 1000 + state.gold + state.population * 100
    return state
  }

  private processActions(gameState: GameState, action1: Action, action2: Action): void {
    gameState.turn++
    
    // Process player 1 action
    this.processPlayerAction(gameState, 'player1', action1)
    
    // Process player 2 action
    this.processPlayerAction(gameState, 'player2', action2)
    
    // Apply turn-based growth
    this.applyTurnGrowth(gameState)
  }

  private processPlayerAction(gameState: GameState, playerId: 'player1' | 'player2', action: Action): void {
    const playerState = gameState[playerId]
    
    switch (action.type) {
      case 'attack':
        if (action.target) {
          this.processCombat(playerState, action.target)
        }
        break
      case 'build':
        this.processBuild(playerState)
        break
      case 'defend':
        this.processDefend(playerState, action.amount || 0)
        break
      case 'economic':
        this.processEconomic(playerState, action.amount || 0)
        break
    }
  }

  private processCombat(attacker: PlayerState, target: { land: number; defense: number }): void {
    // Reduced combat randomness (±8% variance)
    const attackVariance = 0.92 + Math.random() * 0.16 // 0.92 to 1.08
    const defenseVariance = 0.92 + Math.random() * 0.16
    
    const effectiveOffense = attacker.offense * attackVariance
    const effectiveDefense = target.defense * defenseVariance
    
    const landGain = calculateLandGainRange(effectiveOffense, effectiveDefense, target.land)
    
    if (landGain.resultType !== 'failed') {
      const actualGain = Math.floor(Math.random() * (landGain.max - landGain.min + 1)) + landGain.min
      attacker.land += actualGain
      attacker.networth += actualGain * 1000
      
      // Reduced army efficiency loss (0.1-0.2% per attack)
      const efficiencyLoss = (0.001 + Math.random() * 0.001) // 0.1% to 0.2%
      attacker.offense *= (1 - efficiencyLoss)
      attacker.defense *= (1 - efficiencyLoss * 0.5)
    } else {
      // Smaller penalty for failed attacks
      attacker.offense *= 0.995
      attacker.defense *= 0.998
    }
  }

  private processBuild(playerState: PlayerState): void {
    const buildCost = Math.floor(playerState.gold * 0.5)
    if (buildCost > 0) {
      playerState.gold -= buildCost
      const landGain = Math.floor(buildCost / 500) // 500 gold per land
      playerState.land += landGain
      playerState.structures += Math.floor(landGain * 0.8)
      playerState.networth += landGain * 1000
    }
  }

  private processDefend(playerState: PlayerState, amount: number): void {
    const actualAmount = Math.min(amount, playerState.gold)
    playerState.gold -= actualAmount
    playerState.defense += Math.floor(actualAmount / 100) // 100 gold per defense point
  }

  private processEconomic(playerState: PlayerState, amount: number): void {
    const actualAmount = Math.min(amount, playerState.gold)
    playerState.gold -= actualAmount
    // Economic buildings generate more gold over time
    playerState.structures += Math.floor(actualAmount / 200)
  }

  private applyTurnGrowth(gameState: GameState): void {
    [gameState.player1, gameState.player2].forEach(player => {
      // Reduced income variance (±10%)
      const incomeVariance = 0.9 + Math.random() * 0.2 // 0.9 to 1.1
      const income = Math.floor(player.structures * 50 * incomeVariance)
      player.gold += income
      
      // Consistent population growth
      const popGrowth = Math.floor(player.land * 0.1)
      player.population += popGrowth
      
      // Reduced random events (2% chance per turn)
      if (Math.random() < 0.02) {
        const eventType = Math.random()
        if (eventType < 0.5) {
          // Economic boom: +10% gold
          player.gold *= 1.1
        } else {
          // Military training: +5% offense/defense
          player.offense *= 1.05
          player.defense *= 1.05
        }
      }
      
      // Update networth
      player.networth = player.land * 1000 + player.gold + player.population * 100
    })
  }

  private checkWinConditions(gameState: GameState): void {
    const p1 = gameState.player1
    const p2 = gameState.player2
    
    // Elimination condition (land < 100)
    if (p1.land < 100 || p2.land < 100) {
      gameState.isComplete = true
      return
    }
    
    // Significant land advantage (3:1 ratio)
    if (p1.land > p2.land * 3 || p2.land > p1.land * 3) {
      gameState.isComplete = true
      return
    }
  }

  private analyzeResult(gameState: GameState, turns: number, race1: RaceType, race2: RaceType): GameResult {
    const p1 = gameState.player1
    const p2 = gameState.player2
    
    let winner: 'player1' | 'player2' | 'draw' = 'draw'
    let winCondition: 'elimination' | 'land_advantage' | 'timeout' = 'timeout'
    
    if (p1.land < 100) {
      winner = 'player2'
      winCondition = 'elimination'
    } else if (p2.land < 100) {
      winner = 'player1'
      winCondition = 'elimination'
    } else if (p1.land > p2.land * 3) {
      winner = 'player1'
      winCondition = 'land_advantage'
    } else if (p2.land > p1.land * 3) {
      winner = 'player2'
      winCondition = 'land_advantage'
    } else if (p1.land > p2.land) {
      winner = 'player1'
      winCondition = 'timeout'
    } else if (p2.land > p1.land) {
      winner = 'player2'
      winCondition = 'timeout'
    }
    
    return {
      winner,
      turns,
      finalState: gameState,
      player1Race: race1,
      player2Race: race2,
      winCondition
    }
  }
}
