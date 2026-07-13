import React from 'react';

export interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, description, action, className = '' }) => {
  return (
    <div className={`flex items-center justify-between pb-3 mb-4 border-b border-border/60 ${className}`}>
      <div>
        <h2 className="text-base md:text-lg font-serif font-semibold text-text-primary">
          {title}
        </h2>
        {description && (
          <p className="text-xs text-text-muted mt-0.5">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0 flex items-center space-x-2">
          {action}
        </div>
      )}
    </div>
  );
};
export default SectionHeader;
