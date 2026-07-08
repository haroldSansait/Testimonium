import { cn } from '@/utils/cn';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Loading data...', className }: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)} role="status">
      <span className="w-10 h-10 border-4 border-gray-200 border-t-crimson-700 rounded-full animate-spin" />
      <p className="text-xs font-semibold text-gray-400 mt-3 tracking-wider uppercase">
        {message}
      </p>
    </div>
  );
}
