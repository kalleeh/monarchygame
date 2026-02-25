/**
 * Combat Store Tests
 * IQC Compliant: Quality (testing), Consistency (patterns)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock aiKingdomStore before importing combatStore
vi.mock('../aiKingdomStore', () => ({
  useAIKingdomStore: vi.fn(() => ({
    aiKingdoms: [
      {
        id: 'enemy-territory',
        name: 'Enemy Kingdom',
        race: 'Human',
        resources: { land: 1000, gold: 50000 },
        units: { tier1: 100, tier2: 50, tier3: 25, tier4: 10 }
      }
    ]
  }))
}));

// Mock kingdomStore
vi.mock('../kingdomStore', () => ({
  useKingdomStore: {
    getState: vi.fn(() => ({
      units: [
        { id: 'knight-1', type: 'knight', count: 10, attack: 5, defense: 5, health: 50 }
      ],
      resources: { land: 1000, gold: 50000, population: 0, turns: 0 },
      removeUnits: vi.fn(),
      updateResources: vi.fn(),
      setUnits: vi.fn()
    }))
  }
}));

import { useCombatStore } from '../combatStore';

describe('CombatStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useCombatStore.setState({
      selectedUnits: [],
      formations: [],
      activeFormation: null,
      formationPositions: {},
      currentBattle: null,
      battleHistory: [],
      warDeclarations: [],
      attackCounts: {},
      activeSieges: [],
      siegeHistory: [],
      selectedBattleReport: null,
      loading: false,
      error: null,
    });
  });

  it('should initialize with default values', () => {
    const state = useCombatStore.getState();
    
    expect(state.selectedUnits).toEqual([]);
    expect(state.formations).toEqual([]);
    expect(state.activeFormation).toBeNull();
    expect(state.currentBattle).toBeNull();
    expect(state.battleHistory).toEqual([]);
    expect(state.warDeclarations).toEqual([]);
    expect(state.attackCounts).toEqual({});
    expect(state.activeSieges).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should initialize combat data with formations', () => {
    const { initializeCombatData } = useCombatStore.getState();
    
    initializeCombatData();
    
    const state = useCombatStore.getState();
    expect(state.formations).toHaveLength(3);
    expect(state.formations[0].name).toBe('Defensive Wall');
    expect(state.formations[1].name).toBe('Cavalry Charge');
    expect(state.formations[2].name).toBe('Balanced Formation');
  });

  it('should create formations', () => {
    const { createFormation } = useCombatStore.getState();
    
    const units = [
      { id: 'test-1', type: 'knight' as const, count: 10, attack: 5, defense: 5, health: 50 }
    ];
    
    const formationId = createFormation('Test Formation', units);
    
    const state = useCombatStore.getState();
    const newFormation = state.formations.find(f => f.id === formationId);
    expect(newFormation?.name).toBe('Test Formation');
    expect(newFormation?.units).toHaveLength(1);
  });

  it('should manage active formation', () => {
    const { setActiveFormation } = useCombatStore.getState();
    
    setActiveFormation('defensive-wall');
    expect(useCombatStore.getState().activeFormation).toBe('defensive-wall');
    
    setActiveFormation(null);
    expect(useCombatStore.getState().activeFormation).toBeNull();
  });

  it('should update formation positions', () => {
    const { createFormation, updateFormationPositions } = useCombatStore.getState();
    
    const units = [
      { id: 'test-1', type: 'knight' as const, count: 10, attack: 5, defense: 5, health: 50 }
    ];
    const formationId = createFormation('Test', units);
    
    const newPositions = {
      'test-1': { x: 1, y: 1 }
    };
    
    updateFormationPositions(formationId, newPositions);
    
    const formation = useCombatStore.getState().formations.find(f => f.id === formationId);
    expect(formation?.positions).toEqual(newPositions);
  });

  it('should handle battle execution errors', async () => {
    const { executeBattle } = useCombatStore.getState();
    
    // Try to execute battle without units
    const result = await executeBattle('enemy-territory');
    
    expect(result).toBeNull();
    expect(useCombatStore.getState().error).toBe('No units selected for battle');
  });

  it('should manage siege operations', async () => {
    const { startSiege, updateSiege, completeSiege } = useCombatStore.getState();
    
    const units = [
      { id: 'test-1', type: 'knight' as const, count: 10, attack: 5, defense: 5, health: 50 }
    ];
    
    const siegeId = await startSiege('enemy-fortress', units);
    
    expect(siegeId).toBeTruthy();
    expect(useCombatStore.getState().activeSieges).toHaveLength(1);
    
    updateSiege(siegeId, { turnsRemaining: 3 });
    const updatedSiege = useCombatStore.getState().activeSieges[0];
    expect(updatedSiege.turnsRemaining).toBe(3);
    
    completeSiege(siegeId, true);
    expect(useCombatStore.getState().activeSieges).toHaveLength(0);
    expect(useCombatStore.getState().siegeHistory).toHaveLength(1);
  });

  it('should calculate battle statistics', () => {
    const { getBattleStats } = useCombatStore.getState();
    
    // Add mock battle history
    useCombatStore.setState({
      battleHistory: [
        { 
          result: 'victory', 
          landGained: 5, 
          id: '1', 
          timestamp: Date.now(), 
          attacker: 'test', 
          defender: 'test', 
          attackerUnits: [], 
          defenderUnits: [], 
          casualties: { attacker: {}, defender: {} } 
        },
        { 
          result: 'victory', 
          landGained: 3, 
          id: '2', 
          timestamp: Date.now(), 
          attacker: 'test', 
          defender: 'test', 
          attackerUnits: [], 
          defenderUnits: [], 
          casualties: { attacker: {}, defender: {} } 
        },
        { 
          result: 'defeat', 
          landGained: 0, 
          id: '3', 
          timestamp: Date.now(), 
          attacker: 'test', 
          defender: 'test', 
          attackerUnits: [], 
          defenderUnits: [], 
          casualties: { attacker: {}, defender: {} } 
        },
      ]
    });
    
    const stats = getBattleStats();
    expect(stats.totalBattles).toBe(3);
    expect(stats.victories).toBe(2);
    expect(stats.defeats).toBe(1);
    expect(stats.winRate).toBeCloseTo(66.67, 1);
    expect(stats.totalLandGained).toBe(8);
  });

  it('should track attacks and war declarations', () => {
    const { trackAttack, declareWar, isAtWar, getAttackCount } = useCombatStore.getState();
    
    const defenderId = 'enemy-1';
    
    // First attack
    let result = trackAttack(defenderId);
    expect(result.requiresDeclaration).toBe(false);
    expect(result.attackCount).toBe(1);
    
    // Second attack
    result = trackAttack(defenderId);
    expect(result.requiresDeclaration).toBe(false);
    expect(result.attackCount).toBe(2);
    
    // Third attack requires war declaration (>= 3)
    result = trackAttack(defenderId);
    expect(result.requiresDeclaration).toBe(true);
    expect(result.attackCount).toBe(3);
    
    // Declare war
    declareWar('attacker-1', defenderId);
    expect(isAtWar(defenderId)).toBe(true);
    expect(getAttackCount(defenderId)).toBe(3);
  });

  it('should calculate attack costs', () => {
    const { calculateAttackCost } = useCombatStore.getState();
    
    // Equal networth (fair fight)
    expect(calculateAttackCost(10000, 10000)).toBe(4);
    
    // Attacker stronger (easier target - ratio < 0.5)
    expect(calculateAttackCost(20000, 5000)).toBe(6);
    
    // Attacker weaker (harder target - ratio > 2.0)
    expect(calculateAttackCost(5000, 20000)).toBe(8);
  });

  it('should validate attack types', () => {
    const { validateAttack } = useCombatStore.getState();
    
    // Mob assault requires peasants
    expect(validateAttack('mob_assault', true).valid).toBe(true);
    expect(validateAttack('mob_assault', false).valid).toBe(false);
    
    // Guerilla raid always valid but with warning
    const guerillaResult = validateAttack('guerilla_raid', false);
    expect(guerillaResult.valid).toBe(true);
    expect(guerillaResult.warning).toBeDefined();
    
    // Other attack types don't require peasants
    expect(validateAttack('full_attack', false).valid).toBe(true);
    expect(validateAttack('controlled_strike', false).valid).toBe(true);
  });

  it('should handle errors', () => {
    const { clearError } = useCombatStore.getState();
    
    useCombatStore.setState({ error: 'Test error' });
    expect(useCombatStore.getState().error).toBe('Test error');
    
    clearError();
    expect(useCombatStore.getState().error).toBeNull();
  });

  it('should manage UI state', () => {
    const { selectBattleReport, showFormationEditor: toggleFormationEditor } = useCombatStore.getState();
    
    // Test showFormationEditor action method
    toggleFormationEditor(true);
    expect(useCombatStore.getState().showFormationEditor).toBe(true);
    
    toggleFormationEditor(false);
    expect(useCombatStore.getState().showFormationEditor).toBe(false);
    
    // Test selectBattleReport method
    selectBattleReport('battle-1');
    expect(useCombatStore.getState().selectedBattleReport).toBe('battle-1');
    
    selectBattleReport(null);
    expect(useCombatStore.getState().selectedBattleReport).toBeNull();
  });
});
