import React from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action, icon, className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border rounded-card bg-app-base/40 ${className}`}>
      {icon && <div className="text-text-muted mb-3">{icon}</div>}
      <h3 className="text-base font-serif font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-sm text-text-muted max-w-sm mb-4">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
export default EmptyState;
