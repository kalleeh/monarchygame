import { AchievementTier } from '../../stores/achievementStore';
import type { Achievement, AchievementProgress } from '../../stores/achievementStore';
import './Achievement.css';

interface AchievementCardProps {
  achievement: Achievement;
  progress?: AchievementProgress;
}

const TIER_COLORS: Record<AchievementTier, string> = {
  [AchievementTier.COMMON]: '#9ca3af',
  [AchievementTier.RARE]: '#3b82f6',
  [AchievementTier.EPIC]: '#a855f7',
  [AchievementTier.LEGENDARY]: '#f59e0b',
};

export const AchievementCard = ({ achievement, progress }: AchievementCardProps) => {
  const isCompleted = progress?.completed || false;
  const currentProgress = progress?.progress || 0;
  const progressPercentage = (currentProgress / achievement.criteria.target) * 100;

  return (
    <div className={`achievement-card ${isCompleted ? 'completed' : ''}`}>
      <div className="achievement-icon" style={{ borderColor: TIER_COLORS[achievement.tier] }}>
        {achievement.icon}
      </div>
      
      <div className="achievement-content">
        <div className="achievement-header">
          <h3 className="achievement-name">{achievement.name}</h3>
          <span className="achievement-tier" style={{ color: TIER_COLORS[achievement.tier] }}>
            {achievement.tier}
          </span>
        </div>
        
        <p className="achievement-description">{achievement.description}</p>
        
        {!isCompleted && (
          <div className="achievement-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ 
                  width: `${progressPercentage}%`,
                  backgroundColor: TIER_COLORS[achievement.tier]
                }}
              />
            </div>
            <span className="progress-text">
              {currentProgress} / {achievement.criteria.target}
            </span>
          </div>
        )}
        
        {isCompleted && progress?.unlockedAt && (
          <div className="achievement-unlocked">
            ✓ Unlocked {new Date(progress.unlockedAt).toLocaleDateString()}
          </div>
        )}
        
        {achievement.reward && (
          <div className="achievement-reward">
            {achievement.reward.gold && <span>💰 {achievement.reward.gold}</span>}
            {achievement.reward.turns && <span>⏱️ {achievement.reward.turns}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
