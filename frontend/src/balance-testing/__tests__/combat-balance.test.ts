/**
 * Phase 1: Combat Balance Formula Validation
 * IQC: Validate mathematical correctness of combat formulas
 */
import { describe, test } from 'vitest'
import { 
  calculateLandGainRange, 
  calculateSummonTroops 
} from '../../../../shared/balance'

describe('Combat Balance - Land Acquisition', () => {
  test.concurrent('with ease threshold (2:1 ratio)', ({ expect }) => {
    const result = calculateLandGainRange(2000, 1000, 1000)
    expect(result.resultType).toBe('with_ease')
    expect(result.min).toBeGreaterThanOrEqual(67) // 6.79% of 1000
    expect(result.max).toBeLessThanOrEqual(74)    // 7.35% of 1000
  })

  test.concurrent('good fight threshold (1.2:1 ratio)', ({ expect }) => {
    const result = calculateLandGainRange(1200, 1000, 1000)
    expect(result.resultType).toBe('good_fight')
    expect(result.min).toBeGreaterThanOrEqual(67)
    expect(result.max).toBeLessThanOrEqual(70)
  })

  test.concurrent('failed attack threshold (<1.2:1 ratio)', ({ expect }) => {
    const result = calculateLandGainRange(1100, 1000, 1000)
    expect(result.resultType).toBe('failed')
    expect(result.min).toBe(0)
    expect(result.max).toBe(0)
  })
})

describe('Racial Balance - Summon Rates', () => {
  test.concurrent('Droben advantage within acceptable range', ({ expect }) => {
    const drobenSummons = calculateSummonTroops('DROBEN', 100000)
    const faeSummons = calculateSummonTroops('FAE', 100000)
    
    expect(drobenSummons).toBe(3040) // 3.04% of 100k
    expect(faeSummons).toBe(2000)    // 2.0% of 100k
    
    const advantage = drobenSummons / faeSummons
    expect(advantage).toBeCloseTo(1.52) // 52% advantage
    expect(advantage).toBeLessThan(1.6) // Not more than 60% advantage
  })

  test.concurrent('all races within competitive range', ({ expect }) => {
    const races = ['HUMAN', 'ELVEN', 'GOBLIN', 'DROBEN', 'VAMPIRE', 
                   'ELEMENTAL', 'CENTAUR', 'SIDHE', 'DWARVEN', 'FAE']
    const summons = races.map(race => calculateSummonTroops(race, 100000))
    
    const min = Math.min(...summons)
    const max = Math.max(...summons)
    const variance = (max - min) / min
    
    expect(variance).toBeLessThan(0.6) // Max 60% difference between races
  })
})

describe('Combat Thresholds - Edge Cases', () => {
  test.concurrent('exact threshold boundaries', ({ expect }) => {
    // Test exact 2:1 ratio
    const withEase = calculateLandGainRange(2000, 1000, 1000)
    expect(withEase.resultType).toBe('with_ease')
    
    // Test exact 1.2:1 ratio
    const goodFight = calculateLandGainRange(1200, 1000, 1000)
    expect(goodFight.resultType).toBe('good_fight')
    
    // Test just below 1.2:1 ratio
    const failed = calculateLandGainRange(1199, 1000, 1000)
    expect(failed.resultType).toBe('failed')
  })
})
