import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

interface MapControllerProps {
  center: [number, number];
  zoom: number;
  selectedId: string;
  locateTrigger?: number;
}

export function MapController({ center: [latitude, longitude], zoom, selectedId, locateTrigger }: MapControllerProps) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([latitude, longitude], zoom, {
      animate: true,
      duration: 0.7, // 700ms (within the 600-800ms requirement)
    });
  }, [latitude, longitude, zoom, selectedId, map, locateTrigger]);

  return null;
}
