/**
 * BountyBoard Component
 * UI for the bounty hunting system. Displays ranked AI kingdoms as bounty targets,
 * allows players to claim bounties, and shows completed bounty history.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useBountyStore } from '../stores/bountyStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { useKingdomStore } from '../stores/kingdomStore';
import { isDemoMode } from '../utils/authMode';
import { useKingdomTargets } from '../hooks/useKingdomTargets';
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

  const { aiKingdoms, generateAIKingdoms } = useAIKingdomStore();
  const resources = useKingdomStore((state) => state.resources);

  const [targetSearch, setTargetSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { targets: kingdomTargets, loading: targetsLoading, hasMore: targetsHasMore, loadMore: loadMoreTargets } =
    useKingdomTargets({ range: [0.3, 3.0], nameSearch: debouncedSearch });

  // Debounce name search input (300ms)
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(targetSearch), 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [targetSearch]);

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

          <input
            type="text"
            placeholder="Search kingdoms by name..."
            value={targetSearch}
            onChange={(e) => setTargetSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '0.9rem',
              marginBottom: '1rem',
              boxSizing: 'border-box',
            }}
          />

          {(loading || targetsLoading) && (
            <div className="bounty-loading gm-loading">Scanning rival kingdoms...</div>
          )}

          {!loading && !targetsLoading && availableBounties.length === 0 && (
            <div className="bounty-empty gm-empty-state">
              {debouncedSearch ? 'No kingdoms found matching your search.' : 'No bounties available yet. Rival kingdoms are being scouted — check back shortly.'}
            </div>
          )}

          <div
            className="bounty-grid"
            style={{ maxHeight: '600px', overflowY: 'auto' }}
          >
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
                      <span className="reward-icon">🏞️</span>
                      {bounty.reward.landGained.toLocaleString()} land
                    </span>
                    <span className="reward-item">
                      <span className="reward-icon">🏗️</span>
                      {bounty.reward.structuresGained.toLocaleString()} structures
                    </span>
                    <span className="reward-item">
                      <span className="reward-icon">⏱️</span>
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
          {targetsHasMore && (
            <button
              onClick={loadMoreTargets}
              disabled={targetsLoading}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1.25rem',
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.4)',
                borderRadius: '6px',
                color: '#a78bfa',
                fontSize: '0.9rem',
                cursor: targetsLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {targetsLoading ? 'Loading...' : 'Load more'}
            </button>
          )}
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
                      <span className="reward-icon">🏞️</span>
                      {completed.landGained.toLocaleString()} land gained
                    </span>
                    <span className="reward-item">
                      <span className="reward-icon">🏗️</span>
                      {completed.reward.structuresGained.toLocaleString()} structures
                    </span>
                    <span className="reward-item">
                      <span className="reward-icon">⏱️</span>
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
