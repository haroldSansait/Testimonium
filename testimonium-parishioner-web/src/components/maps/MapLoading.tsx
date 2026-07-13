import React from 'react';
import { Spinner } from '../ui/Spinner';

interface MapLoadingProps {
  message?: string;
}

export const MapLoading: React.FC<MapLoadingProps> = ({ message = 'Loading Map Data...' }) => {
  return (
    <div className="h-96 w-full rounded-card bg-app-page border border-border/60 flex flex-col items-center justify-center space-y-3">
      <Spinner size="lg" className="text-crimson" />
      <span className="text-xs font-medium text-text-muted">{message}</span>
    </div>
  );
};
export default MapLoading;
