import React, { useState, useCallback } from 'react';
import { useSpring, useTransition, animated, config } from '@react-spring/web';
import { ErrorBoundary } from './ErrorBoundary';
import { TopNavigation } from './TopNavigation';
import type { Schema } from '../../../amplify/data/resource';

// Minimal SPELLS data - TODO: Fix import from game-data
const SPELLS = {
  fireball: { 
    id: 'fireball', 
    name: 'Fireball', 
    description: 'Basic fire spell',
    cost: { elan: 10, turns: 1, templeThreshold: 5 },
    effects: { type: 'offensive', damagePercentage: 25, backlashChance: 5 },
    targetType: ['enemy'],
    tier: 1
  },
  heal: { 
    id: 'heal', 
    name: 'Heal', 
    description: 'Restore health',
    cost: { elan: 8, turns: 1, templeThreshold: 3 },
    effects: { type: 'utility', backlashChance: 2 },
    targetType: ['self'],
    tier: 1
  }
};

interface MagicSystemProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
}

// Convert game-data spells to component format
const spells = Object.values(SPELLS).map(spell => ({
  id: spell.id,
  name: spell.name,
  description: spell.description,
  elanCost: spell.cost.elan,
  turnCost: spell.cost.turns,
  templeThreshold: spell.cost.templeThreshold,
  type: spell.effects.type === 'utility' ? 'utility' : 
        spell.targetType.includes('enemy') ? 'offensive' : 'defensive',
  icon: spell.name.includes('Hurricane') ? '🌪️' :
        spell.name.includes('Fire') ? '🔥' :
        spell.name.includes('Light') ? '✨' :
        spell.name.includes('Chant') ? '🎵' : '🔮',
  effect: `${spell.effects.damagePercentage ? `${spell.effects.damagePercentage}% damage` : 'Utility effect'}, ${spell.effects.backlashChance}% backlash chance`,
  tier: spell.tier
}));

const SPELLS_LEGACY = spells; // Use authentic spells instead of hardcoded ones

