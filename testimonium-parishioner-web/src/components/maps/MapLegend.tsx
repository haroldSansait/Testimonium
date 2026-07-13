import React from 'react';

interface LegendItem {
  color: string;
  label: string;
}

interface MapLegendProps {
  items: LegendItem[];
  className?: string;
}

export const MapLegend: React.FC<MapLegendProps> = ({ items, className = '' }) => {
  return (
    <div className={`p-3 bg-white border border-border rounded-button shadow-sm text-xs space-y-1.5 ${className}`}>
      <h5 className="font-bold text-text-primary uppercase tracking-wider text-[10px] mb-1">Map Legend</h5>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
          <span className="text-text-muted">{item.label}</span>
        </div>
      ))}
    </div>
  );
};
export default MapLegend;
