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

// Branded SVG teardrop pin icon matching coordinator portal
const createBrandedIcon = (pinColor: string = '#7B1C2A', showLabel: boolean = true, title: string = '') => {
  return L.divIcon({
    html: `
      <div class="relative w-10 h-10 flex flex-col items-center justify-center focus:outline-none hover:scale-110 transition-transform duration-150 cursor-pointer">
        <svg
          width="34"
          height="40"
          viewBox="0 0 34 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));"
        >
          <path
            d="M17 0C7.61 0 0 7.61 0 17C0 27.8 17 40 17 40C17 40 34 27.8 34 17C34 7.61 26.39 0 17 0Z"
            fill="${pinColor}"
          />
          <circle cx="17" cy="16" r="6" fill="#FFFFFF" />
        </svg>

        ${showLabel && title ? `
          <div class="absolute top-10 whitespace-nowrap bg-gray-900/90 text-white text-[10px] px-1.5 py-0.5 rounded shadow border border-gray-700 pointer-events-none select-none font-medium z-[1001]">
            ${title}
          </div>
        ` : ''}
      </div>
    `,
    className: 'custom-church-marker-div',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
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
