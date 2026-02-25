import { useNavigate } from 'react-router-dom';
import { useAchievementStore } from '../../stores/achievementStore';
import { ACHIEVEMENTS } from '../../data/achievements';
import type { AchievementTier } from '../../stores/achievementStore';
import './Achievement.css';

const TIER_COLORS: Record<AchievementTier, string> = {
  COMMON: '#9ca3af',
  RARE: '#3b82f6',
  EPIC: '#a855f7',
  LEGENDARY: '#f59e0b',
};

interface AchievementWidgetProps {
  kingdomId: string;
}

export const AchievementWidget = ({ kingdomId }: AchievementWidgetProps) => {
  const navigate = useNavigate();
  const progress = useAchievementStore((s) => s.progress);

  const total = ACHIEVEMENTS.length;

  // Count completed achievements
  const completedIds = new Set(
    Object.values(progress)
      .filter((p) => p.completed)
      .map((p) => p.achievementId)
  );
  const unlockedCount = completedIds.size;

  // Most recently unlocked: completed achievement with the latest unlockedAt
  const recentlyUnlocked = (() => {
    let latest: { achievement: typeof ACHIEVEMENTS[0]; unlockedAt: string } | null = null;
    for (const ach of ACHIEVEMENTS) {
      const p = progress[ach.id];
      if (p?.completed && p.unlockedAt) {
        if (!latest || p.unlockedAt > latest.unlockedAt) {
          latest = { achievement: ach, unlockedAt: p.unlockedAt };
        }
      }
    }
    return latest;
  })();

  // Nearest to completion: non-completed with highest progress/target ratio
  const nearestToComplete = (() => {
    let best: { achievement: typeof ACHIEVEMENTS[0]; ratio: number; current: number } | null = null;
    for (const ach of ACHIEVEMENTS) {
      const p = progress[ach.id];
      if (p?.completed) continue;
      const current = p?.progress ?? 0;
      const ratio = current / ach.criteria.target;
      if (!best || ratio > best.ratio) {
        best = { achievement: ach, ratio, current };
      }
    }
    return best;
  })();

  return (
    <div className="aw-widget">
      {/* Header */}
      <div className="aw-header">
        <h2 className="aw-title">Achievements</h2>
        <span className="aw-count-badge">
          {unlockedCount} / {total}
        </span>
      </div>

      {/* Recently Unlocked */}
      <div className="aw-section">
        <div className="aw-section-label">Recently Unlocked</div>
        {recentlyUnlocked ? (
          <div className="aw-recent-row">
            <span className="aw-icon">{recentlyUnlocked.achievement.icon}</span>
            <span className="aw-recent-name">{recentlyUnlocked.achievement.name}</span>
            <span
              className="aw-tier-badge"
              style={{ color: TIER_COLORS[recentlyUnlocked.achievement.tier] }}
            >
              {recentlyUnlocked.achievement.tier}
            </span>
          </div>
        ) : (
          <p className="aw-empty">No achievements yet — start exploring!</p>
        )}
      </div>

      {/* Nearest to Completion */}
      {nearestToComplete && (
        <div className="aw-section">
          <div className="aw-section-label">Nearest to Complete</div>
          <div className="aw-progress-row">
            <span className="aw-icon">{nearestToComplete.achievement.icon}</span>
            <div className="aw-progress-content">
              <div className="aw-progress-name">{nearestToComplete.achievement.name}</div>
              <div className="aw-progress-bar-wrap">
                <div className="aw-progress-bar-track">
                  <div
                    className="aw-progress-bar-fill"
                    style={{
                      width: `${Math.min(nearestToComplete.ratio * 100, 100)}%`,
                      backgroundColor: TIER_COLORS[nearestToComplete.achievement.tier],
                    }}
                  />
                </div>
                <span className="aw-progress-numbers">
                  {nearestToComplete.current} / {nearestToComplete.achievement.criteria.target}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View All link */}
      <button
        className="aw-view-all-btn"
        onClick={() => navigate(`/kingdom/${kingdomId}/achievements`)}
      >
        View All Achievements →
      </button>
    </div>
  );
};
