import React from 'react';
import { isDemoMode } from '../../utils/authMode';
import { SeasonBadge } from '../ui/SeasonBadge';
import { NoActiveSeasonBanner } from '../ui/NoActiveSeasonBanner';
import { RestorationNotice } from '../ui/RestorationNotice';
import { NextStepBanner } from '../ui/NextStepBanner';
import { FirstSteps } from '../ui/FirstSteps';

interface DashboardBannersProps {
  seasonInfo: { seasonNumber: number; currentAge: 'early' | 'middle' | 'late'; startDate: string } | null;
  noActiveSeason: boolean;
  startingSeasonLoading: boolean;
  onStartSeason: () => void;
  isInRestoration: boolean;
  restorationType: string;
  getRemainingHours: () => number;
  prohibitedActions: string[];
  nextStep: { text: string; action: string } | null;
  onManageTerritories?: () => void;
  onSummonUnits?: () => void;
  onManageCombat?: () => void;
  kingdomId: string;
  onManageBuildings?: () => void;
  onViewWorldMap?: () => void;
  onGenerateIncome: () => void;
  ownedTerritories: unknown[];
}

export function DashboardBanners({
  seasonInfo,
  noActiveSeason,
  startingSeasonLoading,
  onStartSeason,
  isInRestoration,
  restorationType,
  getRemainingHours,
  prohibitedActions,
  nextStep,
  onManageTerritories,
  onSummonUnits,
  onManageCombat,
  kingdomId,
  onManageBuildings,
  onViewWorldMap,
  onGenerateIncome,
}: DashboardBannersProps) {
  // Map the nextStep action label to the appropriate callback
  const getNextStepOnClick = () => {
    if (!nextStep) return undefined;
    switch (nextStep.action) {
      case 'Claim Territory': return onManageTerritories;
      case 'Summon Units': return onSummonUnits;
      case 'View Targets': return onManageCombat;
      default: return undefined;
    }
  };

  return (
    <>
      {/* Season Age Badge */}
      {seasonInfo && (
        <SeasonBadge
          seasonNumber={seasonInfo.seasonNumber}
          currentAge={seasonInfo.currentAge}
          startDate={seasonInfo.startDate}
        />
      )}

      {/* No Active Season Banner — auth mode only, shown when no season is running */}
      {noActiveSeason && !isDemoMode() && (
        <NoActiveSeasonBanner
          onStartSeason={onStartSeason}
          isLoading={startingSeasonLoading}
        />
      )}

      {/* Restoration Status Banner */}
      <RestorationNotice
        isInRestoration={isInRestoration}
        restorationType={restorationType}
        getRemainingHours={getRemainingHours}
        prohibitedActions={prohibitedActions}
      />

      {/* Next Step contextual banner */}
      {nextStep && (
        <NextStepBanner
          text={nextStep.text}
          action={nextStep.action}
          onClick={getNextStepOnClick()}
        />
      )}

      {/* First Steps onboarding checklist */}
      <FirstSteps
        kingdomId={kingdomId}
        onManageBuildings={onManageBuildings}
        onSummonUnits={onSummonUnits}
        onViewWorldMap={onViewWorldMap}
        onManageCombat={onManageCombat}
        onManageTerritories={onManageTerritories}
        onGenerateIncome={onGenerateIncome}
      />
    </>
  );
}
