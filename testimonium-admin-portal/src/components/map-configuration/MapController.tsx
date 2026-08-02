import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

interface MapControllerProps {
  center: [number, number];
  zoom: number;
  locateTrigger?: number;
}

export function MapController({ center, zoom, locateTrigger }: MapControllerProps) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, {
      animate: true,
      duration: 0.7, // 700ms (within the 600-800ms requirement)
    });
  }, [center, zoom, map, locateTrigger]);

  return null;
}
