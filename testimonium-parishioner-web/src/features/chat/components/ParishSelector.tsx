import React, { useState, useEffect } from 'react';
import { Church, X } from 'lucide-react';
import services from '../../../providers/factory';
import type { Parish } from '../../../types';

interface ParishSelectorProps {
  selectedParishId: number | null;
  onSelectParish: (parishId: number | null) => void;
  disabled?: boolean;
}

export const ParishSelector: React.FC<ParishSelectorProps> = ({
  selectedParishId,
  onSelectParish,
  disabled = false,
}) => {
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadParishes() {
      try {
        setLoading(true);
        const list = await services.parish.getParishes();
        if (mounted) {
          setParishes(list || []);
        }
      } catch (err) {
        console.warn('[ParishSelector] Failed to load parish list:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadParishes();
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      onSelectParish(null);
    } else {
      const parsed = Number(val);
      onSelectParish(Number.isInteger(parsed) && parsed > 0 ? parsed : null);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectParish(null);
  };

  const selectedParish = parishes.find((p) => String(p.id) === String(selectedParishId));

  return (
    <div className="bg-app-page/70 border-b border-border px-3 py-2 text-xs flex items-center gap-2">
      <Church className="w-3.5 h-3.5 text-crimson flex-shrink-0" />
      <div className="flex-1 flex items-center gap-1.5 min-w-0">
        <label htmlFor="caloy-parish-select" className="sr-only">
          Select Parish Context
        </label>
        <select
          id="caloy-parish-select"
          value={selectedParishId ? String(selectedParishId) : ''}
          onChange={handleChange}
          disabled={disabled || loading}
          className="w-full truncate text-xs bg-white border border-border rounded px-2 py-1 text-text-primary focus-ring disabled:opacity-50"
          aria-label="Filter answers by parish"
        >
          <option value="">Diocese-wide (All Parishes)</option>
          {parishes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {selectedParishId && (
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-gray-100 transition-colors focus-ring"
          title="Clear parish filter to diocese-wide"
          aria-label={`Clear ${selectedParish?.name || 'parish'} filter to diocese-wide`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default ParishSelector;
