import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapPosition {
  lat: number;
  lng: number;
}

export interface LeafletMapProps {
  center: MapPosition;
  zoom?: number;
  className?: string;
  children?: React.ReactNode;
}

// Fix default marker icon issues in Leaflet with Webpack/Vite bundles
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// A helper subcomponent that calls Leaflet's useMap() hook to update the view reactively.
const MapViewUpdater: React.FC<{ center: MapPosition; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center.lat, center.lng, zoom, map]);
  return null;
};

export const LeafletMap: React.FC<LeafletMapProps> = ({ 
  center, 
  zoom = 13, 
  className = 'h-96 w-full rounded-card overflow-hidden border border-border shadow-sm', 
  children 
}) => {
  return (
    <MapContainer 
      center={[center.lat, center.lng]} 
      zoom={zoom} 
      className={`${className} relative isolate`}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewUpdater center={center} zoom={zoom} />
      {children}
    </MapContainer>
  );
};

export default LeafletMap;
