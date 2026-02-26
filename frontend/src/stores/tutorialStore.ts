import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface TutorialState {
  currentStep: number;
  completed: boolean;
  skipped: boolean;
  totalSteps: number;
}

interface TutorialActions {
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => void;
  restartTutorial: () => void;
  completeTutorial: () => void;
}

type TutorialStore = TutorialState & TutorialActions;

export const useTutorialStore = create<TutorialStore>()(
  persist(
    (set, get) => ({
      // State
      currentStep: 0,
      completed: false,
      skipped: false,
      totalSteps: 5,

      // Actions
      nextStep: () => {
        const { currentStep, totalSteps } = get();
        if (currentStep < totalSteps - 1) {
          set({ currentStep: currentStep + 1 });
        } else {
          set({ completed: true });
        }
      },

      previousStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 });
        }
      },

      skipTutorial: () => {
        set({ skipped: true, completed: true });
      },

      restartTutorial: () => {
        set({ currentStep: 0, completed: false, skipped: false });
      },

      completeTutorial: () => {
        set({ completed: true });
      },
    }),
    {
      name: 'tutorial-progress',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
