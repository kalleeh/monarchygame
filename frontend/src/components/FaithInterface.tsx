/**
 * Faith & Focus Interface Component
 * Provides UI for faith alignment selection and focus point ability usage.
 * Follows existing component patterns (ThieveryInterface, SpellCastingInterface).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useFaithStore } from '../stores/faithStore';
import { TopNavigation } from './TopNavigation';
import { FAITH_ALIGNMENTS, FOCUS_MECHANICS } from '../../../shared/mechanics/faith-focus-mechanics';
import './FaithInterface.css';

interface FaithInterfaceProps {
  kingdomId: string;
  race: string;
  onBack: () => void;
  serverFocusPoints?: number;
}

type AlignmentType = 'angelique' | 'neutral' | 'elemental';

const ALIGNMENT_CONFIG: Record<AlignmentType, { label: string; color: string }> = {
  angelique: { label: 'Angelique', color: '#ffd700' },
  neutral: { label: 'Neutral', color: '#a0a0a0' },
  elemental: { label: 'Elemental', color: '#4ecdc4' },
};

type AbilityKey = keyof typeof FOCUS_MECHANICS.ABILITY_COSTS;

const ABILITY_CONFIG: Array<{ key: AbilityKey; label: string; cost: number; description: string }> = [
  {
    key: 'ENHANCED_RACIAL_ABILITY',
    label: 'Enhanced Racial Ability',
    cost: FOCUS_MECHANICS.ABILITY_COSTS.ENHANCED_RACIAL_ABILITY,
    description: 'Boost your racial ability effectiveness by 50% for 5 turns.',
  },
  {
    key: 'SPELL_POWER_BOOST',
    label: 'Spell Power Boost',
    cost: FOCUS_MECHANICS.ABILITY_COSTS.SPELL_POWER_BOOST,
    description: 'Increase spell damage and effectiveness by 30% for 5 turns.',
  },
  {
    key: 'COMBAT_FOCUS',
    label: 'Combat Focus',
    cost: FOCUS_MECHANICS.ABILITY_COSTS.COMBAT_FOCUS,
    description: 'Gain a 20% combat bonus for the next 5 turns.',
  },
  {
    key: 'ECONOMIC_FOCUS',
    label: 'Economic Focus',
    cost: FOCUS_MECHANICS.ABILITY_COSTS.ECONOMIC_FOCUS,
    description: 'Boost economic output by 15% for 5 turns.',
  },
  {
    key: 'EMERGENCY_ACTION',
    label: 'Emergency Action',
    cost: FOCUS_MECHANICS.ABILITY_COSTS.EMERGENCY_ACTION,
    description: 'Perform an emergency action with enhanced racial ability boost.',
  },
];

const FaithInterface: React.FC<FaithInterfaceProps> = ({ kingdomId, race, onBack, serverFocusPoints }) => {
  const [lastResult, setLastResult] = useState<string | null>(null);

  const {
    alignment,
    faithLevel,
    faithPoints,
    focusPoints,
    maxFocusPoints,
    focusRegenRate,
    activeEffects,
    error,
    initializeFaith,
    selectAlignment,
    generateFocusPoints,
    useFocusAbility,
    clearError,
  } = useFaithStore();

  // Initialize on mount
  useEffect(() => {
    initializeFaith(race, kingdomId, serverFocusPoints);
  }, [kingdomId, race, initializeFaith, serverFocusPoints]);

  // Periodically regenerate focus points
  useEffect(() => {
    generateFocusPoints(race);

    const interval = setInterval(() => {
      generateFocusPoints(race);
    }, 60000); // check every minute

    return () => clearInterval(interval);
  }, [generateFocusPoints, race]);

  const handleAlignmentChange = useCallback(
    (newAlignment: AlignmentType) => {
      selectAlignment(newAlignment, race);
    },
    [selectAlignment, race]
  );

  const handleUseAbility = useCallback(
    async (abilityKey: AbilityKey) => {
      const result = await useFocusAbility(abilityKey);
      if (result?.success) {
        setLastResult(
          `${ABILITY_CONFIG.find((a) => a.key === abilityKey)?.label || abilityKey} activated successfully!`
        );
      }
    },
    [useFocusAbility]
  );

  // Check which alignments are compatible with this race
  const isAlignmentCompatible = (alignmentId: string): boolean => {
    const alignmentData = FAITH_ALIGNMENTS[alignmentId];
    if (!alignmentData) return false;
    return (
      !alignmentData.compatibleRaces ||
      alignmentData.compatibleRaces.includes(race.toLowerCase())
    );
  };

  // Calculate remaining duration for active effects
  const getEffectRemainingTurns = (effect: { duration: number; appliedAt: number }): number => {
    const elapsedMs = Date.now() - effect.appliedAt;
    const durationMs = effect.duration * 60 * 1000; // approximate turn-to-ms
    const remainingMs = durationMs - elapsedMs;
    return Math.max(0, Math.ceil(remainingMs / (60 * 1000)));
  };

  // Compute the lowest-cost ability the player can't yet afford, for the progress bar
  const nextAbilityCost = ABILITY_CONFIG.map((a) => a.cost)
    .filter((c) => c > focusPoints)
    .sort((a, b) => a - b)[0] ?? null;

  // Build tooltip for a locked ability button
  const getLockedTooltip = (cost: number): string => {
    const needed = cost - focusPoints;
    const hoursFloat = focusRegenRate > 0 ? needed / focusRegenRate : Infinity;
    const hours = Math.ceil(hoursFloat);
    const timeStr = hours === 1 ? '~1 hour' : `~${hours} hours`;
    return `Need ${cost} FP — you have ${focusPoints}. Gain ${focusRegenRate} FP/hr, so ${needed} more FP in ${timeStr}.`;
  };

  const formatAbilityName = (effectType: string): string => {
    return effectType
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="faith-interface">
      <TopNavigation
        title={<><img src="/faith-icon.png" style={{width:28,height:28,objectFit:'contain',verticalAlign:'middle',marginRight:8}} alt="" />Faith & Focus</>}
        onBack={onBack}
        backLabel="← Back to Kingdom"
        subtitle={alignment ? `${ALIGNMENT_CONFIG[alignment]?.label || alignment} Alignment` : 'No Alignment'}
        kingdomId={kingdomId}
      />

      {/* Error Display */}
      {error && (
        <div className="faith-error-banner">
          <span>{error}</span>
          <button onClick={clearError} aria-label="Dismiss error">
            x
          </button>
        </div>
      )}

      {/* Result Display */}
      {lastResult && (
        <div className="gm-success-banner">
          <span>{lastResult}</span>
          <button
            onClick={() => setLastResult(null)}
            aria-label="Dismiss result"
          >
            ✕
          </button>
        </div>
      )}

      <div className="faith-content">
        {/* Stats Overview */}
        <section className="faith-stats">
          <div className="stat-card">
            <h4>Faith Level</h4>
            <span className="stat-value">{faithLevel}</span>
          </div>
          <div className="stat-card">
            <h4>Faith Points</h4>
            <span className="stat-value">{faithPoints.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <h4>Focus Points</h4>
            <span className="stat-value">
              {focusPoints} / {maxFocusPoints}
            </span>
          </div>
          <div className="stat-card">
            <h4>Focus Regen</h4>
            <span className="stat-value">{focusRegenRate}/hr</span>
          </div>
        </section>

        {/* FP Progress toward next usable ability */}
        {nextAbilityCost !== null && (
          <div className="fp-progress-row">
            <div className="fp-progress-label">
              Progress toward next ability ({nextAbilityCost} FP needed)
            </div>
            <div className="fp-progress-track">
              <div
                className="fp-progress-fill"
                style={{ width: `${Math.min(100, (focusPoints / nextAbilityCost) * 100).toFixed(1)}%` }}
              />
            </div>
            <div className="fp-progress-hint">
              {focusPoints} / {nextAbilityCost} FP &mdash; {nextAbilityCost - focusPoints} more needed
              {focusRegenRate > 0 && (
                <> (~{Math.ceil((nextAbilityCost - focusPoints) / focusRegenRate)}h at {focusRegenRate} FP/hr)</>
              )}
            </div>
          </div>
        )}

        {/* Alignment Selection */}
        <section className="faith-alignment">
          <h3>Faith Alignment</h3>
          <div className="alignment-cards">
            {(Object.keys(ALIGNMENT_CONFIG) as AlignmentType[]).map((alignId) => {
              const config = ALIGNMENT_CONFIG[alignId];
              const alignmentData = FAITH_ALIGNMENTS[alignId];
              const compatible = isAlignmentCompatible(alignId);
              const isSelected = alignment === alignId;

              return (
                <div
                  key={alignId}
                  className={`alignment-card ${isSelected ? 'selected' : ''} ${!compatible ? 'disabled' : ''}`}
                  onClick={() => compatible && handleAlignmentChange(alignId)}
                  role="button"
                  tabIndex={compatible ? 0 : -1}
                  onKeyDown={(e) => {
                    if (compatible && (e.key === 'Enter' || e.key === ' ')) {
                      handleAlignmentChange(alignId);
                    }
                  }}
                >
                  <h4 style={{ color: config.color }}>{config.label}</h4>
                  <p className="alignment-desc">{alignmentData?.description}</p>
                  {alignmentData?.bonuses && Object.keys(alignmentData.bonuses).length > 0 && (
                    <div className="alignment-bonuses">
                      {Object.entries(alignmentData.bonuses).map(([key, value]) => (
                        <div key={key}>
                          +{((value as number) * 100).toFixed(0)}% {key.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                      ))}
                    </div>
                  )}
                  {!compatible && (
                    <p className="alignment-desc" style={{ color: '#ef4444', marginTop: '0.25rem' }}>
                      Not compatible with {race}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Focus Abilities */}
        <section className="faith-abilities">
          <h3>Focus Abilities</h3>
          <div className="abilities-grid">
            {ABILITY_CONFIG.map((ability) => {
              const canUse = focusPoints >= ability.cost;
              return (
                <div key={ability.key} className="ability-card">
                  <h4>{ability.label}</h4>
                  <p className="alignment-desc">{ability.description}</p>
                  <span className="ability-cost">{ability.cost} focus points</span>
                  <button
                    className="use-ability-btn"
                    onClick={() => handleUseAbility(ability.key)}
                    disabled={!canUse}
                    title={canUse ? undefined : getLockedTooltip(ability.cost)}
                  >
                    {canUse ? 'Use Ability' : `Need ${ability.cost} FP`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Active Effects */}
        <section className="faith-effects">
          <h3>Active Effects</h3>
          {activeEffects.length === 0 ? (
            <p className="empty-state">No active focus effects.</p>
          ) : (
            <div className="effects-list">
              {activeEffects.map((effect, index) => {
                const remaining = getEffectRemainingTurns(effect);
                return (
                  <div key={`${effect.effectType}-${effect.appliedAt}-${index}`} className="effect-item">
                    <div>
                      <span className="effect-name">{formatAbilityName(effect.effectType)}</span>
                      <span className="effect-detail">
                        {' '}
                        &mdash; Enhanced value: {effect.enhancedValue.toFixed(2)}
                      </span>
                    </div>
                    <span className="effect-duration">
                      {remaining > 0 ? `${remaining} turns remaining` : 'Expiring'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default FaithInterface;
