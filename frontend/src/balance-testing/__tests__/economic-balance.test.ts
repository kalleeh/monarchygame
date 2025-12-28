/**
 * Phase 1: Economic Balance Formula Validation
 * IQC: Test build rate and resource formulas
 */
import { describe, test } from 'vitest'
import { 
  BUILDING_BALANCE,
  calculateOptimalBuildRate,
  isOptimalBR,
  ECONOMIC_BALANCE
} from '../../../../shared/balance'

describe('Economic Balance - Build Rates', () => {
  test.concurrent('optimal build rate calculations', ({ expect }) => {
    expect(calculateOptimalBuildRate(1600, 10000)).toBe(16) // 16% BR
    expect(calculateOptimalBuildRate(2000, 10000)).toBe(20) // 20% BR
    expect(calculateOptimalBuildRate(1800, 10000)).toBe(18) // 18% BR
  })

  test.concurrent('build rate validation', ({ expect }) => {
    expect(isOptimalBR(16)).toBe(true)  // Minimum optimal
    expect(isOptimalBR(20)).toBe(true)  // Maximum optimal
    expect(isOptimalBR(18)).toBe(true)  // Within range
    expect(isOptimalBR(15)).toBe(false) // Below optimal
    expect(isOptimalBR(21)).toBe(false) // Above optimal
  })

  test.concurrent('building ratio validation', ({ expect }) => {
    const { OPTIMAL_RATIOS } = BUILDING_BALANCE
    
    // Quarries should be 30-35%
    expect(OPTIMAL_RATIOS.QUARRIES.min).toBe(0.30)
    expect(OPTIMAL_RATIOS.QUARRIES.max).toBe(0.35)
    
    // Barracks should be 30-35%
    expect(OPTIMAL_RATIOS.BARRACKS.min).toBe(0.30)
    expect(OPTIMAL_RATIOS.BARRACKS.max).toBe(0.35)
    
    // Guildhalls should be 10%
    expect(OPTIMAL_RATIOS.GUILDHALLS).toBe(0.10)
  })
})

describe('Economic Balance - Turn Generation', () => {
  test.concurrent('turn generation rates', ({ expect }) => {
    const { TURNS_PER_HOUR, ENCAMP_BONUS } = ECONOMIC_BALANCE
    
    expect(TURNS_PER_HOUR).toBe(3) // 3 turns per hour base
    expect(ENCAMP_BONUS.HOURS_24).toBe(10) // +10 turns for 24h encamp
    expect(ENCAMP_BONUS.HOURS_16).toBe(7)  // +7 turns for 16h encamp
  })

  test.concurrent('cash management formulas', ({ expect }) => {
    const { SAFE_CASH_MULTIPLIER, WAR_ALLOCATION } = ECONOMIC_BALANCE
    
    // Safe cash should be 1.0-1.5x acreage in millions
    expect(SAFE_CASH_MULTIPLIER.min).toBe(1.0)
    expect(SAFE_CASH_MULTIPLIER.max).toBe(1.5)
    
    // War allocation should be 33-50%
    expect(WAR_ALLOCATION.min).toBe(0.33)
    expect(WAR_ALLOCATION.max).toBe(0.50)
  })
})

describe('Economic Balance - Development Costs', () => {
  test.concurrent('development cost validation', ({ expect }) => {
    const { BUILD_RATE } = BUILDING_BALANCE
    
    expect(BUILD_RATE.OPTIMAL_MIN).toBe(16)
    expect(BUILD_RATE.OPTIMAL_MAX).toBe(20)
    expect(BUILD_RATE.MAX_SUSTAINABLE).toBe(28)
    expect(BUILD_RATE.DEVELOPMENT_COST).toBe(317.5) // 310-325 gold per acre average
  })
})
