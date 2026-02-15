import { useState, useEffect } from 'react';
import { isDemoMode } from '../utils/authMode';
import { AmplifyFunctionService } from '../services/amplifyFunctionService';
import { useKingdomStore } from '../stores/kingdomStore';
import './MultiplayerLobby.css';

interface SeasonInfo {
  id: string;
  seasonNumber: number;
  status: string;
  currentAge: string;
  weeksRemaining: number;
}

interface MultiplayerLobbyProps {
  kingdomId: string;
  onBack: () => void;
  onBrowseKingdoms: () => void;
  onTrade: () => void;
  onDiplomacy: () => void;
}

const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  kingdomId,
  onBack,
  onBrowseKingdoms,
  onTrade,
  onDiplomacy
}) => {
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSeasonInfo();
  }, []);

  const loadSeasonInfo = async () => {
    try {
      setLoading(true);
      const result = await AmplifyFunctionService.callFunction('season-manager', {
        kingdomId
      }) as any;

      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (parsed.success && parsed.season) {
        setSeason(parsed.season);
      } else if (parsed.season) {
        setSeason(parsed.season);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load season');
    } finally {
      setLoading(false);
    }
  };

  if (isDemoMode()) {
    return (
      <div className="multiplayer-lobby">
        <div className="lobby-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h1>Multiplayer Lobby</h1>
        </div>
        <div className="lobby-demo-notice">
          <h2>Multiplayer Mode</h2>
          <p>Multiplayer features require authentication. Sign in to access:</p>
          <ul>
            <li>Season-based competitive gameplay</li>
            <li>Real player kingdoms to attack and trade with</li>
            <li>Diplomatic treaties and alliances</li>
            <li>War declarations and kingdom rankings</li>
          </ul>
          <p className="demo-hint">Exit demo mode and sign in to play multiplayer.</p>
        </div>
      </div>
    );
  }

  const getAgeColor = (age: string) => {
    switch (age) {
      case 'early': return '#4ade80';
      case 'middle': return '#facc15';
      case 'late': return '#f87171';
      default: return '#94a3b8';
    }
  };

  return (
    <div className="multiplayer-lobby">
      <div className="lobby-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h1>Multiplayer Lobby</h1>
      </div>

      {loading && <div className="lobby-loading">Loading season data...</div>}
      {error && <div className="lobby-error">{error}</div>}

      {season && (
        <div className="season-banner">
          <div className="season-info">
            <h2>Season {season.seasonNumber}</h2>
            <div className="season-details">
              <span className="season-age" style={{ color: getAgeColor(season.currentAge) }}>
                {season.currentAge.charAt(0).toUpperCase() + season.currentAge.slice(1)} Age
              </span>
              <span className="season-weeks">{season.weeksRemaining} weeks remaining</span>
              <span className="season-status">{season.status}</span>
            </div>
          </div>
        </div>
      )}

      <div className="lobby-actions">
        <div className="lobby-card" onClick={onBrowseKingdoms}>
          <h3>Kingdom Browser</h3>
          <p>Scout other kingdoms, view their power, and plan your strategy</p>
        </div>
        <div className="lobby-card" onClick={onTrade}>
          <h3>Trade Market</h3>
          <p>Buy and sell resources with other players on the open market</p>
        </div>
        <div className="lobby-card" onClick={onDiplomacy}>
          <h3>Diplomacy</h3>
          <p>Form alliances, propose treaties, or declare war</p>
        </div>
        <div className="lobby-card">
          <h3>War Status</h3>
          <p>View active wars and your kingdom's military engagements</p>
        </div>
      </div>
    </div>
  );
};

export default MultiplayerLobby;
