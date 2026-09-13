import { CustomSelect, type CustomSelectOptionItem } from './CustomSelect';

export interface DropdownOption {
  id: string;
  name: string;
  secondaryText?: string;
  badge?: string;
}

export interface SearchableDropdownProps {
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
  const customOptions: CustomSelectOptionItem[] = options.map((opt) => ({
    value: opt.id,
    label: opt.name,
    secondary: opt.secondaryText,
    badge: opt.badge,
  }));

  const isEmpty = options.length === 0 && !loading;

  return (
    <CustomSelect
      id={id}
      options={customOptions}
      value={selectedValue || ''}
      onChange={(val) => onChange(val ? String(val) : null)}
      placeholder={isEmpty ? emptyMessage : placeholder}
      searchPlaceholder={searchPlaceholder}
      searchable
      allowClear={!required && Boolean(selectedValue)}
      disabled={disabled || isEmpty}
      loading={loading}
      required={required}
    />
  );
}

export default SearchableDropdown;
