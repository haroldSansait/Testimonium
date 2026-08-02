import React from 'react';
import { MapMarker } from '../../../components/maps/MapMarker';
import type { Parish } from '../../../types';

interface ParishMarkerProps {
  parish: Parish;
  position: { lat: number; lng: number };
  onClick?: () => void;
}

export const ParishMarker: React.FC<ParishMarkerProps> = ({ parish, position, onClick }) => {
  return (
    <MapMarker
      position={position}
      title={parish.name}
      description={`Feast Day: ${parish.feastDay}`}
      pinColor={parish.pinColor}
      showLabel={parish.showLabel}
      onClick={onClick}
    />
  );
};

export default ParishMarker;
