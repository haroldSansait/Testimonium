import { useMemo } from 'react';
import { Calendar, Award } from 'lucide-react';

export interface WeekdayRow {
  weekday?: number;
  count?: number;
  _count?: number;
  [key: string]: unknown;
}

interface WeekdayActivityChartProps {
  title?: string;
  rows: WeekdayRow[];
  emptyMessage?: string;
  animationKey?: number | string;
}

const WEEKDAY_NAMES = [
  { id: 1, short: 'Mon', full: 'Monday' },
  { id: 2, short: 'Tue', full: 'Tuesday' },
  { id: 3, short: 'Wed', full: 'Wednesday' },
  { id: 4, short: 'Thu', full: 'Thursday' },
  { id: 5, short: 'Fri', full: 'Friday' },
  { id: 6, short: 'Sat', full: 'Saturday' },
  { id: 7, short: 'Sun', full: 'Sunday' },
];

export function WeekdayActivityChart({
  title = 'Busiest Requested Weekdays',
  rows,
  emptyMessage = 'No weekday scheduling data for this period.',
  animationKey,
}: WeekdayActivityChartProps) {
  const daysData = useMemo(() => {
    const countByWeekday = new Map<number, number>();
    for (const r of rows) {
      const dayNum = Number(r.weekday ?? 0);
      const count = Number(r.count ?? r._count ?? 0);
      if (dayNum >= 1 && dayNum <= 7) {
        countByWeekday.set(dayNum, count);
      }
    }

    return WEEKDAY_NAMES.map((d) => ({
      ...d,
      count: countByWeekday.get(d.id) || 0,
    }));
  }, [rows]);

  const maxVal = useMemo(() => {
    return Math.max(1, ...daysData.map((d) => d.count));
  }, [daysData]);

  const peakDay = useMemo(() => {
    const active = daysData.filter((d) => d.count > 0);
    if (active.length === 0) return null;
    return [...active].sort((a, b) => b.count - a.count)[0];
  }, [daysData]);

  const total = useMemo(() => {
    return daysData.reduce((acc, curr) => acc + curr.count, 0);
  }, [daysData]);

  return (
    <div key={animationKey ?? 'weekday-root'} className="space-y-4">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .animate-weekday-cell {
            animation: weekdayCellFade 400ms ease-out backwards;
          }
          .animate-col-grow {
            animation: colGrowVertical 500ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
            transform-origin: bottom;
          }
        }
        @keyframes weekdayCellFade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes colGrowVertical {
          from {
            transform: scaleY(0);
            opacity: 0.2;
          }
          to {
            transform: scaleY(1);
            opacity: 1;
          }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">{title}</h3>
          <p className="text-[11px] font-medium text-gray-400">
            Distribution by sacrament requested date
          </p>
        </div>

        {peakDay && peakDay.count > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
            <Award className="h-3 w-3 text-amber-600" />
            Busiest: {peakDay.full} ({peakDay.count.toLocaleString()})
          </span>
        )}
      </div>

      {total === 0 ? (
        <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 p-4 text-center">
          <Calendar className="h-4 w-4 text-gray-300" />
          <p className="mt-1 text-xs font-medium text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {daysData.map((d) => {
            const isPeak = peakDay?.id === d.id && d.count > 0;
            const pctOfMax = Math.round((d.count / maxVal) * 100);

            return (
              <div
                key={d.id}
                style={{ animationDelay: `${(d.id - 1) * 35}ms` }}
                className={`flex flex-col items-center justify-between rounded-xl border p-2.5 sm:p-3 text-center transition-all animate-weekday-cell ${
                  isPeak
                    ? 'border-crimson-200 bg-crimson-50/50 shadow-2xs'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    isPeak ? 'text-crimson-800' : 'text-gray-500'
                  }`}
                >
                  {d.short}
                </span>

                <div className="my-2.5 flex h-20 w-full items-end justify-center">
                  <div
                    className={`w-full max-w-7 rounded-t-md transition-all duration-300 animate-col-grow ${
                      isPeak ? 'bg-crimson-700' : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                    style={{
                      height: `${Math.max(6, (pctOfMax / 100) * 80)}px`,
                      animationDelay: `${(d.id - 1) * 35}ms`,
                    }}
                  />
                </div>

                <div className="space-y-0.5">
                  <span
                    className={`block text-xs font-extrabold ${
                      isPeak ? 'text-crimson-900' : 'text-gray-800'
                    }`}
                  >
                    {d.count.toLocaleString()}
                  </span>
                  <span className="block text-[9.5px] font-medium text-gray-400">
                    {total > 0 ? `${Math.round((d.count / total) * 100)}%` : '0%'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
