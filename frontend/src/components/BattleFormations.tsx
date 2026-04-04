/**
 * Battle Formations Component with Drag & Drop
 * IQC Compliant: Integrity (validation), Quality (animations), Consistency (patterns)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSpring, animated, config } from '@react-spring/web';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { useCombatStore } from '../stores/combatStore';
import { useFormationStore } from '../stores/formationStore';
import { useKingdomStore } from '../stores/kingdomStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { getUnitsForRace } from '../utils/units';
// Inline race offense/defense scales to avoid circular import via __mocks__
const RACE_OFFENSE: Record<string, number> = {
  Human: 3, Elven: 2, Goblin: 4, Droben: 5, Vampire: 3,
  Elemental: 4, Centaur: 2, Sidhe: 2, Dwarven: 3, Fae: 3,
};
const RACE_DEFENSE: Record<string, number> = {
  Human: 3, Elven: 4, Goblin: 3, Droben: 3, Vampire: 4,
  Elemental: 3, Centaur: 2, Sidhe: 3, Dwarven: 5, Fae: 3,
};
import { isDemoMode } from '../utils/authMode';
import { useKingdomTargets } from '../hooks/useKingdomTargets';
import { TopNavigation } from './TopNavigation';
import './BattleFormations.css';

let _amplifyClient: ReturnType<typeof generateClient<Schema>> | null = null;
const getAmplifyClient = () => { if (!_amplifyClient) _amplifyClient = generateClient<Schema>(); return _amplifyClient; };

const FORMATION_DESCRIPTIONS: Record<string, string> = {
  'Defensive Wall': 'Minimizes casualties when defending',
  'Cavalry Charge': 'Maximizes offense for a swift attack',
  'Balanced Formation': 'Equal offense and defense for versatility',
};

interface BattleFormationsProps {
  kingdomId: string;
  race?: string;
  onBack?: () => void;
}

interface SortableUnitProps {
  id: string;
  unit: {
    id: string;
    type: string;
    count: number;
    attack: number;
    defense: number;
  };
  isSelected: boolean;
  onToggle: () => void;
  tier?: number;
}

const TIER_LABELS = ['T0', 'T1', 'T2', 'T3'];
const TIER_COLORS = ['#6b7280', '#4ecdc4', '#f59e0b', '#ef4444'];

// ── Battle Result Modal ────────────────────────────────────────────────────

/** Converts raw unit type key to a readable display name */
function formatUnitName(type: string): string {
  return type
    .replace(/-server$/i, '')
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\btier\s*(\d)\b/gi, 'Tier $1')
    .replace(/\bT(\d)\b/g, 'Tier $1')
    .replace(/\bdef\s+/gi, '')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function CasualtyRow({ unitType, count }: { unitType: string; count: number }) {
  const imgSrc = `/units/output/${unitType.replace(/_/g, '-')}-icon.png`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <img
        src={imgSrc}
        alt={unitType}
        style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
      <span style={{ flex: 1, fontSize: '0.85rem', color: '#e2e8f0' }}>{formatUnitName(unitType)}</span>
      <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 600 }}>−{count}</span>
    </div>
  );
}

