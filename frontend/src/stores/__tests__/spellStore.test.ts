/**
 * Spell Store Tests
 * IQC Compliant: Quality (testing), Consistency (patterns)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSpellStore } from '../spellStore';

describe('SpellStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useSpellStore.getState().resetSpellState();
  });

  it('should initialize with default values', () => {
    const state = useSpellStore.getState();
    
    expect(state.currentElan).toBe(0);
    expect(state.maxElan).toBe(300);
    expect(state.castingSpell).toBeNull();
    expect(state.activeEffects).toEqual([]);
    expect(state.cooldowns).toEqual([]);
  });

  it('should manage spell selection', () => {
    const { selectSpell } = useSpellStore.getState();
    
    selectSpell('calming_chant');
    expect(useSpellStore.getState().selectedSpell).toBe('calming_chant');
    expect(useSpellStore.getState().showTargetSelector).toBe(false);
    
    selectSpell('hurricane');
    expect(useSpellStore.getState().selectedSpell).toBe('hurricane');
    expect(useSpellStore.getState().showTargetSelector).toBe(true);
    
    selectSpell(null);
    expect(useSpellStore.getState().selectedSpell).toBeNull();
    expect(useSpellStore.getState().showTargetSelector).toBe(false);
  });

  it('should validate spell casting', () => {
    const { canCastSpell } = useSpellStore.getState();
    
    // Set sufficient elan
    useSpellStore.setState({ currentElan: 100 });
    expect(canCastSpell('hurricane')).toBe(true);
    
    // Set insufficient elan
    useSpellStore.setState({ currentElan: 0 });
    expect(canCastSpell('hurricane')).toBe(false);
  });

  it('should manage cooldowns', () => {
    const { updateCooldowns } = useSpellStore.getState();
    
    // Add a cooldown manually for testing
    useSpellStore.setState({
      cooldowns: [{
        spellId: 'calming_chant',
        remainingTime: 5000,
        totalTime: 5000
      }]
    });
    
    expect(useSpellStore.getState().getSpellCooldown('calming_chant')).toBe(5000);
    expect(useSpellStore.getState().canCastSpell('calming_chant')).toBe(false);
    
    // Update cooldowns
    updateCooldowns(2000);
    expect(useSpellStore.getState().getSpellCooldown('calming_chant')).toBe(3000);
    
    // Cooldown should be removed when it reaches 0
    updateCooldowns(3000);
    expect(useSpellStore.getState().getSpellCooldown('calming_chant')).toBe(0);
    expect(useSpellStore.getState().cooldowns).toEqual([]);
  });

  it('should manage effects', () => {
    const { removeEffect } = useSpellStore.getState();
    
    // Add an effect manually for testing
    const effect = {
      id: 'test-effect',
      spellId: 'calming_chant',
      timestamp: Date.now(),
      success: true
    };
    
    useSpellStore.setState({
      activeEffects: [effect]
    });
    
    expect(useSpellStore.getState().activeEffects).toHaveLength(1);
    
    removeEffect('test-effect');
    expect(useSpellStore.getState().activeEffects).toHaveLength(0);
  });

  it('should handle errors', () => {
    const { clearError } = useSpellStore.getState();
    
    useSpellStore.setState({ error: 'Test error' });
    expect(useSpellStore.getState().error).toBe('Test error');
    
    clearError();
    expect(useSpellStore.getState().error).toBeNull();
  });
});
