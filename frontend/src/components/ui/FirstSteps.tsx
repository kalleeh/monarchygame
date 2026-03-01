/* eslint-disable */
import React, { useState, useCallback } from 'react';
import './FirstSteps.css';

interface StepDef {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

interface FirstStepsProps {
  kingdomId: string;
  onManageBuildings?: () => void;
  onSummonUnits?: () => void;
  onViewWorldMap?: () => void;
  onManageCombat?: () => void;
  onGenerateIncome?: () => void;
}

const DISMISSED_KEY = 'firstSteps_dismissed';
const stepKey = (id: string) => `firstSteps_${id}`;

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function isStepDone(id: string): boolean {
  try {
    return localStorage.getItem(stepKey(id)) === 'done';
  } catch {
    return false;
  }
}

function markStepDone(id: string): void {
  try {
    localStorage.setItem(stepKey(id), 'done');
  } catch {}
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, 'true');
  } catch {}
}

export const FirstSteps: React.FC<FirstStepsProps> = ({
  kingdomId,
  onManageBuildings,
  onSummonUnits,
  onViewWorldMap,
  onManageCombat,
  onGenerateIncome,
}) => {
  const [dismissed, setDismissed] = useState<boolean>(() => isDismissed());
  const [completed, setCompleted] = useState<Record<string, boolean>>(() => ({
    income: isStepDone('income'),
    buildings: isStepDone('buildings'),
    units: isStepDone('units'),
    worldmap: isStepDone('worldmap'),
    combat: isStepDone('combat'),
  }));

  const steps: StepDef[] = [
    {
      id: 'income',
      title: 'Generate your first income',
      description: 'Gold fuels everything. Click Generate Income in the Resources panel to collect your first earnings.',
      actionLabel: 'Generate Income',
      onAction: () => {
        handleComplete('income');
        onGenerateIncome?.();
      },
    },
    {
      id: 'buildings',
      title: 'Build your first structure',
      description: 'Structures increase your gold output, population, and military capacity each turn.',
      actionLabel: 'Go to Buildings',
      onAction: () => {
        handleComplete('buildings');
        onManageBuildings?.();
      },
    },
    {
      id: 'units',
      title: 'Train your first unit',
      description: 'Units defend your kingdom and let you attack others. Head to Summon Units to raise your army.',
      actionLabel: 'Summon Units',
      onAction: () => {
        handleComplete('units');
        onSummonUnits?.();
      },
    },
    {
      id: 'worldmap',
      title: 'View the World Map',
      description: 'See all kingdoms and territories. Scouting the world is the first step to conquest.',
      actionLabel: 'World Map',
      onAction: () => {
        handleComplete('worldmap');
        onViewWorldMap?.();
      },
    },
    {
      id: 'combat',
      title: 'Attack a kingdom',
      description: 'Attacking rival kingdoms earns you land, gold, and glory. Go to Combat Operations to begin.',
      actionLabel: 'Combat',
      onAction: () => {
        handleComplete('combat');
        onManageCombat?.();
      },
    },
  ];

  const handleComplete = useCallback((id: string) => {
    markStepDone(id);
    setCompleted((prev) => ({ ...prev, [id]: true }));
  }, []);

  const handleDismiss = useCallback(() => {
    markDismissed();
    setDismissed(true);
  }, []);

  const doneCount = Object.values(completed).filter(Boolean).length;
  const allDone = doneCount === steps.length;

  if (dismissed || allDone) return null;

  return (
    <div className="first-steps-panel">
      <div className="first-steps-header">
        <div className="first-steps-title-row">
          <span className="first-steps-title">Getting Started</span>
          <span className="first-steps-progress">{doneCount}/{steps.length} complete</span>
        </div>
        <button
          className="first-steps-dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss getting started panel"
          title="Dismiss"
        >
          ×
        </button>
      </div>

      <div className="first-steps-progress-bar">
        <div
          className="first-steps-progress-fill"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <ul className="first-steps-list">
        {steps.map((step) => {
          const done = completed[step.id];
          return (
            <li key={step.id} className={`first-steps-item${done ? ' first-steps-item--done' : ''}`}>
              <button
                className="first-steps-check"
                onClick={() => handleComplete(step.id)}
                aria-label={done ? `${step.title} — completed` : `Mark "${step.title}" as done`}
                title={done ? 'Completed' : 'Mark as done'}
              >
                {done ? '✓' : '○'}
              </button>
              <div className="first-steps-content">
                <span className="first-steps-item-title">{step.title}</span>
                <span className="first-steps-item-desc">{step.description}</span>
              </div>
              {!done && (
                <button
                  className="first-steps-action-btn"
                  onClick={step.onAction}
                >
                  {step.actionLabel} →
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
