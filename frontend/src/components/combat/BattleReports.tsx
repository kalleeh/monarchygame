/**
 * Battle Reports Component
 * Display historical battle results and detailed reports
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { BattleHistory, Army } from '../../types/combat';
import '../TerritoryExpansion.css';

interface BattleReportsProps {
  battleHistory: BattleHistory[];
  className?: string;
  currentKingdomId?: string;
}

type SortField = 'timestamp' | 'outcome' | 'netGain' | 'opponent';
type SortOrder = 'asc' | 'desc';
type FilterType = 'all' | 'victories' | 'defeats' | 'attacks' | 'defenses';

const BattleReports: React.FC<BattleReportsProps> = ({
  battleHistory,
  className = ''
}) => {
  const [selectedReport, setSelectedReport] = useState<BattleHistory | null>(null);
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredAndSortedHistory = useMemo(() => {
    let filtered = battleHistory;

    // Apply filters
    if (filter !== 'all') {
      filtered = filtered.filter(battle => {
        switch (filter) {
          case 'victories':
            return battle.outcome === 'victory';
          case 'defeats':
            return battle.outcome === 'defeat';
          case 'attacks':
            return battle.isAttacker;
          case 'defenses':
            return !battle.isAttacker;
          default:
            return true;
        }
      });
    }

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(battle => {
        const opponentName = battle.isAttacker 
          ? battle.result.defender.kingdomName 
          : battle.result.attacker.kingdomName;
        return opponentName.toLowerCase().includes(term) ||
               battle.result.attackType.toLowerCase().includes(term);
      });
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: string | number, bValue: string | number;

      switch (sortField) {
        case 'timestamp':
          aValue = a.timestamp.getTime();
          bValue = b.timestamp.getTime();
          break;
        case 'outcome':
          aValue = a.outcome;
          bValue = b.outcome;
          break;
        case 'netGain':
          aValue = (a.netGain?.gold ?? 0) + (a.netGain?.land ?? 0) * 100 + (a.netGain?.population ?? 0) * 10;
          bValue = (b.netGain?.gold ?? 0) + (b.netGain?.land ?? 0) * 100 + (b.netGain?.population ?? 0) * 10;
          break;
        case 'opponent':
          aValue = a.isAttacker ? a.result.defender.kingdomName : a.result.attacker.kingdomName;
          bValue = b.isAttacker ? b.result.defender.kingdomName : b.result.attacker.kingdomName;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [battleHistory, filter, searchTerm, sortField, sortOrder]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }, [sortField]);

  const formatArmy = useCallback((army: Army | undefined): string => {
    if (!army) return 'No units';
    return Object.entries(army)
      .filter(([, count]) => (count || 0) > 0)
      .map(([unitType, count]) => `${count || 0} ${unitType}`)
      .join(', ');
  }, []);

  const formatTimeAgo = useCallback((date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  }, []);

  const getOutcomeColor = useCallback((outcome: string): string => {
    switch (outcome) {
      case 'victory': return '#22c55e';
      case 'defeat': return '#ef4444';
      case 'pyrrhic': return '#f59e0b';
      default: return '#6b7280';
    }
  }, []);

  const getOutcomeIcon = useCallback((outcome: string): string => {
    switch (outcome) {
      case 'victory': return '🏆';
      case 'defeat': return '💀';
      case 'pyrrhic': return '⚠️';
      default: return '❓';
    }
  }, []);

  const battleStats = useMemo(() => {
    const total = battleHistory.length;
    const victories = battleHistory.filter(b => b.outcome === 'victory').length;
    const defeats = battleHistory.filter(b => b.outcome === 'defeat').length;
    const attacks = battleHistory.filter(b => b.isAttacker).length;
    const defenses = total - attacks;
    const totalGoldGained = battleHistory.reduce((sum, b) => sum + (b.netGain?.gold ?? 0), 0);

    return {
      total,
      victories,
      defeats,
      attacks,
      defenses,
      winRate: total > 0 ? Math.round((victories / total) * 100) : 0,
      totalGoldGained
    };
  }, [battleHistory]);

  if (selectedReport) {
    return (
      <div className={`battle-reports detailed-view ${className}`}>
        <div className="report-header">
          <button
            type="button"
            className="back-button"
            onClick={() => setSelectedReport(null)}
            aria-label="Back to battle list"
          >
            ← Back to Reports
          </button>
          <h3>Battle Report Details</h3>
        </div>

        <div className="detailed-report">
          <div className="report-summary">
            <div className="battle-outcome">
              <span className="outcome-icon">{getOutcomeIcon(selectedReport.outcome)}</span>
              <span 
                className="outcome-text"
                style={{ color: getOutcomeColor(selectedReport.outcome) }}
              >
                {selectedReport.outcome.toUpperCase()}
              </span>
            </div>
            
            <div className="battle-info">
              <div className="info-item">
                <span className="label">Type:</span>
                <span className="value">{selectedReport.result.attackType.replace('_', ' ')}</span>
              </div>
              <div className="info-item">
                <span className="label">Date:</span>
                <span className="value">{selectedReport.timestamp.toLocaleString()}</span>
              </div>
              <div className="info-item">
                <span className="label">Duration:</span>
                <span className="value">{selectedReport.result.battleReport?.duration ?? 0}s</span>
              </div>
            </div>
          </div>

          <div className="combatants">
            <div className="combatant attacker">
              <h4>
                {selectedReport.isAttacker ? 'Your Forces' : 'Attacker'}
                {selectedReport.isAttacker && ' (You)'}
              </h4>
              <div className="kingdom-info">
                <span className="kingdom-name">{selectedReport.result.attacker.kingdomName}</span>
                <span className="kingdom-race">({selectedReport.result.attacker.race})</span>
              </div>
              
              <div className="army-comparison">
                <div className="army-before">
                  <h5>Before Battle</h5>
                  <p>{formatArmy(selectedReport.result.attacker.armyBefore)}</p>
                </div>
                <div className="army-after">
                  <h5>After Battle</h5>
                  <p>{formatArmy(selectedReport.result.attacker.armyAfter)}</p>
                </div>
                <div className="casualties">
                  <h5>Casualties</h5>
                  <p className="casualty-text">{formatArmy(selectedReport.result.attacker.casualties)}</p>
                </div>
              </div>
            </div>

            <div className="vs-divider">VS</div>

            <div className="combatant defender">
              <h4>
                {!selectedReport.isAttacker ? 'Your Forces' : 'Defender'}
                {!selectedReport.isAttacker && ' (You)'}
              </h4>
              <div className="kingdom-info">
                <span className="kingdom-name">{selectedReport.result.defender.kingdomName}</span>
                <span className="kingdom-race">({selectedReport.result.defender.race})</span>
              </div>
              
              <div className="army-comparison">
                <div className="army-before">
                  <h5>Before Battle</h5>
                  <p>{formatArmy(selectedReport.result.defender.armyBefore)}</p>
                </div>
                <div className="army-after">
                  <h5>After Battle</h5>
                  <p>{formatArmy(selectedReport.result.defender.armyAfter)}</p>
                </div>
                <div className="casualties">
                  <h5>Casualties</h5>
                  <p className="casualty-text">{formatArmy(selectedReport.result.defender.casualties)}</p>
                </div>
              </div>
              
              {(selectedReport.result.defender.fortificationLevel ?? 0) > 0 && (
                <div className="fortification-info">
                  <span>Fortification Level: {selectedReport.result.defender.fortificationLevel ?? 0}</span>
                </div>
              )}
            </div>
          </div>

          {selectedReport.result.success && (
            <div className="spoils-section">
              <h4>Battle Spoils</h4>
              <div className="spoils-grid">
                <div className="spoil-item">
                  <span className="spoil-icon">💰</span>
                  <span className="spoil-label">Gold:</span>
                  <span className="spoil-value">{(selectedReport.result.spoils?.gold ?? 0).toLocaleString()}</span>
                </div>
                <div className="spoil-item">
                  <span className="spoil-icon">👥</span>
                  <span className="spoil-label">Population:</span>
                  <span className="spoil-value">{(selectedReport.result.spoils?.population ?? 0).toLocaleString()}</span>
                </div>
                <div className="spoil-item">
                  <span className="spoil-icon">🏞️</span>
                  <span className="spoil-label">Land:</span>
                  <span className="spoil-value">{(selectedReport.result.spoils?.land ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`battle-reports ${className}`}>
      <div className="reports-header">
        <h3>Battle Reports</h3>
        <div className="battle-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
          <div className="stat-item">
            <span className="stat-value">{battleStats.total}</span>
            <span className="stat-label">Total Battles</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" style={{ color: '#22c55e' }}>{battleStats.victories}</span>
            <span className="stat-label">Victories</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" style={{ color: '#ef4444' }}>{battleStats.defeats}</span>
            <span className="stat-label">Defeats</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{battleStats.winRate}%</span>
            <span className="stat-label">Win Rate</span>
          </div>
        </div>
      </div>

      <div className="reports-controls">
        <div className="search-filter">
          <input
            type="text"
            className="search-input"
            placeholder="Search by opponent or attack type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <select
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
          >
            <option value="all">All Battles</option>
            <option value="victories">Victories Only</option>
            <option value="defeats">Defeats Only</option>
            <option value="attacks">Your Attacks</option>
            <option value="defenses">Your Defenses</option>
          </select>
        </div>
      </div>

      <div className="reports-table">
        <div className="table-header">
          <button
            className={`sort-button ${sortField === 'timestamp' ? 'active' : ''}`}
            onClick={() => handleSort('timestamp')}
          >
            Date {sortField === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            className={`sort-button ${sortField === 'opponent' ? 'active' : ''}`}
            onClick={() => handleSort('opponent')}
          >
            Opponent {sortField === 'opponent' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            className={`sort-button ${sortField === 'outcome' ? 'active' : ''}`}
            onClick={() => handleSort('outcome')}
          >
            Outcome {sortField === 'outcome' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <span className="header-cell">Type</span>
          <button
            className={`sort-button ${sortField === 'netGain' ? 'active' : ''}`}
            onClick={() => handleSort('netGain')}
          >
            Net Gain {sortField === 'netGain' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
        </div>

        <div className="table-body">
          {filteredAndSortedHistory.length === 0 ? (
            <div className="no-reports">
              <span className="no-reports-icon">📊</span>
              <span className="no-reports-text">
                {searchTerm || filter !== 'all' 
                  ? 'No battles match your current filters' 
                  : 'No battle reports available'}
              </span>
            </div>
          ) : (
            filteredAndSortedHistory.map((battle) => {
              const opponent = battle.isAttacker 
                ? battle.result.defender 
                : battle.result.attacker;

              return (
                <div
                  key={battle.id}
                  className="table-row"
                  onClick={() => setSelectedReport(battle)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedReport(battle);
                    }
                  }}
                >
                  <div className="cell date-cell">
                    <span className="date-main">{formatTimeAgo(battle.timestamp)}</span>
                    <span className="date-full">{battle.timestamp.toLocaleDateString()}</span>
                  </div>
                  
                  <div className="cell opponent-cell">
                    <span className="opponent-name">{opponent.kingdomName}</span>
                    <span className="opponent-race">({opponent.race})</span>
                  </div>
                  
                  <div className="cell outcome-cell">
                    <span 
                      className="outcome-badge"
                      style={{ 
                        backgroundColor: getOutcomeColor(battle.outcome),
                        color: 'white'
                      }}
                    >
                      {getOutcomeIcon(battle.outcome)} {battle.outcome}
                    </span>
                  </div>
                  
                  <div className="cell type-cell">
                    <span className="battle-type">
                      {battle.isAttacker ? '⚔️ Attack' : '🛡️ Defense'}
                    </span>
                    <span className="attack-type">
                      {battle.result.attackType.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="cell gain-cell">
                    <div className="gain-item">
                      <span className="gain-icon">💰</span>
                      <span className={`gain-value ${(battle.netGain?.gold ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                        {(battle.netGain?.gold ?? 0) >= 0 ? '+' : ''}{(battle.netGain?.gold ?? 0).toLocaleString()}
                      </span>
                    </div>
                    {(battle.netGain?.land ?? 0) !== 0 && (
                      <div className="gain-item">
                        <span className="gain-icon">🏞️</span>
                        <span className={`gain-value ${(battle.netGain?.land ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                          {(battle.netGain?.land ?? 0) >= 0 ? '+' : ''}{battle.netGain?.land ?? 0}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default BattleReports;