function BattleResultModal({ battle, onClose, defenderName }: { battle: import('../types/combat').BattleReport; onClose: () => void; defenderName?: string }) {
  const isVictory = battle.result === 'victory';
  const accentColor = isVictory ? '#22c55e' : '#ef4444';
  const borderColor = isVictory ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)';
  const attackerEntries = Object.entries(battle.casualties?.attacker ?? {}).filter(([, v]) => (v as number) > 0);
  const defenderEntries = Object.entries(battle.casualties?.defender ?? {}).filter(([, v]) => (v as number) > 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ background: 'linear-gradient(160deg, #0f0f1a 0%, #16213e 100%)', border: `2px solid ${borderColor}`, borderRadius: 18, padding: '2rem', maxWidth: 580, width: '100%', color: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.25rem' }}>{isVictory ? '⚔️' : '🛡️'}</div>
          <h2 style={{ margin: 0, fontSize: '1.8rem', color: accentColor, fontFamily: 'var(--font-display, serif)' }}>
            {isVictory ? 'Victory!' : 'Defeat'}
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: '#9ca3af', fontSize: '0.9rem' }}>
            vs {defenderName || battle.defender}
          </p>
        </div>

        {/* Spoils */}
        {(battle.landGained || (battle.resourcesGained?.gold ?? 0) > 0 || battle.degradedTerritory) && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '1rem', marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
            {battle.landGained != null && battle.landGained > 0 && (
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#4ecdc4' }}>+{battle.landGained}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>🏞️ Land</div>
              </div>
            )}
            {(battle.resourcesGained?.gold ?? 0) > 0 && (
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fbbf24' }}>+{(battle.resourcesGained?.gold ?? 0).toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>💰 Gold</div>
              </div>
            )}
            {battle.degradedTerritory && (
              <div style={{ textAlign: 'center', minWidth: 100 }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f59e0b' }}>Degraded</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>⚔️ Territory</div>
              </div>
            )}
          </div>
        )}

        {/* Casualties */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Your Losses</div>
            {attackerEntries.length > 0
              ? attackerEntries.map(([t, c]) => <CasualtyRow key={t} unitType={t} count={c as number} />)
              : <p style={{ color: '#22c55e', fontSize: '0.85rem' }}>✓ No losses</p>
            }
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Enemy Losses</div>
            {defenderEntries.length > 0
              ? defenderEntries.map(([t, c]) => <CasualtyRow key={t} unitType={t} count={c as number} />)
              : <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>No data</p>
            }
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ width: '100%', padding: '0.75rem', background: `linear-gradient(135deg, ${accentColor}33, ${accentColor}22)`, border: `1px solid ${accentColor}66`, borderRadius: 8, color: accentColor, fontSize: '1rem', cursor: 'pointer', fontWeight: 600 }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

