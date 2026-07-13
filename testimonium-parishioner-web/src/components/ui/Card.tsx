import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ className = '', hoverable = false, children, ...props }) => {
  return (
    <div
      className={`bg-white rounded-card border border-border p-6 shadow-card transition-all duration-fast ${
        hoverable ? 'hover:shadow-md hover:border-gray-300' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
export const CardHeader: React.FC<CardHeaderProps> = ({ className = '', children, ...props }) => (
  <div className={`mb-4 border-b border-border pb-3 ${className}`} {...props}>
    {children}
  </div>
);

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}
export const CardTitle: React.FC<CardTitleProps> = ({ className = '', children, ...props }) => (
  <h3 className={`text-lg font-serif font-semibold text-text-primary ${className}`} {...props}>
    {children}
  </h3>
);

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}
export const CardContent: React.FC<CardContentProps> = ({ className = '', children, ...props }) => (
  <div className={className} {...props}>
    {children}
  </div>
);
