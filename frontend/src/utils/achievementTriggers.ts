import { useAchievementStore } from '../stores/achievementStore';
import { useKingdomStore } from '../stores/kingdomStore';
import toast from 'react-hot-toast';

// Achievement trigger functions
export const achievementTriggers = {
  // Combat achievements
  onBattleWon: () => {
    const store = useAchievementStore.getState();
    const progress = store.getProgress('first-victory');
    
    if (!progress?.completed) {
      store.updateProgress('first-victory', 1);
      checkAndNotify('first-victory');
    }
    
    // Track total victories
    const tenProgress = store.getProgress('ten-victories');
    if (!tenProgress?.completed) {
      store.updateProgress('ten-victories', (tenProgress?.progress || 0) + 1);
      checkAndNotify('ten-victories');
    }
    
    const hundredProgress = store.getProgress('hundred-victories');
    if (!hundredProgress?.completed) {
      store.updateProgress('hundred-victories', (hundredProgress?.progress || 0) + 1);
      checkAndNotify('hundred-victories');
    }
  },

  onFlawlessVictory: () => {
    const store = useAchievementStore.getState();
    store.unlockAchievement('flawless-victory');
    notifyUnlock('flawless-victory');
  },

  onLandCaptured: (acres: number) => {
    const store = useAchievementStore.getState();
    const progress = store.getProgress('conquest');
    
    if (!progress?.completed) {
      store.updateProgress('conquest', (progress?.progress || 0) + acres);
      checkAndNotify('conquest');
    }
  },

  // Economy achievements
  onGoldChanged: () => {
    const gold = useKingdomStore.getState().resources.gold || 0;
    const store = useAchievementStore.getState();
    
    if (gold >= 10000) {
      const progress = store.getProgress('first-gold');
      if (!progress?.completed) {
        store.updateProgress('first-gold', gold);
        checkAndNotify('first-gold');
      }
    }
    
    if (gold >= 1000000) {
      const progress = store.getProgress('millionaire');
      if (!progress?.completed) {
        store.updateProgress('millionaire', gold);
        checkAndNotify('millionaire');
      }
    }
  },

  onPopulationChanged: () => {
    const population = useKingdomStore.getState().resources.population || 0;
    const store = useAchievementStore.getState();
    
    if (population >= 5000) {
      const progress = store.getProgress('resource-hoarder');
      if (!progress?.completed) {
        store.updateProgress('resource-hoarder', population);
        checkAndNotify('resource-hoarder');
      }
    }
  },

  onTradeCompleted: () => {
    const store = useAchievementStore.getState();
    const progress = store.getProgress('trade-master');
    
    if (!progress?.completed) {
      store.updateProgress('trade-master', (progress?.progress || 0) + 1);
      checkAndNotify('trade-master');
    }
  },

  // Territory achievements
  onLandChanged: () => {
    const land = useKingdomStore.getState().resources.land || 0;
    const store = useAchievementStore.getState();
    
    if (land >= 1000) {
      const progress = store.getProgress('land-baron');
      if (!progress?.completed) {
        store.updateProgress('land-baron', land);
        checkAndNotify('land-baron');
      }
    }
    
    if (land >= 5000) {
      const progress = store.getProgress('empire-builder');
      if (!progress?.completed) {
        store.updateProgress('empire-builder', land);
        checkAndNotify('empire-builder');
      }
    }
  },

  onBuildingConstructed: (buildingType: string) => {
    const store = useAchievementStore.getState();
    
    if (buildingType === 'fort') {
      const progress = store.getProgress('fortress-master');
      if (!progress?.completed) {
        store.updateProgress('fortress-master', (progress?.progress || 0) + 1);
        checkAndNotify('fortress-master');
      }
    }
    
    // Track total structures
    const totalProgress = store.getProgress('city-planner');
    if (!totalProgress?.completed) {
      store.updateProgress('city-planner', (totalProgress?.progress || 0) + 1);
      checkAndNotify('city-planner');
    }
  },

  // Social achievements
  onAllianceFormed: () => {
    const store = useAchievementStore.getState();
    store.unlockAchievement('alliance-formed');
    notifyUnlock('alliance-formed');
  },

  onGuildJoined: () => {
    const store = useAchievementStore.getState();
    store.unlockAchievement('guild-member');
    notifyUnlock('guild-member');
  },

  onMessageSent: () => {
    const store = useAchievementStore.getState();
    const progress = store.getProgress('social-butterfly');
    
    if (!progress?.completed) {
      store.updateProgress('social-butterfly', (progress?.progress || 0) + 1);
      checkAndNotify('social-butterfly');
    }
  },

  // Magic achievements
  onSpellCast: () => {
    const store = useAchievementStore.getState();
    const firstProgress = store.getProgress('spell-caster');
    
    if (!firstProgress?.completed) {
      store.updateProgress('spell-caster', 1);
      checkAndNotify('spell-caster');
    }
    
    const archmageProgress = store.getProgress('archmage');
    if (!archmageProgress?.completed) {
      store.updateProgress('archmage', (archmageProgress?.progress || 0) + 1);
      checkAndNotify('archmage');
    }
  },

  onTempleBuilt: () => {
    const store = useAchievementStore.getState();
    const progress = store.getProgress('sorcery-master');

    if (!progress?.completed) {
      store.updateProgress('sorcery-master', (progress?.progress || 0) + 1);
      checkAndNotify('sorcery-master');
    }
  },

  // Guild war achievements
  onGuildWarDeclared: () => {
    // Fires when this kingdom's guild declares a guild war
    const store = useAchievementStore.getState();

    // Reuse onAllianceFormed logic — declaring war is a significant guild action
    store.unlockAchievement('alliance-formed');
    notifyUnlock('alliance-formed');

    // Track participation in a guild war
    const progress = store.getProgress('guild-warrior');
    if (!progress?.completed) {
      store.updateProgress('guild-warrior', (progress?.progress || 0) + 1);
      checkAndNotify('guild-warrior');
    }
  },

  onGuildWarContribution: (points: number) => {
    if (points <= 0) return;
    const store = useAchievementStore.getState();

    // Track total guild war score contribution towards 'guild-warrior' achievement
    const progress = store.getProgress('guild-warrior');
    if (!progress?.completed) {
      store.updateProgress('guild-warrior', (progress?.progress || 0) + points);
      checkAndNotify('guild-warrior');
    }

    // Contributing in a guild war is also a battle win for general warfare achievements
    const tenProgress = store.getProgress('ten-victories');
    if (!tenProgress?.completed) {
      store.updateProgress('ten-victories', (tenProgress?.progress || 0) + 1);
      checkAndNotify('ten-victories');
    }
  },

  // Exploration achievements
  onTerritoryExplored: (regionId: string) => {
    const store = useAchievementStore.getState();

    // World Traveler: count all territory claims
    const travelerProgress = store.getProgress('world-traveler');
    if (!travelerProgress?.completed) {
      store.updateProgress('world-traveler', (travelerProgress?.progress || 0) + 1);
      checkAndNotify('world-traveler');
    }

    // Cartographer: track unique regions visited via localStorage
    const VISITED_KEY = 'achievement-visited-regions';
    const visited: string[] = JSON.parse(localStorage.getItem(VISITED_KEY) || '[]');
    if (!visited.includes(regionId)) {
      visited.push(regionId);
      localStorage.setItem(VISITED_KEY, JSON.stringify(visited));

      const cartographerProgress = store.getProgress('cartographer');
      if (!cartographerProgress?.completed) {
        store.updateProgress('cartographer', visited.length);
        checkAndNotify('cartographer');
      }
    }
  },
};

