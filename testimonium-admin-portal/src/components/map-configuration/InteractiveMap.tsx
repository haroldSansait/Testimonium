import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { ParishMarker, DIOCESE_CENTER } from './ParishMarker';
import { MapController } from './MapController';
import type { Parish } from '@/types';

// Import Leaflet styles
import 'leaflet/dist/leaflet.css';

interface InteractiveMapProps {
  parishes: Parish[];
  selectedId: string | null;
  drafts: Record<string, Partial<Parish>>;
  saveSuccessIds: string[];
  onSelectParish: (id: string) => void;
  onUpdateDraftCoords: (id: string, lat: number, lng: number) => void;
  locateTrigger: number;
  isFullScreen?: boolean;
}

// MapResizer triggers map.invalidateSize() when container size/fullscreen state changes
function MapResizer({ isFullScreen }: { isFullScreen: boolean }) {
  const map = useMap();
  const prevFullScreen = useRef(isFullScreen);

  useEffect(() => {
    if (prevFullScreen.current !== isFullScreen) {
      prevFullScreen.current = isFullScreen;

      // Entering/Exiting fullscreen: delay slightly to allow container animation (300ms) to finish
      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
          map.invalidateSize();
        });
      }, 350);

      return () => clearTimeout(timer);
    }
  }, [isFullScreen, map]);

  return null;
}

export function InteractiveMap({
  parishes,
  selectedId,
  drafts,
  saveSuccessIds,
  onSelectParish,
  onUpdateDraftCoords,
  locateTrigger,
  isFullScreen = false
}: InteractiveMapProps) {
  // Determine map center and zoom for flyTo auto-focus
  const flyToConfig = React.useMemo(() => {
    if (!selectedId) return null;
    const parish = parishes.find((p) => p.id === selectedId);
    if (!parish) return null;

    // Read from draft coordinate if exists, otherwise original coordinate, otherwise center fallback
    const draft = drafts[selectedId];
    const lat = draft?.latitude ?? parish.latitude ?? DIOCESE_CENTER[0];
    const lng = draft?.longitude ?? parish.longitude ?? DIOCESE_CENTER[1];
    const zoom = draft?.mapZoom ?? parish.mapZoom ?? 13;

    return {
      center: [lat, lng] as [number, number],
      zoom: Number(zoom)
    };
  }, [selectedId, parishes, drafts]);

  return (
    <div className="w-full h-full relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50 shadow-inner">
      <MapContainer
        center={DIOCESE_CENTER}
        zoom={11}
        className="w-full h-full z-10"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Resizer component to handle fullscreen sizes */}
        <MapResizer isFullScreen={isFullScreen} />

        {/* Dynamic Map controller to animate transitions */}
        {flyToConfig && (
          <MapController 
            selectedId={selectedId!}
            center={flyToConfig.center} 
            zoom={flyToConfig.zoom} 
            locateTrigger={locateTrigger}
          />
        )}

        {/* Render markers for each parish */}
        {parishes.map((parish) => {
          const isSelected = parish.id === selectedId;
          const draft = drafts[parish.id];
          const isDirty = draft?.latitude !== undefined || draft?.longitude !== undefined;
          const isSaveSuccess = saveSuccessIds.includes(parish.id);

          // Get current visual coordinates
          const visualParish = {
            ...parish,
            latitude: draft?.latitude !== undefined ? draft.latitude : parish.latitude,
            longitude: draft?.longitude !== undefined ? draft.longitude : parish.longitude,
            pinColor: draft?.pinColor !== undefined ? draft.pinColor : parish.pinColor,
            showLabel: draft?.showLabel !== undefined ? draft.showLabel : parish.showLabel,
          };

          return (
            <ParishMarker
              key={parish.id}
              parish={visualParish}
              isSelected={isSelected}
              isDirty={isDirty}
              isSaveSuccess={isSaveSuccess}
              onSelect={onSelectParish}
              onDragEnd={onUpdateDraftCoords}
            />
          );
        })}
      </MapContainer>

      {/* graceful fallback message if map fails */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-[11px] text-gray-500 font-medium py-1 px-2.5 rounded shadow z-20 pointer-events-none select-none border border-gray-100">
        OSM Map Canvas
      </div>
    </div>
  );
}

