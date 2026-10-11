import { useMemo } from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';

export interface StatusDistributionRow {
  [key: string]: unknown;
  _count?: number;
  count?: number;
}

interface StatusDonutChartProps {
  title: string;
  rows: StatusDistributionRow[];
  emptyMessage?: string;
  animationKey?: number | string;
}

// Domain status color mapping derived directly from TESTIMONIUM domain enums
const STATUS_COLORS: Record<string, { fill: string; badgeBg: string; text: string }> = {
  // Completed / Verified (Emerald)
  COMPLETED: { fill: '#10b981', badgeBg: 'bg-emerald-50', text: 'text-emerald-700' },
  VERIFIED: { fill: '#10b981', badgeBg: 'bg-emerald-50', text: 'text-emerald-700' },
  PAYMENT_VERIFIED: { fill: '#10b981', badgeBg: 'bg-emerald-50', text: 'text-emerald-700' },

  // Confirmed / Ready (Teal)
  CONFIRMED: { fill: '#0d9488', badgeBg: 'bg-teal-50', text: 'text-teal-700' },
  READY_FOR_PICKUP: { fill: '#0d9488', badgeBg: 'bg-teal-50', text: 'text-teal-700' },

  // In Processing / Review (Amber)
  PROCESSING: { fill: '#d97706', badgeBg: 'bg-amber-50', text: 'text-amber-700' },
  READY_FOR_SIGNING: { fill: '#d97706', badgeBg: 'bg-amber-50', text: 'text-amber-700' },
  UNDER_REVIEW: { fill: '#d97706', badgeBg: 'bg-amber-50', text: 'text-amber-700' },
  PAYMENT_UNDER_REVIEW: { fill: '#d97706', badgeBg: 'bg-amber-50', text: 'text-amber-700' },
  REQUESTED: { fill: '#d97706', badgeBg: 'bg-amber-50', text: 'text-amber-700' },

  // Initial / Pending (Blue)
  PENDING: { fill: '#2563eb', badgeBg: 'bg-blue-50', text: 'text-blue-700' },
  PAYMENT_PENDING: { fill: '#2563eb', badgeBg: 'bg-blue-50', text: 'text-blue-700' },
  WAITING_PARISHIONER_RESPONSE: { fill: '#3b82f6', badgeBg: 'bg-blue-50', text: 'text-blue-700' },

  // Corrections / Reschedule (Orange)
  NEEDS_CORRECTION: { fill: '#ea580c', badgeBg: 'bg-orange-50', text: 'text-orange-700' },
  PAYMENT_NEEDS_CORRECTION: { fill: '#ea580c', badgeBg: 'bg-orange-50', text: 'text-orange-700' },
  RETURNED: { fill: '#b45309', badgeBg: 'bg-amber-50', text: 'text-amber-800' },
  PROPOSED_RESCHEDULE: { fill: '#ea580c', badgeBg: 'bg-orange-50', text: 'text-orange-700' },

  // Terminal Cancelled / Rejected (Rose)
  REJECTED: { fill: '#e11d48', badgeBg: 'bg-rose-50', text: 'text-rose-700' },
  CANCELLED: { fill: '#94a3b8', badgeBg: 'bg-slate-100', text: 'text-slate-600' },

  // Event Visibilities
  PUBLIC: { fill: '#991b1b', badgeBg: 'bg-crimson-50', text: 'text-crimson-700' },
  PARISH_PRIVATE: { fill: '#64748b', badgeBg: 'bg-slate-100', text: 'text-slate-600' },

  // User Roles
  DIOCESE_COORDINATOR: { fill: '#991b1b', badgeBg: 'bg-crimson-50', text: 'text-crimson-700' },
  PARISHIONER: { fill: '#475569', badgeBg: 'bg-slate-100', text: 'text-slate-700' },
  SECRETARY: { fill: '#0d9488', badgeBg: 'bg-teal-50', text: 'text-teal-700' },
  PRIEST: { fill: '#4f46e5', badgeBg: 'bg-indigo-50', text: 'text-indigo-700' },
  ASSISTANT_PRIEST: { fill: '#6366f1', badgeBg: 'bg-indigo-50', text: 'text-indigo-700' },
};

