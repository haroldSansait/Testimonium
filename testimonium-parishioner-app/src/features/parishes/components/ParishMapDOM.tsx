'use dom';

import React, { useEffect, useMemo, useRef, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";

export interface ParishMapItem {
  id: string;
  name: string;
  type?: string;
  latitude: number;
  longitude: number;
  pinColor?: string | null;
  showLabel?: boolean | null;
  mapZoom?: number | null;
}

export interface ParishMapDOMProps {
  parishes: ParishMapItem[];
  selectedParishId?: string | null;
  onSelectParish?: (id: string) => void;
  resetSignal?: number;
  dom?: {
    scrollEnabled?: boolean;
    bounces?: boolean;
    style?: any;
    matchContents?: boolean;
  };
}

// Default San Carlos center & zoom
const DEFAULT_CENTER: [number, number] = [10.22, 123.25];
const DEFAULT_ZOOM = 9;

// Fix default marker icon issues with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Branded Church SVG icon matching the web portal and mobile design tokens
const createChurchIcon = (
  pinColor: string = "#7B1C2A",
  showLabel: boolean = true,
  title: string = "",
  isSelected: boolean = false
) => {
  const sanitizedPinColor = /^#[0-9A-Fa-f]{6}$/.test(pinColor) ? pinColor : "#7B1C2A";
  const sanitizedTitle = escapeHtml(title || "");
  const selectedClass = isSelected ? " selected" : "";

  return L.divIcon({
    html: `
      <div class="church-marker-wrapper${selectedClass}">
        ${isSelected ? '<div class="church-marker-halo"></div>' : ""}
        <svg
          class="church-marker-svg"
          width="38"
          height="42"
          viewBox="0 0 38 42"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
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

        ${
          showLabel && sanitizedTitle
            ? `<div class="church-marker-label${selectedClass}">${sanitizedTitle}</div>`
            : ""
        }
      </div>
    `,
    className: "custom-church-marker-div",
    iconSize: [44, 48],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44],
  });
};

// Map controller subcomponent that handles auto-fit, selection panning, and reset signals
const MapController: React.FC<{
  parishes: ParishMapItem[];
  selectedParishId?: string | null;
  resetSignal?: number;
}> = ({ parishes, selectedParishId, resetSignal }) => {
  const map = useMap();
  const hasInitializedBounds = useRef(false);

  // Invalidate map size on mount and window resize for accurate rendering in WebView
  useEffect(() => {
    const handleResize = () => {
      map.invalidateSize();
    };
    handleResize();
    const timer = setTimeout(handleResize, 150);
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);

  const fitAllParishes = useCallback(
    (animate = true) => {
      if (parishes.length > 0) {
        const validCoords = parishes
          .filter(
            (p) =>
              typeof p.latitude === "number" &&
              typeof p.longitude === "number" &&
              Number.isFinite(p.latitude) &&
              Number.isFinite(p.longitude)
          )
          .map((p) => [p.latitude, p.longitude] as [number, number]);

        if (validCoords.length > 0) {
          const bounds = L.latLngBounds(validCoords);
          if (bounds.isValid()) {
            map.fitBounds(bounds, {
              padding: [40, 40],
              maxZoom: 13,
              animate,
            });
            return;
          }
        }
      }
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate });
    },
    [parishes, map]
  );

  // Initial fit once markers are loaded
  useEffect(() => {
    if (!hasInitializedBounds.current && parishes.length > 0) {
      hasInitializedBounds.current = true;
      fitAllParishes(false);
    }
  }, [parishes, fitAllParishes]);

  // Respond to reset signal from native button
  const prevResetSignal = useRef(resetSignal);
  useEffect(() => {
    if (resetSignal !== undefined && resetSignal !== prevResetSignal.current) {
      prevResetSignal.current = resetSignal;
      fitAllParishes(true);
    }
  }, [resetSignal, fitAllParishes]);

  // Adjust camera when a parish is selected so pin remains visible above bottom sheet
  const prevSelectedId = useRef(selectedParishId);
  useEffect(() => {
    if (selectedParishId && selectedParishId !== prevSelectedId.current) {
      prevSelectedId.current = selectedParishId;
      const parish = parishes.find((p) => p.id === selectedParishId);
      if (parish && typeof parish.latitude === "number" && typeof parish.longitude === "number") {
        const targetZoom = Math.max(map.getZoom(), parish.mapZoom || 13);
        map.setView([parish.latitude, parish.longitude], targetZoom, { animate: true });

        // Offset the map downward so the marker sits higher in the top portion of the screen
        const offsetTimer = setTimeout(() => {
          const verticalOffset = Math.round(window.innerHeight * 0.16);
          map.panBy([0, verticalOffset], { animate: true });
        }, 120);

        return () => clearTimeout(offsetTimer);
      }
    } else if (!selectedParishId) {
      prevSelectedId.current = null;
    }
  }, [selectedParishId, parishes, map]);

  return null;
};

