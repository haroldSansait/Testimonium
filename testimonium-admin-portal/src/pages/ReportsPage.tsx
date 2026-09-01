import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, Calendar, FilePlus2, Filter, Loader2, Pencil, RefreshCw, Search, User, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { reportsApi, type DailyReport, type ReportCategory, type ReportPayload, type ReportScope } from '@/api/reportsApi';
import { ParishManagementService } from '@/services/ParishManagementService';
import { useAuth } from '@/hooks/useAuth';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import type { Parish } from '@/types';
import type { ApiError } from '@/types/api';

const categories: Array<{ value: ReportCategory; label: string; badgeClass: string }> = [
  { value: 'MEETING', label: 'Meeting', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'ACTIVITY', label: 'Activity', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'IMPORTANT_EVENT', label: 'Important Event', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'OTHER', label: 'Other', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
];

function getCategoryConfig(category: ReportCategory) {
  return categories.find((c) => c.value === category) || {
    value: category,
    label: category.replaceAll('_', ' '),
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
  };
}

const emptyForm = (): ReportPayload => ({
  reportDate: new Date().toISOString().slice(0, 10),
  scope: 'PARISH',
  parishId: null,
  title: '',
  category: 'ACTIVITY',
  description: '',
});

function ReportCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-5 w-24 rounded bg-gray-200" />
          <div className="h-6 w-48 rounded bg-gray-200" />
        </div>
        <div className="h-4 w-20 rounded bg-gray-200" />
      </div>
      <div className="space-y-2 pt-1">
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-5/6 rounded bg-gray-200" />
        <div className="h-4 w-2/3 rounded bg-gray-200" />
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="h-3.5 w-36 rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-7 w-16 rounded bg-gray-200" />
          <div className="h-7 w-16 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { role, applicationUser } = useAuth();
  const coordinator = role === 'DIOCESE_COORDINATOR';

  // Data states
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Filter states
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Modal / Form states
  const [editing, setEditing] = useState<DailyReport | null>(null);
  const [form, setForm] = useState<ReportPayload>(emptyForm);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');

  // Mutation in-flight protection states & refs
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const [archivingIds, setArchivingIds] = useState<Set<number>>(new Set());
  const archivingIdsRef = useRef<Set<number>>(new Set());

  // Load authoritative reports list
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setRefreshError(null);
    try {
      const result = await reportsApi.list({
        page,
        limit: 20,
        keyword: keyword.trim() || undefined,
        category: category || undefined,
        includeArchived,
      });
      setReports(result.data);
      setTotalPages(result.pagination.totalPages || 1);
      setTotalCount(result.pagination.total ?? null);
    } catch (error) {
      setLoadError((error as ApiError)?.message || 'Unable to load daily reports.');
    } finally {
      setLoading(false);
    }
  }, [category, includeArchived, keyword, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (coordinator) {
      void ParishManagementService.getParishes().then(setParishes).catch(() => {});
    }
  }, [coordinator]);

  const startCreate = () => {
    const next = emptyForm();
    if (!coordinator && applicationUser?.parishId) {
      next.parishId = Number(applicationUser.parishId);
    }
    setEditing(null);
    setForm(next);
    setFormError('');
    setOpen(true);
  };

  const startEdit = (report: DailyReport) => {
    setEditing(report);
    setForm({
      reportDate: report.reportDate.slice(0, 10),
      scope: report.scope,
      parishId: report.parishId,
      title: report.title,
      category: report.category,
      description: report.description,
    });
    setFormError('');
    setOpen(true);
  };

  const closeModal = () => {
    if (isSavingRef.current) return;
    setOpen(false);
    setEditing(null);
    setFormError('');
  };

  const clearFilters = () => {
    setKeyword('');
    setCategory('');
    setIncludeArchived(false);
    setPage(1);
  };

  // Synchronously guarded Save action
  const save = async () => {
    // Guard against rapid duplicate clicks before state update
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    setFormError('');

    const isEditMode = Boolean(editing);

    try {
      if (editing) {
        await reportsApi.update(editing.id, {
          ...form,
          expectedVersion: editing.version,
        });
      } else {
        await reportsApi.create(form);
      }

      // Mutation succeeded! Close form and acknowledge success
      setOpen(false);
      setEditing(null);
      setFeedbackMessage({
        type: 'success',
        text: isEditMode ? 'Report updated successfully.' : 'Report created successfully.',
      });

      // Release guard before background refresh
      isSavingRef.current = false;
      setIsSaving(false);

      // Attempt authoritative list refresh
      try {
        await load();
      } catch {
        setRefreshError('Report saved, but the list could not refresh automatically.');
      }
    } catch (error) {
      // Mutation failed: release guard and keep user input intact for retry
      isSavingRef.current = false;
      setIsSaving(false);

      const apiError = error as ApiError;
      if (apiError.status === 409 && apiError.code === 'REPORT_STALE') {
        setOpen(false);
        setEditing(null);
        setFeedbackMessage({
          type: 'warning',
          text: 'The report changed in another session. The latest list was reloaded; reopen it to review before editing.',
        });
        void load();
      } else {
        setFormError(apiError.message || 'Unable to save the report. Please try again.');
      }
    }
  };

  // Synchronously guarded Archive action
  const archive = async (report: DailyReport) => {
    if (archivingIdsRef.current.has(report.id)) return;
    if (!window.confirm('Archive this report? It will remain available through the archived filter.')) return;

    archivingIdsRef.current.add(report.id);
    setArchivingIds(new Set(archivingIdsRef.current));

    try {
      await reportsApi.archive(report.id, report.version);
      setFeedbackMessage({
        type: 'success',
        text: 'Report archived successfully.',
      });

      // Release item lock before refreshing
      archivingIdsRef.current.delete(report.id);
      setArchivingIds(new Set(archivingIdsRef.current));

      try {
        await load();
      } catch {
        setRefreshError('Report archived, but the list could not refresh automatically.');
      }
    } catch (error) {
      archivingIdsRef.current.delete(report.id);
      setArchivingIds(new Set(archivingIdsRef.current));

      const apiError = error as ApiError;
      if (apiError.status === 409) {
        void load();
      }
      setFeedbackMessage({
        type: 'error',
        text: apiError.message || 'Unable to archive the report.',
      });
    }
  };

  const isFormValid = Boolean(
    form.title.trim() &&
    form.description.trim() &&
    (!coordinator || form.scope !== 'PARISH' || form.parishId)
  );

  const hasActiveFilters = Boolean(keyword.trim() || category || includeArchived);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Daily Reports"
        subtitle="Versioned parish and diocesan operational reports."
        actions={
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-crimson-700 hover:bg-crimson-800 active:bg-crimson-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-crimson-700/20"
          >
            <FilePlus2 className="h-4 w-4" />
            New report
          </button>
        }
      />

      {/* Global Feedback Banner */}
      {feedbackMessage && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-sm font-medium transition-all ${
            feedbackMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : feedbackMessage.type === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="rounded p-1 text-current opacity-70 hover:opacity-100"
            aria-label="Dismiss message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* List Refresh Error Banner */}
      {refreshError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <span>{refreshError}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm hover:bg-amber-100 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry refresh
          </button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="Search title or description..."
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm text-gray-900 outline-none focus:border-crimson-700 focus:ring-1 focus:ring-crimson-700"
            />
          </div>
          <div className="w-full">
            <CustomSelect
              aria-label="Filter by category"
              value={category}
              onChange={(val) => {
                setCategory(val);
                setPage(1);
              }}
              placeholder="All categories"
              options={[{ value: '', label: 'All categories' }, ...categories]}
            />
          </div>
          <div className="flex items-center">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700 select-none">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => {
                  setIncludeArchived(event.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-gray-300 text-crimson-700 focus:ring-crimson-700"
              />
              Include archived reports
            </label>
          </div>
          {hasActiveFilters && (
            <div className="flex items-center justify-start lg:justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-crimson-700 hover:text-crimson-800 hover:underline"
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Summary Counter Bar */}
        {totalCount !== null && (
          <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500 font-medium">
            <span>
              Showing {reports.length} of {totalCount} {totalCount === 1 ? 'report' : 'reports'}
            </span>
            {hasActiveFilters && (
              <span className="inline-flex items-center gap-1 text-crimson-700">
                <Filter className="h-3 w-3" />
                Filtered view
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area: Loading / Error / Empty / List */}
      {loading && reports.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <ReportCardSkeleton key={index} />
          ))}
        </div>
      ) : loadError && reports.length === 0 ? (
        <ErrorState message={loadError} onRetry={() => void load()} />
      ) : reports.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No reports match the selected filters."
            description="Try clearing or adjusting your search term, category filter, or archive inclusion."
          />
        ) : (
          <EmptyState
            title="No daily reports found."
            description="Create the first operational report for your parish or diocese."
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {reports.map((report) => {
            const catConfig = getCategoryConfig(report.category);
            const isArchiving = archivingIds.has(report.id);

            return (
              <article
                key={report.id}
                className={`relative flex flex-col justify-between rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
                  report.isArchived ? 'border-gray-200 bg-gray-50/70 opacity-80' : 'border-gray-200'
                }`}
              >
                <div>
                  {/* Top Bar: Category Pill + Date */}
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${catConfig.badgeClass}`}
                    >
                      {catConfig.label}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      <span>{report.reportDate.slice(0, 10)}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="mt-3 text-base font-bold text-gray-900 leading-snug">
                    {report.title}
                  </h2>

                  {/* Description */}
                  <p className="mt-2.5 whitespace-pre-wrap text-sm text-gray-700 leading-relaxed line-clamp-4 hover:line-clamp-none transition-all">
                    {report.description}
                  </p>
                </div>

                {/* Metadata & Actions Footer */}
                <div className="mt-5 border-t border-gray-100 pt-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 font-medium">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      {report.scope === 'DIOCESE' ? 'Diocese-wide' : report.parish?.parishName || 'Parish'}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3 text-gray-400" />
                      {report.createdBy.fullName}
                    </span>
                    {report.isArchived && (
                      <>
                        <span>•</span>
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
                          Archived
                        </span>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {!report.isArchived && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(report)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-crimson-700"
                      >
                        <Pencil className="h-3.5 w-3.5 text-gray-500" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isArchiving}
                        onClick={() => void archive(report)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-red-600"
                      >
                        {isArchiving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-red-600" />
                        ) : (
                          <Archive className="h-3.5 w-3.5 text-red-600" />
                        )}
                        {isArchiving ? 'Archiving...' : 'Archive'}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm font-medium text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Create / Edit Modal Dialog */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            onClick={(e) => e.target === e.currentTarget && !isSaving && closeModal()}
          >
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h2 id="report-modal-title" className="text-lg font-bold text-gray-900">
                  {editing ? 'Edit Daily Report' : 'New Daily Report'}
                </h2>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSaving}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                  aria-label="Close dialog"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                  {formError}
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                    Report Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    aria-label="Report date"
                    required
                    type="date"
                    disabled={isSaving}
                    value={form.reportDate}
                    onChange={(event) => setForm({ ...form, reportDate: event.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-crimson-700 focus:ring-1 focus:ring-crimson-700 disabled:bg-gray-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    aria-label="Category"
                    disabled={isSaving}
                    value={form.category}
                    onChange={(val) =>
                      setForm({ ...form, category: val as ReportCategory })
                    }
                    options={categories}
                  />
                </div>

                {coordinator && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                      Scope <span className="text-red-500">*</span>
                    </label>
                    <CustomSelect
                      aria-label="Scope"
                      disabled={isSaving}
                      value={form.scope}
                      onChange={(val) =>
                        setForm({
                          ...form,
                          scope: val as ReportScope,
                          parishId: val === 'DIOCESE' ? null : form.parishId,
                        })
                      }
                      options={[
                        { value: 'PARISH', label: 'Parish' },
                        { value: 'DIOCESE', label: 'Diocese' },
                      ]}
                    />
                  </div>
                )}

                {coordinator && form.scope === 'PARISH' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                      Parish <span className="text-red-500">*</span>
                    </label>
                    <CustomSelect
                      aria-label="Parish"
                      required
                      disabled={isSaving}
                      value={form.parishId ? String(form.parishId) : ''}
                      onChange={(val) =>
                        setForm({ ...form, parishId: Number(val) || null })
                      }
                      placeholder="Select parish"
                      options={parishes.map((parish) => ({
                        value: String(parish.id),
                        label: parish.name,
                      }))}
                      searchable
                    />
                  </div>
                )}

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    aria-label="Title"
                    required
                    maxLength={255}
                    disabled={isSaving}
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder="e.g. Pastoral Council Monthly Assembly"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-crimson-700 focus:ring-1 focus:ring-crimson-700 disabled:bg-gray-100"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    aria-label="Description"
                    required
                    maxLength={10000}
                    rows={8}
                    disabled={isSaving}
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    placeholder="Detailed notes and operational summary..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-crimson-700 focus:ring-1 focus:ring-crimson-700 disabled:bg-gray-100"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving || !isFormValid}
                  onClick={() => void save()}
                  className="inline-flex items-center gap-2 rounded-lg bg-crimson-700 hover:bg-crimson-800 active:bg-crimson-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-crimson-700/20"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin text-white" />}
                  {isSaving
                    ? 'Saving...'
                    : editing
                    ? 'Save Changes'
                    : 'Save Report'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
