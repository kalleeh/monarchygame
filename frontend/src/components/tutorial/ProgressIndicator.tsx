interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressIndicator({ currentStep, totalSteps }: ProgressIndicatorProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="tutorial-progress" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={totalSteps}>
      <div className="tutorial-progress-bar" style={{ width: `${progress}%` }} />
      <span className="tutorial-progress-text" aria-live="polite">
        Step {currentStep + 1} of {totalSteps}
      </span>
    </div>
  );
}