const FALLBACK_PALETTE = ['#991b1b', '#0d9488', '#d97706', '#2563eb', '#64748b', '#7c3aed', '#ec4899'];

function extractKeyAndLabel(row: StatusDistributionRow): { rawKey: string; label: string; count: number } {
  const count = Number(row._count ?? row.count ?? 0);
  const entry = Object.entries(row).find(([key]) => !['_count', 'count'].includes(key));
  const rawKey = String(entry?.[1] ?? 'UNKNOWN');
  const label = rawKey.replaceAll('_', ' ').toLowerCase();
  return { rawKey, label, count };
}

export function StatusDonutChart({
  title,
  rows,
  emptyMessage = 'No distribution records for this period.',
  animationKey,
}: StatusDonutChartProps) {
  const items = useMemo(() => {
    return rows
      .map((row, idx) => {
        const { rawKey, label, count } = extractKeyAndLabel(row);
        const colorConfig = STATUS_COLORS[rawKey.toUpperCase()] || {
          fill: FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length],
          badgeBg: 'bg-gray-50',
          text: 'text-gray-700',
        };
        return { rawKey, label, count, colorConfig };
      })
      .filter((item) => item.count > 0);
  }, [rows]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + item.count, 0);
  }, [items]);

  // Compute SVG Donut arc segments using stroke-dasharray and stroke-dashoffset
  const radius = 64;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  const segments = useMemo(() => {
    let accumulated = 0;
    return items.map((item) => {
      const pct = total > 0 ? item.count / total : 0;
      const strokeLength = pct * circumference;
      const strokeOffset = -accumulated * circumference;
      accumulated += pct;

      return {
        ...item,
        percentage: Math.round(pct * 100),
        dashArray: `${strokeLength} ${circumference - strokeLength}`,
        dashOffset: strokeOffset,
      };
    });
  }, [items, total, circumference]);

  return (
    <div key={animationKey ?? 'donut-root'} className="space-y-4">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .animate-donut-sweep {
            animation: donutSweep 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
            transform-origin: 80px 80px;
          }
          .animate-donut-legend {
            opacity: 0;
            animation: donutLegendFade 450ms ease-out 120ms forwards;
          }
        }
        @keyframes donutSweep {
          from {
            transform: rotate(-140deg) scale(0.92);
            opacity: 0.3;
          }
          to {
            transform: rotate(-90deg) scale(1);
            opacity: 1;
          }
        }
        @keyframes donutLegendFade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">{title}</h3>
        {total > 0 && (
          <span className="text-[11px] font-semibold text-gray-400">
            Total: {total.toLocaleString()}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 p-6 text-center">
          <PieChartIcon className="h-5 w-5 text-gray-300" />
          <p className="mt-1.5 text-xs font-medium text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          {/* SVG Donut Visual */}
          <div className="sm:col-span-5 flex justify-center py-2">
            <div className="relative flex items-center justify-center">
              <svg width="160" height="160" viewBox="0 0 160 160" className="rotate-[-90deg] animate-donut-sweep">
                {/* Background Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke="#f1f5f9"
                  strokeWidth={strokeWidth}
                />

                {/* Status Segments */}
                {segments.map((seg) => (
                  <circle
                    key={seg.rawKey}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="transparent"
                    stroke={seg.colorConfig.fill}
                    strokeWidth={strokeWidth}
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    strokeLinecap="butt"
                    className="transition-all duration-300"
                  />
                ))}
              </svg>

              {/* Center Content */}
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-lg font-black tracking-tight text-gray-900 leading-tight">
                  {total.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Total
                </span>
              </div>
            </div>
          </div>

          {/* Accessible Legend Breakdown */}
          <div className="sm:col-span-7 space-y-2 max-h-56 overflow-y-auto pr-1 animate-donut-legend">
            {segments.map((seg) => (
              <div
                key={seg.rawKey}
                className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.colorConfig.fill }}
                  />
                  <span className="font-medium text-gray-700 capitalize truncate text-[11px]">
                    {seg.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-gray-900 text-xs">
                    {seg.count.toLocaleString()}
                  </span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${seg.colorConfig.badgeBg} ${seg.colorConfig.text}`}>
                    {seg.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
