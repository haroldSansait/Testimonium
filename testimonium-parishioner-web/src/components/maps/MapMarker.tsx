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
          width="36"
          height="44"
          viewBox="0 0 36 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));"
        >
          <!-- Outer Pin Teardrop Shape -->
          <path
            d="M18 0C8.05887 0 0 8.05887 0 18C0 29.5 18 44 18 44C18 44 36 29.5 36 18C36 8.05887 27.9411 0 18 0Z"
            fill="${sanitizedPinColor}"
          />
          <!-- Inner Circle Glow Ring -->
          <circle cx="18" cy="18" r="13" fill="#FFFFFF" fill-opacity="0.2" />
          <circle cx="18" cy="18" r="11" fill="#FFFFFF" />
          <!-- Church / Cross Icon -->
          <path
            d="M18 9V24M14.5 13.5H21.5M12.5 24H23.5M13.5 24V21L18 17.5L22.5 21V24H13.5Z"
            stroke="${sanitizedPinColor}"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="${sanitizedPinColor}"
            fill-opacity="0.15"
          />
        </svg>

        ${showLabel && sanitizedTitle ? `
          <div class="absolute top-11 whitespace-nowrap bg-gray-900/90 text-white text-[10px] px-1.5 py-0.5 rounded shadow border border-gray-700 pointer-events-none select-none font-medium z-[1001]">
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
