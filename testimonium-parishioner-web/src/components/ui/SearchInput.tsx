import React from 'react';
import { Search } from 'lucide-react';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const SearchInput: React.FC<SearchInputProps> = ({ className = '', ...props }) => {
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
        <Search size={16} />
      </div>
      <input
        type="search"
        className={`w-full pl-9 pr-4 py-2 text-sm bg-white border border-border rounded-button focus-ring text-text-primary placeholder-text-muted transition-colors ${className}`}
        {...props}
      />
    </div>
  );
};
export default SearchInput;
