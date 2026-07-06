export function CalendarLegend() {
  const items = [
    { color: 'bg-crimson-800', label: 'Mass Schedule' },
    { color: 'bg-rose-100 border border-rose-200', label: 'Confirmed Sacrament (Baptism/Wedding)' },
    { color: 'bg-gray-100 border border-gray-200', label: 'Admin / Meeting' },
    { isTentative: true, label: 'Tentative / Hold' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-5 px-4 py-3 border-t border-gray-200 mt-2">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">LEGEND:</span>
      {items.map((item) =>
        item.isTentative ? (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-dashed border-amber-400 rounded-sm inline-block" />
            <span className="text-xs text-gray-600">{item.label}</span>
          </div>
        ) : (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`w-4 h-4 rounded-sm inline-block ${item.color}`} />
            <span className="text-xs text-gray-600">{item.label}</span>
          </div>
        )
      )}
    </div>
  );
}
