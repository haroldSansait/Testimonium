import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div className={`border-b border-border ${className}`}>
      <nav className="flex space-x-6 -mb-px" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center py-3.5 px-1 border-b-2 font-medium text-sm transition-colors duration-fast whitespace-nowrap focus-ring ${
                isActive
                  ? 'border-crimson text-crimson font-semibold'
                  : 'border-transparent text-text-muted hover:text-text-primary hover:border-gray-300'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.icon && <span className="mr-2">{tab.icon}</span>}
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
export default Tabs;
