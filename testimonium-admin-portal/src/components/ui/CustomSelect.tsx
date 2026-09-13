import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface CustomSelectOptionItem {
  value: string | number;
  label: string;
  secondary?: string;
  badge?: string;
  disabled?: boolean;
}

export interface CustomSelectOptionGroup {
  groupName?: string;
  options: CustomSelectOptionItem[];
}

export type CustomSelectOption = CustomSelectOptionItem | string | number;

export interface CustomSelectProps {
  id?: string;
  label?: string;
  value: string | number | null | undefined;
  onChange: (value: any) => void;
  options?: CustomSelectOption[];
  groups?: CustomSelectOptionGroup[];
  placeholder?: string;
  allowClear?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
  size?: 'sm' | 'md';
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
  size = 'md',
  icon,
  className,
  triggerClassName,
  dropdownClassName,
  'aria-label': ariaLabel,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Normalize groups & options into uniform groups array
  const normalizedGroups: CustomSelectOptionGroup[] = useMemo(() => {
    if (groups && groups.length > 0) {
      return groups;
    }
    if (options && options.length > 0) {
      const formattedOptions: CustomSelectOptionItem[] = options.map((opt) => {
        if (typeof opt === 'string' || typeof opt === 'number') {
          return { value: opt, label: String(opt) };
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
    if (value === null || value === undefined) return null;
    return allOptions.find((opt) => String(opt.value) === String(value)) || null;
  }, [allOptions, value]);

  // Determine if search should be enabled (threshold > 6 options or explicit prop)
  const shouldEnableSearch = searchable ?? allOptions.length > 6;

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
            String(opt.value).toLowerCase().includes(query) ||
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

  // Flatten filtered options for keyboard navigation
  const flatFilteredOptions = useMemo(() => {
    const list: CustomSelectOptionItem[] = [];
    filteredGroups.forEach((g) => {
      g.options.forEach((opt) => list.push(opt));
    });
    return list;
  }, [filteredGroups]);

  const hasFilteredResults = flatFilteredOptions.length > 0;

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

  // Focus search input or initialize active index on open
  useEffect(() => {
    if (isOpen) {
      const selectedIdx = flatFilteredOptions.findIndex(
        (opt) => String(opt.value) === String(value)
      );
      setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);

      if (shouldEnableSearch) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 40);
      }
    } else {
      setSearch('');
      setActiveIndex(-1);
    }
  }, [isOpen, shouldEnableSearch, value, flatFilteredOptions]);

  // Keep active option in view
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && optionRefs.current[activeIndex]) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  const handleSelect = (val: string | number) => {
    onChange(val);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange('');
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || loading) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!flatFilteredOptions.length) return;
      let next = activeIndex + 1;
      while (next < flatFilteredOptions.length && flatFilteredOptions[next]?.disabled) {
        next++;
      }
      if (next < flatFilteredOptions.length) {
        setActiveIndex(next);
      } else {
        let first = 0;
        while (first < flatFilteredOptions.length && flatFilteredOptions[first]?.disabled) {
          first++;
        }
        if (first < flatFilteredOptions.length) setActiveIndex(first);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!flatFilteredOptions.length) return;
      let prev = activeIndex - 1;
      while (prev >= 0 && flatFilteredOptions[prev]?.disabled) {
        prev--;
      }
      if (prev >= 0) {
        setActiveIndex(prev);
      } else {
        let last = flatFilteredOptions.length - 1;
        while (last >= 0 && flatFilteredOptions[last]?.disabled) {
          last--;
        }
        if (last >= 0) setActiveIndex(last);
      }
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      const first = flatFilteredOptions.findIndex((opt) => !opt.disabled);
      if (first >= 0) setActiveIndex(first);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      for (let i = flatFilteredOptions.length - 1; i >= 0; i--) {
        if (!flatFilteredOptions[i]?.disabled) {
          setActiveIndex(i);
          break;
        }
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < flatFilteredOptions.length) {
        const targetOpt = flatFilteredOptions[activeIndex];
        if (targetOpt && !targetOpt.disabled) {
          handleSelect(targetOpt.value);
        }
      }
      return;
    }
  };

  const isDropdownDisabled = disabled || loading;
  const isCompact = size === 'sm';

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1 select-none"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <div className="relative w-full">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={isDropdownDisabled}
          onClick={() => setIsOpen((prev) => !prev)}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full text-left rounded-lg border transition-all bg-white flex items-center justify-between select-none shadow-xs font-sans',
            isCompact
              ? 'min-h-[38px] py-1.5 text-xs'
              : 'min-h-[42px] py-2 text-sm',
            icon ? 'pl-9 pr-9' : isCompact ? 'pl-3 pr-8' : 'pl-3.5 pr-9',
            isOpen
              ? 'border-crimson-700 ring-2 ring-crimson-700/20 outline-none'
              : 'border-gray-200 hover:border-gray-300 focus:border-crimson-700 focus:ring-2 focus:ring-crimson-700/20',
            isDropdownDisabled &&
              'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60 text-gray-400',
            triggerClassName
          )}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={ariaLabel || label || placeholder}
        >
          {/* Optional leading icon */}
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-gray-400 pointer-events-none">
              {icon}
            </span>
          )}

          <span className="block truncate">
            {loading ? (
              <span className="flex items-center gap-2 text-gray-400">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-crimson-700" />
                Loading...
              </span>
            ) : selectedOption ? (
              <span className="font-medium text-gray-900">
                {selectedOption.label}
              </span>
            ) : (
              <span className="text-gray-400 font-normal">
                {placeholder}
              </span>
            )}
          </span>
        </button>

        {/* Action icons on right */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400 pointer-events-none',
            isCompact ? 'right-2' : 'right-2.5'
          )}
        >
          {allowClear && (value !== '' && value !== null && value !== undefined) && !disabled && !required && (
            <button
              type="button"
              onClick={handleClear}
              className="pointer-events-auto p-1 text-gray-400 hover:text-crimson-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Clear selection"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              'transition-transform duration-200 text-gray-400',
              isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4',
              isOpen && 'rotate-180 text-crimson-700'
            )}
          />
        </div>
      </div>

      {/* Popover Menu - Local relative positioning */}
      {isOpen && (
        <div
          role="listbox"
          aria-label={ariaLabel || label || placeholder}
          className={cn(
            'absolute left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-1 duration-150 min-w-[200px]',
            dropdownClassName
          )}
        >
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
                  onKeyDown={handleKeyDown}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 p-0.5 text-gray-400 hover:text-gray-600 rounded"
                    aria-label="Clear search"
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
                  <div className="sticky top-0 z-10 w-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-t border-b border-gray-100/90 select-none first:border-t-0">
                    {group.groupName}
                  </div>
                )}
                <div className="p-1 space-y-0.5 bg-white">
                  {group.options.map((opt) => {
                    const isSelected = String(opt.value) === String(value);
                    const isDisabled = Boolean(opt.disabled);
                    const flatIdx = flatFilteredOptions.findIndex(
                      (item) => String(item.value) === String(opt.value)
                    );
                    const isKeyboardActive = flatIdx === activeIndex;

                    return (
                      <button
                        key={opt.value}
                        ref={(el) => {
                          if (flatIdx >= 0) optionRefs.current[flatIdx] = el;
                        }}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={isDisabled}
                        disabled={isDisabled}
                        tabIndex={-1}
                        onClick={() => {
                          if (!isDisabled) {
                            handleSelect(opt.value);
                          }
                        }}
                        onMouseEnter={() => {
                          if (!isDisabled && flatIdx >= 0) setActiveIndex(flatIdx);
                        }}
                        className={cn(
                          'w-full text-left rounded-lg transition-colors flex items-center justify-between group',
                          isCompact ? 'min-h-[36px] px-2.5 py-1.5 text-xs' : 'min-h-[38px] px-3 py-2 text-xs',
                          isDisabled
                            ? 'opacity-60 bg-gray-50/50 text-gray-400 cursor-not-allowed select-none'
                            : isSelected
                            ? 'bg-crimson-50 text-crimson-900 font-semibold cursor-pointer'
                            : isKeyboardActive
                            ? 'bg-gray-100 text-gray-900 cursor-pointer'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 cursor-pointer'
                        )}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className={cn('truncate', isDisabled && 'text-gray-500 font-normal')}>
                            {opt.label}
                          </span>
                          {opt.secondary && (
                            <span className="text-[11px] text-gray-400 truncate">
                              {opt.secondary}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {opt.badge && (
                            <span
                              className={cn(
                                'px-1.5 py-0.5 text-[10px] font-semibold rounded',
                                isDisabled
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                                  : 'bg-gray-100 text-gray-600'
                              )}
                            >
                              {opt.badge}
                            </span>
                          )}
                          {isSelected && !isDisabled && (
                            <Check className="h-3.5 w-3.5 text-crimson-700 shrink-0" />
                          )}
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

export default CustomSelect;
