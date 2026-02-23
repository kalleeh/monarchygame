/**
 * Territory Store Tests
 * IQC Compliant: Quality (testing), Consistency (patterns)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock kingdomStore to provide resources and a kingdomId
vi.mock('../kingdomStore', () => ({
  useKingdomStore: {
    getState: vi.fn(() => ({
      kingdomId: 'test-kingdom-1',
      resources: {
        gold: 100000,
        population: 10000,
        land: 1000,
        turns: 50
      },
      updateResources: vi.fn()
    }))
  }
}));

import { useTerritoryStore } from '../territoryStore';

describe('TerritoryStore', () => {
  beforeEach(() => {
    // Enable demo mode so claimTerritory skips the auth/Lambda branch entirely
    localStorage.setItem('demo-mode', 'true');
    useTerritoryStore.getState().resetTerritoryState();
  });

  it('should initialize with default values', () => {
    const state = useTerritoryStore.getState();
    
    expect(state.territories).toEqual([]);
    expect(state.ownedTerritories).toEqual([]);
    expect(state.selectedTerritory).toBeNull();
    expect(state.availableExpansions).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should initialize territories with mock data', () => {
    const { initializeTerritories } = useTerritoryStore.getState();
    
    initializeTerritories();
    
    const state = useTerritoryStore.getState();
    expect(state.territories).toHaveLength(3);
    expect(state.ownedTerritories).toHaveLength(1);
    expect(state.ownedTerritories[0].id).toBe('capital-1');
    expect(state.availableExpansions).toHaveLength(2);
  });

  it('should manage territory selection', () => {
    const { selectTerritory, initializeTerritories } = useTerritoryStore.getState();
    
    initializeTerritories();
    
    selectTerritory('settlement-1');
    expect(useTerritoryStore.getState().selectedTerritory).toBe('settlement-1');
    
    selectTerritory(null);
    expect(useTerritoryStore.getState().selectedTerritory).toBeNull();
  });

  it('should add and update territories', () => {
    const { addTerritory, updateTerritory } = useTerritoryStore.getState();
    
    const newTerritory = {
      id: 'test-territory',
      name: 'Test Territory',
      type: 'settlement' as const,
      position: { x: 0, y: 0 },
      ownerId: '',
      resources: { gold: 100, population: 50, land: 25 },
      buildings: {},
      defenseLevel: 1,
      adjacentTerritories: []
    };
    
    addTerritory(newTerritory);
    expect(useTerritoryStore.getState().territories).toHaveLength(1);
    
    updateTerritory('test-territory', { defenseLevel: 2 });
    const updatedTerritory = useTerritoryStore.getState().territories[0];
    expect(updatedTerritory.defenseLevel).toBe(2);
  });

  it('should handle territory claiming', async () => {
    const { initializeTerritories, claimTerritory, canClaimTerritory } = useTerritoryStore.getState();
    
    initializeTerritories();
    
    expect(canClaimTerritory('settlement-1')).toBe(true);
    
    const success = await claimTerritory('settlement-1');
    
    // Log error if claim failed
    if (!success) {
      console.log('Claim failed. Error:', useTerritoryStore.getState().error);
    }
    
    expect(success).toBe(true);
    
    const state = useTerritoryStore.getState();
    expect(state.ownedTerritories.some(t => t.id === 'settlement-1')).toBe(true);
    expect(state.expansionHistory).toHaveLength(1);
    expect(state.availableExpansions).toHaveLength(1); // One less available
  });

  it('should handle territory upgrades', async () => {
    const { initializeTerritories, upgradeTerritory, getTerritoryById } = useTerritoryStore.getState();
    
    initializeTerritories();
    
    const initialLevel = getTerritoryById('capital-1')?.defenseLevel || 0;
    
    const success = await upgradeTerritory('capital-1');
    expect(success).toBe(true);
    
    const upgradedTerritory = getTerritoryById('capital-1');
    expect(upgradedTerritory?.defenseLevel).toBe(initialLevel + 1);
  });

  it('should get owned territories', () => {
    const { initializeTerritories, getOwnedTerritories } = useTerritoryStore.getState();
    
    initializeTerritories();
    
    const ownedTerritories = getOwnedTerritories();
    expect(ownedTerritories).toHaveLength(1);
    expect(ownedTerritories[0].id).toBe('capital-1');
  });

  it('should generate territory resources', () => {
    const { initializeTerritories, generateTerritoryResources, getTerritoryById } = useTerritoryStore.getState();
    
    initializeTerritories();
    
    const initialGold = getTerritoryById('capital-1')?.resources.gold || 0;
    
    generateTerritoryResources();
    
    const updatedGold = getTerritoryById('capital-1')?.resources.gold || 0;
    expect(updatedGold).toBeGreaterThan(initialGold);
  });

  it('should handle errors', () => {
    const { clearError } = useTerritoryStore.getState();
    
    useTerritoryStore.setState({ error: 'Test error' });
    expect(useTerritoryStore.getState().error).toBe('Test error');
    
    clearError();
    expect(useTerritoryStore.getState().error).toBeNull();
  });

  it('should validate territory claiming requirements', async () => {
    const { claimTerritory } = useTerritoryStore.getState();
    
    // Try to claim without initializing (no available expansions)
    const success = await claimTerritory('nonexistent-territory');
    expect(success).toBe(false);
    expect(useTerritoryStore.getState().error).toBe('Territory not available for expansion');
  });
});
