import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Compass,
  RefreshCw,
  MapPin,
  AlertTriangle,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';
import { useParishes } from '../../hooks/useService';
import { useProfileRequirement } from '../../hooks/useProfileRequirement';
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

type MorphPhase = 'idle' | 'expanding' | 'fullscreen' | 'contracting';

export const ParishDirectoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { requireCompleteProfile } = useProfileRequirement();

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
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  // Fullscreen morph animation refs and state
  // Notice: The map container itself is a direct child of the page root (NO wrapper div)
  // so position: fixed with z-[60] operates in the root stacking context and completely
  // covers the dashboard sidebar (z-30) and header navbar (z-20).
  // A sibling placeholder reserves document flow space while fullscreen without creating any trapping stacking context.
  const placeholderRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const isAnimatingRef = useRef(false);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [morphPhase, setMorphPhase] = useState<MorphPhase>('idle');
  const [morphStyle, setMorphStyle] = useState<React.CSSProperties | null>(null);

  // Clean up any pending animation timer on unmount
  useEffect(() => {
    return () => {
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
      }
    };
  }, []);

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
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
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
    requireCompleteProfile(
      () => navigate(`/dashboard/request?parishId=${parishId}`),
      'request certificates'
    );
  };

  const handleScheduleAppointment = (parishId: string) => {
    requireCompleteProfile(
      () => navigate(`/dashboard/scheduler?parishId=${parishId}`),
      'schedule appointments'
    );
  };

  const handleRefresh = () => {
    setSelectedParishId(null);
    setSearchQuery('');
    refetch();
  };

  // Smooth layout transition between the original normal map and original fullscreen map
  const handleToggleFullScreen = useCallback(() => {
    // Guard against rapid clicks while an animation is in progress
    if (isAnimatingRef.current) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      const nextState = !isFullScreen;
      setIsFullScreen(nextState);
      setMorphPhase(nextState ? 'fullscreen' : 'idle');
      setMorphStyle(null);
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
      return;
    }

    const mapEl = mapContainerRef.current;
    if (!mapEl) {
      setIsFullScreen(prev => !prev);
      return;
    }

    if (!isFullScreen) {
      // ─── ENTER FULLSCREEN (EXPAND) ──────────────────────────────────
      const firstRect = mapEl.getBoundingClientRect();
      isAnimatingRef.current = true;
      setIsFullScreen(true);
      setMorphPhase('expanding');

      // 1. Initial snapshot: pinned to the exact starting rectangle
      setMorphStyle({
        position: 'fixed',
        zIndex: 60,
        top: `${firstRect.top}px`,
        left: `${firstRect.left}px`,
        width: `${firstRect.width}px`,
        height: `${firstRect.height}px`,
        borderRadius: '16px',
        margin: 0,
        transition: 'none',
      });

      // 2. Next frames: transition smoothly outward to full viewport
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setMorphStyle({
            position: 'fixed',
            zIndex: 60,
            top: '0px',
            left: '0px',
            width: '100vw',
            height: '100dvh',
            borderRadius: '0px',
            margin: 0,
            transition: 'top 400ms cubic-bezier(0.4, 0, 0.2, 1), left 400ms cubic-bezier(0.4, 0, 0.2, 1), width 400ms cubic-bezier(0.4, 0, 0.2, 1), height 400ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          });

          if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
          animTimeoutRef.current = setTimeout(() => {
            setMorphPhase('fullscreen');
            setMorphStyle(null);
            isAnimatingRef.current = false;
            window.dispatchEvent(new Event('resize'));
          }, 420);
        });
      });
    } else {
      // ─── EXIT FULLSCREEN (CONTRACT) ──────────────────────────────────
      const placeholder = placeholderRef.current;
      const targetRect = placeholder
        ? placeholder.getBoundingClientRect()
        : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };

      isAnimatingRef.current = true;
      setMorphPhase('contracting');

      // 1. Initial snapshot: pinned to full viewport
      setMorphStyle({
        position: 'fixed',
        zIndex: 60,
        top: '0px',
        left: '0px',
        width: '100vw',
        height: '100dvh',
        borderRadius: '0px',
        margin: 0,
        transition: 'none',
      });

      // 2. Next frames: transition smoothly back into the embedded slot
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setMorphStyle({
            position: 'fixed',
            zIndex: 60,
            top: `${targetRect.top}px`,
            left: `${targetRect.left}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
            borderRadius: '16px',
            margin: 0,
            transition: 'top 400ms cubic-bezier(0.4, 0, 0.2, 1), left 400ms cubic-bezier(0.4, 0, 0.2, 1), width 400ms cubic-bezier(0.4, 0, 0.2, 1), height 400ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          });

          if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
          animTimeoutRef.current = setTimeout(() => {
            setIsFullScreen(false);
            setMorphPhase('idle');
            setMorphStyle(null);
            isAnimatingRef.current = false;
            window.dispatchEvent(new Event('resize'));
          }, 420);
        });
      });
    }
  }, [isFullScreen]);

  // ESC key exits fullscreen smoothly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen && !isAnimatingRef.current) {
        e.preventDefault();
        handleToggleFullScreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen, handleToggleFullScreen]);

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
      <div className="space-y-6 flex flex-col h-full" aria-busy="true">
        <PageHeader
          title="Vicariate Directory Map"
          description="Explore the parishes of the Vicariate of Canlaon geographically, view mass schedules, and request sacraments."
          onRefresh={handleRefresh}
          isRefreshing={true}
          breadcrumbs={['Home', 'Vicariate Directory']}
        />

        {/* Search Input Skeleton */}
        <div className="relative max-w-md w-full z-20">
          <Skeleton className="h-[42px] w-full rounded-button" />
        </div>

        {/* Map Viewport Skeleton */}
        <div className="relative z-0 isolate h-[65vh] md:h-[72vh] w-full rounded-card overflow-hidden border border-border shadow-md bg-gray-100 flex items-center justify-center">
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

      {/* Search Input Box — preserved exactly in normal page, not inside fullscreen */}
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

      {/* Sibling Placeholder Slot: reserves document layout space while fullscreen WITHOUT wrapping the map or trapping stacking context */}
      {isFullScreen && (
        <div
          ref={placeholderRef}
          className="h-[65vh] md:h-[72vh] w-full pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Map Container Viewport: Direct child of page root, allowing z-[60] to cover sidebar (z-30) and header (z-20) completely */}
      <div
        ref={mapContainerRef}
        className={
          isFullScreen
            ? "fixed inset-0 !m-0 z-[60] h-screen h-[100dvh] w-screen bg-white rounded-none border-none shadow-2xl overflow-hidden"
            : "relative z-0 isolate h-[65vh] md:h-[72vh] w-full rounded-card overflow-hidden border border-border shadow-md"
        }
        style={morphStyle || (isFullScreen ? { margin: 0, top: 0, left: 0 } : undefined)}
      >
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
        <div className={`absolute left-3 sm:left-4 top-3 sm:top-4 bottom-3 sm:bottom-4 w-[calc(100%-56px)] sm:w-72 max-w-sm bg-white/95 backdrop-blur-sm border border-border rounded-xl shadow-xl flex flex-col z-20 transition-all duration-350 pointer-events-auto ${
          isSidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-[115%] opacity-0 pointer-events-none"
        }`}>
          {/* Header */}
          <div className="p-2.5 sm:p-3 border-b border-border/60 flex items-center justify-between bg-white/95 rounded-t-xl gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Mobile: Close (X) button positioned on the left to avoid collision with right-side map controls */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="sm:hidden p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg focus-ring transition-colors shrink-0"
                title="Close parish list"
                aria-label="Close parish list"
              >
                <X size={16} />
              </button>
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <MapIcon size={14} className="text-[#7B1C2A] shrink-0" />
                <span className="truncate">Parish Directory ({displayParishes.length})</span>
              </h3>
            </div>
            {/* Desktop: Close (X) button preserved on the right */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="hidden sm:inline-flex p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg focus-ring transition-colors shrink-0"
              title="Close parish list"
              aria-label="Close parish list"
            >
              <X size={16} />
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
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-3 sm:left-4 top-3 sm:top-4 z-10 px-3 py-2 sm:p-2.5 bg-white/95 backdrop-blur-sm border border-border text-text-primary hover:text-[#7B1C2A] rounded-button shadow-md transition-all focus-ring flex items-center gap-1.5 text-xs font-bold pointer-events-auto active:scale-95"
            title="Show Parish List"
            aria-label="Show Parish List"
          >
            <MapIcon size={14} className="text-[#7B1C2A]" />
            <span>Show Parish List</span>
          </button>
        )}

        {/* Map Floating Control Controls */}
        <div className="absolute right-3 sm:right-3.5 top-3 sm:top-3.5 z-10 flex flex-col space-y-2">
          <button
            onClick={handleToggleFullScreen}
            disabled={morphPhase === 'expanding' || morphPhase === 'contracting'}
            className="p-2 sm:p-2.5 bg-white border border-border text-text-muted hover:text-crimson rounded-button shadow-sm hover:shadow transition-all focus-ring disabled:opacity-70 disabled:cursor-not-allowed"
            title={isFullScreen ? "Exit Fullscreen" : "Fullscreen Mode"}
            aria-label={isFullScreen ? "Exit Fullscreen Mode" : "Enter Fullscreen Mode"}
          >
            {isFullScreen ? (
              <Minimize2 size={16} className="sm:w-[18px] sm:h-[18px]" />
            ) : (
              <Maximize2 size={16} className="sm:w-[18px] sm:h-[18px]" />
            )}
          </button>
          <button
            onClick={handleLocateMe}
            className="p-2 sm:p-2.5 bg-white border border-border text-text-muted hover:text-crimson rounded-button shadow-sm hover:shadow transition-all focus-ring"
            title="Locate Me"
            aria-label="Locate Me"
          >
            <Compass size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
          <button
            onClick={handleResetView}
            className="p-2 sm:p-2.5 bg-white border border-border text-text-muted hover:text-crimson rounded-button shadow-sm hover:shadow transition-all focus-ring"
            title="Reset View"
            aria-label="Reset View"
          >
            <RefreshCw size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
        </div>

        {/* Rich Floating Parish Info Overlay Card (Desktop: expanded split panel overlay, Mobile: bottom sheet style) */}
        {selectedParish && (
          <div className="absolute inset-0 pointer-events-none z-20">
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
