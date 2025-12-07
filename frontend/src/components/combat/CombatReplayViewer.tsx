import { useState } from 'react';
import type { CombatReplay } from '../../types/combat';
import { TERRAINS } from '../../data/terrains';
import { FORMATIONS } from '../../data/formations';
import './CombatEnhancements.css';

interface CombatReplayViewerProps {
  replay: CombatReplay;
  onClose: () => void;
}

export const CombatReplayViewer = ({ replay, onClose }: CombatReplayViewerProps) => {
  const [currentRound, setCurrentRound] = useState(0);

  const terrain = TERRAINS.find((t) => t.type === replay.terrain);
  const attackerFormation = FORMATIONS.find((f) => f.type === replay.attackerFormation);
  const defenderFormation = FORMATIONS.find((f) => f.type === replay.defenderFormation);

  const round = replay.rounds[currentRound];

  return (
    <div className="replay-viewer-overlay">
      <div className="replay-viewer">
        <div className="replay-header">
          <h2>⚔️ Battle Replay</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="replay-info">
          <div className="battle-participants">
            <div className="participant attacker">
              <h3>{replay.attackerName}</h3>
              <p>{attackerFormation?.icon} {attackerFormation?.name}</p>
            </div>
            <span className="vs">VS</span>
            <div className="participant defender">
              <h3>{replay.defenderName}</h3>
              <p>{defenderFormation?.icon} {defenderFormation?.name}</p>
            </div>
          </div>

          <div className="battle-conditions">
            <div className="condition">
              <span className="label">Terrain:</span>
              <span className="value">{terrain?.icon} {terrain?.name}</span>
            </div>
            <div className="condition">
              <span className="label">Result:</span>
              <span className={`value ${replay.result}`}>
                {replay.result === 'victory' ? '✓ Victory' : '✗ Defeat'}
              </span>
            </div>
            <div className="condition">
              <span className="label">Land Gained:</span>
              <span className="value">{replay.landGained} acres</span>
            </div>
          </div>
        </div>

        <div className="replay-timeline">
          <h3>Round {currentRound + 1} of {replay.rounds.length}</h3>
          
          <div className="round-stats">
            <div className="stat-group">
              <h4>Attacker</h4>
              <p>Units: {round.attackerUnitsRemaining}</p>
              <p className="casualties">Casualties: {round.attackerCasualties}</p>
            </div>
            <div className="stat-group">
              <h4>Defender</h4>
              <p>Units: {round.defenderUnitsRemaining}</p>
              <p className="casualties">Casualties: {round.defenderCasualties}</p>
            </div>
          </div>

          <div className="replay-controls">
            <button 
              onClick={() => setCurrentRound(Math.max(0, currentRound - 1))}
              disabled={currentRound === 0}
            >
              ← Previous
            </button>
            <span className="round-indicator">
              {currentRound + 1} / {replay.rounds.length}
            </span>
            <button 
              onClick={() => setCurrentRound(Math.min(replay.rounds.length - 1, currentRound + 1))}
              disabled={currentRound === replay.rounds.length - 1}
            >
              Next →
            </button>
          </div>
        </div>

        <div className="replay-footer">
          <p className="timestamp">
            Battle fought on {new Date(replay.timestamp).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};
