import React from 'react';
import { Calendar, Clock, AlertCircle, ArrowRight, History } from 'lucide-react';
import type { RescheduleHistoryEntry } from '../../../types';

export interface ScheduleRescheduleHistoryProps {
  history?: RescheduleHistoryEntry[];
  className?: string;
  showSummaryCard?: boolean;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'TBD';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return dateStr;
}

function formatTime(timeIso?: string | null): string | null {
  if (!timeIso) return null;
  try {
    const date = new Date(timeIso);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    });
  } catch {
    return null;
  }
}

function formatScheduleDisplay(dateStr?: string | null, startIso?: string | null): string {
  const formattedDate = formatDate(dateStr);
  const formattedStart = formatTime(startIso);
  if (formattedStart) {
    return `${formattedDate} • ${formattedStart}`;
  }
  return formattedDate;
}

function formatChangedAt(changedAtStr?: string | null): string {
  if (!changedAtStr) return '';
  try {
    const date = new Date(changedAtStr);
    if (isNaN(date.getTime())) return changedAtStr;
    const datePart = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    });
    const timePart = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    });
    return `${datePart} • ${timePart}`;
  } catch {
    return changedAtStr || '';
  }
}

function formatDateOnly(changedAtStr?: string | null): string {
  if (!changedAtStr) return '';
  try {
    const date = new Date(changedAtStr);
    if (isNaN(date.getTime())) return changedAtStr;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    });
  } catch {
    return changedAtStr || '';
  }
}

export const ScheduleRescheduleHistory: React.FC<ScheduleRescheduleHistoryProps> = ({
  history,
  className = '',
  showSummaryCard = true,
}) => {
  if (!history || history.length === 0) {
    return null;
  }

  const latest = history[0];
  const hasMultiple = history.length > 1;

  return (
    <div className={`space-y-4 ${className}`} data-testid="schedule-reschedule-history">
      {/* Latest Reschedule Summary Card */}
      {showSummaryCard && latest && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5 text-left shadow-xs transition-all">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-amber-950">Schedule Updated</h4>
              <p className="text-xs text-amber-800">This appointment was rescheduled by the parish.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs pt-1">
            <div className="bg-white/80 rounded-lg p-3 border border-amber-100/80">
              <span className="text-[10px] font-bold text-amber-800/80 uppercase tracking-wider block mb-1">
                Previous Schedule
              </span>
              <p className="font-semibold text-text-primary flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                {formatScheduleDisplay(latest.previousDate, latest.previousStart)}
              </p>
            </div>

            <div className="bg-white/80 rounded-lg p-3 border border-amber-100/80">
              <span className="text-[10px] font-bold text-amber-800/80 uppercase tracking-wider block mb-1">
                New Schedule
              </span>
              <p className="font-semibold text-emerald-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                {formatScheduleDisplay(latest.newDate, latest.newStart)}
              </p>
            </div>

            <div className="sm:col-span-2 bg-white/80 rounded-lg p-3 border border-amber-100/80 space-y-1">
              <div className="flex justify-between items-center flex-wrap gap-1">
                <span className="text-[10px] font-bold text-amber-800/80 uppercase tracking-wider">Reason</span>
                {latest.changedAt && (
                  <span className="text-[11px] text-text-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Rescheduled: {formatChangedAt(latest.changedAt)}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-primary leading-relaxed">{latest.reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Multiple Reschedules Timeline */}
      {hasMultiple && (
        <div className="rounded-xl border border-border bg-white p-4 sm:p-5 text-left shadow-xs">
          <div className="flex items-center gap-2 mb-3.5 border-b border-border pb-2.5">
            <History className="w-4 h-4 text-crimson flex-shrink-0" />
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Schedule Changes</h4>
          </div>

          <div className="space-y-4 pl-1">
            {history.map((entry, idx) => (
              <div key={idx} className="relative pl-5 pb-3 last:pb-0 border-l-2 border-border/80 last:border-l-transparent">
                {/* Timeline Dot */}
                <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-crimson ring-4 ring-white" />

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-text-primary">
                      {formatDateOnly(entry.changedAt)}
                    </span>
                    <span className="text-[11px] text-text-muted">
                      {formatChangedAt(entry.changedAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-text-primary flex-wrap pt-0.5">
                    <span className="line-through text-text-muted">
                      {formatScheduleDisplay(entry.previousDate, entry.previousStart)}
                    </span>
                    <ArrowRight className="w-3 h-3 text-crimson flex-shrink-0" />
                    <span className="font-semibold text-emerald-800">
                      {formatScheduleDisplay(entry.newDate, entry.newStart)}
                    </span>
                  </div>

                  <p className="text-xs text-text-muted pt-0.5">
                    <strong className="text-text-primary">Reason:</strong> {entry.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleRescheduleHistory;
