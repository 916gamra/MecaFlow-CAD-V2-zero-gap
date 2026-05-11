import React from 'react';
import { WizardStep, WIZARD_STEPS, WIZARD_LABELS } from '../types';

interface WizardStepperProps {
  currentStep: WizardStep;
  onStepClick: (step: WizardStep) => void;
}

const WizardStepper: React.FC<WizardStepperProps> = ({ currentStep, onStepClick }) => {
  const currentIdx = WIZARD_STEPS.indexOf(currentStep);

  return (
    <div className="wizard-stepper">
      {WIZARD_STEPS.map((step, idx) => {
        const isActive = idx === currentIdx;
        const isCompleted = idx < currentIdx;
        const isFuture = idx > currentIdx;
        const isDashboard = step === 'dashboard';

        return (
          <React.Fragment key={step}>
            {/* Connector line (not before first item) */}
            {idx > 0 && (
              <div className={`wizard-connector ${isCompleted ? 'completed' : ''}`} />
            )}

            {/* Step circle + label */}
            <button
              className={`wizard-step-btn ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isFuture ? 'future' : ''}`}
              onClick={() => {
                // Can go back to completed steps or click current
                if (isCompleted || isActive) onStepClick(step);
              }}
              disabled={isFuture}
              title={WIZARD_LABELS[step]}
            >
              <div className="wizard-circle">
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : isDashboard ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                  </svg>
                ) : (
                  <span className="wizard-num">{idx}</span>
                )}
              </div>
              <span className="wizard-label">{WIZARD_LABELS[step]}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default WizardStepper;
