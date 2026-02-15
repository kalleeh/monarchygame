/**
 * Combat Cache Hook
 * React hook for cached combat calculations
 */

import { useMemo, useCallback } from 'react';
import { 
  calculateCombatResult, 
  calculatePowerRatio, 
  precomputePowerRatios,
  getCacheStats,
  clearCombatCache
} from '../utils/combatCache';

export interface CombatPreview {
  powerRatio: number;
  expectedResult: string;
  expectedCasualties: {
    attacker: Record<string, number>;
    defender: Record<string, number>;
  };
  expectedLandGain: number;
  expectedGoldGain: number;
  success: boolean;
}

export const useCombatCache = () => {
  // Memoized combat preview calculation
  const calculatePreview = useCallback((
    attackerUnits: Record<string, number>,
    defenderUnits: Record<string, number>,
    defenderLand: number
  ): CombatPreview => {
    const result = calculateCombatResult(attackerUnits, defenderUnits, defenderLand);
    
    return {
      powerRatio: result.powerRatio,
      expectedResult: result.result,
      expectedCasualties: result.casualties,
      expectedLandGain: result.landGained,
      expectedGoldGain: result.goldLooted,
      success: result.success
    };
  }, []);

  // Memoized power ratio calculation
  const getPowerRatio = useCallback((
    attackerUnits: Record<string, number>,
    defenderUnits: Record<string, number>
  ): number => {
    return calculatePowerRatio(attackerUnits, defenderUnits);
  }, []);

  // Initialize cache with common scenarios
  const initializeCache = useCallback(() => {
    precomputePowerRatios();
  }, []);

  // Get cache performance stats
  const getCachePerformance = useCallback(() => {
    return getCacheStats();
  }, []);

  // Clear cache if needed
  const clearCache = useCallback(() => {
    clearCombatCache();
  }, []);

  return {
    calculatePreview,
    getPowerRatio,
    initializeCache,
    getCachePerformance,
    clearCache
  };
};

/**
 * Hook for memoized combat preview
 */
export const useCombatPreview = (
  attackerUnits: Record<string, number>,
  defenderUnits: Record<string, number>,
  defenderLand: number
) => {
  const { calculatePreview } = useCombatCache();

  return useMemo(() => {
    if (!attackerUnits || !defenderUnits || !defenderLand) {
      return null;
    }

    return calculatePreview(attackerUnits, defenderUnits, defenderLand);
  }, [attackerUnits, defenderUnits, defenderLand, calculatePreview]);
};
