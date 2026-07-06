import { cn } from '@/utils/cn';

interface AvatarProps {
  initials: string;
  bgColor?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
};

export function Avatar({ initials, bgColor = '#6B7280', size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold text-white flex-shrink-0',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: bgColor }}
      aria-label={initials}
    >
      {initials}
    </span>
  );
}
