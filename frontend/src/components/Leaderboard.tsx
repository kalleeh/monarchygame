import { useState, useMemo, useEffect } from 'react';
import type { Kingdom } from '../types/kingdom';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import '../components/TerritoryExpansion.css';
import '../components/Leaderboard.css';

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
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '1rem' }}>
        {([
          { key: 'showOnlyFairTargets', label: 'Show fair targets only', checked: filters.showOnlyFairTargets },
          { key: 'hideNPPKingdoms',     label: 'Hide protected players', checked: filters.hideNPPKingdoms },
          { key: 'showOnlyYourFaith',   label: 'Show guild-eligible',    checked: filters.showOnlyYourFaith },
        ] as const).map(({ key, label, checked }) => (
          <label
            key={key}
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', userSelect: 'none', color: '#d1d5db' }}
          >
            {/* Hidden native checkbox keeps accessibility / keyboard support */}
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setFilters({ ...filters, [key]: e.target.checked })}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
            {/* Pill-shaped toggle track */}
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                position: 'relative',
                width: '40px',
                height: '22px',
                borderRadius: '11px',
                background: checked ? '#14b8a6' : '#374151',
                transition: 'background 0.2s ease',
                flexShrink: 0,
                boxShadow: checked ? '0 0 6px rgba(20,184,166,0.5)' : 'none',
              }}
            >
              {/* Thumb */}
              <span
                style={{
                  position: 'absolute',
                  top: '3px',
                  left: checked ? '21px' : '3px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }}
              />
            </span>
            {label}
          </label>
        ))}
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
                  <h4>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: kingdom.isOnline ? '#22c55e' : '#64748b',
                        boxShadow: kingdom.isOnline ? '0 0 4px #22c55e' : 'none',
                        marginRight: '6px',
                        verticalAlign: 'middle',
                      }}
                      title={kingdom.isOnline ? 'Online' : 'Offline'}
                    />
                    #{index + 1} {kingdom.name} {isCurrentKingdom ? '(You)' : ''}
                  </h4>
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

              {kingdom.stats.previousSeasonRank != null && (
                <div className="territory-production">
                  <div className="production-label">
                    Last Season{kingdom.stats.previousSeasonNumber != null ? ` #${kingdom.stats.previousSeasonNumber}` : ''}
                  </div>
                  <div className="production-items">
                    <span className="production-item">
                      Rank #{kingdom.stats.previousSeasonRank}
                      {kingdom.stats.previousSeasonNetworth != null && (
                        <> &mdash; {(kingdom.stats.previousSeasonNetworth / 1000000).toFixed(2)}M NW</>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Leaderboard;
