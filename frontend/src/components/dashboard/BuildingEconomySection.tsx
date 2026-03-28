import React from 'react';
import { BuildingStatsPanel } from '../ui/BuildingStatsPanel';
import { RaceAbilitiesPanel } from '../ui/RaceAbilitiesPanel';
import { AchievementsPanel } from '../ui/AchievementsPanel';

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
  raceData: RaceData | null | undefined;
  kingdomId: string;
}

export function BuildingEconomySection({
  buildingStats,
  upkeepInfo,
  race,
  raceData,
  kingdomId,
}: BuildingEconomySectionProps) {
  return (
    <>
      {/* Row 4: Buildings & Economy (2fr left) + Race Abilities (1fr right) */}
      <BuildingStatsPanel
        buildingStats={buildingStats}
        upkeepInfo={upkeepInfo}
        race={race}
      />

      <RaceAbilitiesPanel raceData={raceData} />

      {/* Row 5: Achievements (full width) */}
      <AchievementsPanel kingdomId={kingdomId} />
    </>
  );
}
