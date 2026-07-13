import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'pending' | 'under-review' | 'ready' | 'rejected' | 'neutral' | 'crimson';
}

export const Badge: React.FC<BadgeProps> = ({ className = '', variant = 'neutral', children, ...props }) => {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold';
  
  const variants = {
    pending: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    'under-review': 'bg-blue-50 text-blue-700 border border-blue-200',
    ready: 'bg-green-50 text-green-700 border border-green-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
    neutral: 'bg-gray-100 text-gray-700 border border-gray-200',
    crimson: 'bg-red-50/50 text-crimson border border-crimson/20',
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
};
