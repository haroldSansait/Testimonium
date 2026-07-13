import React, { useState, useRef, useEffect } from 'react';

export interface DropdownItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({ trigger, items, align = 'right', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = (item: DropdownItem) => {
    setIsOpen(false);
    if (item.onClick) item.onClick();
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-2 w-56 rounded-card border border-border bg-white shadow-card z-50 py-1 focus:outline-none animate-in fade-in slide-in-from-top-2 duration-fast`}
          role="menu"
          aria-orientation="vertical"
        >
          {items.map((item, idx) => (
            <button
              key={`${item.value}-${idx}`}
              onClick={() => handleItemClick(item)}
              className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-app-page hover:text-crimson flex items-center transition-colors focus-ring"
              role="menuitem"
            >
              {item.icon && <span className="mr-2 text-text-muted">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
export default Dropdown;
