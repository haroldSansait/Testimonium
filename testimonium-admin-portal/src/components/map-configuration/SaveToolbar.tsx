import { Search, Eye, Save, RefreshCw, Maximize2, Minimize2, MapPin } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';

interface SaveToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedVicariate: string;
  onVicariateChange: (vicariate: string) => void;
  onResetView: () => void;
  onPreviewClick: () => void;
  onSaveAllClick: () => void;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isFullScreen: boolean;
  onFullScreenToggle: () => void;
  selectedId: string | null;
  onLocateClick: () => void;
}

export function SaveToolbar({
  searchQuery,
  onSearchChange,
  selectedVicariate,
  onVicariateChange,
  onResetView,
  onPreviewClick,
  onSaveAllClick,
  hasUnsavedChanges,
  isSaving,
  isFullScreen,
  onFullScreenToggle,
  selectedId,
  onLocateClick
}: SaveToolbarProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 select-none">
      {/* Left side: Vicariate Filter & Search */}
      <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-md">
        {/* Vicariate Select */}
        <select
          value={selectedVicariate}
          onChange={(e) => onVicariateChange(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100/80 focus:outline-none focus:ring-1 focus:ring-crimson-700 cursor-pointer"
        >
          <option value="ALL">All Vicariates</option>
          <option value="Vicariate of Canlaon">Vicariate of Canlaon</option>
          <option value="Vicariate of San Carlos Borromeo">Vicariate of San Carlos Borromeo</option>
          <option value="Vicariate of St. Vincent Ferrer">Vicariate of St. Vincent Ferrer</option>
          <option value="Vicariate of St. John the Baptist">Vicariate of St. John the Baptist</option>
        </select>

        {/* Parish Search Box */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search parish by name..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-md text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-crimson-700"
          />
        </div>
      </div>

      {/* Right side: Action triggers */}
      <div className="flex items-center gap-2">
        {/* Locate Selected */}
        <button
          onClick={onLocateClick}
          disabled={!selectedId}
          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-medium transition-colors ${
            selectedId
              ? 'border-gray-200 text-gray-600 hover:bg-gray-50 active:bg-gray-100 cursor-pointer'
              : 'border-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Locate Selected
        </button>

        {/* Reset View */}
        <button
          onClick={onResetView}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset View
        </button>

        {/* Preview */}
        <button
          onClick={onPreviewClick}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          Preview Card
        </button>

        {/* Full Screen */}
        <Tooltip
          content={isFullScreen ? "Exit full-screen map mode (Esc)" : "Expand map to full screen"}
          side="bottom"
        >
          <button
            onClick={onFullScreenToggle}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
            aria-label={isFullScreen ? "Exit full-screen map mode" : "Expand map to full screen"}
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
          </button>
        </Tooltip>

        {/* Save All */}
        <button
          onClick={onSaveAllClick}
          disabled={!hasUnsavedChanges || isSaving}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold shadow transition-all ${
            isSaving
              ? 'bg-crimson-700/80 text-white cursor-not-allowed'
              : hasUnsavedChanges
              ? 'bg-crimson-700 hover:bg-crimson-800 text-white animate-pulse cursor-pointer'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
          }`}
        >
          <Save className="w-3.5 h-3.5" />
          {isSaving ? 'Saving...' : 'Save All'}
        </button>
      </div>
    </div>
  );
}
