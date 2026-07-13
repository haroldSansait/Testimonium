import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, id, type = 'text', ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substring(2, 11)}`;

    return (
      <div className="w-full mb-4">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-1.5">
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          className={`w-full px-4 py-2.5 text-sm bg-white border ${
            error ? 'border-status-rejected' : 'border-border'
          } rounded-button focus-ring text-text-primary placeholder-text-muted transition-colors ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} role="alert" className="mt-1 text-xs text-status-rejected font-medium">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
