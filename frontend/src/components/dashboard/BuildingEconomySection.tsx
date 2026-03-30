import React from 'react';
import { BuildingStatsPanel } from '../ui/BuildingStatsPanel';

interface BuildingStats {
  brt: number;
  quarryPercentage: number;
  quarries: number;
  barracks: number;
  guildhalls: number;
  temples: number;
  hovels: number;
  forts: number;
  totalBuildings: number;
}

interface UpkeepInfo {
  totalUpkeep: number;
  upkeepPercentage: number;
  isHigh: boolean;
  isCritical: boolean;
  troopCapUsed: number;
  troopCapRemaining: number;
}

interface RaceData {
  name: string;
  specialAbility: {
    name: string;
    description: string;
    strategicValue?: string;
    [key: string]: unknown;
  };
  stats: Record<string, number>;
}

interface BuildingEconomySectionProps {
  buildingStats: BuildingStats;
  upkeepInfo: UpkeepInfo;
  race: string;
  raceData?: RaceData | null;
  kingdomId?: string;
}

export function BuildingEconomySection({
  buildingStats,
  upkeepInfo,
  race,
}: BuildingEconomySectionProps) {
  return (
    <BuildingStatsPanel
      buildingStats={buildingStats}
      upkeepInfo={upkeepInfo}
      race={race}
    />
  );
}
