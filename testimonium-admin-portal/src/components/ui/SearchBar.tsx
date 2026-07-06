import { Search } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SearchBar({ placeholder = 'Search...', value, onChange, className }: SearchBarProps) {
  return (
    <div className={cn('relative flex-1 max-w-md', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 transition-all"
      />
    </div>
  );
}
