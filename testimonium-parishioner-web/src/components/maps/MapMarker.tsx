import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { MapPosition } from './LeafletMap';

interface MapMarkerProps {
  position: MapPosition;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  pinColor?: string;
  showLabel?: boolean;
}

// Branded Church SVG pin icon matching parishioner & coordinator portals
const createBrandedIcon = (pinColor: string = '#7B1C2A', showLabel: boolean = true, title: string = '') => {
  const sanitizedPinColor = /^#[0-9A-Fa-f]{6}$/.test(pinColor) ? pinColor : '#7B1C2A';
  const sanitizedTitle = (title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return L.divIcon({
    html: `
      <div class="relative w-11 h-12 flex flex-col items-center justify-center focus:outline-none hover:scale-115 transition-transform duration-150 cursor-pointer">
        <svg
          width="38"
          height="42"
          viewBox="0 0 38 42"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));"
        >
          <!-- Latin Cross -->
          <path d="M17 2H21V6H26V9.5H21V13H17V9.5H12V6H17V2Z" fill="${sanitizedPinColor}" />
          <!-- Belfry / Bell Tower -->
          <rect x="11.5" y="12.5" width="15" height="2" rx="0.5" fill="${sanitizedPinColor}" />
          <rect x="12.5" y="14.5" width="13" height="4.5" fill="${sanitizedPinColor}" />
          <path d="M17 19V16.5C17 15.4 17.9 14.5 19 14.5C20.1 14.5 21 15.4 21 16.5V19H17Z" fill="#FFFFFF" />
          <!-- Main Church Body & Gable Roof -->
          <path d="M19 15L2 25V40.5H36V25L19 15Z" fill="${sanitizedPinColor}" />
          <!-- Roof Trim / Eaves Dark Line for Definition -->
          <path d="M1.5 25.5L19 15.5L36.5 25.5" stroke="rgba(0,0,0,0.35)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          <!-- Center Arched Doorway -->
          <path d="M13.5 40.5V31.5C13.5 28.46 15.96 26 19 26C22.04 26 24.5 28.46 24.5 31.5V40.5H13.5Z" fill="#FFFFFF" />
          <!-- Left Window -->
          <rect x="5.5" y="26.5" width="5.5" height="8.5" rx="2.75" fill="#FFFFFF" />
          <!-- Right Window -->
          <rect x="27" y="26.5" width="5.5" height="8.5" rx="2.75" fill="#FFFFFF" />
        </svg>

        ${showLabel && sanitizedTitle ? `
          <div class="absolute top-[43px] left-1/2 -translate-x-1/2 whitespace-nowrap text-center bg-white text-gray-800 text-[9px] font-medium px-1.5 py-0.5 rounded shadow-sm border border-gray-200 pointer-events-none select-none z-[1001]">
            ${sanitizedTitle}
          </div>
        ` : ''}
      </div>
    `,
    className: 'custom-church-marker-div',
    iconSize: [44, 48],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44]
  });
};

export const MapMarker: React.FC<MapMarkerProps> = ({ 
  position, 
  title, 
  description, 
  children, 
  onClick,
  pinColor = '#7B1C2A',
  showLabel = true
}) => {
  const eventHandlers = React.useMemo(() => ({
    click() {
      if (onClick) {
        onClick();
      }
    }
  }), [onClick]);

  const dynamicIcon = React.useMemo(() => {
    return createBrandedIcon(pinColor, showLabel, title);
  }, [pinColor, showLabel, title]);

  return (
    <Marker position={[position.lat, position.lng]} icon={dynamicIcon} eventHandlers={eventHandlers}>
      {(title || description || children) && (
        <Popup>
          <div className="space-y-1 text-xs">
            {title && <h4 className="font-bold text-text-primary font-serif m-0">{title}</h4>}
            {description && <p className="text-text-muted m-0 mt-0.5">{description}</p>}
            {children}
          </div>
        </Popup>
      )}
    </Marker>
  );
};

export default MapMarker;
