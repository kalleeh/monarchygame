/**
 * BountyBoard Component
 * UI for the bounty hunting system. Displays ranked AI kingdoms as bounty targets,
 * allows players to claim bounties, and shows completed bounty history.
 */

import React, { useEffect } from 'react';
import { useBountyStore } from '../stores/bountyStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { TopNavigation } from './TopNavigation';
import './BountyBoard.css';

interface BountyBoardProps {
  kingdomId: string;
  onBack: () => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#4ecdc4',
  medium: '#f59e0b',
  hard: '#ef4444',
};

const BountyBoard: React.FC<BountyBoardProps> = ({ kingdomId, onBack }) => {
  const {
    availableBounties,
    completedBounties,
    loading,
    error,
    generateBounties,
    claimBounty,
    clearError,
  } = useBountyStore();

  const { aiKingdoms } = useAIKingdomStore();

  // Generate bounties on mount from current AI kingdoms
  useEffect(() => {
    if (aiKingdoms.length > 0) {
      generateBounties(aiKingdoms);
    }
  }, [aiKingdoms, generateBounties]);

  // Auto-clear errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleClaimBounty = (targetId: string) => {
    claimBounty(targetId);
  };

  return (
    <div className="bounty-board">
      <TopNavigation
        title="Bounty Board"
        onBack={onBack}
        backLabel="← Back to Kingdom"
        subtitle="Hunt rival kingdoms for glory and rewards"
      />

      {error && (
        <div className="bounty-error">
          <span>{error}</span>
          <button onClick={clearError} className="dismiss-btn">Dismiss</button>
        </div>
      )}

      <div className="bounty-content">
        {/* Available Bounties */}
        <section className="bounty-section">
          <h2 className="section-title">Available Bounties</h2>

          {loading && (
            <div className="bounty-loading">Scanning rival kingdoms...</div>
          )}

          {!loading && availableBounties.length === 0 && (
            <div className="bounty-empty">
              <p>No bounties available. AI kingdoms must be generated first.</p>
            </div>
          )}

          <div className="bounty-grid">
            {availableBounties.map((bounty) => (
              <div
                key={bounty.target.kingdomId}
                className={`bounty-card ${bounty.claimed ? 'claimed' : ''}`}
              >
                <div className="bounty-card-header">
                  <h3 className="bounty-target-name">{bounty.targetName}</h3>
                  <span
                    className="bounty-difficulty"
                    style={{ backgroundColor: DIFFICULTY_COLORS[bounty.target.difficulty] || '#888' }}
                  >
                    {bounty.target.difficulty}
                  </span>
                </div>

                <div className="bounty-details">
                  <div className="bounty-detail-row">
                    <span className="detail-label">Race</span>
                    <span className="detail-value">{bounty.targetRace}</span>
                  </div>
                  <div className="bounty-detail-row">
                    <span className="detail-label">Land</span>
                    <span className="detail-value">{bounty.target.totalLand.toLocaleString()} acres</span>
                  </div>
                  <div className="bounty-detail-row">
                    <span className="detail-label">Structures</span>
                    <span className="detail-value">{bounty.target.totalStructures.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bounty-rewards">
                  <h4>Estimated Rewards</h4>
                  <div className="reward-items">
                    <span className="reward-item">
                      <span className="reward-icon">💰</span>
                      {bounty.reward.goldGained.toLocaleString()} gold
                    </span>
                    <span className="reward-item">
                      <span className="reward-icon">🏞️</span>
                      {bounty.reward.landGained.toLocaleString()} land
                    </span>
                    <span className="reward-item">
                      <span className="reward-icon">🏗️</span>
                      {bounty.reward.structuresGained.toLocaleString()} structures
                    </span>
                  </div>
                </div>

                <div className="bounty-footer">
                  <div className="efficiency-score">
                    <span className="efficiency-label">Efficiency</span>
                    <span className="efficiency-value">{bounty.efficiency}</span>
                  </div>

                  {bounty.claimed ? (
                    <div className="bounty-claimed-badge">
                      <span className="claimed-text">Claimed</span>
                      <span className="claimed-hint">Attack to Complete</span>
                    </div>
                  ) : (
                    <button
                      className="claim-bounty-btn"
                      onClick={() => handleClaimBounty(bounty.target.kingdomId)}
                      disabled={loading}
                    >
                      Claim Bounty
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Completed Bounties */}
        {completedBounties.length > 0 && (
          <section className="bounty-section">
            <h2 className="section-title">Completed Bounties</h2>
            <div className="completed-list">
              {completedBounties.map((completed, index) => (
                <div key={`${completed.targetId}-${index}`} className="completed-card">
                  <div className="completed-info">
                    <h4 className="completed-name">{completed.targetName}</h4>
                    <span className="completed-date">
                      {new Date(completed.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="completed-rewards">
                    <span className="reward-item">
                      <span className="reward-icon">💰</span>
                      {completed.reward.goldGained.toLocaleString()} gold
                    </span>
                    <span className="reward-item">
                      <span className="reward-icon">🏞️</span>
                      {completed.landGained.toLocaleString()} land gained
                    </span>
                    <span className="reward-item">
                      <span className="reward-icon">🏗️</span>
                      {completed.reward.structuresGained.toLocaleString()} structures
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default BountyBoard;
