/**
 * AI Personality Display Component
 * Shows opponent personality traits and characteristics in-game
 */

import React from 'react';
import type { AIPersonality } from '../services/aiPersonalitySystem';

interface AIPersonalityDisplayProps {
  personality: AIPersonality;
  compact?: boolean;
  showDetails?: boolean;
}

/**
 * Visual indicator for AI opponent personality
 */
export const AIPersonalityDisplay: React.FC<AIPersonalityDisplayProps> = ({
  personality,
  compact = false,
  showDetails = true
}) => {
  if (compact) {
    return (
      <div className="ai-personality-compact">
        <span className="personality-icon">{getPersonalityIcon(personality)}</span>
        <span className="personality-name">{personality.name}</span>
        <span className="personality-title text-gray-500">{personality.title}</span>
      </div>
    );
  }

  return (
    <div className="ai-personality-display bg-gray-800 rounded-lg p-4 border border-gray-700">
      {/* Header */}
      <div className="personality-header flex items-center gap-3 mb-3">
        <div className="personality-icon-large text-4xl">
          {getPersonalityIcon(personality)}
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">
            {personality.name} {personality.title}
          </h3>
          <p className="text-sm text-gray-400">
            {personality.race} {personality.persona} • {personality.playstyle}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-300 mb-3">{personality.description}</p>

      {showDetails && (
        <>
          {/* Trait Bars */}
          <div className="personality-traits space-y-2 mb-3">
            <TraitBar label="Aggression" value={personality.traits.aggression} icon="⚔️" />
            <TraitBar label="Economy" value={personality.traits.economy} icon="💰" />
            <TraitBar label="Magic" value={personality.traits.magic} icon="🔮" />
            <TraitBar label="Diplomacy" value={personality.traits.diplomacy} icon="🤝" />
            <TraitBar label="Risk" value={personality.traits.risk} icon="🎲" />
          </div>

          {/* Behavior Tags */}
          <div className="personality-behaviors flex flex-wrap gap-2 mb-3">
            <BehaviorTag icon="🎯" label={personality.behavior.militaryStrategy} />
            <BehaviorTag icon="💼" label={personality.behavior.economicStrategy} />
            <BehaviorTag icon="🤝" label={personality.behavior.allianceStrategy} />
          </div>

          {/* Quirks */}
          {personality.behavior.quirks.length > 0 && (
            <div className="personality-quirks">
              <p className="text-xs text-gray-500 mb-1">Special Traits:</p>
              <div className="flex flex-wrap gap-1">
                {personality.behavior.quirks.map((quirk, index) => (
                  <span
                    key={index}
                    className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded"
                  >
                    {quirk.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * Trait bar component
 */
const TraitBar: React.FC<{ label: string; value: number; icon: string }> = ({
  label,
  value,
  icon
}) => {
  const percentage = Math.min(100, (value / 2.0) * 100); // 2.0 is max trait value
  const color = getTraitColor(value);

  return (
    <div className="trait-bar">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">
          {icon} {label}
        </span>
        <span className="text-gray-500">{value.toFixed(1)}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Behavior tag component
 */
const BehaviorTag: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
  <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded flex items-center gap-1">
    <span>{icon}</span>
    <span>{label.replace(/_/g, ' ')}</span>
  </span>
);

/**
 * Get personality icon based on persona
 */
function getPersonalityIcon(personality: AIPersonality): string {
  const iconMap: Record<string, string> = {
    warlord: '⚔️',
    tactician: '🎯',
    berserker: '💥',
    guardian: '🛡️',
    merchant: '💰',
    noble: '👑',
    peasant: '🌾',
    diplomat: '🤝',
    archmage: '🔮',
    trickster: '🎭',
    scholar: '📚',
    cultist: '🕯️',
    assassin: '🗡️',
    spy: '👁️',
    thief: '💎',
    scout: '🔭',
    builder: '🏗️',
    explorer: '🗺️',
    survivor: '🏕️',
    opportunist: '🎲'
  };

  return iconMap[personality.persona] || '❓';
}

/**
 * Get color for trait value
 */
function getTraitColor(value: number): string {
  if (value >= 1.5) return 'bg-red-500';
  if (value >= 1.2) return 'bg-orange-500';
  if (value >= 0.8) return 'bg-yellow-500';
  if (value >= 0.5) return 'bg-green-500';
  return 'bg-blue-500';
}

/**
 * Compact personality badge for lists
 */
export const AIPersonalityBadge: React.FC<{ personality: AIPersonality }> = ({
  personality
}) => (
  <div className="inline-flex items-center gap-2 bg-gray-800 rounded px-2 py-1 border border-gray-700">
    <span className="text-lg">{getPersonalityIcon(personality)}</span>
    <div className="text-xs">
      <div className="font-semibold text-white">{personality.name}</div>
      <div className="text-gray-400">{personality.persona}</div>
    </div>
  </div>
);

/**
 * Personality comparison component
 */
export const AIPersonalityComparison: React.FC<{
  personality1: AIPersonality;
  personality2: AIPersonality;
}> = ({ personality1, personality2 }) => (
  <div className="personality-comparison grid grid-cols-2 gap-4">
    <AIPersonalityDisplay personality={personality1} showDetails={false} />
    <AIPersonalityDisplay personality={personality2} showDetails={false} />
    
    <div className="col-span-2 bg-gray-800 rounded p-3">
      <h4 className="text-sm font-semibold text-white mb-2">Key Differences</h4>
      <div className="space-y-1 text-xs">
        <ComparisonRow
          label="Aggression"
          value1={personality1.traits.aggression}
          value2={personality2.traits.aggression}
        />
        <ComparisonRow
          label="Diplomacy"
          value1={personality1.traits.diplomacy}
          value2={personality2.traits.diplomacy}
        />
        <ComparisonRow
          label="Risk Tolerance"
          value1={personality1.traits.risk}
          value2={personality2.traits.risk}
        />
      </div>
    </div>
  </div>
);

/**
 * Comparison row component
 */
const ComparisonRow: React.FC<{
  label: string;
  value1: number;
  value2: number;
}> = ({ label, value1, value2 }) => {
  const diff = value1 - value2;
  const diffText = diff > 0.3 ? '→' : diff < -0.3 ? '←' : '↔';
  const diffColor = diff > 0.3 ? 'text-red-400' : diff < -0.3 ? 'text-blue-400' : 'text-gray-400';

  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-gray-300">{value1.toFixed(1)}</span>
        <span className={diffColor}>{diffText}</span>
        <span className="text-gray-300">{value2.toFixed(1)}</span>
      </div>
    </div>
  );
};
