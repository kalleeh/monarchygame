import { useState, useCallback } from 'react';

/**
 * Hook for managing tutorial state
 */
export const useTutorial = (tutorialId: string) => {
  const [hasCompleted, setHasCompleted] = useState(() => {
    return localStorage.getItem(`tutorial-${tutorialId}`) === 'completed';
  });

  const markComplete = useCallback(() => {
    localStorage.setItem(`tutorial-${tutorialId}`, 'completed');
    setHasCompleted(true);
  }, [tutorialId]);

  const reset = useCallback(() => {
    localStorage.removeItem(`tutorial-${tutorialId}`);
    setHasCompleted(false);
  }, [tutorialId]);

  return {
    hasCompleted,
    markComplete,
    reset
  };
};