// Helper functions
function checkAndNotify(achievementId: string) {
  const store = useAchievementStore.getState();
  const progress = store.getProgress(achievementId);
  
  if (progress?.completed) {
    notifyUnlock(achievementId);
  }
}

function notifyUnlock(achievementId: string) {
  const store = useAchievementStore.getState();
  const achievement = store.achievements.find((a) => a.id === achievementId);

  if (!achievement) return;

  // Guard against double-granting rewards
  const REWARDS_KEY = 'achievement-rewards-granted';
  const granted: string[] = JSON.parse(localStorage.getItem(REWARDS_KEY) || '[]');
  if (granted.includes(achievementId)) {
    // Reward already granted — just show the toast without re-granting
    toast.success(
      `🏆 Achievement Unlocked: ${achievement.name}`,
      {
        duration: 5000,
        position: 'top-center',
        style: {
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.95) 0%, rgba(99, 102, 241, 0.95) 100%)',
          color: '#fff',
          fontWeight: 'bold',
        },
      }
    );
    return;
  }

  // Apply rewards
  const reward = achievement.reward;
  const rewardParts: string[] = [];

  if (reward) {
    const kingdomStore = useKingdomStore.getState();
    if (reward.gold) {
      kingdomStore.addGold(reward.gold);
      rewardParts.push(`+${reward.gold.toLocaleString()} gold`);
    }
    if (reward.turns) {
      kingdomStore.addTurns(reward.turns);
      rewardParts.push(`+${reward.turns} turns`);
    }
  }

  // Mark reward as granted
  granted.push(achievementId);
  localStorage.setItem(REWARDS_KEY, JSON.stringify(granted));

  const rewardText = rewardParts.length > 0 ? ` (${rewardParts.join(', ')})` : '';

  toast.success(
    `🏆 Achievement Unlocked: ${achievement.name}${rewardText}`,
    {
      duration: 5000,
      position: 'top-center',
      style: {
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.95) 0%, rgba(99, 102, 241, 0.95) 100%)',
        color: '#fff',
        fontWeight: 'bold',
      },
    }
  );
}
