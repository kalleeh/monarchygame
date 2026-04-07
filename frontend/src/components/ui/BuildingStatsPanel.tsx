import React from 'react';
import { getBuildingName } from '../../utils/buildingMechanics';
import { WarningIcon } from './MenuIcons';

interface BuildingStats {
  brt: number;
  quarryPercentage: number;
  quarries: number;
  barracks: number;
  guildhalls: number;
  temples: number;
  forts: number;
}

interface UpkeepInfo {
  totalUpkeep: number;
  upkeepPercentage: number;
  isHigh: boolean;
  isCritical: boolean;
  troopCapUsed: number;
}

interface BuildingStatsPanelProps {
  buildingStats: BuildingStats;
  upkeepInfo: UpkeepInfo;
  race: string;
}

export function BuildingStatsPanel({ buildingStats, upkeepInfo, race }: BuildingStatsPanelProps) {
  return (
    <div className="race-stats-panel">
      <h2><img src="/buildings-economy-icon.png" alt="" style={{width:'28px',height:'28px',objectFit:'contain',verticalAlign:'middle',marginRight:'0.5rem'}} />Buildings & Economy</h2>

      {/* BRT Display */}
      <div className="brt-display" style={{
        padding: '0.75rem',
        background: 'rgba(78, 205, 196, 0.1)',
        borderRadius: '8px',
        marginBottom: '1rem',
        border: '1px solid rgba(78, 205, 196, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Build Rate (BRT)</span>
          <span style={{ fontSize: '1.5rem', color: '#4ecdc4' }}>{buildingStats.brt}</span>
        </div>
        <small style={{ color: '#a0a0a0', display: 'block', marginTop: '0.25rem' }}>
          {buildingStats.quarryPercentage.toFixed(1)}% {getBuildingName(race || 'Human', 'buildrate')} • {buildingStats.brt} structures/turn
        </small>
        {buildingStats.quarryPercentage < 25 && (
          <small style={{ color: '#f59e0b', display: 'block', marginTop: '0.25rem' }}>
            <WarningIcon /> Low BRT - Consider building more {getBuildingName(race || 'Human', 'buildrate')}
          </small>
        )}
      </div>

      {/* Building Breakdown */}
      <div className="building-breakdown" style={{ marginBottom: '1rem' }}>
        <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#a0a0a0' }}>Building Distribution</h4>
        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{getBuildingName(race || 'Human', 'buildrate')}</span>
            <span style={{ color: '#4ecdc4' }}>{buildingStats.quarries} ({buildingStats.quarryPercentage.toFixed(1)}%)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{getBuildingName(race || 'Human', 'troop')}</span>
            <span style={{ color: '#4ecdc4' }}>{buildingStats.barracks}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{getBuildingName(race || 'Human', 'income')}</span>
            <span style={{ color: '#4ecdc4' }}>{buildingStats.guildhalls}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{getBuildingName(race || 'Human', 'magic')}</span>
            <span style={{ color: '#4ecdc4' }}>{buildingStats.temples}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{getBuildingName(race || 'Human', 'fortress')}</span>
            <span style={{ color: '#4ecdc4' }}>{buildingStats.forts}</span>
          </div>
        </div>
      </div>

      {/* Upkeep Warning */}
      <div className={`upkeep-display ${upkeepInfo.isCritical ? 'critical' : upkeepInfo.isHigh ? 'warning' : ''}`} style={{
        padding: '0.75rem',
        background: upkeepInfo.isCritical ? 'rgba(239, 68, 68, 0.1)' : upkeepInfo.isHigh ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        border: `1px solid ${upkeepInfo.isCritical ? 'rgba(239, 68, 68, 0.3)' : upkeepInfo.isHigh ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Army Upkeep</span>
          <span style={{ fontSize: '1.25rem', color: upkeepInfo.isCritical ? '#ef4444' : upkeepInfo.isHigh ? '#f59e0b' : '#4ecdc4' }}>
            {upkeepInfo.totalUpkeep}g/turn
          </span>
        </div>
        <small style={{ color: '#a0a0a0', display: 'block', marginTop: '0.25rem' }}>
          {upkeepInfo.upkeepPercentage.toFixed(1)}% of treasury
        </small>
        {upkeepInfo.isCritical && (
          <small style={{ color: '#ef4444', display: 'block', marginTop: '0.25rem', fontWeight: 600 }}>
            <WarningIcon /> CRITICAL: Upkeep exceeds 25% of gold! Risk of bankruptcy!
          </small>
        )}
        {upkeepInfo.isHigh && !upkeepInfo.isCritical && (
          <small style={{ color: '#f59e0b', display: 'block', marginTop: '0.25rem' }}>
            <WarningIcon /> High upkeep - Consider downsizing or increasing income
          </small>
        )}
        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span>Troop Cap Used</span>
            <span>{upkeepInfo.troopCapUsed.toLocaleString()}g / 10,000,000g</span>
          </div>
        </div>
      </div>
    </div>
  );
}
