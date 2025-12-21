/**
 * Tutorial/Onboarding Component
 * IQC Compliant: User experience enhancement with step-by-step guidance
 * Context7 Research: React best practices for interactive tutorials
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSpring, animated, config } from '@react-spring/web';
import './Tutorial.css';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetElement?: string; // CSS selector for highlighting
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface TutorialProps {
  steps: TutorialStep[];
  onComplete: () => void;
  onSkip: () => void;
  autoStart?: boolean;
}

export const Tutorial: React.FC<TutorialProps> = ({
  steps,
  onComplete,
  onSkip,
  autoStart = true
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(autoStart);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);

  // Memoize current step data
  const step = useMemo(() => steps[currentStep], [steps, currentStep]);
  const isLastStep = useMemo(() => currentStep === steps.length - 1, [currentStep, steps.length]);
  const progress = useMemo(() => ((currentStep + 1) / steps.length) * 100, [currentStep, steps.length]);

  // Animation for tutorial card
  const cardSpring = useSpring({
    opacity: isActive ? 1 : 0,
    transform: isActive ? 'scale(1)' : 'scale(0.9)',
    config: config.gentle
  });

  // Animation for progress bar
  const progressSpring = useSpring({
    width: `${progress}%`,
    config: config.slow
  });

  // Highlight target element
  useEffect(() => {
    if (!isActive || !step.targetElement) {
      setHighlightedElement(null);
      return;
    }

    const element = document.querySelector(step.targetElement) as HTMLElement;
    if (element) {
      setHighlightedElement(element);
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return () => {
      setHighlightedElement(null);
    };
  }, [isActive, step.targetElement]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (isLastStep) {
      setIsActive(false);
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [isLastStep, onComplete]);

  // Handle previous step
  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  // Handle skip
  const handleSkip = useCallback(() => {
    setIsActive(false);
    onSkip();
  }, [onSkip]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, handleSkip, handleNext, handlePrevious]);

  if (!isActive) return null;

  return (
    <>
      {/* Overlay */}
      <div className="tutorial-overlay" onClick={handleSkip} />

      {/* Highlight spotlight */}
      {highlightedElement && (
        <div
          className="tutorial-spotlight"
          style={{
            top: highlightedElement.offsetTop - 10,
            left: highlightedElement.offsetLeft - 10,
            width: highlightedElement.offsetWidth + 20,
            height: highlightedElement.offsetHeight + 20
          }}
        />
      )}

      {/* Tutorial Card */}
      <animated.div
        style={cardSpring}
        className={`tutorial-card tutorial-card-${step.position || 'bottom'}`}
      >
        <div className="tutorial-header">
          <h3>{step.title}</h3>
          <button
            className="tutorial-close"
            onClick={handleSkip}
            aria-label="Close tutorial"
          >
            ×
          </button>
        </div>

        <div className="tutorial-body">
          <p>{step.description}</p>
          {step.action && (
            <button
              className="tutorial-action-btn"
              onClick={step.action.onClick}
            >
              {step.action.label}
            </button>
          )}
        </div>

        <div className="tutorial-footer">
          <div className="tutorial-progress">
            <div className="tutorial-progress-bar">
              <animated.div
                className="tutorial-progress-fill"
                style={progressSpring}
              />
            </div>
            <span className="tutorial-progress-text">
              {currentStep + 1} / {steps.length}
            </span>
          </div>

          <div className="tutorial-navigation">
            <button
              className="tutorial-btn tutorial-btn-secondary"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              Previous
            </button>
            <button
              className="tutorial-btn tutorial-btn-primary"
              onClick={handleNext}
            >
              {isLastStep ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>

        <div className="tutorial-hint">
          <span>💡 Use arrow keys to navigate, ESC to skip</span>
        </div>
      </animated.div>
    </>
  );
};
