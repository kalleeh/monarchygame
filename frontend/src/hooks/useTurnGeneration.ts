/**
 * Auto Turn Generation Hook
 * IQC Compliant: Authentic game mechanics (3 turns per hour = 20 minutes per turn)
 * Context7 Research: React hooks best practices with useCallback and useEffect
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AmplifyFunctionService } from '../services/amplifyFunctionService';
import { ToastService } from '../services/toastService';

interface TurnGenerationState {
  nextTurnIn: number; // seconds until next turn
  turnsToGenerate: number; // number of turns ready to generate
  isGenerating: boolean;
  lastGeneration: number; // timestamp of last generation
  autoGenerate: boolean;
}

interface UseTurnGenerationOptions {
  kingdomId: string;
  autoGenerate?: boolean;
  onTurnGenerated?: (newTurns: number) => void;
}

const TURN_INTERVAL = 20 * 60 * 1000; // 20 minutes in milliseconds
const MAX_STORED_TURNS = 100; // Maximum turns that can be stored

/**
 * Hook for managing automatic turn generation
 * Follows authentic Monarchy mechanics: 3 turns per hour (20 minutes per turn)
 */
export const useTurnGeneration = ({
  kingdomId,
  autoGenerate = true,
  onTurnGenerated
}: UseTurnGenerationOptions) => {
  const [state, setState] = useState<TurnGenerationState>({
    nextTurnIn: TURN_INTERVAL / 1000,
    turnsToGenerate: 0,
    isGenerating: false,
    lastGeneration: Date.now(),
    autoGenerate
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastGenerationRef = useRef<number>(
    parseInt(localStorage.getItem(`turnTimer-last-${kingdomId}`) || '') || Date.now()
  );

  const overflowWarningShownRef = useRef(false);

  // Calculate turns available based on time elapsed
  const calculateAvailableTurns = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastGenerationRef.current;
    const rawTurns = Math.floor(elapsed / TURN_INTERVAL);
    const capped = Math.min(rawTurns, MAX_STORED_TURNS);

    // Warn player when turns are being lost due to cap
    if (rawTurns > MAX_STORED_TURNS && !overflowWarningShownRef.current) {
      overflowWarningShownRef.current = true;
      ToastService.warning(`Turn storage full (${MAX_STORED_TURNS} max). Spend turns to avoid losing generated turns!`);
    } else if (rawTurns <= MAX_STORED_TURNS) {
      overflowWarningShownRef.current = false;
    }

    return capped;
  }, []);

  // Generate turns (manual or automatic)
  const generateTurns = useCallback(async () => {
    const turnsAvailable = calculateAvailableTurns();
    
    if (turnsAvailable === 0 || state.isGenerating) {
      return { success: false, turns: 0 };
    }

    setState(prev => ({ ...prev, isGenerating: true }));

    try {
      const result = await AmplifyFunctionService.updateResources({
        kingdomId,
        amount: turnsAvailable
      });

      if ((result as { success: boolean }).success) {
        const newTurns = (result as { newTurns?: number }).newTurns || turnsAvailable;
        lastGenerationRef.current = Date.now();
        localStorage.setItem(`turnTimer-last-${kingdomId}`, String(Date.now()));

        // Check if an encamp period has ended and apply bonus turns
        let bonusFromEncamp = 0;
        try {
          const encampRaw = localStorage.getItem(`encamp-${kingdomId}`);
          if (encampRaw) {
            const encampData = JSON.parse(encampRaw) as { endTime: number; bonusTurns: number };
            if (Date.now() >= encampData.endTime) {
              bonusFromEncamp = encampData.bonusTurns;
              localStorage.removeItem(`encamp-${kingdomId}`);
              ToastService.success(
                `Encamp bonus applied! +${bonusFromEncamp} bonus turns added.`
              );
            }
          }
        } catch {
          // Malformed encamp data — ignore and clear it
          localStorage.removeItem(`encamp-${kingdomId}`);
        }

        const totalTurns = newTurns + bonusFromEncamp;

        setState(prev => ({
          ...prev,
          isGenerating: false,
          turnsToGenerate: 0,
          lastGeneration: Date.now(),
          nextTurnIn: TURN_INTERVAL / 1000
        }));

        onTurnGenerated?.(totalTurns);

        return { success: true, turns: totalTurns };
      }

      setState(prev => ({ ...prev, isGenerating: false }));
      return { success: false, turns: 0 };
    } catch (error) {
      console.error('Turn generation failed:', error);
      setState(prev => ({ ...prev, isGenerating: false }));
      return { success: false, turns: 0 };
    }
  }, [kingdomId, calculateAvailableTurns, state.isGenerating, onTurnGenerated]);

  // Update countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const elapsed = now - lastGenerationRef.current;
      const nextTurnIn = Math.max(0, Math.ceil((TURN_INTERVAL - (elapsed % TURN_INTERVAL)) / 1000));
      const turnsToGenerate = calculateAvailableTurns();

      setState(prev => ({
        ...prev,
        nextTurnIn,
        turnsToGenerate
      }));

      // Auto-generate if enabled and turns are available
      if (state.autoGenerate && turnsToGenerate > 0 && !state.isGenerating) {
        generateTurns();
      }
    };

    // Update every second
    intervalRef.current = setInterval(updateTimer, 1000);
    updateTimer(); // Initial update

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [calculateAvailableTurns, state.autoGenerate, state.isGenerating, generateTurns]);

  // Toggle auto-generation
  const toggleAutoGenerate = useCallback(() => {
    setState(prev => ({ ...prev, autoGenerate: !prev.autoGenerate }));
  }, []);

  // Format time remaining as MM:SS
  const formatTimeRemaining = useCallback(() => {
    const minutes = Math.floor(state.nextTurnIn / 60);
    const seconds = state.nextTurnIn % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [state.nextTurnIn]);

  return {
    nextTurnIn: state.nextTurnIn,
    turnsToGenerate: state.turnsToGenerate,
    isGenerating: state.isGenerating,
    autoGenerate: state.autoGenerate,
    formatTimeRemaining,
    generateTurns,
    toggleAutoGenerate
  };
};
