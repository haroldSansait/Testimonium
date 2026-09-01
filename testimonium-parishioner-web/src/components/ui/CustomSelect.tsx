import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface CustomSelectOptionItem {
  value: string;
  label: string;
  secondary?: string;
  badge?: string;
}

export interface CustomSelectOptionGroup {
  groupName?: string;
  options: CustomSelectOptionItem[];
}

export type CustomSelectOption = CustomSelectOptionItem | string;

export interface CustomSelectProps {
  id?: string;
  label?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  options?: CustomSelectOption[];
  groups?: CustomSelectOptionGroup[];
  placeholder?: string;
  allowClear?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
  icon?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  'aria-label'?: string;
}

export function CustomSelect({
  id,
  label,
  value,
  onChange,
  options,
  groups,
  placeholder = 'Select an option...',
  allowClear = false,
  searchable,
  searchPlaceholder = 'Search...',
  disabled = false,
  loading = false,
  required = false,
  icon,
  className,
  triggerClassName,
  dropdownClassName,
  'aria-label': ariaLabel,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize groups & options into uniform groups array
  const normalizedGroups: CustomSelectOptionGroup[] = useMemo(() => {
    if (groups && groups.length > 0) {
      return groups;
    }
    if (options && options.length > 0) {
      const formattedOptions: CustomSelectOptionItem[] = options.map((opt) => {
        if (typeof opt === 'string') {
          return { value: opt, label: opt };
        }
        return opt;
      });
      return [{ options: formattedOptions }];
    }
    return [];
  }, [groups, options]);

  // Flatten options for quick lookup
  const allOptions: CustomSelectOptionItem[] = useMemo(() => {
    const list: CustomSelectOptionItem[] = [];
    normalizedGroups.forEach((g) => {
      g.options.forEach((opt) => list.push(opt));
    });
    return list;
  }, [normalizedGroups]);

  // Selected option lookup
  const selectedOption = useMemo(() => {
    if (value === null || value === undefined || value === '') return null;
    return allOptions.find((opt) => String(opt.value) === String(value)) || null;
  }, [allOptions, value]);

  // Determine if search should be enabled
  const shouldEnableSearch = searchable ?? allOptions.length > 6;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return normalizedGroups;

    return normalizedGroups
      .map((group) => {
        const groupMatches = group.groupName?.toLowerCase().includes(query);
        const matchingOptions = group.options.filter(
          (opt) =>
            opt.label.toLowerCase().includes(query) ||
            opt.value.toLowerCase().includes(query) ||
            (opt.secondary && opt.secondary.toLowerCase().includes(query)) ||
            (opt.badge && opt.badge.toLowerCase().includes(query)) ||
            groupMatches
        );
        return {
          ...group,
          options: matchingOptions,
        };
      })
      .filter((group) => group.options.length > 0);
  }, [normalizedGroups, search]);

  const hasFilteredResults = filteredGroups.some((g) => g.options.length > 0);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange('');
    setIsOpen(false);
  };

  const isDropdownDisabled = disabled || loading;

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold uppercase tracking-wider text-text-primary mb-1.5"
        >
          {label}
          {required && <span className="text-crimson ml-0.5">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <div className="relative w-full">
        <button
          id={id}
          type="button"
          disabled={isDropdownDisabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            'w-full text-left py-2.5 rounded-button border text-sm transition-all bg-white flex items-center justify-between select-none shadow-xs font-sans',
            icon ? 'pl-9 pr-9' : 'pl-3.5 pr-9',
            isOpen
              ? 'border-crimson ring-2 ring-crimson/20 outline-none'
              : 'border-border hover:border-gray-300 focus:border-crimson focus:ring-2 focus:ring-crimson/20',
            isDropdownDisabled && 'bg-app-page border-border cursor-not-allowed opacity-60 text-text-muted',
            triggerClassName
          )}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={ariaLabel || label || placeholder}
        >
          {/* Optional leading icon */}
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-text-muted pointer-events-none">
              {icon}
            </span>
          )}

          <span className="block truncate text-sm">
            {loading ? (
              <span className="flex items-center gap-2 text-text-muted">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-crimson" />
                Loading...
              </span>
            ) : selectedOption ? (
              <span className="font-medium text-text-primary">
                {selectedOption.label}
              </span>
            ) : (
              <span className="text-text-muted font-normal">
                {placeholder}
              </span>
            )}
          </span>
        </button>

        {/* Action icons on right */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-text-muted pointer-events-none">
          {allowClear && value && !disabled && !required && (
            <button
              type="button"
              onClick={handleClear}
              className="pointer-events-auto p-1 text-text-muted hover:text-crimson hover:bg-gray-100 rounded-md transition-colors"
              title="Clear selection"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-text-muted transition-transform duration-200',
              isOpen && 'rotate-180 text-crimson'
            )}
          />
        </div>
      </div>

      {/* Popover Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute left-0 right-0 mt-1.5 bg-white border border-border rounded-card shadow-card z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-1 duration-150 min-w-[200px]',
            dropdownClassName
          )}
        >
          {/* In-dropdown Search Bar */}
          {shouldEnableSearch && (
            <div className="p-2 border-b border-border bg-app-base">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 h-3.5 w-3.5 text-text-muted pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-border rounded-button text-text-primary placeholder:text-text-muted outline-none focus:border-crimson focus:ring-1 focus:ring-crimson"
                  onClick={(e) => e.stopPropagation()}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 p-0.5 text-text-muted hover:text-text-primary rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto overscroll-contain focus:outline-none [scrollbar-width:thin] [scrollbar-color:#e5e7eb_transparent]">
            {filteredGroups.map((group, groupIdx) => (
              <div key={group.groupName || `group-${groupIdx}`} className="w-full">
                {group.groupName && (
                  <div className="sticky top-0 z-10 w-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted bg-gray-50 border-t border-b border-border select-none first:border-t-0">
                    {group.groupName}
                  </div>
                )}
                <div className="p-1 space-y-0.5 bg-white">
                  {group.options.map((opt) => {
                    const isSelected = String(opt.value) === String(value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-button text-xs transition-colors flex items-center justify-between group cursor-pointer',
                          isSelected
                            ? 'bg-red-50/70 text-crimson font-semibold'
                            : 'text-text-primary hover:bg-app-page hover:text-crimson'
                        )}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="truncate">{opt.label}</span>
                          {opt.secondary && (
                            <span className="text-[11px] text-text-muted truncate">
                              {opt.secondary}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {opt.badge && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gray-100 text-text-muted">
                              {opt.badge}
                            </span>
                          )}
                          {isSelected && <Check className="h-3.5 w-3.5 text-crimson shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {!hasFilteredResults && (
              <div className="px-3 py-6 text-center text-xs text-text-muted">
                No matching options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomSelect;
