/**
 * Battle Formations Component with Drag & Drop
 * IQC Compliant: Integrity (validation), Quality (animations), Consistency (patterns)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSpring, animated, config } from '@react-spring/web';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { useCombatStore } from '../stores/combatStore';
import { useKingdomStore } from '../stores/kingdomStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import { isDemoMode } from '../utils/authMode';
import { TopNavigation } from './TopNavigation';

const amplifyClient = generateClient<Schema>();

const FORMATION_DESCRIPTIONS: Record<string, string> = {
  'Defensive Wall': 'Minimizes casualties when defending',
  'Cavalry Charge': 'Maximizes offense for a swift attack',
  'Balanced Formation': 'Equal offense and defense for versatility',
};

interface BattleFormationsProps {
  kingdomId: string;
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
}

const SortableUnit: React.FC<SortableUnitProps> = ({ id, unit, isSelected, onToggle }) => {
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
      <div className="unit-icon" {...listeners} style={{ cursor: 'grab' }}>{getUnitIcon(unit.type)}</div>
      <div className="unit-info" onClick={onToggle} style={{ cursor: 'pointer', flex: 1 }}>
        <h4>{unit.type}</h4>
        <span className="unit-count">{unit.count}</span>
      </div>
      <div className="unit-stats" onClick={onToggle} style={{ cursor: 'pointer' }}>
        <span>⚔️{unit.attack}</span>
        <span>🛡️{unit.defense}</span>
      </div>
    </div>
  );
};

const BattleFormations: React.FC<BattleFormationsProps> = ({ kingdomId, onBack }) => {
  const navigate = useNavigate();
  const {
    selectedUnits,
    formations,
    activeFormation,
    loading,
    error,
    currentBattle,
    selectUnit,
    deselectUnit,
    createFormation,
    setActiveFormation,
    executeBattle,
    getBattleStats,
    clearError,
    initializeCombatData
  } = useCombatStore();

  // Get available units from kingdom store (single source of truth)
  const availableUnits = useKingdomStore((state) => state.units);
  const aiKingdoms = useAIKingdomStore((state) => state.aiKingdoms);

  const [unitOrder, setUnitOrder] = useState<string[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [showBattleResult, setShowBattleResult] = useState(false);
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
  const battlePreview = useMemo(() => {
    if (selectedUnits.length === 0 || !selectedTarget) {
      return null;
    }

    // Calculate attacker power
    const attackerPower = selectedUnits.reduce((sum, u) => sum + (u.attack * u.count), 0);

    // Calculate defender power from selected target's units
    const targetKingdom = aiKingdoms.find(k => k.id === selectedTarget);
    const defenderPower = targetKingdom
      ? Object.entries(targetKingdom.units || {}).reduce((sum, [, count]) => sum + (count as number) * 3, 0)
      : 200;
    
    // Calculate offense ratio
    const offenseRatio = attackerPower / defenderPower;
    
    // Determine expected result
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
  }, [selectedUnits, selectedTarget, aiKingdoms]);

  // Initialize combat data on mount
  useEffect(() => {
    initializeCombatData();
  }, [initializeCombatData]);

  // Update unit order when available units change
  useEffect(() => {
    setUnitOrder(availableUnits.map(unit => unit.id));
  }, [availableUnits]);

  // Battle stats animation
  const battleStats = getBattleStats();
  const statsSpring = useSpring({
    winRate: battleStats.winRate,
    totalBattles: battleStats.totalBattles,
    config: config.gentle
  });

  // Formation animation
  const formationSpring = useSpring({
    opacity: selectedUnits.length > 0 ? 1 : 0.5,
    transform: selectedUnits.length > 0 ? 'scale(1)' : 'scale(0.95)',
    config: config.wobbly
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

  const handleUnitToggle = (unitId: string) => {
    const isSelected = selectedUnits.some(u => u.id === unitId);
    console.log('Toggle unit:', unitId, 'Currently selected:', isSelected, 'Total selected:', selectedUnits.length);
    if (isSelected) {
      deselectUnit(unitId);
    } else {
      selectUnit(unitId);
    }
    // Log after action
    setTimeout(() => {
      console.log('After toggle, selected units:', selectedUnits.length);
    }, 100);
  };

  const handleExecuteBattle = async () => {
    if (selectedUnits.length > 0) {
      const result = await executeBattle('enemy-territory');
      if (result) {
        setShowBattleResult(true);
      }
    }
  };

  const handleCreateFormation = () => {
    if (selectedUnits.length > 0) {
      const formationName = `Formation ${formations.length + 1}`;
      createFormation(formationName, selectedUnits);
    }
  };

  const handleLoadFormation = (formationId: string) => {
    const formation = formations.find(f => f.id === formationId);
    if (formation) {
      // Clear current selection
      selectedUnits.forEach(unit => deselectUnit(unit.id));
      
      // Select units from formation
      formation.units.forEach(unit => {
        selectUnit(unit.id);
      });
      
      // Set as active
      setActiveFormation(formationId);
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

    // Persist defensive formation to DynamoDB so combat-processor reads it from kingdom.stats
    if (!isDemoMode() && kingdomId) {
      void (async () => {
        try {
          // Read current stats from the server, merge, and write back
          const result = await amplifyClient.models.Kingdom.get({ id: kingdomId });
          if (result.data) {
            const currentStats = typeof result.data.stats === 'string'
              ? JSON.parse(result.data.stats as string)
              : (result.data.stats ?? {});
            await amplifyClient.models.Kingdom.update({
              id: kingdomId,
              stats: JSON.stringify({ ...(currentStats as Record<string, unknown>), defensiveFormation: formationId }),
            });
          }
        } catch {
          // Non-fatal — localStorage version used as fallback
        }
      })();
    }

    setDefensiveFormationSaved(true);
    setTimeout(() => setDefensiveFormationSaved(false), 2000);
  };

  // Get ordered units for display
  const orderedUnits = useMemo(() => {
    return unitOrder
      .map(id => availableUnits.find(unit => unit.id === id))
      .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit));
  }, [unitOrder, availableUnits]);

  return (
    <div style={{ background: 'var(--color-bg-deep, #0f1629)', minHeight: '100vh' }}>
      <TopNavigation
        title="Battle Formations"
        onBack={onBack}
        backLabel="← Back to Kingdom"
        subtitle="Manage units and execute attacks"
      />
    <div className="battle-formations">

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
        {aiKingdoms.length === 0 ? (
          <p style={{ color: '#a0a0a0' }}>
            No targets available. Use Time Travel on the dashboard to generate AI kingdoms.
          </p>
        ) : (
          <select 
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '1rem'
            }}
          >
            <option value="">-- Select a target kingdom --</option>
            {aiKingdoms.map(kingdom => (
              <option key={kingdom.id} value={kingdom.id}>
                {kingdom.name} ({kingdom.race}) - Land: {kingdom.resources.land}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Drag & Drop Unit Selection */}
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
                    isSelected={selectedUnits.some(u => u.id === unit.id)}
                    onToggle={() => handleUnitToggle(unit.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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

      {/* Formation Builder */}
      <animated.div style={formationSpring} className="formation-builder">
        <h3>Formation Builder</h3>
        <div className="selected-units">
          <h4>Selected Units ({selectedUnits.length})</h4>
          <div className="formation-preview">
            {selectedUnits.map((unit, index) => (
              <div key={unit.id} className="formation-unit">
                <span className="position">{index + 1}</span>
                <span className="unit-type">{getUnitIcon(unit.type)} {unit.type}</span>
                <span className="unit-count">×{unit.count}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleCreateFormation}
            disabled={selectedUnits.length === 0}
            className="create-formation-btn"
          >
            Save Formation
          </button>
        </div>
      </animated.div>

      {/* Saved Formations */}
      <div className="saved-formations">
        <h3>Saved Formations</h3>
        <div className="formations-list">
          {formations.map(formation => (
            <div
              key={formation.id}
              className={`formation-card ${activeFormation === formation.id ? 'active' : ''}`}
              onClick={() => handleLoadFormation(formation.id)}
            >
              <h4>{formation.name}</h4>
              <p className="formation-desc">{FORMATION_DESCRIPTIONS[formation.name] || ''}</p>
              <div className="formation-bonuses">
                <span>⚔️+{formation.bonuses.attack}</span>
                <span>🛡️+{formation.bonuses.defense}</span>
              </div>
              <div className="formation-units">
                {formation.units.length} units
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Battle Controls */}
      <div className="battle-controls">
        <h3>Battle Execution</h3>
        <div className="battle-form">
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
          <button
            onClick={handleExecuteBattle}
            disabled={!selectedTarget || selectedUnits.length === 0 || loading}
            className={`execute-battle-btn ${(!selectedTarget || selectedUnits.length === 0) ? 'disabled' : ''}`}
            style={{
              ...(!selectedTarget || selectedUnits.length === 0 || loading
                ? {
                    opacity: 0.45,
                    cursor: 'not-allowed',
                    background: '#4b5563',
                    borderColor: '#6b7280',
                    color: '#9ca3af',
                    pointerEvents: 'none',
                  }
                : {}),
            }}
            title={
              !selectedTarget
                ? 'Select a target kingdom first'
                : selectedUnits.length === 0
                ? 'Select at least one unit'
                : undefined
            }
          >
            {loading ? 'Executing...' : 'Execute Battle'}
          </button>
        </div>
      </div>

      {/* Battle Tips */}
      <div style={{
        marginTop:'1.5rem',
        padding:'1rem',
        border:'1px solid rgba(255,255,255,0.1)',
        borderRadius:'0.5rem',
        background:'rgba(255,255,255,0.03)'
      }}>
        <p style={{margin:'0 0 0.5rem 0',fontSize:'0.8rem',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>Battle Tips</p>
        <ul style={{margin:0,paddingLeft:'1.25rem',listStyle:'disc'}}>
          <li style={{fontSize:'0.82rem',color:'#6b7280',marginBottom:'0.25rem'}}>Ambush gives 95% defense bonus when attacked</li>
          <li style={{fontSize:'0.82rem',color:'#6b7280',marginBottom:'0.25rem'}}>Cavalry Charge formation maximizes offense</li>
          <li style={{fontSize:'0.82rem',color:'#6b7280'}}>Train units before attacking for best results</li>
        </ul>
      </div>

      {/* Defensive Stance */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1.25rem',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        borderRadius: '0.75rem',
        background: 'rgba(59, 130, 246, 0.05)'
      }}>
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Defensive Stance
        </p>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.82rem', color: '#9ca3af' }}>
          Choose a formation your kingdom automatically uses when defending against attacks.
          {defensiveFormationSaved && (
            <span style={{ color: '#10b981', marginLeft: '0.5rem' }}>Saved!</span>
          )}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { id: 'defensive-wall', label: 'Defensive Wall', desc: 'Maximizes defense, minimizes offense' },
            { id: 'balanced', label: 'Balanced Formation', desc: 'Equal offense and defense' },
            { id: 'cavalry-charge', label: 'Cavalry Charge', desc: 'Offense-focused, lower defense' },
          ].map(opt => (
            <div key={opt.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.6rem 0.85rem',
              background: defensiveFormation === opt.id ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${defensiveFormation === opt.id ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '0.5rem',
            }}>
              <div>
                <span style={{ color: '#e5e7eb', fontSize: '0.88rem', fontWeight: 600 }}>{opt.label}</span>
                <span style={{ color: '#6b7280', fontSize: '0.78rem', marginLeft: '0.5rem' }}>{opt.desc}</span>
              </div>
              <button
                onClick={() => handleSetDefensiveFormation(opt.id)}
                disabled={defensiveFormation === opt.id}
                style={{
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.78rem',
                  background: defensiveFormation === opt.id ? '#1d4ed8' : 'rgba(59, 130, 246, 0.2)',
                  border: `1px solid ${defensiveFormation === opt.id ? '#3b82f6' : 'rgba(59, 130, 246, 0.3)'}`,
                  borderRadius: '0.375rem',
                  color: defensiveFormation === opt.id ? '#fff' : '#93c5fd',
                  cursor: defensiveFormation === opt.id ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: defensiveFormation === opt.id ? 1 : 0.85,
                }}
              >
                {defensiveFormation === opt.id ? 'Active' : 'Set Stance'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Battle Result Modal */}
      {showBattleResult && currentBattle && (
        <div className="battle-result-modal" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)',
            border: '2px solid rgba(139, 92, 246, 0.5)',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '600px',
            width: '90%',
            color: '#fff'
          }}>
            <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              {currentBattle.result === 'victory' ? '🎉 Victory!' : '💀 Defeat'}
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>Battle Summary</h3>
              <p>Defender: {currentBattle.defender}</p>
              <p>Result: {currentBattle.result.toUpperCase()}</p>
              {currentBattle.landGained && <p>Land Gained: +{currentBattle.landGained}</p>}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>Casualties</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <h4>Your Losses:</h4>
                  {Object.entries(currentBattle.casualties.attacker).map(([unit, count]) => (
                    <p key={unit}>{unit}: -{count}</p>
                  ))}
                </div>
                <div>
                  <h4>Enemy Losses:</h4>
                  {Object.entries(currentBattle.casualties.defender).map(([unit, count]) => (
                    <p key={unit}>{unit}: -{count}</p>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowBattleResult(false)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '1rem',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

// Helper function
function getUnitIcon(type: string) {
  const icons = {
    peasant: '👨‍🌾',
    militia: '🛡️',
    knight: '⚔️',
    cavalry: '🐎',
    archer: '🏹',
    mage: '🔮'
  };
  return icons[type as keyof typeof icons] || '⚔️';
}

export default BattleFormations;
