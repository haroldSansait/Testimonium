import React from 'react';
import { getPriestColor } from '@/utils/priestColors';
import type { ManagedUser } from '@/types';

interface CalendarLegendProps {
  priests: ManagedUser[];
}

export const CalendarLegend: React.FC<CalendarLegendProps> = ({ priests }) => {
  const items = [
    { color: 'bg-[#7B1C2A]', label: 'Mass Schedule' },
    { color: 'bg-rose-100 border border-rose-300 text-rose-800', label: 'Confirmed Sacrament' },
    { color: 'bg-gray-100 border border-gray-300 text-gray-700', label: 'Admin / Meeting' },
    { isTentative: true, label: 'Tentative / Hold' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 px-5 py-3.5 border-t border-gray-200 bg-gray-50/70 text-xs">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex-shrink-0">
        LEGEND:
      </span>
      {items.map((item) =>
        item.isTentative ? (
          <div key={item.label} className="flex items-center gap-2 flex-shrink-0">
            <span className="w-3.5 h-3.5 border-2 border-dashed border-amber-400 rounded-sm inline-block bg-white shadow-xs" />
            <span className="text-gray-600 font-medium">{item.label}</span>
          </div>
        ) : (
          <div key={item.label} className="flex items-center gap-2 flex-shrink-0">
            <span className={`w-3.5 h-3.5 rounded-sm inline-block shadow-xs ${item.color}`} />
            <span className="text-gray-600 font-medium">{item.label}</span>
          </div>
        )
      )}

      {priests.length > 0 && (
        <>
          <div className="h-4 w-px bg-gray-200 hidden md:block" />
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex-shrink-0">
              Priests:
            </span>
            {priests.map((p) => {
              const hexColor = p.color || getPriestColor(p.name).hex;
              return (
                <div key={p.id} className="flex items-center gap-1.5 flex-shrink-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-block border shadow-xs"
                    style={{
                      backgroundColor: hexColor || '#7B1C2A',
                      borderColor: '#ffffff',
                    }}
                  />
                  <span className="text-gray-700 font-semibold">{p.name}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

