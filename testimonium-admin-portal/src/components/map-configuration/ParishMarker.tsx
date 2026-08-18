import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PortalMarker } from './PortalMarker';
import type { Parish } from '@/types';
import L from 'leaflet';

interface ParishMarkerProps {
  parish: Parish;
  isSelected: boolean;
  isDirty: boolean;
  isSaveSuccess: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, lat: number, lng: number) => void;
}

// Bounding box for Diocese boundary
const DIOCESE_BOUNDS = {
  minLat: 10.0,
  maxLat: 11.0,
  minLng: 123.0,
  maxLng: 123.6
};

// Diocese Center as fallback for new parishes
export const DIOCESE_CENTER: [number, number] = [10.4377, 123.2582];

export const ParishMarker = React.memo(
  function ParishMarker({
    parish,
    isSelected,
    isDirty,
    isSaveSuccess,
    onSelect,
    onDragEnd
  }: ParishMarkerProps) {
    // Use coordinates, fallback to Diocese center if null
    const lat = parish.latitude !== null && parish.latitude !== undefined ? parish.latitude : DIOCESE_CENTER[0];
    const lng = parish.longitude !== null && parish.longitude !== undefined ? parish.longitude : DIOCESE_CENTER[1];
    const needsLocation = parish.latitude === null || parish.latitude === undefined;

    const position: L.LatLngTuple = [lat, lng];
    const defaultColor = '#7B1C2A';
    const pinColor = needsLocation ? '#6b7280' : (/^#[0-9A-Fa-f]{6}$/.test(parish.pinColor || '') ? parish.pinColor! : defaultColor);

    // Keyboard nudging handler for accessibility
    const handleKeyDown = (e: React.KeyboardEvent) => {
      const nudgeAmount = 0.00005; // ~5 meters
      let newLat = lat;
      let newLng = lng;

      switch (e.key) {
        case 'ArrowUp':
          newLat += nudgeAmount;
          break;
        case 'ArrowDown':
          newLat -= nudgeAmount;
          break;
        case 'ArrowLeft':
          newLng -= nudgeAmount;
          break;
        case 'ArrowRight':
          newLng += nudgeAmount;
          break;
        default:
          return; // Ignore other keys
      }

      e.preventDefault();

      // Clamp coordinates to diocese boundaries
      newLat = Math.max(DIOCESE_BOUNDS.minLat, Math.min(DIOCESE_BOUNDS.maxLat, newLat));
      newLng = Math.max(DIOCESE_BOUNDS.minLng, Math.min(DIOCESE_BOUNDS.maxLng, newLng));

      onDragEnd(parish.id, newLat, newLng);
    };

    // Leaflet Marker events
    const eventHandlers = React.useMemo(() => ({
      click: () => {
        onSelect(parish.id);
      },
      drag: (e: any) => {
        const marker = e.target;
        const pos = marker.getLatLng();
        
        // Clamp coordinates continuously during dragging
        const clampedLat = Math.max(DIOCESE_BOUNDS.minLat, Math.min(DIOCESE_BOUNDS.maxLat, pos.lat));
        const clampedLng = Math.max(DIOCESE_BOUNDS.minLng, Math.min(DIOCESE_BOUNDS.maxLng, pos.lng));
        
        if (clampedLat !== pos.lat || clampedLng !== pos.lng) {
          marker.setLatLng([clampedLat, clampedLng]);
        }
      },
      dragend: (e: any) => {
        const marker = e.target;
        const pos = marker.getLatLng();
        
        // Clamp coordinates to diocese boundaries
        const finalLat = Math.max(DIOCESE_BOUNDS.minLat, Math.min(DIOCESE_BOUNDS.maxLat, pos.lat));
        const finalLng = Math.max(DIOCESE_BOUNDS.minLng, Math.min(DIOCESE_BOUNDS.maxLng, pos.lng));
        
        onDragEnd(parish.id, finalLat, finalLng);
      }
    }), [onSelect, onDragEnd, parish.id]);

    return (
      <PortalMarker
        position={position}
        draggable={true}
        eventHandlers={eventHandlers}
      >
        <div 
          className="relative w-11 h-12 flex items-center justify-center focus:outline-none"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          aria-label={`${parish.name} church marker. Use arrow keys to nudge position.`}
        >
          <AnimatePresence>
            {/* Unsaved Changes orange outer ring glow */}
            {isDirty && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.3, opacity: [0.3, 0.6, 0.3] }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute w-11 h-11 rounded-full bg-amber-500/30 blur-sm pointer-events-none"
              />
            )}

            {/* Selected Ring */}
            {isSelected && (
              <motion.div
                layoutId="selected-marker-ring"
                className="absolute -inset-2 rounded-full border-2 border-white bg-red-500/10 shadow-lg pointer-events-none"
                style={{ borderColor: pinColor }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              />
            )}

            {/* Success Save Pulse */}
            {isSaveSuccess && (
              <motion.div
                initial={{ scale: 0.8, opacity: 1 }}
                animate={{ scale: 2.2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="absolute w-11 h-11 rounded-full bg-emerald-500 pointer-events-none"
              />
            )}
          </AnimatePresence>

          {/* Pin Body Container */}
          <motion.div
            whileHover={{ scale: 1.15, y: -4 }}
            whileTap={{ scale: 0.95 }}
            className="relative cursor-grab active:cursor-grabbing"
          >
            {/* Church SVG Pin */}
            <svg
              width="36"
              height="44"
              viewBox="0 0 36 44"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)]"
            >
              {/* Outer Pin Teardrop Shape */}
              <path
                d="M18 0C8.05887 0 0 8.05887 0 18C0 29.5 18 44 18 44C18 44 36 29.5 36 18C36 8.05887 27.9411 0 18 0Z"
                fill={pinColor}
              />
              {/* Inner Circle Glow Ring */}
              <circle cx="18" cy="18" r="13" fill="#FFFFFF" fillOpacity="0.2" />
              <circle cx="18" cy="18" r="11" fill="#FFFFFF" />
              {/* Church / Cross Icon */}
              <path
                d="M18 9V24M14.5 13.5H21.5M12.5 24H23.5M13.5 24V21L18 17.5L22.5 21V24H13.5Z"
                stroke={pinColor}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={pinColor}
                fillOpacity="0.15"
              />
            </svg>

            {/* Red "Needs Location" tiny badge */}
            {needsLocation && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 border border-white"></span>
              </span>
            )}

            {/* Unsaved indicator tiny badge */}
            {isDirty && !needsLocation && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border border-white"></span>
              </span>
            )}
          </motion.div>

          {/* Pin label (conditionally shown) */}
          {(parish.showLabel ?? true) && (
            <div className="absolute top-11 whitespace-nowrap bg-gray-900/90 text-white text-[10px] px-1.5 py-0.5 rounded shadow border border-gray-700 pointer-events-none select-none font-medium z-[1001]">
              {parish.name}
            </div>
          )}
        </div>
      </PortalMarker>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isDirty === nextProps.isDirty &&
      prevProps.isSaveSuccess === nextProps.isSaveSuccess &&
      prevProps.parish.id === nextProps.parish.id &&
      prevProps.parish.latitude === nextProps.parish.latitude &&
      prevProps.parish.longitude === nextProps.parish.longitude &&
      prevProps.parish.pinColor === nextProps.parish.pinColor &&
      prevProps.parish.showLabel === nextProps.parish.showLabel
    );
  }
);

