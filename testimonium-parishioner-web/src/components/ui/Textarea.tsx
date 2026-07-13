import React, { forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', label, error, id, rows = 4, ...props }, ref) => {
    const inputId = id || `textarea-${Math.random().toString(36).substring(2, 11)}`;

    return (
      <div className="w-full mb-4">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-1.5">
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          rows={rows}
          className={`w-full px-4 py-2.5 text-sm bg-white border ${
            error ? 'border-status-rejected' : 'border-border'
          } rounded-button focus-ring text-text-primary placeholder-text-muted transition-colors resize-y ${className}`}
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

Textarea.displayName = 'Textarea';
