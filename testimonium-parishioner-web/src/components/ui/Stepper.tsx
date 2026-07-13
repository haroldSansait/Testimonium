import React from 'react';
import { Check } from 'lucide-react';

export interface StepperProps {
  steps: string[];
  currentStep: number; // 0-indexed
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentStep }) => {
  return (
    <div className="w-full py-4">
      <div className="flex items-center">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStep;
          const isActive = idx === currentStep;

          return (
            <React.Fragment key={step}>
              {/* Step indicator */}
              <div className="flex flex-col items-center relative flex-1">
                <div
                  className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors duration-fast ${
                    isCompleted
                      ? 'bg-crimson border-crimson text-white'
                      : isActive
                      ? 'border-crimson text-crimson bg-white ring-4 ring-red-50'
                      : 'border-border text-text-muted bg-white'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? <Check size={16} /> : <span>{idx + 1}</span>}
                </div>
                <span
                  className={`mt-2 text-xs font-medium text-center max-w-[120px] hidden sm:block ${
                    isActive ? 'text-crimson font-semibold' : isCompleted ? 'text-text-primary' : 'text-text-muted'
                  }`}
                >
                  {step}
                </span>
              </div>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 transition-colors duration-fast ${
                    idx < currentStep ? 'bg-crimson' : 'bg-border'
                  }`}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {/* Mobile step details */}
      <div className="mt-3 text-center text-xs font-semibold text-crimson sm:hidden">
        Step {currentStep + 1} of {steps.length}: {steps[currentStep]}
      </div>
    </div>
  );
};
export default Stepper;
