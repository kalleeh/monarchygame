import type { ReactNode } from 'react';

interface TutorialStepData {
  id: number;
  title: string;
  description: string;
  targetElement?: string;
  action?: ReactNode;
}

interface TutorialStepProps {
  step: TutorialStepData;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function TutorialStep({
  step,
  onNext,
  onPrevious,
  onSkip,
  isFirst,
  isLast,
}: TutorialStepProps) {
  return (
    <div
      className="tutorial-step"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      aria-describedby="tutorial-description"
    >
      <div className="tutorial-content">
        <h2 id="tutorial-title">{step.title}</h2>
        <p id="tutorial-description">{step.description}</p>
        {step.action && <div className="tutorial-action">{step.action}</div>}
      </div>

      <div className="tutorial-controls">
        <button
          onClick={onSkip}
          className="tutorial-btn tutorial-skip"
          aria-label="Skip tutorial"
        >
          Skip Tutorial
        </button>

        <div className="tutorial-navigation">
          {!isFirst && (
            <button
              onClick={onPrevious}
              className="tutorial-btn tutorial-previous"
              aria-label="Previous step"
            >
              ← Previous
            </button>
          )}

          <button
            onClick={onNext}
            className="tutorial-btn tutorial-next"
            aria-label={isLast ? 'Complete tutorial' : 'Next step'}
          >
            {isLast ? 'Complete' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
