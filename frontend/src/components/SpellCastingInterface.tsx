/**
 * Spell Casting Interface Component
 * IQC Compliant: Integrity (validation), Quality (animations), Consistency (patterns)
 * Uses ELAN (not mana) as per official documentation
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { useSpring, useTransition, animated, config } from '@react-spring/web';
import { useSpellStore } from '../stores/spellStore';
import { SPELLS, type Spell } from "../shared-spells";
import { TopNavigation } from './TopNavigation';
import { achievementTriggers } from '../utils/achievementTriggers';
import './SpellCastingInterface.css';

interface SpellCastingInterfaceProps {
  kingdomId: string;
  onBack?: () => void;
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  enemy_kingdom: 'Enemy Kingdom',
  enemy_structures: 'Enemy Structures',
  enemy_forts: 'Enemy Forts',
  enemy_peasants: 'Enemy Peasants',
  enemy_shields: 'Enemy Shields',
  self: 'Self',
};

const EFFECT_TYPE_LABELS: Record<string, string> = {
  structure_damage: 'Structure Damage',
  fort_damage: 'Fort Damage',
  peasant_kill: 'Peasant Kill',
  shield_removal: 'Shield Removal',
  utility: 'Utility',
};

const SPELL_EMOJIS: Record<string, string> = {
  calming_chant: '🎵',
  rousing_wind: '💨',
  shattering_calm: '🌪️',
  hurricane: '🌊',
  lightning_lance: '⚡',
  banshee_deluge: '👻',
  foul_light: '☠️',
};

const TIER_LABELS: Record<number, string> = {
  0: 'Universal',
  1: 'Tier I',
  2: 'Tier II',
  3: 'Tier III',
  4: 'Tier IV',
};

const SpellCastingInterface: React.FC<SpellCastingInterfaceProps> = ({ kingdomId, onBack }) => {
  const {
    currentElan,
    maxElan,
    castingSpell,
    selectedSpell,
    selectedTarget,
    activeEffects,
    castHistory,
    loading,
    error,
    selectSpell,
    selectTarget,
    castSpell,
    removeEffect,
    updateCooldowns,
    canCastSpell,
    getSpellCooldown,
    initializeFromServer,
    clearError
  } = useSpellStore();

  // Initialize from server on mount
  useEffect(() => {
    initializeFromServer(kingdomId);
  }, [kingdomId, initializeFromServer]);

  // Elan bar animation (renamed from mana)
  const elanSpring = useSpring({
    width: `${maxElan > 0 ? (currentElan / maxElan) * 100 : 0}%`,
    backgroundColor: currentElan < 20 ? '#ef4444' : currentElan < 40 ? '#f59e0b' : '#10b981',
    config: config.gentle
  });

  // Casting glow animation
  const castingSpring = useSpring({
    scale: castingSpell ? 1.05 : 1,
    boxShadow: castingSpell
      ? '0 0 30px rgba(79, 172, 254, 0.6), 0 0 60px rgba(79, 172, 254, 0.4)'
      : '0 0 0px rgba(79, 172, 254, 0)',
    config: config.wobbly
  });

  // Spell effects animation
  const effectTransitions = useTransition(activeEffects, {
    from: { opacity: 0, scale: 0, y: -50, rotateZ: -180 },
    enter: { opacity: 1, scale: 1, y: 0, rotateZ: 0 },
    leave: { opacity: 0, scale: 0, y: 50, rotateZ: 180 },
    config: config.wobbly,
    onRest: (result, _ctrl, item) => {
      if (result.finished && !result.cancelled && item) {
        setTimeout(() => removeEffect(item.id), 2000);
      }
    }
  });

  // Update cooldowns every second
  useEffect(() => {
    const interval = setInterval(() => {
      updateCooldowns(1000);
    }, 1000);
    return () => clearInterval(interval);
  }, [updateCooldowns]);

  // Handle spell casting with server integration
  const handleCastSpell = useCallback(async (spellId: string) => {
    if (!canCastSpell(spellId)) return;

    const spell = SPELLS[spellId];
    const needsTarget = spell.targetType.includes('enemy');

    if (needsTarget && !selectedTarget) {
      selectSpell(spellId);
      return;
    }

    try {
      const result = await castSpell(kingdomId, spellId, selectedTarget || undefined);
      if (result.success) {
        achievementTriggers.onSpellCast();
      }
    } catch (error) {
      console.error('Spell casting failed:', error);
    }
  }, [canCastSpell, selectedTarget, castSpell, kingdomId, selectSpell]);

  // Memoized spell cards to avoid recreating animations
  const spellCards = useMemo(() => {
    return Object.values(SPELLS).map((spell: Spell) => {
      const cooldownTime = getSpellCooldown(spell.id);
      const canCast = canCastSpell(spell.id);
      const isSelected = selectedSpell === spell.id;
      const isCasting = castingSpell === spell.id;

      return (
        <SpellCard
          key={spell.id}
          spell={spell}
          cooldownTime={cooldownTime}
          canCast={canCast}
          isSelected={isSelected}
          isCasting={isCasting}
          onCast={handleCastSpell}
        />
      );
    });
  }, [selectedSpell, castingSpell, getSpellCooldown, canCastSpell, handleCastSpell]);

  // Loading state
  if (loading) {
    return (
      <div className="spell-casting-interface loading">
        <div className="loading-spinner" />
        <p>Loading spell system...</p>
      </div>
    );
  }

  return (
    <div style={{background:'var(--color-bg-deep,#0f1629)',minHeight:'100vh'}}>
    <div className="spell-casting-interface">
      <TopNavigation
        title={<><img src="/magic-spells-icon.png" style={{width:28,height:28,objectFit:'contain',verticalAlign:'middle',marginRight:8}} alt="" />Spell Casting</>}
        onBack={onBack}
        backLabel="← Back to Kingdom"
        subtitle="Cast powerful spells to aid your kingdom"
      />

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={clearError} aria-label="Dismiss error">×</button>
        </div>
      )}

      {/* Elan Bar */}
      <div className="mana-section">
        <div className="mana-info">
          <img src="/elan-resource-icon.png" alt="Elan" style={{width:'22px',height:'22px',objectFit:'contain',verticalAlign:'middle',marginRight:'0.4rem'}} /><span>Elan: {currentElan}/{maxElan}</span>
        </div>
        <p style={{margin:'0.25rem 0 0.5rem 0',fontSize:'0.8rem',color:'var(--text-secondary)'}}>
          Elan is your magical energy. It regenerates over time and is consumed when casting spells.
        </p>
        <div className="mana-bar">
          <animated.div className="mana-fill" style={elanSpring} />
        </div>
      </div>

      {/* Spell Grid */}
      <animated.div className="spell-grid" style={castingSpring}>
        {spellCards}
      </animated.div>

      {/* Bottom panels: Tips + History */}
      <div className="spell-bottom-panels">

        {/* Magic Tips */}
        <div className="magic-tips">
          <p className="magic-tips-label">Magic Tips</p>
          <ul>
            <li>Elan regenerates 1 point every 3 turns</li>
            <li>Some spells target buildings, others target population</li>
            <li>Higher sorcery stat means more elan capacity</li>
            <li>Temple percentage unlocks higher-tier spells</li>
            <li>Backlash can damage your own kingdom — check rates before casting</li>
            <li>Sidhe and Fae races have the best sorcery effectiveness</li>
          </ul>
        </div>

        {/* Cast History */}
        <div className="spell-history-panel">
          <p className="spell-history-label">Recent Casts</p>
          {castHistory.length === 0 ? (
            <div className="spell-history-empty">
              <span className="spell-history-empty-icon">🔮</span>
              <span>No spells cast yet this session</span>
            </div>
          ) : (
            <ul className="spell-history-list">
              {castHistory.slice(0, 8).map((entry, idx) => {
                const spell = SPELLS[entry.spellId];
                const emoji = SPELL_EMOJIS[entry.spellId] || '✨';
                const timeAgo = Math.round((Date.now() - entry.timestamp) / 1000);
                const timeLabel = timeAgo < 60
                  ? `${timeAgo}s ago`
                  : `${Math.floor(timeAgo / 60)}m ago`;
                return (
                  <li key={idx} className={`spell-history-item ${entry.success ? 'success' : 'failure'}`}>
                    <span className="spell-history-emoji">{emoji}</span>
                    <span className="spell-history-name">{spell?.name ?? entry.spellId}</span>
                    <span className="spell-history-meta">
                      {entry.damage ? `${entry.damage} dmg · ` : ''}
                      {entry.elanCost} elan
                    </span>
                    <span className="spell-history-time">{timeLabel}</span>
                    <span className={`spell-history-status ${entry.success ? 'success' : 'failure'}`}>
                      {entry.success ? '✓' : '✗'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

      </div>

      {/* Active Effects */}
      <div className="spell-effects">
        {effectTransitions((style, effect) => (
          <animated.div
            key={effect.id}
            style={style}
            className={`spell-effect ${effect.success ? 'success' : 'failure'}`}
          >
            <div className="effect-icon">✨</div>
            <div className="effect-text">
              {SPELLS[effect.spellId]?.name}
              {effect.damage && ` (${effect.damage} damage)`}
            </div>
          </animated.div>
        ))}
      </div>

      {/* Target Selector (if needed) */}
      {selectedSpell && SPELLS[selectedSpell]?.targetType.includes('enemy') && (
        <div className="target-selector">
          <h4>Select Target</h4>
          <div className="target-options">
            <button onClick={() => selectTarget('enemy-1')}>Enemy Kingdom 1</button>
            <button onClick={() => selectTarget('enemy-2')}>Enemy Kingdom 2</button>
            <button onClick={() => selectTarget(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

// Separate SpellCard component to fix React hooks rules
interface SpellCardProps {
  spell: Spell;
  cooldownTime: number;
  canCast: boolean;
  isSelected: boolean;
  isCasting: boolean;
  onCast: (spellId: string) => void;
}

const SpellCard: React.FC<SpellCardProps> = ({
  spell,
  cooldownTime,
  canCast,
  isSelected,
  isCasting,
  onCast
}) => {
  const cardSpring = useSpring({
    scale: isSelected ? 1.02 : 1,
    borderColor: isSelected ? '#4ecdc4' : 'rgba(255, 255, 255, 0.1)',
    backgroundColor: isCasting
      ? 'rgba(79, 172, 254, 0.2)'
      : canCast
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(255, 255, 255, 0.05)',
    opacity: canCast ? 1 : 0.6,
    config: config.gentle
  });

  const cooldownSpring = useSpring({
    width: cooldownTime > 0 ? `${(cooldownTime / (spell.cost.turns * 1000)) * 100}%` : '0%',
    config: config.slow
  });

  const emoji = SPELL_EMOJIS[spell.id] || '✨';
  const tierLabel = TIER_LABELS[spell.tier] ?? `Tier ${spell.tier}`;
  const targetLabel = TARGET_TYPE_LABELS[spell.targetType] ?? spell.targetType;
  const effectLabel = EFFECT_TYPE_LABELS[spell.effects.type] ?? spell.effects.type;
  const backlashPct = Math.round(spell.effects.backlashChance * 100);
  const templeReqPct = Math.round(spell.cost.templeThreshold * 100);

  return (
    <animated.div
      style={cardSpring}
      className="spell-card"
      onClick={() => onCast(spell.id)}
      role="button"
      tabIndex={0}
      aria-label={`Cast ${spell.name}`}
      aria-disabled={!canCast}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCast(spell.id);
        }
      }}
    >
      {/* Card header: emoji + name + tier badge */}
      <div className="spell-header">
        <div className="spell-title-row">
          <span className="spell-emoji" aria-hidden="true">{emoji}</span>
          <h3>{spell.name}</h3>
        </div>
        <span className={`spell-tier-badge tier-${spell.tier}`}>{tierLabel}</span>
      </div>

      <p className="spell-description">{spell.description}</p>

      {/* Stats row */}
      <div className="spell-stats">
        <div className="spell-stat">
          <span className="spell-stat-label">Elan</span>
          <span className="spell-stat-value mana-cost">💙 {spell.cost.elan}</span>
        </div>
        <div className="spell-stat">
          <span className="spell-stat-label">Cast Time</span>
          <span className="spell-stat-value turn-cost">⏱ {spell.cost.turns}s</span>
        </div>
        <div className="spell-stat">
          <span className="spell-stat-label">Backlash</span>
          <span className={`spell-stat-value ${backlashPct === 0 ? 'backlash-none' : backlashPct <= 8 ? 'backlash-low' : 'backlash-high'}`}>
            {backlashPct === 0 ? '—' : `${backlashPct}%`}
          </span>
        </div>
        {templeReqPct > 0 && (
          <div className="spell-stat">
            <span className="spell-stat-label">Temples</span>
            <span className="spell-stat-value temple-req">🏛 {templeReqPct}%</span>
          </div>
        )}
      </div>

      {/* Target + effect type tags */}
      <div className="spell-tags">
        <span className="spell-tag tag-target">{targetLabel}</span>
        <span className="spell-tag tag-effect">{effectLabel}</span>
      </div>

      {cooldownTime > 0 && (
        <div className="cooldown-bar">
          <animated.div
            className="cooldown-fill"
            style={cooldownSpring}
          />
          <span className="cooldown-text">
            {Math.ceil(cooldownTime / 1000)}s cooldown
          </span>
        </div>
      )}

      {isCasting && (
        <div className="casting-indicator">
          <div className="casting-spinner" />
          <span>Casting...</span>
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onCast(spell.id); }}
        disabled={!canCast}
        style={{
          marginTop: 'auto',
          width: '100%',
          padding: '0.55rem 1rem',
          background: canCast
            ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
            : 'rgba(255,255,255,0.06)',
          color: canCast ? '#1a1a2e' : '#6b7280',
          border: canCast ? 'none' : '1px solid rgba(255,255,255,0.1)',
          borderRadius: '0.375rem',
          fontWeight: 700,
          fontSize: '0.875rem',
          cursor: canCast ? 'pointer' : 'not-allowed',
          opacity: canCast ? 1 : 0.5,
          transition: 'box-shadow 0.15s, transform 0.1s',
          boxShadow: 'none',
        }}
        aria-label={`Cast ${spell.name}`}
        onMouseEnter={(e) => { if (canCast) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(251,191,36,0.35)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
      >
        Cast Spell
      </button>
    </animated.div>
  );
};

export default SpellCastingInterface;
