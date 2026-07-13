import React, { createContext, useContext } from 'react';

interface MapContextProps {
  providerName: 'leaflet' | 'google' | 'mapbox';
}

const MapContext = createContext<MapContextProps>({ providerName: 'leaflet' });

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <MapContext.Provider value={{ providerName: 'leaflet' }}>
      {children}
    </MapContext.Provider>
  );
};

export const useMapContext = () => useContext(MapContext);
