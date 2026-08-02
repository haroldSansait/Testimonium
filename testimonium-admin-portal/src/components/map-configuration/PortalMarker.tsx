import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Marker } from 'react-leaflet';
import L from 'leaflet';

interface PortalMarkerProps {
  position: L.LatLngExpression;
  draggable?: boolean;
  eventHandlers?: L.LeafletEventHandlerFnMap;
  children: React.ReactNode;
}

export function PortalMarker({ position, draggable, eventHandlers, children }: PortalMarkerProps) {
  const markerRef = useRef<L.Marker>(null);
  const [portalRoot, setPortalRoot] = useState<Element | null>(null);

  // Custom DivIcon that hosts our React Portal root
  const customIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-leaflet-portal-marker',
      html: '<div class="marker-portal-root"></div>',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });
  }, []);

  // Sync state with DOM once mounted or moved
  useEffect(() => {
    const marker = markerRef.current;
    if (marker) {
      const el = marker.getElement();
      if (el) {
        const root = el.querySelector('.marker-portal-root');
        if (root) {
          setPortalRoot(root);
        }
      }
    }
  }, [position]);

  return (
    <Marker
      ref={markerRef}
      position={position}
      draggable={draggable}
      eventHandlers={eventHandlers}
      icon={customIcon}
    >
      {portalRoot && createPortal(children, portalRoot)}
    </Marker>
  );
}