export default function ParishMapDOM({
  parishes = [],
  selectedParishId,
  onSelectParish,
  resetSignal,
}: ParishMapDOMProps) {
  const mapRef = useRef<L.Map | null>(null);

  const handleMarkerClick = useCallback(
    (id: string) => {
      if (onSelectParish) {
        onSelectParish(id);
      }
    },
    [onSelectParish]
  );

  const markers = useMemo(() => {
    return parishes
      .filter(
        (p) =>
          typeof p.latitude === "number" &&
          typeof p.longitude === "number" &&
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude)
      )
      .map((p) => {
        const isSelected = p.id === selectedParishId;
        const icon = createChurchIcon(
          p.pinColor || "#7B1C2A",
          p.showLabel !== false,
          p.name,
          isSelected
        );

        return (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={icon}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{
              click: () => handleMarkerClick(p.id),
            }}
          />
        );
      });
  }, [parishes, selectedParishId, handleMarkerClick]);

  return (
    <div className="parish-map-container">
      <style>{`
        html, body, #root, .parish-map-container {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
          background-color: #F8F8F7;
          -webkit-tap-highlight-color: transparent;
        }

        .leaflet-container {
          width: 100%;
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .church-marker-wrapper {
          position: relative;
          width: 44px;
          height: 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .church-marker-wrapper.selected {
          transform: scale(1.18);
        }

        .church-marker-svg {
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
        }

        .church-marker-wrapper.selected .church-marker-svg {
          filter: drop-shadow(0 0 6px rgba(123, 28, 42, 0.85)) drop-shadow(0 2px 5px rgba(0, 0, 0, 0.45));
        }

        .church-marker-halo {
          position: absolute;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(123, 28, 42, 0.12);
          border: 2px solid #7B1C2A;
          top: 2px;
          left: 0;
          pointer-events: none;
          animation: church-pulse 2s infinite ease-in-out;
        }

        @keyframes church-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.22);
            opacity: 0.35;
          }
        }

        .church-marker-label {
          position: absolute;
          top: 44px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          text-align: center;
          background-color: #FFFFFF;
          color: #181719;
          font-size: 10px;
          font-weight: 600;
          line-height: 1.2;
          padding: 2.5px 6px;
          border-radius: 5px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.18);
          border: 1px solid #E7E4E5;
          pointer-events: none;
          user-select: none;
          max-width: 130px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .church-marker-label.selected {
          background-color: #FBF4F5;
          color: #7B1C2A;
          border-color: #7B1C2A;
          font-weight: 700;
          box-shadow: 0 2px 6px rgba(123, 28, 42, 0.28);
        }

        /* Positioning zoom controls neatly on top-left */
        .leaflet-top.leaflet-left {
          top: 10px;
          left: 10px;
        }

        .leaflet-touch .leaflet-bar {
          border: 1px solid #D7D2D4;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
          border-radius: 8px;
          overflow: hidden;
        }

        .leaflet-touch .leaflet-bar a {
          width: 38px;
          height: 38px;
          line-height: 38px;
          font-size: 18px;
          color: #181719;
          background-color: #FFFFFF;
        }

        .leaflet-touch .leaflet-bar a:hover,
        .leaflet-touch .leaflet-bar a:active {
          background-color: #F8F8F7;
          color: #7B1C2A;
        }

        /* Attribution styling */
        .leaflet-control-attribution {
          background: rgba(255, 255, 255, 0.88) !important;
          font-size: 9px !important;
          padding: 2px 6px !important;
          border-radius: 4px 0 0 0 !important;
          color: #5F5B60 !important;
        }

        .leaflet-control-attribution a {
          color: #7B1C2A !important;
          text-decoration: none !important;
        }
      `}</style>

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={true}
        scrollWheelZoom={true}
        attributionControl={true}
        className="parish-map-container"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapController
          parishes={parishes}
          selectedParishId={selectedParishId}
          resetSignal={resetSignal}
        />
        {markers}
      </MapContainer>
    </div>
  );
}
