/**
 * Spell Casting Interface Component
 * IQC Compliant: Integrity (validation), Quality (animations), Consistency (patterns)
 * Uses ELAN (not mana) as per official documentation
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { useSpring, useTransition, animated, config } from '@react-spring/web';
import { useSpellStore } from '../stores/spellStore';
import { SPELLS, type Spell } from "../shared-spells";

interface SpellCastingInterfaceProps {
  kingdomId: string;
  onBack?: () => void;
}

const SpellCastingInterface: React.FC<SpellCastingInterfaceProps> = ({ kingdomId, onBack }) => {
  const {
    currentElan,
    maxElan,
    castingSpell,
    selectedSpell,
    selectedTarget,
    activeEffects,
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
      await castSpell(kingdomId, spellId, selectedTarget || undefined);
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
    <div className="spell-casting-interface">
      {/* Header with Back Navigation */}
      <div className="spell-header">
        {onBack && (
          <button className="back-btn" onClick={onBack}>
            ← Back to Kingdom
          </button>
        )}
        <h1>
          <img src="/magic-spells-icon.png" alt="Magic" style={{width:'32px',height:'32px',objectFit:'contain',verticalAlign:'middle',marginRight:'0.5rem'}} />
          Spell Casting
        </h1>
      </div>

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

      {/* Magic Tips */}
      <div style={{
        margin:'1rem 0 2rem 0',
        padding:'1rem',
        border:'1px solid rgba(255,255,255,0.1)',
        borderRadius:'0.5rem',
        background:'rgba(255,255,255,0.03)'
      }}>
        <p style={{margin:'0 0 0.5rem 0',fontSize:'0.8rem',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>Magic Tips</p>
        <ul style={{margin:0,paddingLeft:'1.25rem',listStyle:'disc'}}>
          <li style={{fontSize:'0.82rem',color:'#6b7280',marginBottom:'0.25rem'}}>Elan regenerates 1 point every 3 turns</li>
          <li style={{fontSize:'0.82rem',color:'#6b7280',marginBottom:'0.25rem'}}>Some spells target buildings, others target population</li>
          <li style={{fontSize:'0.82rem',color:'#6b7280'}}>Higher sorcery stat means more elan capacity</li>
        </ul>
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
      <div className="spell-header">
        <h3>{spell.name}</h3>
        <div className="spell-cost">
          <span className="mana-cost">💙 {spell.cost.elan}</span>
          <span className="turn-cost">⏱️ {spell.cost.turns}s</span>
        </div>
      </div>
      
      <p className="spell-description">{spell.description}</p>
      
      {cooldownTime > 0 && (
        <div className="cooldown-bar">
          <animated.div 
            className="cooldown-fill" 
            style={cooldownSpring}
          />
          <span className="cooldown-text">
            {Math.ceil(cooldownTime / 1000)}s
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
          marginTop:'0.75rem',
          width:'100%',
          padding:'0.5rem 1rem',
          background: canCast
            ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'
            : 'rgba(255,255,255,0.08)',
          color: canCast ? '#fff' : '#6b7280',
          border: canCast ? 'none' : '1px solid rgba(255,255,255,0.1)',
          borderRadius:'0.375rem',
          fontWeight:600,
          fontSize:'0.875rem',
          cursor: canCast ? 'pointer' : 'not-allowed',
          opacity: canCast ? 1 : 0.6,
          transition:'all 0.2s ease'
        }}
        aria-label={`Cast ${spell.name}`}
      >
        Cast Spell
      </button>
    </animated.div>
  );
};

export default SpellCastingInterface;
