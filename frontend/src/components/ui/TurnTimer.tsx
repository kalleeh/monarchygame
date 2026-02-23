/* eslint-disable */
/**
 * Turn Timer Component
 * IQC Compliant: Real-time turn generation display
 * Context7 Research: React Spring animations for smooth updates
 */

import React, { useMemo, useCallback, memo } from 'react';
import { useSpring, animated, config } from '@react-spring/web';
import { useTurnGeneration } from '../../hooks/useTurnGeneration';
import './TurnTimer.css';

interface TurnTimerProps {
  kingdomId: string;
  onTurnGenerated?: (newTurns: number) => void;
  compact?: boolean;
}

function TurnTimer({
  kingdomId,
  onTurnGenerated,
  compact = false
}: TurnTimerProps) {
  const {
    nextTurnIn,
    turnsToGenerate,
    isGenerating,
    autoGenerate,
    formatTimeRemaining,
    generateTurns,
    toggleAutoGenerate
  } = useTurnGeneration({ kingdomId, onTurnGenerated });

  // Memoized progress calculation
  const progress = useMemo(() => {
    const TURN_INTERVAL_SECONDS = 20 * 60; // 20 minutes
    return ((TURN_INTERVAL_SECONDS - nextTurnIn) / TURN_INTERVAL_SECONDS) * 100;
  }, [nextTurnIn]);

  // Memoized event handlers
  const handleGenerateTurns = useCallback(() => {
    generateTurns();
  }, [generateTurns]);

  const handleToggleAutoGenerate = useCallback(() => {
    toggleAutoGenerate();
  }, [toggleAutoGenerate]);

  // Animated progress bar
  const progressSpring = useSpring({
    width: `${progress}%`,
    config: config.slow
  });

  // Pulse animation when turns are ready
  const pulseSpring = useSpring({
    scale: turnsToGenerate > 0 ? 1.05 : 1,
    config: config.wobbly,
    loop: turnsToGenerate > 0
  });

  if (compact) {
    return (
      <animated.div className="turn-timer-compact" style={pulseSpring}>
        <span className="timer-icon">⏱️</span>
        <span className="timer-text">{formatTimeRemaining()}</span>
        {turnsToGenerate > 0 && (
          <span className="turns-ready">+{turnsToGenerate}</span>
        )}
      </animated.div>
    );
  }

  return (
    <div className="turn-timer">
      <div className="turn-timer-header">
        <div className="timer-title">
          <span className="timer-icon">⏱️</span>
          <h4>Turn Generation</h4>
        </div>
        <button
          className={`auto-toggle ${autoGenerate ? 'active' : ''}`}
          onClick={handleToggleAutoGenerate}
          title={autoGenerate ? 'Auto-generation ON' : 'Auto-generation OFF'}
        >
          {autoGenerate ? '🔄 Auto' : '⏸️ Manual'}
        </button>
      </div>

      <div className="timer-display">
        <animated.div className="timer-value" style={pulseSpring}>
          {formatTimeRemaining()}
        </animated.div>
        <div className="timer-label">Next turn in</div>
      </div>

      <div className="timer-progress-bar">
        <animated.div
          className="timer-progress-fill"
          style={progressSpring}
        />
      </div>

      {turnsToGenerate > 0 && (
        <div className="turns-available">
          <span className="turns-count">
            {turnsToGenerate} turn{turnsToGenerate > 1 ? 's' : ''} ready!
          </span>
          <button
            className="generate-btn"
            onClick={generateTurns}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Now'}
          </button>
        </div>
      )}

      <div className="timer-info">
        <span>💡 Turns generate every 20 minutes (3 per hour)</span>
      </div>
      <div className="timer-info timer-info-secondary">
        ⚔️ Actions cost 1–4 turns · Build=1 · Train=1 · Attack=4 · Spell=1
      </div>
    </div>
  );
}

export default TurnTimer;
export { TurnTimer };
