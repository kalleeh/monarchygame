import { useEffect } from 'react';
import { useAchievementStore } from '../stores/achievementStore';
import { ACHIEVEMENTS } from '../data/achievements';

export const useInitializeAchievements = () => {
  useEffect(() => {
    const store = useAchievementStore.getState();
    
    // Initialize achievements if not already loaded
    if (store.achievements.length === 0) {
      useAchievementStore.setState({ achievements: ACHIEVEMENTS });
    }
  }, []);
};
