import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  description = 'We encountered an error loading this information. Please try again.',
  onRetry,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 border border-red-100 rounded-card bg-red-50/15 ${className}`}>
      <div className="text-red-500 mb-3.5 bg-red-50 p-2.5 rounded-full">
        <AlertCircle size={28} />
      </div>
      <h3 className="text-base font-serif font-bold text-text-primary mb-1">
        {title}
      </h3>
      <p className="text-xs text-text-muted max-w-sm mb-4 leading-relaxed">
        {description}
      </p>
      {onRetry && (
        <Button size="sm" onClick={onRetry} className="flex items-center space-x-1.5 bg-crimson hover:bg-crimson-dark">
          <span>Retry</span>
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
