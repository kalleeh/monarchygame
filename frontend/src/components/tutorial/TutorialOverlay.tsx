import { useEffect, useState } from 'react';
import { useTutorialStore } from '../../stores/tutorialStore';
import { TutorialStep } from './TutorialStep';
import { ProgressIndicator } from './ProgressIndicator';
import './Tutorial.css';

interface TutorialStepData {
  id: number;
  title: string;
  description: string;
  targetElement?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const tutorialSteps: TutorialStepData[] = [
  {
    id: 0,
    title: '👑 Welcome to Monarchy!',
    description: 'Build your kingdom, command armies, and forge alliances in this strategic multiplayer game. Let\'s get you started!',
  },
  {
    id: 1,
    title: '🏰 Kingdom Creation',
    description: 'Choose your race and name your kingdom wisely. Each race has unique strengths and special abilities that define your playstyle.',
    targetElement: '.race-grid',
    position: 'bottom',
  },
  {
    id: 2,
    title: '💰 Resource Management',
    description: 'These are your kingdom\'s vital resources. Gold funds your armies, Population provides workers, Land expands your territory, and Turns let you take actions.',
    targetElement: '.resources-panel',
    position: 'bottom',
  },
  {
    id: 3,
    title: '🗺️ Territory & Actions',
    description: 'Use these action buttons to expand your kingdom, train armies, cast spells, and manage diplomacy. Each action costs turns.',
    targetElement: '.actions-panel',
    position: 'top',
  },
  {
    id: 4,
    title: '⚔️ Combat & Alliances',
    description: 'Battle other kingdoms, forge alliances, and dominate the leaderboard. Use your race\'s special abilities to gain the upper hand. Good luck, ruler!',
  },
];

export function TutorialOverlay() {
  const {
    currentStep,
    completed,
    skipped,
    nextStep,
    previousStep,
    skipTutorial,
    completeTutorial,
  } = useTutorialStore();

  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        skipTutorial();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [skipTutorial]);

  // Update highlight position when step changes
  useEffect(() => {
    const currentStepData = tutorialSteps[currentStep];
    if (currentStepData?.targetElement) {
      const element = document.querySelector(currentStepData.targetElement);
      if (element) {
        const rect = element.getBoundingClientRect();
        setHighlightRect(rect);
        
        // Only scroll if element is not visible
        const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
        if (!isVisible) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else {
        setHighlightRect(null);
      }
    } else {
      setHighlightRect(null);
    }
  }, [currentStep]);

  // Don't show if completed or skipped
  if (completed || skipped) {
    return null;
  }

  const currentStepData = tutorialSteps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === tutorialSteps.length - 1;

  const handleNext = () => {
    if (isLast) {
      completeTutorial();
    } else {
      nextStep();
    }
  };

  return (
    <div className="tutorial-overlay">
      {/* Dark backdrop - lighter so content is visible */}
      <div className="tutorial-backdrop" />

      {/* Bright highlight border around target element */}
      {highlightRect && (
        <>
          <div
            className="tutorial-spotlight"
            style={{
              top: highlightRect.top - 8,
              left: highlightRect.left - 8,
              width: highlightRect.width + 16,
              height: highlightRect.height + 16,
            }}
          />
          <div
            className="tutorial-highlight-border"
            style={{
              top: highlightRect.top - 4,
              left: highlightRect.left - 4,
              width: highlightRect.width + 8,
              height: highlightRect.height + 8,
            }}
          />
        </>
      )}
      
      {/* Tutorial content positioned near highlighted element */}
      <div 
        className={`tutorial-container ${currentStepData.position || 'center'}`}
        style={highlightRect && currentStepData.position ? {
          top: currentStepData.position === 'bottom' 
            ? Math.min(highlightRect.bottom + 20, window.innerHeight - 400)
            : currentStepData.position === 'top'
            ? Math.max(highlightRect.top - 320, 20)
            : '50%',
          left: '50%',
          transform: 'translateX(-50%)',
        } : {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      >
        <ProgressIndicator currentStep={currentStep} totalSteps={tutorialSteps.length} />
        
        <TutorialStep
          step={currentStepData}
          onNext={handleNext}
          onPrevious={previousStep}
          onSkip={skipTutorial}
          isFirst={isFirst}
          isLast={isLast}
        />
      </div>
    </div>
  );
}
