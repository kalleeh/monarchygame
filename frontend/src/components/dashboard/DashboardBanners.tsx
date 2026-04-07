import React, { useMemo } from 'react';
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

const AGE_BANNERS: Record<string, { icon: string; text: string; color: string }> = {
  middle: { icon: '⚡', text: 'The Middle Age has begun — combat is balanced, training costs reduced 10%', color: '#fbbf24' },
  late: { icon: '🔥', text: 'The Late Age has begun — offense +10%, defense -10%, training costs -20%', color: '#f87171' },
};

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
  // Show persistent age transition banner for non-early ages
  const ageBanner = useMemo(() => {
    if (!seasonInfo || seasonInfo.currentAge === 'early') return null;
    return AGE_BANNERS[seasonInfo.currentAge] ?? null;
  }, [seasonInfo]);

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

      {/* Persistent age transition banner */}
      {ageBanner && (
        <div style={{
          padding: '0.4rem 0.75rem',
          marginBottom: '0.5rem',
          borderRadius: '8px',
          fontSize: '0.8rem',
          background: `${ageBanner.color}15`,
          border: `1px solid ${ageBanner.color}40`,
          color: ageBanner.color,
        }}>
          {ageBanner.icon} {ageBanner.text}
        </div>
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
