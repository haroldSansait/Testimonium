import React, { forwardRef } from 'react';
import { Spinner } from './Spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors rounded-button focus-ring disabled:opacity-50 disabled:pointer-events-none';
    
    const variants = {
      primary: 'bg-crimson hover:bg-crimson-dark text-white shadow-sm',
      secondary: 'bg-app-page hover:bg-border text-text-primary',
      outline: 'border border-border bg-transparent hover:bg-app-page text-text-primary',
      ghost: 'bg-transparent hover:bg-app-page text-text-primary',
      danger: 'bg-status-rejected hover:bg-red-700 text-white shadow-sm',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading && <Spinner size="sm" className="mr-2 text-current" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
