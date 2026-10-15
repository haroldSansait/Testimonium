import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { ParishManagementService } from '@/services/ParishManagementService';
import { getManilaTodayDateString } from '@/utils/date';
import type { MassOccurrence, MassOccurrenceWeek, MassScheduleTemplate } from '@/providers/interfaces';

function addDays(date: string, days: number) {
  return new Date(new Date(date + 'T00:00:00Z').getTime() + days * 86400000).toISOString().slice(0, 10);
}
function displayDate(date: string) {
  return new Date(date + 'T00:00:00+08:00').toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}
function availabilityMessage(item: MassOccurrence) {
  if (item.classification === 'AVAILABLE') {
    return 'Priest available: ' + item.priests.filter(p => p.classification === 'AVAILABLE').map(p => p.fullName).join(', ') + '.';
  }
  if (item.classification === 'UNKNOWN') return 'Priest availability cannot currently be verified. Use Retry; a new assignment requires successful validation.';
  if (item.classification === 'NO_ACTIVE_PRIESTS') return 'No active parish priest is assigned to this parish.' + (item.layMinisterAssigned ? '' : ' A Lay Minister may be assigned for this occurrence only.');
  return item.priests.map(p => p.fullName).join(', ') + (item.priests.length === 1 ? ' is unavailable.' : ' are unavailable.')
    + ' No eligible parish priest is available at this time.' + (item.layMinisterAssigned ? '' : ' You may assign a Lay Minister for this occurrence only.');
}
function errorMessage(error: unknown) {
  const value = error as { code?: string; response?: { data?: { message?: string } }; message?: string };
  if (['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(value?.code || '')) return 'The parish server could not be reached or did not respond in time. Retry to verify the current scheduling state.';
  return value?.response?.data?.message || value?.message || 'Unable to verify the Mass schedule. Please retry.';
}

export function MassOccurrencePanel({ parishId, templates }: { parishId: string; templates: MassScheduleTemplate[] }) {
  const [from, setFrom] = useState(getManilaTodayDateString);
  const [week, setWeek] = useState<MassOccurrenceWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ item: MassOccurrence; assign: boolean } | null>(null);
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await ParishManagementService.getMassOccurrences(parishId, from);
      if (current === requestId.current) setWeek(data);
    } catch (err) {
      if (current === requestId.current) {
        setWeek(null);
        setError(errorMessage(err));
      }
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [parishId, from]);
  useEffect(() => {
    setConfirmation(null);
    void refresh();
    return () => { requestId.current++; };
  }, [refresh, templates]);

  async function save() {
    if (!confirmation || saving) return;
    const { item, assign } = confirmation;
    setSaving(true);
    setSuccess(null);
    setError(null);
    let failure: string | null = null;
    try {
      await ParishManagementService.setMassOccurrenceLayMinister(parishId, item.templateId, item.date, {
        weekStart: item.weekStart, availabilityToken: item.availabilityToken,
      }, assign);
      setSuccess(assign
        ? `${displayDate(item.date)} at ${item.timeSlot} alone is now designated Liturgy of the Word — Lay Minister-led. The recurring template remains unchanged.`
        : `The date-specific override for ${displayDate(item.date)} at ${item.timeSlot} was removed. This occurrence again follows its original Mass template.`);
    } catch (err) {
      failure = errorMessage(err) + ' Review the refreshed occurrence before trying again. If refresh fails, use Retry to establish its current state.';
    } finally {
      setConfirmation(null);
      await refresh();
      if (failure) setError(failure);
      setSaving(false);
    }
  }
  const busy = loading || saving;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm" aria-label="Mass occurrences">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5">
        <div>
          <h2 className="font-serif font-bold text-gray-900">Mass occurrences — single-day coverage</h2>
          <p className="mt-1 text-xs text-gray-500">{displayDate(from)} – {displayDate(addDays(from, 6))} · Manila time</p>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="Previous week" disabled={busy || from <= getManilaTodayDateString()} onClick={() => setFrom(addDays(from, -7) < getManilaTodayDateString() ? getManilaTodayDateString() : addDays(from, -7))} className="rounded-lg border p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <button aria-label="Next week" disabled={busy} onClick={() => setFrom(addDays(from, 7))} className="rounded-lg border p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          <button disabled={busy} onClick={() => { setConfirmation(null); void refresh(); }} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" />Retry / Refresh</button>
        </div>
      </div>
      <div className="space-y-3 p-5">
        {success && <p role="status" className="flex gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800"><Check className="h-4 w-4 shrink-0" />{success}</p>}
        {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading && <p role="status" className="text-sm text-gray-500">Verifying the saved Mass schedule and priest availability…</p>}
        {!loading && week?.occurrences.length === 0 && <p className="text-sm text-gray-500">No configured Mass occurrences in this week.</p>}
        {week?.outdatedOverrides?.map(item => (
          <div key={item.templateId + '-' + item.date} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-amber-900">Saved designation: {displayDate(item.date)} at {item.timeSlot}. The template was archived or its recurrence changed. This override has no effect.</p>
            <button disabled={busy || Boolean(error)} onClick={() => setConfirmation({ item, assign: false })} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40">Remove Date-Specific Override</button>
          </div>
        ))}
        {week?.occurrences.map(item => {
          const future = Boolean(item.startAt && new Date(item.startAt) > new Date());
          const eligible = ['CONFIRMED_UNAVAILABLE', 'NO_ACTIVE_PRIESTS'].includes(item.classification);
          const dated = item.override?.isActive;
          return (
            <div key={`${item.templateId}-${item.date}`} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-gray-900">{displayDate(item.date)} at {item.timeSlot}</h3>
                <p className="mt-1 text-sm text-gray-700">{item.displayLabel}{item.layMinisterAssigned ? ' — Lay Minister-led' : item.assignedPriest ? ` — ${item.assignedPriest.fullName}` : ''}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">{availabilityMessage(item)}</p>
                {item.override?.applies && <p className="mt-1 text-xs text-amber-800">Single-day designation. Configured label: {item.label}</p>}
                {dated && !item.override?.applies && <p className="mt-1 text-xs text-amber-800">The saved override no longer matches this template configuration and has no effect. Review availability before assigning this date again.</p>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {!item.layMinisterAssigned && future && eligible && <button disabled={busy || Boolean(error)} onClick={() => { setSuccess(null); setConfirmation({ item, assign: true }); }} className="rounded-lg bg-crimson-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Assign Lay Minister for This Date</button>}
                {item.classification === 'UNKNOWN' && <button disabled={busy} onClick={() => void refresh()} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Retry</button>}
                {dated && <button disabled={busy || Boolean(error)} onClick={() => { setSuccess(null); setConfirmation({ item, assign: false }); }} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Remove Date-Specific Override</button>}
              </div>
            </div>
          );
        })}
      </div>
      {confirmation && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && !saving && setConfirmation(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="mass-occurrence-confirm-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-amber-600" />
            <h3 id="mass-occurrence-confirm-title" className="font-serif text-base font-bold text-gray-900">{confirmation.assign ? 'Assign Lay Minister' : 'Remove date-specific override'} for {displayDate(confirmation.item.date)} at {confirmation.item.timeSlot}?</h3>
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-gray-700">{confirmation.assign
              ? 'This assignment applies only to this Mass occurrence. The recurring Mass schedule and all other dates will remain unchanged. Priest availability will be validated again before saving.'
              : 'This removes the override for this date only. The occurrence will again follow its original Mass template.'}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={saving} onClick={() => setConfirmation(null)} className="rounded-lg border px-4 py-2 text-xs font-bold disabled:opacity-40">Cancel</button>
              <button disabled={saving} onClick={() => void save()} className="rounded-lg bg-crimson-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{saving ? 'Validating and saving…' : 'Confirm'}</button>
            </div>
          </div>
        </div>, document.body
      )}
    </section>
  );
}
