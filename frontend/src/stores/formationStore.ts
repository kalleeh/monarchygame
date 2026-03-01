/**
 * Formation Store
 * Manages unit selection and formation building/saving.
 * Battle execution remains in combatStore.
 */

import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import { useKingdomStore } from './kingdomStore';

interface Unit {
  id: string;
  type: 'peasant' | 'militia' | 'knight' | 'cavalry' | 'archer' | 'mage';
  count: number;
  attack: number;
  defense: number;
  health: number;
  position?: { x: number; y: number };
}

interface Formation {
  id: string;
  name: string;
  units: Unit[];
  bonuses: {
    attack: number;
    defense: number;
    special?: string;
  };
  positions: Record<string, { x: number; y: number }>;
}

export type { Unit, Formation };

export const useFormationStore = create(
  combine(
    {
      // Unit selection (reads from kingdomStore)
      selectedUnits: [] as Unit[],

      // Formation system
      formations: [] as Formation[],
      activeFormation: null as string | null,
      formationPositions: {} as Record<string, { x: number; y: number }>,

      // UI state
      showFormationEditor: false,
    },
    (set, get) => ({
      // Unit selection (reads from kingdomStore)
      selectUnit: (unitId: string) => {
        const kingdomUnits = useKingdomStore.getState().units;
        const unit = kingdomUnits.find(u => u.id === unitId);
        if (unit && !get().selectedUnits.find(u => u.id === unitId)) {
          set((state) => ({
            selectedUnits: [...state.selectedUnits, unit as Unit]
          }));
        }
      },

      deselectUnit: (unitId: string) => {
        set((state) => ({
          selectedUnits: state.selectedUnits.filter(u => u.id !== unitId)
        }));
      },

      clearSelectedUnits: () => {
        set({ selectedUnits: [] });
      },

      // Formation management
      createFormation: (name: string, units: Unit[]) => {
        const formation: Formation = {
          id: `formation-${Date.now()}`,
          name,
          units,
          bonuses: calculateFormationBonuses(units),
          positions: {}
        };

        set((state) => ({
          formations: [...state.formations, formation]
        }));

        return formation.id;
      },

      updateFormationPositions: (formationId: string, positions: Record<string, { x: number; y: number }>) => {
        set((state) => ({
          formations: state.formations.map(f =>
            f.id === formationId ? { ...f, positions } : f
          )
        }));
      },

      setActiveFormation: (formationId: string | null) => {
        set({ activeFormation: formationId });
      },

      // UI actions
      setShowFormationEditor: (show: boolean) => {
        set({ showFormationEditor: show });
      },

      // Initialize default formations
      initializeFormations: () => {
        const mockFormations: Formation[] = [
          {
            id: 'defensive-wall',
            name: 'Defensive Wall',
            units: [],
            bonuses: { attack: 0, defense: 20 },
            positions: {}
          },
          {
            id: 'cavalry-charge',
            name: 'Cavalry Charge',
            units: [],
            bonuses: { attack: 30, defense: -10 },
            positions: {}
          },
          {
            id: 'balanced',
            name: 'Balanced Formation',
            units: [],
            bonuses: { attack: 10, defense: 10 },
            positions: {}
          }
        ];

        set({ formations: mockFormations });
      },
    })
  )
);

// Helper function
function calculateFormationBonuses(units: Unit[]): { attack: number; defense: number; special?: string } {
  // Formation bonuses based on unit composition
  let attackBonus = 0;
  let defenseBonus = 0;
  let special: string | undefined;

  // Heavy infantry formation
  if (units.filter(u => u.type === 'knight' || u.type === 'militia').length >= 2) {
    defenseBonus += 15;
  }

  // Cavalry formation
  if (units.filter(u => u.type === 'cavalry').length > 0) {
    attackBonus += 20;
    special = 'mobility';
  }

  // Ranged formation
  if (units.filter(u => u.type === 'archer' || u.type === 'mage').length >= 2) {
    attackBonus += 10;
    special = 'ranged_advantage';
  }

  return { attack: attackBonus, defense: defenseBonus, special };
}
