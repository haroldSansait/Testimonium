import { cn } from '@/utils/cn';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message = 'An unexpected error occurred.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-md mx-auto my-12 animate-in fade-in duration-200',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 mx-auto">
        <AlertTriangle className="w-6 h-6 text-red-700" />
      </div>
      <p className="text-sm font-bold text-gray-900">Failed to Load Data</p>
      <p className="text-xs text-gray-505 mt-1 mb-5 leading-relaxed max-w-sm mx-auto">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-crimson-700 text-white text-xs font-semibold rounded-lg hover:bg-crimson-800 active:bg-crimson-900 transition-all focus:outline-none focus:ring-2 focus:ring-crimson-700/20"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Retry Request
        </button>
      )}
    </div>
  );
}
