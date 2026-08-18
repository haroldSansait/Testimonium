import { Search, Eye, Save, RefreshCw, Maximize2, Minimize2, MapPin } from 'lucide-react';

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
    <div className="w-full bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm select-none">
      {/* Left side: Search & Filter */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative w-64">
          <span className="absolute left-3 top-2.5 text-gray-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search parish (e.g. St Joseph)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:border-crimson-700 font-medium"
          />
        </div>

        {/* Vicariate Filter */}
        <div className="relative">
          <select
            value={selectedVicariate}
            onChange={(e) => onVicariateChange(e.target.value)}
            className="pl-3 pr-8 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:border-crimson-700 font-medium bg-white appearance-none cursor-pointer"
          >
            <option value="all">All Vicariates</option>
            <option value="Vicariate of Canlaon">Vicariate of Canlaon</option>
          </select>
          <span className="absolute right-2 top-3 pointer-events-none border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-500"></span>
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
          title="Center map on selected parish"
        >
          <MapPin className="w-3.5 h-3.5" />
          Locate Selected
        </button>

        {/* Reset View */}
        <button
          onClick={onResetView}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
          title="Reset map view to diocese bounds"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset View
        </button>

        {/* Preview */}
        <button
          onClick={onPreviewClick}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
          title="Preview public parish details card"
        >
          <Eye className="w-3.5 h-3.5" />
          Preview Card
        </button>

        {/* Full Screen */}
        <button
          onClick={onFullScreenToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
          title={isFullScreen ? "Exit Full Screen" : "Enter Full Screen"}
        >
          {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          {isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
        </button>

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
