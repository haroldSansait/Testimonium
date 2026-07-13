import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  showBackToHome?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  breadcrumbs?: string[];
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  description, 
  action, 
  className = '',
  showBackToHome = true,
  onRefresh,
  isRefreshing = false,
  breadcrumbs
}) => {
  const navigate = useNavigate();

  return (
    <div className={`space-y-2 pb-5 border-b border-border ${className}`}>
      {/* Breadcrumb Navigation */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex text-xs text-text-muted select-none" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-1.5">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <li key={idx} className="inline-flex items-center">
                  {idx > 0 && <span className="mx-1 text-text-muted/40 font-light">/</span>}
                  {isLast ? (
                    <span className="font-semibold text-text-primary text-[11px]" aria-current="page">
                      {crumb}
                    </span>
                  ) : (
                    <Link 
                      to={crumb === 'Home' ? '/dashboard/home' : '#'} 
                      className="hover:text-crimson transition-colors text-[11px]"
                    >
                      {crumb}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* Main Title & Action Grid */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-text-primary mb-1 tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-text-muted leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Action Panel (Standardized back & refresh controls first) */}
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          {showBackToHome && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/dashboard/home')}
              className="flex items-center space-x-1.5 focus-ring"
              aria-label="Back to home page"
            >
              <ArrowLeft size={14} />
              <span>Back to Home</span>
            </Button>
          )}

          {onRefresh && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1.5 focus-ring"
              aria-label="Refresh page data"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
          )}

          {action}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
