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
}

// Custom branded SVG church marker icon matching Testimonium branding (white church inside deep crimson circle)
const customChurchIcon = L.divIcon({
  html: `
    <div style="background-color: #7B1C2A;" class="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-md hover:scale-110 transition-transform duration-150 cursor-pointer">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 15px; height: 15px;">
        <path d="M3 21h18" />
        <path d="M12 2v4" />
        <path d="M10 4h4" />
        <path d="M12 8L4 14v7h16v-7z" />
        <path d="M10 21v-4a2 2 0 0 1 4 0v4" />
      </svg>
    </div>
  `,
  className: 'custom-church-marker-div',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

export const MapMarker: React.FC<MapMarkerProps> = ({ position, title, description, children, onClick }) => {
  const eventHandlers = React.useMemo(() => ({
    click() {
      if (onClick) {
        onClick();
      }
    }
  }), [onClick]);

  return (
    <Marker position={[position.lat, position.lng]} icon={customChurchIcon} eventHandlers={eventHandlers}>
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
