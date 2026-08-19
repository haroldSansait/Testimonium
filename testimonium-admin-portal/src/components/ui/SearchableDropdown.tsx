import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Tooltip } from '@/components/ui/Tooltip';


export interface DropdownOption {
  id: string;
  name: string;
  secondaryText?: string;
  badge?: string; // e.g. "(Inactive)"
}

interface SearchableDropdownProps {
  id: string;
  options: DropdownOption[];
  selectedValue: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
}

export function SearchableDropdown({
  id,
  options,
  selectedValue,
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No options available',
  disabled = false,
  loading = false,
  required = false,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset search when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.id === selectedValue);

  const filteredOptions = options.filter(
    (opt) =>
      opt.name.toLowerCase().includes(search.toLowerCase()) ||
      (opt.secondaryText && opt.secondaryText.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelect = (idVal: string | null) => {
    onChange(idVal);
    setIsOpen(false);
  };

  const showLoader = loading;
  const isDropdownDisabled = disabled || loading || options.length === 0;

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={isDropdownDisabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full text-left pl-3.5 pr-14 py-2.5 border rounded-lg text-sm transition-all bg-white',
          isOpen
            ? 'border-crimson-700 ring-2 ring-crimson-700/20 outline-none'
            : 'border-gray-200 focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700',
          isDropdownDisabled && 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-75'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className={cn('block truncate', !selectedOption && 'text-gray-400')}>
          {showLoader ? (
            <span className="flex items-center gap-1.5 text-gray-400">
              <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-crimson-700 rounded-full animate-spin" />
              Loading...
            </span>
          ) : selectedOption ? (
            <span className="flex items-center gap-1.5 text-gray-900 font-medium">
              {selectedOption.name}
              {selectedOption.badge && (
                <span className="text-xs text-red-500 font-semibold">{selectedOption.badge}</span>
              )}
            </span>
          ) : (
            options.length === 0 ? emptyMessage : placeholder
          )}
        </span>
      </button>

      {/* Action Icons (Clear selection, Chevron) */}
      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-gray-400 pointer-events-none">
        {selectedValue && !disabled && !required && (
          <Tooltip content="Clear selection" side="top">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelect(null);
              }}
              className="p-0.5 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors pointer-events-auto"
              aria-label="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        )}

        <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', isOpen && 'rotate-180')} />
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-1 duration-100">
          {/* Search bar inside panel */}
          <div className="flex items-center border-b border-gray-100 px-3 py-2 bg-gray-50/50">
            <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              className="w-full bg-transparent border-none text-sm text-gray-900 placeholder-gray-400 focus:outline-none p-0"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto py-1 divide-y divide-gray-50">
            {!required && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={cn(
                  'w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-gray-50 transition-colors',
                  !selectedValue ? 'text-crimson-700 bg-crimson-50/50' : 'text-gray-500'
                )}
              >
                (Unassign Staff)
              </button>
            )}
            
            {filteredOptions.length === 0 ? (
              <div className="px-3.5 py-4 text-sm text-gray-400 text-center">
                No matching results found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === selectedValue;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={cn(
                      'w-full text-left px-3.5 py-2 hover:bg-gray-50 flex flex-col transition-colors',
                      isSelected && 'bg-crimson-50/50 hover:bg-crimson-50'
                    )}
                  >
                    <span className={cn('text-sm font-medium', isSelected ? 'text-crimson-800' : 'text-gray-900')}>
                      {opt.name}
                      {opt.badge && (
                        <span className="ml-1.5 text-xs text-red-500 font-semibold">{opt.badge}</span>
                      )}
                    </span>
                    {opt.secondaryText && (
                      <span className="text-xs text-gray-400 truncate mt-0.5">
                        {opt.secondaryText}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
