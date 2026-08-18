import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Compass, 
  RefreshCw, 
  MapPin, 
  AlertTriangle,
  Map as MapIcon,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useParishes } from '../../hooks/useService';
import type { Parish } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LeafletMap } from '../../components/maps/LeafletMap';
import { ParishMarker } from '../../features/parishes/components/ParishMarker';
import { ParishDrawer } from '../../features/parishes/components/ParishDrawer';

// Center of the Vicariate of Canlaon (Negros Oriental)
const DEFAULT_CENTER = { lat: 10.22, lng: 123.25 };
const DEFAULT_ZOOM = 9;

const EMPTY_PARISHES_ARRAY: Parish[] = [];

export const ParishDirectoryPage: React.FC = () => {
  const navigate = useNavigate();

  const parishesQuery = useParishes();
  const parishes = parishesQuery.data || EMPTY_PARISHES_ARRAY;
  const { loading, error, refetch } = parishesQuery;

  const [selectedParishId, setSelectedParishId] = useState<string | null>(null);
  const selectedParish = selectedParishId
    ? parishes.find(parish => parish.id === selectedParishId) || null
    : null;

  // Map state
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Parish[]>([]);

  // Update suggestions on search query change
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSuggestions(prev => prev.length === 0 ? prev : EMPTY_PARISHES_ARRAY);
      return;
    }
    const filtered = parishes.filter(p => {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.patronSaint.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.province.toLowerCase().includes(q) ||
        p.feastDay.toLowerCase().includes(q)
      );
    });
    setSuggestions(filtered);
  }, [searchQuery, parishes]);

  const handleSelectParish = (parish: Parish) => {
    setSelectedParishId(parish.id);
    setMapCenter(parish.coordinates);
    setMapZoom(14);
    setSearchQuery('');
    setSuggestions([]);
  };

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setMapZoom(14);
          setGeoError(null);
        },
        (error) => {
          console.error(error);
          setGeoError("Location permission denied or unavailable.");
          setTimeout(() => setGeoError(null), 4000);
        }
      );
    } else {
      setGeoError("Geolocation is not supported by your browser.");
      setTimeout(() => setGeoError(null), 4000);
    }
  };

  const handleResetView = () => {
    setMapCenter(DEFAULT_CENTER);
    setMapZoom(DEFAULT_ZOOM);
    setSelectedParishId(null);
    setSearchQuery('');
  };

  const handleRequestDocument = (parishId: string) => {
    navigate(`/dashboard/request?parishId=${parishId}`);
  };

  const handleScheduleAppointment = (parishId: string) => {
    navigate(`/dashboard/scheduler?parishId=${parishId}`);
  };

  const handleRefresh = () => {
    setSelectedParishId(null);
    setSearchQuery('');
    refetch();
  };

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Vicariate Directory Map" 
          description="Explore the parishes of the Vicariate of Canlaon geographically."
          onRefresh={handleRefresh}
          breadcrumbs={['Home', 'Vicariate Directory']}
        />
        <ErrorState 
          title="Failed to load vicariate directory" 
          description="We had trouble fetching coordinates and schedules for Canlaon parishes. Please try again."
          onRetry={handleRefresh} 
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <PageHeader 
          title="Vicariate Directory Map" 
          description="Explore the parishes of the Vicariate of Canlaon geographically."
          onRefresh={handleRefresh}
          isRefreshing={true}
          breadcrumbs={['Home', 'Vicariate Directory']}
        />
        
        {/* Search Input Skeleton */}
        <Skeleton className="h-11 max-w-md w-full rounded-button" />

        {/* Map Viewport Skeleton */}
        <div className="relative h-[65vh] md:h-[72vh] w-full rounded-card overflow-hidden border border-border bg-gray-100 flex items-center justify-center">
          <Skeleton className="absolute inset-0 h-full w-full" />
          {/* Floating detail skeleton to mimic desktop view */}
          <div className="hidden lg:block absolute left-4 top-4 bottom-4 w-96 z-10 bg-white border border-border/80 rounded-card p-5 space-y-4">
            <Skeleton className="h-44 w-full rounded-card" />
            <Skeleton className="h-5 w-3/4 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
            <Skeleton className="h-10 w-full rounded-button mt-4" />
          </div>
        </div>
      </div>
    );
  }

  // Filtered parishes list for the map if suggestions are shown or if we search matches
  const displayParishes = searchQuery.trim() !== '' ? suggestions : parishes;

  return (
    <div className="space-y-6 flex flex-col h-full" aria-live="polite">
      <PageHeader 
        title="Vicariate Directory Map" 
        description="Explore the parishes of the Vicariate of Canlaon geographically, view mass schedules, and request sacraments."
        onRefresh={handleRefresh}
        breadcrumbs={['Home', 'Vicariate Directory']}
      />

      {/* Geolocation friendly error notification */}
      {geoError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 flex items-center space-x-2 text-red-700 text-xs rounded shadow-sm animate-in fade-in slide-in-from-top duration-200">
          <AlertTriangle size={16} />
          <span>{geoError}</span>
        </div>
      )}

      {/* Search Input Box */}
      <div className="relative max-w-md w-full z-20">
        <div className="flex items-center border border-border bg-white rounded-button px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-crimson/20 focus-within:border-crimson transition-all shadow-sm">
          <Search size={18} className="text-text-muted mr-2" />
          <input 
            type="text"
            placeholder="Search Parish (by name, city, feast day, patron saint)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm outline-none text-text-primary bg-transparent placeholder-text-muted"
          />
        </div>

        {/* Suggestion list */}
        {searchQuery.trim() !== '' && suggestions.length > 0 && (
          <Card className="absolute top-full left-0 right-0 mt-1 shadow-card border border-border bg-white divide-y divide-border/60 z-20 max-h-60 overflow-y-auto">
            {suggestions.map(parish => (
              <div 
                key={parish.id}
                onClick={() => handleSelectParish(parish)}
                className="p-3 hover:bg-app-page cursor-pointer transition-colors text-xs flex items-center space-x-2"
              >
                <MapPin size={14} className="text-[#7B1C2A]" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-text-primary truncate">{parish.name}</h4>
                  <p className="text-[10px] text-text-muted truncate">{parish.address}</p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Map Container Viewport */}
      <div className={
        isFullScreen 
          ? "fixed inset-0 z-[9999] h-screen w-screen bg-white rounded-none border-none shadow-2xl" 
          : "relative h-[65vh] md:h-[72vh] w-full rounded-card overflow-hidden border border-border shadow-md"
      }>
        {/* Leaflet map */}
        {displayParishes.length > 0 ? (
          <LeafletMap center={mapCenter} zoom={mapZoom} className="h-full w-full">
            {displayParishes.map(parish => (
              <ParishMarker 
                key={parish.id}
                parish={parish}
                position={parish.coordinates}
                onClick={() => handleSelectParish(parish)}
              />
            ))}
          </LeafletMap>
        ) : (
          <div className="absolute inset-0 bg-app-base flex items-center justify-center p-8 z-10">
            <EmptyState 
              title="No parish found"
              description="No canonical registry location matches your current search keyword. Try another parish name or vicariate city."
              icon={<MapIcon size={36} className="text-text-muted/40" />}
              action={
                <Button size="sm" onClick={() => setSearchQuery('')} className="bg-[#7B1C2A] hover:bg-[#5C1520]">
                  Reset Search
                </Button>
              }
            />
          </div>
        )}

        {/* Collapsible scrolling Parishes List sidebar overlay */}
        <div className={`absolute left-4 top-4 bottom-4 w-72 bg-white/95 backdrop-blur-sm border border-border rounded-xl shadow-xl flex flex-col z-[1000] transition-all duration-350 pointer-events-auto ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-[290px]"
        }`}>
          {/* Header */}
          <div className="p-3 border-b border-border/60 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapIcon size={14} className="text-[#7B1C2A]" />
              Parish Directory ({displayParishes.length})
            </h3>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded focus-ring"
              title="Hide list"
            >
              <Minimize2 size={14} />
            </button>
          </div>
          
          {/* List */}
          <div className="flex-grow overflow-y-auto divide-y divide-border/40 p-2 space-y-1">
            {displayParishes.map(parish => (
              <button
                key={parish.id}
                onClick={() => handleSelectParish(parish)}
                className={`w-full text-left p-2.5 rounded-lg transition-all flex items-start gap-2.5 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#7B1C2A]/20 ${
                  selectedParish?.id === parish.id ? "bg-[#7B1C2A]/5 border border-[#7B1C2A]/25 text-[#7B1C2A]" : "border border-transparent"
                }`}
              >
                <MapPin size={14} className="text-[#7B1C2A] flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-gray-900 truncate">{parish.name}</h4>
                  <p className="text-[10px] text-gray-500 truncate mt-0.5">{parish.address}</p>
                  <p className="text-[9px] text-gray-400 mt-1">Patron: {parish.patronSaint}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Trigger to show sidebar when collapsed */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 top-4 z-[1000] p-2.5 bg-white border border-border text-text-muted hover:text-[#7B1C2A] rounded-button shadow-md transition-all focus-ring flex items-center gap-1.5 text-xs font-bold pointer-events-auto"
            title="Show list"
          >
            <Maximize2 size={14} />
            <span>Show List</span>
          </button>
        )}

        {/* Map Floating Control Controls */}
        <div className="absolute right-3.5 top-3.5 z-[1000] flex flex-col space-y-2">
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2.5 bg-white border border-border text-text-muted hover:text-crimson rounded-button shadow-sm hover:shadow transition-all focus-ring"
            title={isFullScreen ? "Exit Fullscreen" : "Fullscreen Mode"}
          >
            {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            onClick={handleLocateMe}
            className="p-2.5 bg-white border border-border text-text-muted hover:text-crimson rounded-button shadow-sm hover:shadow transition-all focus-ring"
            title="Locate Me"
          >
            <Compass size={18} />
          </button>
          <button
            onClick={handleResetView}
            className="p-2.5 bg-white border border-border text-text-muted hover:text-crimson rounded-button shadow-sm hover:shadow transition-all focus-ring"
            title="Reset View"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Rich Floating Parish Info Overlay Card (Desktop: expanded split panel overlay, Mobile: bottom sheet style) */}
        {selectedParish && (
          <div className="absolute inset-0 pointer-events-none z-[1000]">
            {/* Desktop layout: spacious floating overlay */}
            <div className={`hidden lg:block absolute top-4 bottom-4 w-[580px] max-w-[calc(100vw-360px)] pointer-events-auto overflow-hidden animate-in slide-in-from-left duration-300 transition-all ${
              isSidebarOpen ? "left-[304px]" : "left-4"
            }`}>
              <ParishDrawer 
                parish={selectedParish}
                onRequestDocument={handleRequestDocument}
                onScheduleAppointment={handleScheduleAppointment}
                onClose={() => setSelectedParishId(null)}
              />
            </div>

            {/* Mobile layout: bottom sheet overlay */}
            <div className="lg:hidden absolute bottom-0 left-0 right-0 max-h-[70vh] pointer-events-auto overflow-y-auto border-t border-border shadow-2xl rounded-t-2xl bg-white animate-in slide-in-from-bottom duration-300">
              <ParishDrawer 
                parish={selectedParish}
                onRequestDocument={handleRequestDocument}
                onScheduleAppointment={handleScheduleAppointment}
                onClose={() => setSelectedParishId(null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParishDirectoryPage;
