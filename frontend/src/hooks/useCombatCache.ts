/**
 * Combat Cache Hook
 * React hook for cached combat calculations
 */

import { useMemo, useCallback } from 'react';
import { 
  calculateCombatResult, 
  calculatePowerRatio, 
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

  // Get cache performance stats
  const getCachePerformance = useCallback(() => {
    return getCacheStats();
  }, []);

  // Clear cache if needed
  const clearCache = useCallback(() => {
    clearCombatCache();
  }, []);

  // Stable object reference: without this memo the returned object is a new literal every
  // render, causing useCombatPreview's useMemo to treat calculatePreview as a changed dep
  // even though the useCallback above produced the same function identity.
  return useMemo(() => ({
    calculatePreview,
    getPowerRatio,
    getCachePerformance,
    clearCache
  }), [calculatePreview, getPowerRatio, getCachePerformance, clearCache]);
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
