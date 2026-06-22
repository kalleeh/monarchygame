/**
 * BountyBoard Component
 * UI for the bounty hunting system. Displays ranked AI kingdoms as bounty targets,
 * allows players to claim bounties, and shows completed bounty history.
 */

import React, { useEffect } from 'react';
import { useBountyStore } from '../stores/bountyStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { useKingdomStore } from '../stores/kingdomStore';
import { isDemoMode } from '../utils/authMode';
import { useKingdomTargets } from '../hooks/useKingdomTargets';
import { TargetPicker } from './common/TargetPicker';
import { TopNavigation } from './TopNavigation';
import { LandIcon, HammerIcon, TurnsIcon } from './ui/MenuIcons';
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

  const { aiKingdoms, generateAIKingdoms } = useAIKingdomStore();
  const resources = useKingdomStore((state) => state.resources);

  // Feeds the bounty list (rewards/efficiency are computed per target by the store).
  const { targets: kingdomTargets } = useKingdomTargets({ range: [0.3, 3.0] });

  // Seed AI kingdoms in demo mode, then generate bounties from them.
  // In auth mode, generate bounties from server-fetched kingdomTargets.
  useEffect(() => {
    if (isDemoMode()) {
      if (aiKingdoms.length === 0) {
        const networth = (resources.gold || 0) + (resources.land || 0) * 50;
        generateAIKingdoms(5, networth);
      } else {
        generateBounties(aiKingdoms);
      }
    }
  }, [aiKingdoms, generateBounties, generateAIKingdoms, resources.gold, resources.land]);

  useEffect(() => {
    if (!isDemoMode() && kingdomTargets.length > 0) {
      // Adapt TargetKingdom[] to AIKingdom[] shape for the bounty mechanics
      const adapted = kingdomTargets.map(k => ({
        id: k.id,
        name: k.name,
        race: k.race,
        resources: k.resources,
        units: { tier1: 0, tier2: 0, tier3: 0, tier4: 0 },
        difficulty: (k.difficulty as 'easy' | 'medium' | 'hard') ?? 'medium',
        networth: k.networth,
      }));
      generateBounties(adapted);
    }
  }, [kingdomTargets, generateBounties]);

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
        title={<><img src="/bounty-icon.png" style={{width:28,height:28,objectFit:'contain',verticalAlign:'middle',marginRight:8}} alt="" />Bounty Board</>}
        onBack={onBack}
        backLabel="← Back to Kingdom"
        subtitle="Hunt rival kingdoms for glory and rewards"
        kingdomId={kingdomId}
      />

      {error && (
        <div className="bounty-error gm-error-banner">
          <span>{error}</span>
          <button onClick={clearError} className="dismiss-btn">Dismiss</button>
        </div>
      )}

      <div className="bounty-content">
        {/* Available Bounties */}
        <section className="bounty-section">
          <h2 className="section-title">Available Bounties</h2>

          {loading && (
            <div className="bounty-loading gm-loading">Scanning rival kingdoms...</div>
          )}

          <TargetPicker
            currentKingdomId={kingdomId}
            range={[0.3, 3.0]}
            variant="cards"
            onSelect={(t) => {
              const bounty = availableBounties.find(b => b.target.kingdomId === t.id);
              if (bounty && !bounty.claimed) handleClaimBounty(t.id);
            }}
            metadataRenderer={(t) => {
              const bounty = availableBounties.find(b => b.target.kingdomId === t.id);
              if (!bounty) {
                return <span className="bounty-meta-hint">Generating bounty…</span>;
              }
              return (
                <div className="bounty-meta">
                  <span
                    className="bounty-difficulty"
                    style={{ backgroundColor: DIFFICULTY_COLORS[bounty.target.difficulty] || '#888' }}
                  >
                    {bounty.target.difficulty}
                  </span>
                  <div className="bounty-rewards">
                    <h4>Estimated Rewards</h4>
                    <div className="reward-items">
                      <span className="reward-item">
                        <span className="reward-icon"><LandIcon /></span>
                        {bounty.reward.landGained.toLocaleString()} land
                      </span>
                      <span className="reward-item">
                        <span className="reward-icon"><HammerIcon /></span>
                        {bounty.reward.structuresGained.toLocaleString()} structures
                      </span>
                      <span className="reward-item">
                        <span className="reward-icon"><TurnsIcon /></span>
                        {bounty.reward.turnsSaved.toLocaleString()} turns saved
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
                        className="claim-bounty-btn gm-btn gm-btn--primary"
                        onClick={(e) => { e.stopPropagation(); handleClaimBounty(bounty.target.kingdomId); }}
                        disabled={loading}
                      >
                        Claim Bounty
                      </button>
                    )}
                  </div>
                </div>
              );
            }}
          />
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
                      <span className="reward-icon"><LandIcon /></span>
                      {completed.landGained.toLocaleString()} land gained
                    </span>
                    <span className="reward-item">
                      <span className="reward-icon"><HammerIcon /></span>
                      {completed.reward.structuresGained.toLocaleString()} structures
                    </span>
                    <span className="reward-item">
                      <span className="reward-icon"><TurnsIcon /></span>
                      {completed.reward.turnsSaved.toLocaleString()} turns saved
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
