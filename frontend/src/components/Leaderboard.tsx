import { useState, useMemo, useEffect } from 'react';
import type { Kingdom } from '../types/kingdom';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import '../components/TerritoryExpansion.css';

interface LeaderboardFilters {
  showOnlyFairTargets: boolean;
  hideNPPKingdoms: boolean;
  showOnlyYourFaith: boolean;
}

interface TargetIndicator {
  indicator: 'easy' | 'fair' | 'hard';
  turnCostModifier: number;
  color: string;
  emoji: string;
}

// Simple networth calculation (land + gold + units value)
const calculateNetworth = (kingdom: Kingdom): number => {
  const landValue = kingdom.resources.land * 1000;
  const goldValue = kingdom.resources.gold;
  const unitsValue = Object.values(kingdom.totalUnits).reduce((sum, count) => sum + count * 100, 0);
  return landValue + goldValue + unitsValue;
};

const getTargetIndicator = (yourNW: number, theirNW: number): TargetIndicator => {
  const ratio = theirNW / yourNW;
  
  if (ratio < 0.5) return { indicator: 'easy', turnCostModifier: 1.5, color: 'text-yellow-400', emoji: '🟡' };
  if (ratio >= 0.5 && ratio <= 1.5) return { indicator: 'fair', turnCostModifier: 1.0, color: 'text-green-400', emoji: '🟢' };
  return { indicator: 'hard', turnCostModifier: 2.0, color: 'text-red-400', emoji: '🔴' };
};

interface LeaderboardProps {
  kingdoms: Kingdom[];
  currentKingdom: Kingdom;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ kingdoms, currentKingdom }) => {
  const [filters, setFilters] = useState<LeaderboardFilters>(() => {
    const saved = localStorage.getItem('leaderboard-filters');
    return saved ? JSON.parse(saved) : {
      showOnlyFairTargets: false,
      hideNPPKingdoms: false,
      showOnlyYourFaith: false
    };
  });
  
  // Get AI kingdoms
  const aiKingdoms = useAIKingdomStore((state) => state.aiKingdoms);
  
  // Convert AI kingdoms to Kingdom format
  const aiAsKingdoms: Kingdom[] = useMemo(() => 
    aiKingdoms.map((ai): Kingdom => ({
      id: ai.id,
      name: `${ai.name} 🤖`,
      race: ai.race,
      owner: 'AI',
      resources: ai.resources,
      stats: {
        warOffense: 0,
        warDefense: 0,
        sorcery: 0,
        scum: 0,
        forts: 0,
        tithe: 0,
        training: 0,
        siege: 0,
        economy: 0,
        building: 0
      },
      territories: [],
      totalUnits: {
        peasants: ai.units.tier1,
        militia: ai.units.tier2,
        knights: ai.units.tier3,
        cavalry: ai.units.tier4
      },
      isOnline: true,
      lastActive: new Date()
    })),
    [aiKingdoms]
  );
  
  // Combine player kingdoms and AI kingdoms
  const allKingdoms = useMemo(() => [...kingdoms, ...aiAsKingdoms], [kingdoms, aiAsKingdoms]);

  useEffect(() => {
    localStorage.setItem('leaderboard-filters', JSON.stringify(filters));
  }, [filters]);

  const currentNetworth = useMemo(() => calculateNetworth(currentKingdom), [currentKingdom]);

  const filteredKingdoms = useMemo(() => {
    let result = allKingdoms; // Include current kingdom

    if (filters.showOnlyFairTargets) {
      result = result.filter(k => {
        const ratio = calculateNetworth(k) / currentNetworth;
        return ratio >= 0.5 && ratio <= 1.5;
      });
    }

    if (filters.hideNPPKingdoms) {
      result = result.filter(k => k.resources.turns > 100); // Assume NPP if < 100 turns
    }

    if (filters.showOnlyYourFaith) {
      result = result.filter(k => k.race === currentKingdom.race); // Simplified: same race = same faith
    }

    return result.sort((a, b) => calculateNetworth(b) - calculateNetworth(a));
  }, [allKingdoms, currentKingdom, filters, currentNetworth]);

  return (
    <div className="leaderboard-container">
      <h2>Kingdom Scrolls</h2>
      
      {/* Filters */}
      <div className="filters mb-4 flex gap-4">
        <label className="flex items-center gap-2 text-gray-300">
          <input
            type="checkbox"
            checked={filters.showOnlyFairTargets}
            onChange={(e) => setFilters({ ...filters, showOnlyFairTargets: e.target.checked })}
            className="rounded"
          />
          Show fair targets only
        </label>
        <label className="flex items-center gap-2 text-gray-300">
          <input
            type="checkbox"
            checked={filters.hideNPPKingdoms}
            onChange={(e) => setFilters({ ...filters, hideNPPKingdoms: e.target.checked })}
            className="rounded"
          />
          Hide protected players
        </label>
        <label className="flex items-center gap-2 text-gray-300">
          <input
            type="checkbox"
            checked={filters.showOnlyYourFaith}
            onChange={(e) => setFilters({ ...filters, showOnlyYourFaith: e.target.checked })}
            className="rounded"
          />
          Show guild-eligible
        </label>
      </div>

      {/* Leaderboard Grid */}
      <div className="territory-grid">
        {filteredKingdoms.map((kingdom, index) => {
          const networth = calculateNetworth(kingdom);
          const indicator = getTargetIndicator(currentNetworth, networth);
          const baseTurnCost = 4;
          const totalTurnCost = Math.round(baseTurnCost * indicator.turnCostModifier);
          const isCurrentKingdom = kingdom.id === currentKingdom.id;

          return (
            <div key={kingdom.id} className={`kingdom-card ${isCurrentKingdom ? 'owned' : ''}`}>
              <div className="territory-header">
                <span className="territory-icon">{isCurrentKingdom ? '⭐' : '👑'}</span>
                <div className="territory-info">
                  <h4>#{index + 1} {kingdom.name} {isCurrentKingdom ? '(You)' : ''}</h4>
                  <span className="territory-type">{kingdom.race}</span>
                </div>
              </div>
              
              <div className="territory-production">
                <div className="production-label">Networth</div>
                <div className="production-items">
                  <span className="production-item">{(networth / 1000000).toFixed(2)}M</span>
                </div>
              </div>

              <div className="territory-production">
                <div className="production-label">Target Difficulty</div>
                <div className="production-items">
                  <span className="production-item">
                    {indicator.emoji} {indicator.indicator.charAt(0).toUpperCase() + indicator.indicator.slice(1)} ({totalTurnCost} turns)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Leaderboard;
