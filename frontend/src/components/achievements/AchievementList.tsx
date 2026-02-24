import { useState, useMemo } from 'react';
import { AchievementCategory, useAchievementStore } from '../../stores/achievementStore';
import { AchievementCard } from './AchievementCard';
import './Achievement.css';

export const AchievementList = () => {
  const { achievements, progress } = useAchievementStore();
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | 'ALL'>('ALL');

  const filteredAchievements = useMemo(() => {
    if (selectedCategory === 'ALL') return achievements;
    return achievements.filter((a) => a.category === selectedCategory);
  }, [achievements, selectedCategory]);

  const stats = useMemo(() => {
    const total = achievements.length;
    const completed = Object.values(progress).filter((p) => p.completed).length;
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [achievements, progress]);

  return (
    <div className="achievement-list-container">
      <div className="achievement-header">
        <h1><img src="/achievements-icon.png" style={{width:28,height:28,objectFit:'contain',verticalAlign:'middle',marginRight:8}} alt="" />Achievements</h1>
        <div className="achievement-stats">
          <span>{stats.completed} / {stats.total} Unlocked</span>
          <span className="achievement-percentage">({stats.percentage}%)</span>
        </div>
      </div>

      <div className="achievement-filters">
        <button
          className={selectedCategory === 'ALL' ? 'active' : ''}
          onClick={() => setSelectedCategory('ALL')}
        >
          All
        </button>
        {Object.values(AchievementCategory).map((category) => (
          <button
            key={category}
            className={selectedCategory === category ? 'active' : ''}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="achievement-grid">
        {filteredAchievements.map((achievement) => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
            progress={progress[achievement.id]}
          />
        ))}
      </div>
    </div>
  );
};

export default AchievementList;
