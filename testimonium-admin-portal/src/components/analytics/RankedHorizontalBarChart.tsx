import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';

export interface CategoryCountRow {
  [key: string]: unknown;
  _count?: number;
  count?: number;
}

interface RankedHorizontalBarChartProps {
  title: string;
  rows: CategoryCountRow[];
  emptyMessage?: string;
  badgeLabel?: string;
  animationKey?: number | string;
}

function labelFor(row: CategoryCountRow): string {
  const entry = Object.entries(row).find(([key]) => !['_count', 'count'].includes(key));
  return String(entry?.[1] ?? 'Unknown').replaceAll('_', ' ');
}

export function RankedHorizontalBarChart({
  title,
  rows,
  emptyMessage = 'No category records for this period.',
  badgeLabel,
  animationKey,
}: RankedHorizontalBarChartProps) {
  const sorted = useMemo(() => {
    return [...rows]
      .map((r) => ({
        label: labelFor(r),
        count: Number(r._count ?? r.count ?? 0),
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  const maxVal = useMemo(() => {
    return Math.max(1, ...sorted.map((s) => s.count));
  }, [sorted]);

  const total = useMemo(() => {
    return sorted.reduce((acc, curr) => acc + curr.count, 0);
  }, [sorted]);

  return (
    <div key={animationKey ?? 'bar-root'} className="space-y-3.5">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .animate-bar-grow {
            animation: barGrowHorizontal 450ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
            transform-origin: left;
          }
        }
        @keyframes barGrowHorizontal {
          from {
            transform: scaleX(0);
            opacity: 0.2;
          }
          to {
            transform: scaleX(1);
            opacity: 1;
          }
        }
      `}</style>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">{title}</h3>
        {badgeLabel && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-crimson-700 bg-crimson-50 px-2 py-0.5 rounded">
            {badgeLabel}
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 p-4 text-center">
          <BarChart3 className="h-4 w-4 text-gray-300" />
          <p className="mt-1 text-xs font-medium text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {sorted.map((item, idx) => {
            const pctOfMax = Math.round((item.count / maxVal) * 100);
            const pctOfTotal = total > 0 ? Math.round((item.count / total) * 100) : 0;

            return (
              <div key={`${item.label}-${idx}`} className="group space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-gray-100 text-[10px] font-bold text-gray-500 group-hover:bg-crimson-50 group-hover:text-crimson-700 transition-colors">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-gray-700 capitalize truncate text-xs">
                      {item.label.toLowerCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-gray-900 text-xs">
                      {item.count.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-medium text-gray-400">
                      ({pctOfTotal}%)
                    </span>
                  </div>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-crimson-700/90 transition-all duration-300 group-hover:bg-crimson-700 animate-bar-grow"
                    style={{
                      width: `${Math.max(4, pctOfMax)}%`,
                      animationDelay: `${Math.min(idx * 35, 250)}ms`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