const MagicSystemContent: React.FC<MagicSystemProps> = ({ kingdom, onBack }) => {
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);
  const [mana, setMana] = useState(200);
  const [castingSpell, setCastingSpell] = useState<string | null>(null);
  const [spellEffects, setSpellEffects] = useState<Array<{ id: string; spell: Spell }>>([]);

  // Header animation
  const headerSpring = useSpring({
    from: { opacity: 0, y: -20 },
    to: { opacity: 1, y: 0 },
    config: config.gentle
  });

  // Mana bar animation
  const manaSpring = useSpring({
    width: `${(mana / 300) * 100}%`,
    config: config.slow
  });

  // Spell effects transition
  const effectTransitions = useTransition(spellEffects, {
    from: { opacity: 0, scale: 0, y: 50 },
    enter: { opacity: 1, scale: 1, y: 0 },
    leave: { opacity: 0, scale: 0, y: -50 },
    config: config.wobbly
  });

  // Casting animation
  const castingSpring = useSpring({
    scale: castingSpell ? 1.1 : 1,
    glow: castingSpell ? 1 : 0,
    config: config.wobbly
  });

  const handleCastSpell = useCallback((spell: Spell) => {
    if (mana < spell.manaCost || castingSpell) return;

    setCastingSpell(spell.id);
    setMana(prev => prev - spell.manaCost);

    // Add visual effect
    const effectId = `effect-${Date.now()}`;
    setSpellEffects(prev => [...prev, { id: effectId, spell }]);

    // Simulate spell casting
    setTimeout(() => {
      setCastingSpell(null);
      // Remove effect after animation
      setTimeout(() => {
        setSpellEffects(prev => prev.filter(e => e.id !== effectId));
      }, 2000);
    }, 1500);
  }, [mana, castingSpell]);

  const getSpellTypeColor = (type: Spell['type']) => {
    switch (type) {
      case 'offensive': return '#ef4444';
      case 'defensive': return '#3b82f6';
      case 'utility': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const hasRaceBonus = (spell: Spell) => {
    return spell.raceBonus?.includes(kingdom.race || '') || false;
  };

  return (
    <div className="magic-system">
      <TopNavigation
        title="🔮 Magic System"
        subtitle={`Mana: ${mana}/300`}
        onBack={onBack}
        backLabel="← Back to Kingdom"
        actions={
          <div className="mana-display">
            <div className="mana-bar">
              <animated.div 
                className="mana-fill" 
                style={manaSpring}
              />
            </div>
          </div>
        }
      />

      <div className="magic-content">
        <div className="spells-grid">
          {SPELLS.map((spell, index) => {
            const canCast = mana >= spell.manaCost && !castingSpell;
            const isCasting = castingSpell === spell.id;
            const bonus = hasRaceBonus(spell);

            return (
              <animated.div
                key={spell.id}
                className={`spell-card ${!canCast ? 'disabled' : ''} ${bonus ? 'race-bonus' : ''}`}
                style={{
                  ...useSpring({
                    from: { opacity: 0, y: 20 },
                    to: { opacity: 1, y: 0 },
                    delay: index * 100,
                    config: config.gentle
                  }),
                  ...(isCasting ? castingSpring : {})
                }}
                onClick={() => canCast && handleCastSpell(spell)}
              >
                <div className="spell-icon" style={{ color: getSpellTypeColor(spell.type) }}>
                  {spell.icon}
                </div>
                <h3>{spell.name}</h3>
                <p className="spell-description">{spell.description}</p>
                <div className="spell-stats">
                  <div className="mana-cost">💙 {spell.manaCost}</div>
                  <div className="cooldown">⏱️ {spell.cooldown}s</div>
                </div>
                <div className="spell-effect">{spell.effect}</div>
                {bonus && (
                  <div className="race-bonus-indicator">
                    ⭐ {kingdom.race} Bonus
                  </div>
                )}
                {isCasting && (
                  <div className="casting-overlay">
                    <div className="casting-text">Casting...</div>
                  </div>
                )}
              </animated.div>
            );
          })}
        </div>

        {selectedSpell && (
          <div className="spell-details">
            <h3>Spell Details</h3>
            <p><strong>Name:</strong> {selectedSpell.name}</p>
            <p><strong>Type:</strong> {selectedSpell.type}</p>
            <p><strong>Effect:</strong> {selectedSpell.effect}</p>
            <p><strong>Mana Cost:</strong> {selectedSpell.manaCost}</p>
            <p><strong>Cooldown:</strong> {selectedSpell.cooldown} seconds</p>
          </div>
        )}
      </div>

      {/* Spell Effects */}
      <div className="spell-effects">
        {effectTransitions((style, item) => (
          <animated.div
            key={item.id}
            style={style}
            className="spell-effect-animation"
          >
            <div className="effect-icon">{item.spell.icon}</div>
            <div className="effect-text">{item.spell.name} Cast!</div>
          </animated.div>
        ))}
      </div>

      <style jsx>{`
        .magic-system {
          min-height: 100vh;
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%);
          color: white;
          position: relative;
          overflow: hidden;
        }

        .magic-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .back-button {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .back-button:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        .mana-display {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .mana-bar {
          width: 200px;
          height: 20px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid rgba(59, 130, 246, 0.5);
        }

        .mana-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #60a5fa);
          border-radius: 10px;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
        }

        .mana-text {
          font-weight: bold;
          color: #60a5fa;
        }

        .magic-content {
          padding: 2rem;
        }

        .spells-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .spell-card {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 1rem;
          padding: 1.5rem;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .spell-card:hover:not(.disabled) {
          transform: translateY(-5px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
          border-color: rgba(255, 255, 255, 0.4);
        }

        .spell-card.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spell-card.race-bonus {
          border-color: #fbbf24;
          box-shadow: 0 0 20px rgba(251, 191, 36, 0.3);
        }

        .spell-icon {
          font-size: 3rem;
          text-align: center;
          margin-bottom: 1rem;
          filter: drop-shadow(0 0 10px currentColor);
        }

        .spell-card h3 {
          margin: 0 0 0.5rem 0;
          text-align: center;
          color: #f8fafc;
        }

        .spell-description {
          color: #cbd5e1;
          text-align: center;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }

        .spell-stats {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }

        .mana-cost {
          color: #60a5fa;
        }

        .cooldown {
          color: #fbbf24;
        }

        .spell-effect {
          background: rgba(0, 0, 0, 0.3);
          padding: 0.5rem;
          border-radius: 0.5rem;
          font-size: 0.8rem;
          color: #e2e8f0;
          text-align: center;
        }

        .race-bonus-indicator {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          background: #fbbf24;
          color: #1f2937;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.7rem;
          font-weight: bold;
        }

        .casting-overlay {
          position: absolute;
          inset: 0;
          background: rgba(139, 92, 246, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 1rem;
        }

        .casting-text {
          font-size: 1.2rem;
          font-weight: bold;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .spell-effects {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 1000;
        }

        .spell-effect-animation {
          text-align: center;
          margin-bottom: 1rem;
        }

        .effect-icon {
          font-size: 4rem;
          margin-bottom: 0.5rem;
          filter: drop-shadow(0 0 20px currentColor);
        }

        .effect-text {
          font-size: 1.5rem;
          font-weight: bold;
          color: #fbbf24;
          text-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
        }

        .spell-details {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 1rem;
          padding: 1.5rem;
          margin-top: 2rem;
        }

        .spell-details h3 {
          margin-top: 0;
          color: #fbbf24;
        }

        .spell-details p {
          margin: 0.5rem 0;
          color: #e2e8f0;
        }
      `}</style>
    </div>
  );
};

export const MagicSystem: React.FC<MagicSystemProps> = (props) => {
  return (
    <ErrorBoundary fallback={
      <div className="magic-error">
        <h2>🔮 Magic System Temporarily Unavailable</h2>
        <p>The magical energies are unstable. Please try again later.</p>
        <button onClick={props.onBack}>← Back to Kingdom</button>
      </div>
    }>
      <MagicSystemContent {...props} />
    </ErrorBoundary>
  );
};