const SortableUnit: React.FC<SortableUnitProps> = ({ id, unit, isSelected, onToggle, tier }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`unit-card ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
    >
      <div className="unit-icon" {...listeners} style={{ cursor: 'grab', position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
        <img src={`/units/output/${unit.type.replace(/_/g, '-')}-icon.png`} alt={unit.type}
          style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 6, display: 'block' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        {tier !== undefined && tier > 0 && (
          <span style={{
            position: 'absolute', bottom: 0, right: 0,
            background: TIER_COLORS[tier] ?? '#6b7280',
            color: '#fff', fontSize: '0.6rem', fontWeight: 700,
            padding: '1px 3px', borderRadius: 3, lineHeight: 1,
          }}>{TIER_LABELS[tier] ?? `T${tier}`}</span>
        )}
      </div>
      <div className="unit-info" onClick={onToggle} style={{ cursor: 'pointer', flex: 1 }}>
        <h4 style={{ textTransform: 'capitalize' }}>{unit.type.replace(/-/g, ' ')}</h4>
        <span className="unit-count">×{unit.count}</span>
      </div>
      <div className="unit-stats" onClick={onToggle} style={{ cursor: 'pointer' }}>
        <span>⚔️{unit.attack}</span>
        <span>🛡️{unit.defense}</span>
      </div>
    </div>
  );
};

const BattleFormations: React.FC<BattleFormationsProps> = ({ kingdomId, race = 'Human', onBack }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedTargetId = (location.state as { targetKingdomId?: string } | null)?.targetKingdomId;
  const {
    selectedUnits,
    formations,
    activeFormation,
    setActiveFormation,
  } = useFormationStore();

  const {
    loading,
    error,
    currentBattle,
    executeBattle,
    getBattleStats,
    clearError,
    initializeCombatData,
  } = useCombatStore();

  // Get available units from kingdom store (single source of truth)
  const availableUnits = useKingdomStore((state) => state.units);
  const aiKingdoms = useAIKingdomStore((state) => state.aiKingdoms);
  const generateAIKingdoms = useAIKingdomStore((state) => state.generateAIKingdoms);
  const attackerRace = race;

  // In auth mode, load real player kingdoms from server; in demo mode, use AI kingdoms only
  const { targets: serverTargets } = useKingdomTargets();
  const kingdomTargets = useMemo(() => {
    if (isDemoMode()) return aiKingdoms;
    const serverIds = new Set(serverTargets.map(t => t.id));
    const aiOnly = aiKingdoms.filter(k => !serverIds.has(k.id));
    return [...serverTargets.map(t => ({
      id: t.id,
      name: t.name,
      race: t.race,
      resources: t.resources,
      networth: t.networth,
      units: { tier1: 0, tier2: 0, tier3: 0, tier4: 0 },
      difficulty: t.difficulty,
      terrain: undefined,
      terrainType: undefined,
    })), ...aiOnly];
  }, [aiKingdoms, serverTargets]);

  const [unitOrder, setUnitOrder] = useState<string[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [showBattleResult, setShowBattleResult] = useState(false);
  const [selectedAttackType, setSelectedAttackType] = useState<'standard' | 'raid' | 'pillage' | 'siege'>('standard');
  const [ambushActive, setAmbushActive] = useState(false);
  const [defensiveFormation, setDefensiveFormation] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(`defensive-formation-${kingdomId}`);
      return stored ?? 'balanced';
    } catch {
      return 'balanced';
    }
  });
  const [defensiveFormationSaved, setDefensiveFormationSaved] = useState(false);

  // Battle preview calculation (useMemo for performance)
  // Mirrors the simulateBattle logic in combatStore.ts so the prediction
  // matches the actual combat outcome for AI/demo targets.
  const battlePreview = useMemo(() => {
    if (selectedUnits.length === 0 || !selectedTarget) {
      return null;
    }

    // Attacker race scaling: matches simulateBattle's attackerOffenseScale.
    // Units in the kingdom store already have race-scaled .attack stats, but
    // simulateBattle multiplies by the raw warOffense rating a second time.
    const attackerOffenseScale = RACE_OFFENSE[attackerRace] ?? 3;

    // Calculate attacker power with race offense scaling applied (matches simulateBattle)
    const attackerPower = selectedUnits.reduce((sum, u) => sum + (u.attack * u.count * attackerOffenseScale), 0);

    // Calculate defender power matching simulateBattle's per-tier defense values
    // scaled by the defender's race warDefense rating.
    // simulateBattle builds defender units as:
    //   tier1 → defense = 1 * defenseScale
    //   tier2 → defense = 3 * defenseScale
    //   tier3 → defense = 4 * defenseScale
    //   tier4 → defense = 2 * defenseScale
    const targetKingdom = kingdomTargets.find(k => k.id === selectedTarget);
    let defenderPower: number;
    if (targetKingdom) {
      const defenseScale = RACE_DEFENSE[targetKingdom.race] ?? 3;
      const aiTarget = aiKingdoms.find(k => k.id === selectedTarget);
      if (aiTarget) {
        const units = aiTarget.units || { tier1: 0, tier2: 0, tier3: 0, tier4: 0 };
        defenderPower =
          (units.tier1 || 0) * 1 * defenseScale +
          (units.tier2 || 0) * 3 * defenseScale +
          (units.tier3 || 0) * 4 * defenseScale +
          (units.tier4 || 0) * 2 * defenseScale;
      } else {
        // Server kingdom: estimate defense from networth (land * 1000 + gold)
        const nw = targetKingdom.networth ?? ((targetKingdom.resources?.land ?? 0) * 1000 + (targetKingdom.resources?.gold ?? 0));
        defenderPower = Math.max(200, nw * 0.003 * defenseScale);
      }
    } else {
      defenderPower = 200;
    }

    // Calculate offense ratio
    const offenseRatio = defenderPower === 0 ? 999 : attackerPower / defenderPower;

    // Determine expected result — thresholds match combatCache.ts getBattleResult
    let resultType: 'with_ease' | 'good_fight' | 'failed';
    let attackerCasualtyRate: number;
    let defenderCasualtyRate: number;
    let landGainPercent: string;

    if (offenseRatio >= 2.0) {
      resultType = 'with_ease';
      attackerCasualtyRate = 0.05;
      defenderCasualtyRate = 0.20;
      landGainPercent = '7.0-7.35%';
    } else if (offenseRatio >= 1.2) {
      resultType = 'good_fight';
      attackerCasualtyRate = 0.15;
      defenderCasualtyRate = 0.15;
      landGainPercent = '6.79-7.0%';
    } else {
      resultType = 'failed';
      attackerCasualtyRate = 0.25;
      defenderCasualtyRate = 0.05;
      landGainPercent = '0%';
    }

    return {
      attackerPower,
      defenderPower,
      offenseRatio,
      resultType,
      attackerCasualtyRate,
      defenderCasualtyRate,
      landGainPercent
    };
  }, [selectedUnits, selectedTarget, aiKingdoms, kingdomTargets, attackerRace]);

  // Initialize combat data on mount (also initializes formations via formationStore)
  useEffect(() => {
    initializeCombatData();
  }, [initializeCombatData]);

  // Generate AI kingdoms if none exist (demo mode only — auth mode uses useKingdomTargets)
  const resources = useKingdomStore((state) => state.resources);
  useEffect(() => {
    if (isDemoMode() && aiKingdoms.length === 0) {
      const networth = (resources.gold || 0) + (resources.land || 0) * 1000;
      generateAIKingdoms(5, networth);
    }
  }, [aiKingdoms.length, generateAIKingdoms, resources.gold, resources.land]);

  // Pre-select target when navigated from KingdomBrowser with a target id
  useEffect(() => {
    if (preselectedTargetId) {
      setSelectedTarget(preselectedTargetId);
    }
  }, [preselectedTargetId]);

  // Update unit order when available units change — sort by tier (highest first)
  useEffect(() => {
    const raceDefs = getUnitsForRace(race);
    const withTier = availableUnits.map(unit => ({
      id: unit.id,
      tier: raceDefs.find(u => u.id === unit.type)?.tier ?? 0,
    }));
    withTier.sort((a, b) => b.tier - a.tier);
    setUnitOrder(withTier.map(u => u.id));
  }, [availableUnits, race]);

  // Battle stats animation
  const battleStats = getBattleStats();
  const statsSpring = useSpring({
    winRate: battleStats.winRate,
    totalBattles: battleStats.totalBattles,
    config: config.gentle
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setUnitOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = over ? items.indexOf(over.id as string) : -1;
        if (newIndex !== -1) {
          return arrayMove(items, oldIndex, newIndex);
        }
        return items;
      });
    }
  };

  const handleExecuteBattle = async () => {
    if (selectedTarget) {
      const result = await executeBattle(selectedTarget, selectedAttackType);
      if (result) {
        setShowBattleResult(true);
      }
    }
  };

  const handleSetDefensiveFormation = (formationId: string) => {
    setDefensiveFormation(formationId);
    try {
      // Persist to localStorage so combat-processor can read it via kingdom stats
      localStorage.setItem(`defensive-formation-${kingdomId}`, formationId);
      // Also merge into the kingdom localStorage blob so it travels with kingdom stats
      const stored = localStorage.getItem(`kingdom-${kingdomId}`);
      const kingdomBlob = stored ? JSON.parse(stored) : {};
      const existingStats = kingdomBlob.stats ?? {};
      kingdomBlob.stats = { ...existingStats, defensiveFormation: formationId };
      localStorage.setItem(`kingdom-${kingdomId}`, JSON.stringify(kingdomBlob));
    } catch {
      // Non-fatal
    }

    // Persist defensive formation to DynamoDB via Lambda so auth rules are enforced
    if (!isDemoMode() && kingdomId) {
      void (async () => {
        try {
          await getAmplifyClient().mutations.saveDefensiveFormation({
            kingdomId,
            formationId,
          });
        } catch {
          // Non-fatal — localStorage version used as fallback
        }
      })();
    }

    setDefensiveFormationSaved(true);
    setTimeout(() => setDefensiveFormationSaved(false), 2000);
  };

  // Get ordered units for display with tier info
  const raceDefs = useMemo(() => getUnitsForRace(race), [race]);
  const orderedUnits = useMemo(() => {
    return unitOrder
      .map(id => availableUnits.find(unit => unit.id === id))
      .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit));
  }, [unitOrder, availableUnits]);

  return (
    <div className="battle-formations">
      <TopNavigation
        title="Combat Operations"
        onBack={onBack}
        backLabel="← Back to Kingdom"
        subtitle="Select units, choose attack type, and execute"
        kingdomId={kingdomId}
      />

      <div className="bf-content">
      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={clearError} aria-label="Dismiss error">×</button>
        </div>
      )}

      {/* Battle Statistics */}
      <div className="battle-stats">
        <h2>Battle Statistics</h2>
        <div className="stats-grid">
          <animated.div className="stat-card">
            <animated.span className="stat-value">
              {statsSpring.totalBattles.to(val => Math.floor(val))}
            </animated.span>
            <span className="stat-label">Total Battles</span>
          </animated.div>
          <animated.div className="stat-card">
            <animated.span className="stat-value">
              {statsSpring.winRate.to(val => `${Math.floor(val)}%`)}
            </animated.span>
            <span className="stat-label">Win Rate</span>
          </animated.div>
          <div className="stat-card">
            <span className="stat-value">{battleStats.totalLandGained}</span>
            <span className="stat-label">Land Gained</span>
          </div>
        </div>
      </div>

      {/* Target Selection */}
      <div className="target-selection" style={{
        background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem' }}>🎯 Select Target</h3>
        {kingdomTargets.length === 0 && !preselectedTargetId ? (
          <p style={{ color: '#a0a0a0' }}>Loading targets…</p>
        ) : (
          <select
            value={selectedTarget}
            onChange={(e) => { setSelectedTarget(e.target.value); clearError(); }}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '1rem',
            }}
          >
            <option value="">-- Select a target kingdom --</option>
            {kingdomTargets.map(kingdom => (
              <option key={kingdom.id} value={kingdom.id}>
                {kingdom.name} ({kingdom.race}) - NW: {(kingdom.networth ?? ((kingdom.resources?.land ?? 0) * 1000 + (kingdom.resources?.gold ?? 0))).toLocaleString()}
              </option>
            ))}
            {preselectedTargetId && !kingdomTargets.some(k => k.id === preselectedTargetId) && (
              <option key={preselectedTargetId} value={preselectedTargetId}>
                Real Kingdom (ID: {preselectedTargetId})
              </option>
            )}
          </select>
        )}
      </div>

      {/* Army Overview — read-only display */}
      <div className="unit-selection">
        <h3>Available Units (Drag to Reorder)</h3>
        {availableUnits.length === 0 ? (
          <div className="combat-empty-state">
            <p>🗡️ You have no units trained yet.</p>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>You need units to attack. Train some first.</p>
            <button onClick={() => navigate(`/kingdom/${kingdomId}/summon`)}>
              ⚔️ Train Units First
            </button>
          </div>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={unitOrder} strategy={verticalListSortingStrategy}>
              <div className="unit-grid">
                {orderedUnits.map(unit => (
                  <SortableUnit
                    key={unit.id}
                    id={unit.id}
                    unit={unit}
                    isSelected={false}
                    onToggle={() => {}}
                    tier={raceDefs.find(u => u.id === unit.type)?.tier}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        {availableUnits.length > 0 && (
          <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0.5rem 0 0', textAlign: 'center' }}>
            All units commit to the attack automatically. Drag to reorder for display.
          </p>
        )}
      </div>

      {/* Battle Preview */}
      {battlePreview && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%)',
          border: '2px solid rgba(139, 92, 246, 0.5)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ color: '#fff', marginBottom: '1rem' }}>⚔️ Battle Preview</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <p style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>Your Offense</p>
              <p style={{ color: '#4ecdc4', fontSize: '1.5rem', fontWeight: 'bold' }}>{battlePreview.attackerPower}</p>
            </div>
            <div>
              <p style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>Enemy Defense</p>
              <p style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 'bold' }}>{battlePreview.defenderPower}</p>
            </div>
          </div>

          <div style={{
            background: battlePreview.resultType === 'with_ease' ? 'rgba(16, 185, 129, 0.1)' :
                       battlePreview.resultType === 'good_fight' ? 'rgba(245, 158, 11, 0.1)' :
                       'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${battlePreview.resultType === 'with_ease' ? '#10b981' :
                                 battlePreview.resultType === 'good_fight' ? '#f59e0b' :
                                 '#ef4444'}`,
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <p style={{ 
              color: battlePreview.resultType === 'with_ease' ? '#10b981' :
                     battlePreview.resultType === 'good_fight' ? '#f59e0b' :
                     '#ef4444',
              fontWeight: 'bold',
              fontSize: '1.125rem',
              marginBottom: '0.5rem'
            }}>
              {battlePreview.resultType === 'with_ease' ? '🎉 With Ease' :
               battlePreview.resultType === 'good_fight' ? '⚔️ Good Fight' :
               '💀 Failed Attack'}
            </p>
            <p style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
              Offense Ratio: {battlePreview.offenseRatio.toFixed(2)}x
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
            <div>
              <p style={{ color: '#a0a0a0' }}>Your Losses</p>
              <p style={{ color: '#fff', fontWeight: 'bold' }}>{(battlePreview.attackerCasualtyRate * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p style={{ color: '#a0a0a0' }}>Enemy Losses</p>
              <p style={{ color: '#fff', fontWeight: 'bold' }}>{(battlePreview.defenderCasualtyRate * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p style={{ color: '#a0a0a0' }}>Land Gain</p>
              <p style={{ color: '#fff', fontWeight: 'bold' }}>{battlePreview.landGainPercent}</p>
            </div>
          </div>
        </div>
      )}

      {/* Formation Modifier — optional bonus applied to this attack */}
      <div className="saved-formations">
        <h3>Formation Modifier <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#6b7280' }}>(optional)</span></h3>
        <div className="formations-list">
          {formations.map(formation => (
            <div
              key={formation.id}
              className={`formation-card ${activeFormation === formation.id ? 'active' : ''}`}
              onClick={() => setActiveFormation(activeFormation === formation.id ? null : formation.id)}
              title={activeFormation === formation.id ? 'Click to deselect' : 'Click to apply this bonus to your attack'}
            >
              <h4>{formation.name}</h4>
              <p className="formation-desc">{FORMATION_DESCRIPTIONS[formation.name] || ''}</p>
              <div className="formation-bonuses">
                <span>⚔️+{formation.bonuses.attack}</span>
                <span>🛡️+{formation.bonuses.defense}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Battle Controls */}
      <div className="battle-controls">
        <h3>Battle Execution</h3>
        <div className="battle-form">
          {/* Attack type selector */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {([
              { value: 'standard', label: 'Standard', desc: 'Captures land' },
              { value: 'raid', label: 'Raid', desc: 'Steals gold (5%), captures less land' },
              { value: 'pillage', label: 'Pillage 💰', desc: 'Destructive raid — steals 10% gold, destroys buildings, no land captured' },
              { value: 'siege', label: 'Siege', desc: 'Heavy assault (+50% land, 3 turns, +30% casualties)' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelectedAttackType(opt.value)}
                title={opt.desc}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  background: selectedAttackType === opt.value ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${selectedAttackType === opt.value ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '6px',
                  color: selectedAttackType === opt.value ? '#c4b5fd' : '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: selectedAttackType === opt.value ? 'bold' : 'normal',
                  transition: 'all 0.15s ease',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
            {selectedAttackType === 'standard' && 'Captures land from the defender.'}
            {selectedAttackType === 'raid' && 'Steals 5% of defender\'s gold and captures half the normal land. Lower attacker casualties.'}
            {selectedAttackType === 'pillage' && 'Steals 10% of defender\'s gold and destroys a random building. No land captured.'}
            {selectedAttackType === 'siege' && 'Heavy assault: +50% land gained, costs 3 turns total, +30% attacker casualties.'}
          </div>
          <label className="ambush-toggle" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            background: ambushActive ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${ambushActive ? 'rgba(139, 92, 246, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
            borderRadius: '8px',
            marginBottom: '1rem',
            cursor: 'pointer',
            color: '#fff',
            fontSize: '0.9rem',
            transition: 'all 0.2s ease'
          }}>
            <input
              type="checkbox"
              checked={ambushActive}
              onChange={(e) => setAmbushActive(e.target.checked)}
            />
            Set Ambush (95% defense bonus if attacked)
          </label>
          {error && error.toLowerCase().includes('war') && (
            <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
              <p style={{ color: '#f87171', marginBottom: '0.5rem', fontWeight: 600 }}>⚔️ War Declaration Required</p>
              <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.75rem' }}>You've attacked this kingdom 3 times. You must declare war to continue.</p>
              <button
                onClick={() => navigate(`/kingdom/${kingdomId}/diplomacy`)}
                style={{ background: 'rgba(239,68,68,0.3)', border: '1px solid rgba(239,68,68,0.5)', borderRadius: 6, padding: '0.5rem 1rem', color: '#fca5a5', cursor: 'pointer' }}
              >
                Go to Diplomacy → Declare War
              </button>
            </div>
          )}
          {(!selectedTarget || availableUnits.length === 0) && !loading && (
            <p style={{ fontSize: '0.8rem', color: '#f59e0b', margin: '0.5rem 0 0.25rem', textAlign: 'center' }}>
              {!selectedTarget
                ? '⚠️ Select a target kingdom above'
                : '⚠️ Train units before attacking'}
            </p>
          )}
          <button
            onClick={handleExecuteBattle}
            disabled={!selectedTarget || availableUnits.length === 0 || loading}
            className={`execute-battle-btn ${(!selectedTarget || availableUnits.length === 0) ? 'disabled' : ''}`}
            style={{
              ...(!selectedTarget || availableUnits.length === 0 || loading
                ? { opacity: 0.5, cursor: 'not-allowed', background: '#4b5563', borderColor: '#6b7280', color: '#9ca3af' }
                : {}),
            }}
            title={
              !selectedTarget
                ? 'Select a target kingdom first'
                : availableUnits.length === 0
                ? 'Train units before attacking'
                : `Attack with all ${availableUnits.reduce((s, u) => s + u.count, 0)} units`
            }
          >
            {loading ? 'Executing...' : 'Execute Battle'}
          </button>
        </div>
      </div>

      {/* Battle Tips */}
      <div className="battle-tips">
        <p className="battle-tips-label">Battle Tips</p>
        <ul>
          <li>Ambush gives 95% defense bonus when attacked</li>
          <li>Cavalry Charge formation maximizes offense</li>
          <li>Train units before attacking for best results</li>
        </ul>
      </div>

      {/* Defensive Stance */}
      <div className="defensive-stance">
        <p className="defensive-stance-label">Defensive Stance</p>
        <p className="defensive-stance-desc">
          Choose a formation your kingdom automatically uses when defending against attacks.
          {defensiveFormationSaved && (
            <span className="defensive-stance-saved">Saved!</span>
          )}
        </p>
        <div className="defensive-stance-options">
          {[
            { id: 'defensive-wall', label: 'Defensive Wall', desc: 'Maximizes defense, minimizes offense' },
            { id: 'balanced', label: 'Balanced Formation', desc: 'Equal offense and defense' },
            { id: 'cavalry-charge', label: 'Cavalry Charge', desc: 'Offense-focused, lower defense' },
          ].map(opt => (
            <div
              key={opt.id}
              className={`defensive-stance-option ${defensiveFormation === opt.id ? 'defensive-stance-option--active' : 'defensive-stance-option--inactive'}`}
            >
              <div>
                <span className="defensive-stance-option-name">{opt.label}</span>
                <span className="defensive-stance-option-desc">{opt.desc}</span>
              </div>
              <button
                onClick={() => handleSetDefensiveFormation(opt.id)}
                disabled={defensiveFormation === opt.id}
                className={`defensive-stance-btn ${defensiveFormation === opt.id ? 'defensive-stance-btn--active' : 'defensive-stance-btn--inactive'}`}
              >
                {defensiveFormation === opt.id ? 'Active' : 'Set Stance'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Battle Result Modal */}
      {showBattleResult && currentBattle && (
        <BattleResultModal
          battle={currentBattle}
          onClose={() => setShowBattleResult(false)}
          defenderName={kingdomTargets.find(k => k.id === currentBattle.defender)?.name
            ?? aiKingdoms.find(k => k.id === currentBattle.defender)?.name
            ?? currentBattle.defender}
        />
      )}
      </div>
    </div>
  );
};

export default BattleFormations;
