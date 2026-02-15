/**
 * Spell System State Management
 * IQC Compliant: Integrity (server validation), Quality (typed), Consistency (Zustand pattern)
 * Uses ELAN (not mana) as per official documentation
 */

import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import { SpellService } from '../services/SpellService';

// Local spell definitions (minimal for build compatibility)
const SPELLS: Record<string, any> = {
  calming_chant: {
    tier: 0,
    cost: { elan: 1, turns: 1, templeThreshold: 0 },
    targetType: ['self']
  }
};

// Local elan calculation (minimal for build compatibility)
const calculateMaxElan = (templeCount: number, landCount: number, raceId: string): number => {
  return Math.floor(templeCount * 10 + landCount * 0.1);
};

interface SpellEffect {
  id: string;
  spellId: string;
  timestamp: number;
  damage?: number;
  success: boolean;
}

interface SpellCooldown {
  spellId: string;
  remainingTime: number;
  totalTime: number;
}

interface SpellCastHistory {
  spellId: string;
  timestamp: number;
  target?: string;
  success: boolean;
  damage?: number;
  elanCost: number;
}

interface ServerCooldown {
  spellId: string;
  remainingTime: number;
  totalTime: number;
}

export const useSpellStore = create(
  combine(
    {
      // Core spell state (ELAN not mana)
      currentElan: 0,
      maxElan: 0,
      templeCount: 0,
      templePercentage: 0,
      
      // Spell casting state
      castingSpell: null as string | null,
      selectedTarget: null as string | null,
      
      // Effects and history
      activeEffects: [] as SpellEffect[],
      cooldowns: [] as SpellCooldown[],
      castHistory: [] as SpellCastHistory[],
      
      // UI state
      selectedSpell: null as string | null,
      showTargetSelector: false,
      
      // Loading states
      loading: false,
      error: null as string | null,
    },
    (set, get) => ({
      // Server integration
      initializeFromServer: async (kingdomId: string) => {
        set({ loading: true, error: null });
        try {
          const status = await SpellService.validateSpell(kingdomId, 'default');
          const history = await SpellService.getSpellHistory(kingdomId, 20);
          
          // Calculate max elan from server data
          const templeCount = Number((status as unknown as Record<string, unknown>).templeCount) || 0;
          const landCount = Number((status as unknown as Record<string, unknown>).landCount) || 100;
          const raceId = String((status as unknown as Record<string, unknown>).raceId) || 'HUMAN';
          
          const calculatedMaxElan = calculateMaxElan(templeCount, landCount, raceId);
          const templePercentage = landCount > 0 ? (templeCount / landCount) * 100 : 0;
          
          set({
            currentElan: Number((status as unknown as Record<string, unknown>).currentElan) || 0,
            maxElan: calculatedMaxElan,
            templeCount,
            templePercentage,
            cooldowns: Array.isArray((status as unknown as Record<string, unknown>).activeCooldowns) 
              ? ((status as unknown as Record<string, unknown>).activeCooldowns as ServerCooldown[]).map((cd: ServerCooldown) => ({
                spellId: cd.spellId,
                remainingTime: cd.remainingTime,
                totalTime: cd.totalTime
              }))
              : [],
            castHistory: history as SpellCastHistory[],
            loading: false
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load spell data',
            loading: false 
          });
        }
      },

      // Elan management (renamed from mana)
      updateElan: (amount: number) => {
        set((state) => ({
          currentElan: Math.max(0, Math.min(state.maxElan, state.currentElan + amount))
        }));
      },

      setMaxElan: (maxElan: number) => {
        set((state) => ({
          maxElan,
          currentElan: Math.min(state.currentElan, maxElan)
        }));
      },

      // Temple management
      updateTemples: (templeCount: number, totalLand: number) => {
        const templePercentage = totalLand > 0 ? (templeCount / totalLand) * 100 : 0;
        set({ templeCount, templePercentage });
      },

      // Spell selection
      selectSpell: (spellId: string | null) => {
        const spell = spellId ? SPELLS[spellId] : null;
        
        // Validate temple requirements
        const state = get();
        const canCast = spell ? state.templePercentage >= (spell.cost.templeThreshold || 0) : false;
        
        set({
          selectedSpell: spellId,
          showTargetSelector: spell?.targetType.includes('enemy') || false,
          error: !canCast && spell ? `Requires ${spell.cost.templeThreshold}% temples` : null
        });
      },

      // Target selection
      selectTarget: (targetId: string | null) => {
        set({ selectedTarget: targetId });
      },

      // Server-side spell casting
      castSpell: async (kingdomId: string, spellId: string, targetId?: string) => {
        const spell = SPELLS[spellId];
        const state = get();
        
        // Client-side validation
        if (!spell || state.currentElan < spell.cost.elan || state.castingSpell) {
          return { success: false, error: 'Invalid spell cast attempt' };
        }

        // Check temple requirements based on tier
        const templeRequirements = [0, 2, 4, 8, 12]; // Tier 0-4 requirements
        const requiredPercentage = templeRequirements[spell.tier] || 0;
        if (state.templePercentage < requiredPercentage) {
          return { success: false, error: `Requires ${requiredPercentage}% temples` };
        }

        // Check cooldown
        const onCooldown = state.cooldowns.find(cd => cd.spellId === spellId);
        if (onCooldown && onCooldown.remainingTime > 0) {
          return { success: false, error: 'Spell is on cooldown' };
        }

        set({ castingSpell: spellId, error: null });

        try {
          // Server-side casting
          const result = await SpellService.castSpell(kingdomId, spellId);

          // Update state based on server response
          if ((result as unknown as Record<string, unknown>).success) {
            const effectId = `effect-${Date.now()}`;
            const effect: SpellEffect = {
              id: effectId,
              spellId,
              timestamp: Date.now(),
              damage: Number((result as unknown as Record<string, unknown>).damage) || 0,
              success: true
            };

            const historyEntry: SpellCastHistory = {
              spellId,
              timestamp: Date.now(),
              target: targetId,
              success: true,
              damage: Number((result as unknown as Record<string, unknown>).damage) || 0,
              elanCost: Number((result as unknown as Record<string, unknown>).elanCost) || 0
            };

            const cooldown: SpellCooldown = {
              spellId,
              remainingTime: spell.cost.turns * 1000,
              totalTime: spell.cost.turns * 1000
            };

            set((state) => ({
              castingSpell: null,
              selectedTarget: null,
              showTargetSelector: false,
              currentElan: Number((result as unknown as Record<string, unknown>).newElan) || 0,
              activeEffects: [...state.activeEffects, effect],
              castHistory: [historyEntry, ...state.castHistory.slice(0, 49)],
              cooldowns: [...state.cooldowns.filter(cd => cd.spellId !== spellId), cooldown]
            }));

            // Handle special spell effects
            if (spellId === 'calming_chant') {
              
        set(state => ({ currentElan: state.currentElan + 1 }));
            }
          } else {
            set({ 
              castingSpell: null,
              error: String((result as unknown as Record<string, unknown>).error) || 'Spell casting failed'
            });
          }

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          set({ 
            castingSpell: null,
            error: errorMessage
          });
          return { success: false, error: errorMessage };
        }
      },

      // Effect management
      removeEffect: (effectId: string) => {
        set((state) => ({
          activeEffects: state.activeEffects.filter(effect => effect.id !== effectId)
        }));
      },

      // Cooldown management
      updateCooldowns: (deltaTime: number) => {
        set((state) => ({
          cooldowns: state.cooldowns
            .map(cd => ({ ...cd, remainingTime: Math.max(0, cd.remainingTime - deltaTime) }))
            .filter(cd => cd.remainingTime > 0)
        }));
      },

      // Utility functions
      canCastSpell: (spellId: string): boolean => {
        const state = get();
        const spell = SPELLS[spellId];
        
        if (!spell || state.castingSpell) return false;
        if (state.currentElan < spell.cost.elan) return false;
        
        const onCooldown = state.cooldowns.find(cd => cd.spellId === spellId);
        return !onCooldown || onCooldown.remainingTime <= 0;
      },

      getSpellCooldown: (spellId: string): number => {
        const cooldown = get().cooldowns.find(cd => cd.spellId === spellId);
        return cooldown?.remainingTime || 0;
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Reset state (for testing/demo)
      resetSpellState: () => {
        set({
          currentElan: 0,
          maxElan: 300,
          castingSpell: null,
          selectedTarget: null,
          activeEffects: [],
          cooldowns: [],
          castHistory: [],
          selectedSpell: null,
          showTargetSelector: false,
          loading: false,
          error: null
        });
      }
    })
  )
);
