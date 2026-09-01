import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Layers } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SelectOptionItem {
  value: string;
  label: string;
  secondary?: string;
  badge?: string;
}

export interface SelectOptionGroup {
  groupName?: string;
  options: SelectOptionItem[];
}

interface AnalyticsSelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  allOptionLabel?: string;
  placeholder?: string;
  groups: SelectOptionGroup[];
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function AnalyticsSelect({
  id,
  label,
  value,
  onChange,
  allOptionLabel = 'All options',
  placeholder,
  groups,
  searchable,
  searchPlaceholder = 'Search options...',
  disabled = false,
  loading = false,
  className,
}: AnalyticsSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Keyboard navigation: Escape key closes menu
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Flatten all options for quick lookup
  const allOptions = useMemo(() => {
    const list: SelectOptionItem[] = [];
    groups.forEach((g) => {
      g.options.forEach((opt) => list.push(opt));
    });
    return list;
  }, [groups]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    if (!value) return null;
    return allOptions.find((opt) => opt.value === value) || null;
  }, [allOptions, value]);

  // Total count of options
  const totalOptionsCount = allOptions.length;
  // Automatically enable search if > 6 options unless explicitly set
  const shouldEnableSearch = searchable ?? totalOptionsCount > 6;

  // Filter groups based on search term
  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;

    return groups
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
  }, [groups, search]);

  const hasFilteredResults = filteredGroups.some((g) => g.options.length > 0);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
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
    <div className={cn('relative w-full space-y-1', className)} ref={containerRef}>
      {label && (
        <span className="block text-xs font-bold uppercase tracking-wider text-gray-600">
          {label}
        </span>
      )}

      {/* Dropdown Trigger Button */}
      <div className="relative">
        <button
          id={id}
          type="button"
          disabled={isDropdownDisabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            'w-full text-left pl-3.5 pr-11 py-2 rounded-lg border text-sm transition-all bg-white flex items-center justify-between select-none shadow-xs',
            isOpen
              ? 'border-crimson-700 ring-2 ring-crimson-700/20 outline-none'
              : 'border-gray-300 hover:border-gray-400 focus:border-crimson-700 focus:ring-2 focus:ring-crimson-700/20',
            isDropdownDisabled && 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-60 text-gray-400'
          )}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className="block truncate text-sm">
            {loading ? (
              <span className="flex items-center gap-2 text-gray-400">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-crimson-700" />
                Loading...
              </span>
            ) : selectedOption ? (
              <span className="font-semibold text-gray-900">
                {selectedOption.label}
              </span>
            ) : (
              <span className="text-gray-700 font-normal">
                {allOptionLabel || placeholder || 'All'}
              </span>
            )}
          </span>
        </button>

        {/* Action icons on right */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-gray-400 pointer-events-none">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="pointer-events-auto p-1 text-gray-400 hover:text-crimson-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Reset selection"
              aria-label="Reset selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-gray-400 transition-transform duration-200',
              isOpen && 'rotate-180 text-crimson-700'
            )}
          />
        </div>
      </div>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-1 duration-150 min-w-[240px]">
          {/* In-dropdown Search Bar */}
          {shouldEnableSearch && (
            <div className="p-2 border-b border-gray-100 bg-gray-50/70">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 outline-none focus:border-crimson-700 focus:ring-1 focus:ring-crimson-700"
                  onClick={(e) => e.stopPropagation()}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 p-0.5 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto overscroll-contain focus:outline-none [scrollbar-width:thin] [scrollbar-color:#e5e7eb_transparent]">
            {/* "All" default selection pinned at top */}
            {!search && (
              <div className="p-1 border-b border-gray-100 bg-white">
                <button
                  type="button"
                  onClick={() => handleSelect('')}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer',
                    !value
                      ? 'bg-crimson-50 text-crimson-800 font-bold'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Layers className={cn('h-3.5 w-3.5', !value ? 'text-crimson-700' : 'text-gray-400')} />
                    <span>{allOptionLabel}</span>
                  </div>
                  {!value && <Check className="h-4 w-4 text-crimson-700" />}
                </button>
              </div>
            )}

            {/* Categorized Options */}
            {filteredGroups.map((group, groupIdx) => (
              <div key={group.groupName || `group-${groupIdx}`} className="w-full">
                {group.groupName && (
                  <div className="sticky top-0 z-10 w-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-t border-b border-gray-100/90 select-none first:border-t-0">
                    {group.groupName}
                  </div>
                )}
                <div className="p-1 space-y-0.5 bg-white">
                  {group.options.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={cn(
                          'w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between group cursor-pointer',
                          isSelected
                            ? 'bg-crimson-50 text-crimson-900 font-semibold'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        )}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="truncate">{opt.label}</span>
                          {opt.secondary && (
                            <span className="text-[11px] text-gray-400 truncate">
                              {opt.secondary}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {opt.badge && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gray-100 text-gray-600">
                              {opt.badge}
                            </span>
                          )}
                          {isSelected && <Check className="h-3.5 w-3.5 text-crimson-700 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {!hasFilteredResults && (
              <div className="px-3 py-6 text-center text-xs text-gray-400">
                No matching options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
