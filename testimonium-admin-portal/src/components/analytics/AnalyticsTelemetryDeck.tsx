import React from 'react';
import {
  FileText,
  Clock,
  Landmark,
  Receipt,
  RotateCcw,
  CheckCircle2,
  CalendarDays,
  Calendar,
  ScrollText,
  Users,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

export interface TelemetryMetric {
  label: string;
  value: string | number;
  hint?: string;
  icon?: string;
}

interface AnalyticsTelemetryDeckProps {
  metrics: TelemetryMetric[];
  domainTitle?: string;
  scopeLabel?: string;
  dateRangeLabel?: string;
  animationKey?: number | string;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  file: FileText,
  clock: Clock,
  landmark: Landmark,
  receipt: Receipt,
  correction: RotateCcw,
  verified: CheckCircle2,
  schedule: CalendarDays,
  calendar: Calendar,
  report: ScrollText,
  users: Users,
  shield: ShieldCheck,
  trend: TrendingUp,
};

function resolveIcon(label: string, customIcon?: string): React.ComponentType<{ className?: string }> {
  if (customIcon && ICON_MAP[customIcon]) {
    return ICON_MAP[customIcon];
  }
  const l = label.toLowerCase();
  if (l.includes('processing') || l.includes('time') || l.includes('hour')) return Clock;
  if (l.includes('receipt')) return Receipt;
  if (l.includes('correction')) return RotateCcw;
  if (l.includes('verified') || l.includes('amount')) return CheckCircle2;
  if (l.includes('schedule')) return CalendarDays;
  if (l.includes('event')) return Calendar;
  if (l.includes('report')) return ScrollText;
  if (l.includes('user') || l.includes('role')) return Users;
  if (l.includes('transaction') || l.includes('payment')) return Landmark;
  return FileText;
}

export function AnalyticsTelemetryDeck({
  metrics,
  domainTitle,
  scopeLabel,
  dateRangeLabel,
  animationKey,
}: AnalyticsTelemetryDeckProps) {
  if (!metrics || metrics.length === 0) return null;

  return (
    <section
      key={animationKey ?? 'telemetry-root'}
      aria-label="Summary Telemetry"
      className="rounded-2xl border border-gray-200/90 bg-white shadow-xs overflow-hidden transition-all"
    >
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .animate-telemetry-card {
            animation: telemetryFadeIn 350ms ease-out backwards;
          }
        }
        @keyframes telemetryFadeIn {
          from {
            opacity: 0.3;
            transform: translateY(3px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Deck Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/70 px-5 py-2.5 text-xs text-gray-500">
        <div className="flex items-center gap-2 font-semibold text-gray-700">
          <span className="inline-block h-2 w-2 rounded-full bg-crimson-700 animate-pulse" />
          <span className="uppercase tracking-wider text-[11px] font-bold text-gray-600">
            {domainTitle || 'Operational Telemetry'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          {scopeLabel && (
            <span className="rounded-md border border-gray-200 bg-white px-2 py-0.5 font-medium text-gray-600">
              Scope: <strong className="text-gray-800">{scopeLabel}</strong>
            </span>
          )}
          {dateRangeLabel && (
            <span className="hidden sm:inline-block rounded-md border border-gray-200 bg-white px-2 py-0.5 font-medium text-gray-500">
              {dateRangeLabel}
            </span>
          )}
        </div>
      </div>

      {/* Metric Cards Deck with Internal Vertical/Horizontal Dividers */}
      <div
        className={`grid divide-y divide-gray-100 sm:divide-y-0 sm:divide-x ${
          metrics.length === 1
            ? 'grid-cols-1'
            : metrics.length === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : metrics.length === 3
            ? 'grid-cols-1 sm:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {metrics.map((metric, idx) => {
          const IconComponent = resolveIcon(metric.label, metric.icon);

          return (
            <div
              key={`${metric.label}-${idx}`}
              style={{ animationDelay: `${idx * 40}ms` }}
              className="p-5 lg:p-6 transition-colors hover:bg-gray-50/40 animate-telemetry-card"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 truncate">
                  {metric.label}
                </p>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-crimson-50 text-crimson-700">
                  <IconComponent className="h-3.5 w-3.5" />
                </div>
              </div>

              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                  {metric.value}
                </span>
              </div>

              {metric.hint && (
                <p className="mt-1 text-[11px] font-medium text-gray-400 truncate">
                  {metric.hint}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
