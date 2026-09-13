import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import {
  caloyAdminApi,
  type CaloyLogItem,
  type CaloyLogsResponse,
  type CaloyLogsQueryParams,
  type PurgePreviewResponse,
  type PurgeExecuteResponse,
} from '@/api/caloyAdminApi';
import { ParishManagementService } from '@/services/ParishManagementService';
import type { Parish } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/permissions/rolePermissions';
import { PERMISSIONS } from '@/permissions/permissions';

export function shouldAcceptPurgePreview(
  preview: PurgePreviewResponse,
  requestedDays: number,
  requestGeneration: number,
  latestGeneration: number,
) {
  return requestGeneration === latestGeneration && preview.daysOlderThan === requestedDays;
}

export function isPurgePreviewReady(preview: PurgePreviewResponse | null, selectedDays: number) {
  return preview?.daysOlderThan === selectedDays;
}

export function CaloyLogsPage({ initialData = null }: { initialData?: CaloyLogsResponse | null } = {}) {
  const { role } = useAuth();
  const canManageLogs = hasPermission(role, PERMISSIONS.MANAGE_CALOY_LOGS);
  const [logs, setLogs] = useState<CaloyLogItem[]>(initialData?.items ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(initialData?.pagination.page ?? 1);
  const [pageSize, setPageSize] = useState(initialData?.pagination.pageSize ?? 25);
  const [total, setTotal] = useState(initialData?.pagination.total ?? 0);
  const [totalPages, setTotalPages] = useState(initialData?.pagination.totalPages ?? 0);

  // Filters
  const [responseTypeFilter, setResponseTypeFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'success' | 'fallback'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [parishIdFilter, setParishIdFilter] = useState<string>('all');

  const [parishes, setParishes] = useState<Parish[]>([]);

  // Manual Purge Modal & Workflow State
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purgeCutoffDays, setPurgeCutoffDays] = useState<number>(90);
  const [purgePreview, setPurgePreview] = useState<PurgePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [purgeExecuting, setPurgeExecuting] = useState(false);
  const [purgeResult, setPurgeResult] = useState<PurgeExecuteResponse | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadGenerationRef = useRef(0);
  const previewControllerRef = useRef<AbortController | null>(null);
  const previewGenerationRef = useRef(0);

  useEffect(() => {
    ParishManagementService.getParishes()
      .then((p: Parish[]) => setParishes(p || []))
      .catch((err: unknown) => console.warn('Failed to load parishes for filter:', err));
  }, []);

  const loadLogs = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const params: CaloyLogsQueryParams = {
        page,
        pageSize,
      };
      if (responseTypeFilter !== 'all') {
        params.responseType = responseTypeFilter;
      }
      if (outcomeFilter !== 'all') {
        params.outcome = outcomeFilter;
      }
      if (categoryFilter !== 'all') {
        params.category = categoryFilter;
      }
      if (parishIdFilter !== 'all') {
        params.parishId = Number(parishIdFilter);
      }

      const res = await caloyAdminApi.getLogs(params, controller.signal);
      if (generation !== loadGenerationRef.current) return;
      setLogs(res.items);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return;
      }
      if (generation !== loadGenerationRef.current) return;
      console.error('Failed to load logs:', err);
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to load operational logs.');
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false);
    }
  }, [page, pageSize, responseTypeFilter, outcomeFilter, categoryFilter, parishIdFilter]);

  useEffect(() => {
    if (!initialData) loadLogs();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadLogs, initialData]);

  // Open Purge Modal and fetch preview
  const handleOpenPurge = async () => {
    setIsPurgeModalOpen(true);
    setPurgeResult(null);
    setPurgeError(null);
    await fetchPurgePreview(purgeCutoffDays);
  };

  const fetchPurgePreview = async (days: number) => {
    previewControllerRef.current?.abort();
    const controller = new AbortController();
    previewControllerRef.current = controller;
    const generation = ++previewGenerationRef.current;
    setPurgePreview(null);
    try {
      setPreviewLoading(true);
      setPurgeError(null);
      const prev = await caloyAdminApi.getPurgePreview(days, controller.signal);
      if (!shouldAcceptPurgePreview(prev, days, generation, previewGenerationRef.current)) return;
      setPurgePreview(prev);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      if (generation !== previewGenerationRef.current) return;
      setPurgeError(err?.response?.data?.error?.message || 'Failed to calculate purge preview.');
    } finally {
      if (generation === previewGenerationRef.current) setPreviewLoading(false);
    }
  };

  const handleExecutePurge = async () => {
    if (purgeExecuting || !canManageLogs || !isPurgePreviewReady(purgePreview, purgeCutoffDays)) return;
    try {
      setPurgeExecuting(true);
      setPurgeError(null);
      const res = await caloyAdminApi.executePurge(purgeCutoffDays);
      setPurgeResult(res);
      // Refresh current table state
      loadLogs();
    } catch (err: any) {
      const partialResult = err?.response?.data?.data as PurgeExecuteResponse | undefined;
      if (partialResult?.status === 'PARTIAL' || partialResult?.status === 'FAILED') {
        setPurgeResult(partialResult);
      }
      setPurgeError(err?.response?.data?.message || err?.response?.data?.error?.message || 'Failed to execute telemetry purge.');
    } finally {
      setPurgeExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Privacy Protection Notice & Manual Purge Trigger */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-600" />
            Privacy-Guaranteed Operational Telemetry
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Logs contain metadata only (response type, categories, latency, models, fallback reasons). Questions, response bodies, and user identities are never retained in admin logs.
          </p>
        </div>

        {canManageLogs && <div className="flex items-center gap-3">
          <button
            onClick={handleOpenPurge}
            className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Purge Older Telemetry
          </button>
        </div>}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-3">
        {/* Response Type Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-gray-500 font-medium">Type:</span>
          <select
            value={responseTypeFilter}
            onChange={(e) => {
              setResponseTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-crimson-700"
          >
            <option value="all">All Types</option>
            <option value="SOCIAL">SOCIAL</option>
            <option value="CLARIFICATION">CLARIFICATION</option>
            <option value="LIVE_DATA">LIVE_DATA</option>
            <option value="RAG">RAG</option>
            <option value="FALLBACK">FALLBACK</option>
          </select>
        </div>

        {/* Outcome Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-gray-500 font-medium">Outcome:</span>
          <select
            value={outcomeFilter}
            onChange={(e) => {
              setOutcomeFilter(e.target.value as any);
              setPage(1);
            }}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-crimson-700"
          >
            <option value="all">All Outcomes</option>
            <option value="success">Success Only</option>
            <option value="fallback">Fallback / Error Only</option>
          </select>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-gray-500 font-medium">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-crimson-700"
          >
            <option value="all">All Categories</option>
            <option value="PROCEDURE">PROCEDURE</option>
            <option value="REQUIREMENTS">REQUIREMENTS</option>
            <option value="SCHEDULE">SCHEDULE</option>
            <option value="FEES">FEES</option>
            <option value="MINISTRY">MINISTRY</option>
            <option value="PARISH_INFO">PARISH_INFO</option>
            <option value="STATUS_CHECK">STATUS_CHECK</option>
            <option value="GENERAL">GENERAL</option>
          </select>
        </div>

        {/* Parish Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-gray-500 font-medium">Parish:</span>
          <select
            value={parishIdFilter}
            onChange={(e) => {
              setParishIdFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-crimson-700 max-w-[200px]"
          >
            <option value="all">All Parishes</option>
            {parishes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Page Size */}
        <div className="flex items-center gap-1.5 text-xs ml-auto">
          <span className="text-gray-500 font-medium">Per Page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-crimson-700"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <button
            onClick={loadLogs}
            disabled={loading}
            className="p-1.5 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors ml-2"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp (PHT)</th>
                <th className="py-3 px-4">Response Type</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Model</th>
                <th className="py-3 px-4">Parish Context</th>
                <th className="py-3 px-4">Latency</th>
                <th className="py-3 px-4">Outcome</th>
                <th className="py-3 px-4">Fallback / Error Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-normal">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-crimson-700" />
                    Loading operational logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    No operational logs match the specified criteria.
                  </td>
                </tr>
              ) : (
                logs.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-gray-600">
                      {new Date(item.timestamp).toLocaleString([], {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] ${
                          item.responseType === 'LIVE_DATA'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : item.responseType === 'RAG'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : item.responseType === 'SOCIAL'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.responseType === 'CLARIFICATION'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : item.responseType === 'FALLBACK'
                            ? 'bg-orange-50 text-orange-700 border border-orange-200'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {item.responseType || 'UNKNOWN / LEGACY'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{item.category}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-gray-600">
                      {item.generationModel || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-700">{item.parishName || 'None / General'}</td>
                    <td className="py-3 px-4 font-mono text-gray-600">{item.latencyMs}ms</td>
                    <td className="py-3 px-4">
                      {item.fallback ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-[11px]">
                          Fallback
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                          Success
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {item.errorCategory || item.fallbackReason ? (
                        <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          {item.errorCategory || item.fallbackReason}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
          <div>
            Showing <span className="font-semibold">{logs.length}</span> of{' '}
            <span className="font-semibold">{total}</span> records (Page {page} of {totalPages || 1})
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Manual Purge Modal */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                Purge Older Telemetry
              </h3>
              <button
                onClick={() => setIsPurgeModalOpen(false)}
                disabled={purgeExecuting}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <p className="text-xs text-gray-600">
                Permanently deletes older operational telemetry from both <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">chatbot_logs</code> and <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">ai_usage_events</code>.
              </p>

              {/* Retention Policy Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Select Cutoff Window
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[30, 60, 90, 180, 365].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => {
                        previewControllerRef.current?.abort();
                        previewGenerationRef.current += 1;
                        setPurgeCutoffDays(days);
                        setPurgePreview(null);
                        setPurgeResult(null);
                        fetchPurgePreview(days);
                      }}
                      className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                        purgeCutoffDays === days
                          ? 'border-red-600 bg-red-50 text-red-700 font-semibold'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Older than {days}d
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Box */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs font-bold uppercase text-gray-400 block mb-2">
                  Purge Impact Preview (Informational)
                </span>
                {previewLoading ? (
                  <div className="flex items-center justify-center py-4 text-xs text-gray-500 gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-crimson-700" />
                    Calculating matched records...
                  </div>
                ) : purgePreview ? (
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-gray-700">
                      <span>Cutoff Date (UTC):</span>
                      <span className="font-mono font-semibold">
                        {new Date(purgePreview.cutoff).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-700">
                      <span>Chatbot Logs to Delete:</span>
                      <span className="font-bold text-gray-900">{purgePreview.chatbotLogsMatched}</span>
                    </div>
                    <div className="flex justify-between text-gray-700">
                      <span>AI Usage Events to Delete:</span>
                      <span className="font-bold text-gray-900">{purgePreview.aiUsageEventsMatched}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Error Box */}
              {purgeError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {purgeError}
                </div>
              )}

              {/* Authoritative Result Box (including partial committed deletes) */}
              {purgeResult && (
                <div className={`p-4 border rounded-xl text-xs space-y-1 ${purgeResult.status === 'COMPLETED' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  <div className="font-bold flex items-center gap-1.5">
                    {purgeResult.status === 'COMPLETED' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-amber-600" />}
                    Purge {purgeResult.status === 'COMPLETED' ? 'Completed Successfully' : purgeResult.status}
                  </div>
                  <div>Actually deleted {purgeResult.chatbotLogsDeleted} Chatbot Logs.</div>
                  <div>Actually deleted {purgeResult.aiUsageEventsDeleted} AI Usage Events.</div>
                  {purgeResult.auditFinalizationWarning && (
                    <div className="mt-2 font-semibold">
                      Deletion completed, but the final completion audit could not be written. The operation's STARTED audit remains recorded.
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                ⚠️ Warning: Deletion is permanent and cannot be undone. An entry will be recorded in the Diocesan Activity Log documenting this action.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
                disabled={purgeExecuting}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50"
              >
                {purgeResult ? 'Close' : 'Cancel'}
              </button>

              {!purgeResult && (
                <button
                  type="button"
                  onClick={handleExecutePurge}
                  disabled={purgeExecuting || previewLoading || !isPurgePreviewReady(purgePreview, purgeCutoffDays)}
                  className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors inline-flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {purgeExecuting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Executing Purge...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Confirm Permanent Purge
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
