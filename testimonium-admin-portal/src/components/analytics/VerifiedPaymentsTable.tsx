import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Loader2, RotateCcw, Search } from 'lucide-react';
import { analyticsApi } from '@/api/analyticsApi';
import { Pagination } from '@/components/ui/Pagination';
import { formatManilaDateTime } from '@/utils/date';
import type { VerifiedPaymentItem } from '@/types';
import type { ApiError } from '@/types/api';

interface VerifiedPaymentsTableProps {
  from: string;
  to: string;
  parishId: string;
  documentType: string;
  coordinator: boolean;
  refreshTrigger?: number;
}

function formatAmount(amount: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  return `₱${amount}`;
}

function TableSkeleton({ showParish }: { showParish: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs animate-pulse">
      <div className="border-b border-gray-200 bg-gray-50/75 px-4 py-3">
        <div className="h-4 w-48 rounded bg-gray-200" />
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <div className="h-3.5 w-28 rounded bg-gray-200" />
            <div className="h-3.5 w-24 rounded bg-gray-200" />
            <div className="h-3.5 w-32 rounded bg-gray-200" />
            <div className="h-3.5 w-28 rounded bg-gray-200" />
            {showParish && <div className="h-3.5 w-32 rounded bg-gray-200" />}
            <div className="h-3.5 w-16 rounded bg-gray-200" />
            <div className="h-3.5 w-28 rounded bg-gray-200" />
            <div className="h-3.5 w-32 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function VerifiedPaymentsTable({
  from,
  to,
  parishId,
  documentType,
  coordinator,
  refreshTrigger,
}: VerifiedPaymentsTableProps) {
  const searchInputId = useId();
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<VerifiedPaymentItem[] | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorQueryKey, setErrorQueryKey] = useState('');
  const [staleError, setStaleError] = useState('');
  const [dataQueryKey, setDataQueryKey] = useState('');

  const showParishColumn = coordinator && !parishId;

  // Build a query identity key
  const buildQueryKey = useCallback(
    (pFrom: string, pTo: string, pParish: string, pDoc: string, pSearch: string, pPage: number) => {
      return `${pFrom}|${pTo}|${pParish}|${pDoc}|${pSearch}|${pPage}`;
    },
    []
  );

  // Synchronously derive current query key during render pass (FIX H-02)
  const currentQueryKey = buildQueryKey(from, to, parishId, documentType, debouncedSearch, page);
  const isMatchingQuery = dataQueryKey === currentQueryKey;

  // Search debounce: typing resets page to 1 and debounces by ~300ms
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    // Invalidate any in-flight request when search input changes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value.trim());
      setPage(1);
    }, 300);
  };

  // Cleanup debounce timer and abort in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Filter changes (from, to, parishId, documentType) reset page to 1
  const prevFiltersRef = useRef({ from, to, parishId, documentType });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (
      prev.from !== from ||
      prev.to !== to ||
      prev.parishId !== parishId ||
      prev.documentType !== documentType
    ) {
      prevFiltersRef.current = { from, to, parishId, documentType };
      setPage(1);
    }
  }, [from, to, parishId, documentType]);

  // Main data fetch with race-condition, cancellation & stale-data protection
  const fetchVerifiedPayments = useCallback(async () => {
    // Abort previous in-flight request (FIX H-02)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentRequestId = ++requestIdRef.current;
    const targetKey = buildQueryKey(from, to, parishId, documentType, debouncedSearch, page);
    const isSameQuery = dataQueryKey === targetKey;

    setLoading(true);
    setError('');
    setErrorQueryKey('');
    setStaleError('');

    // If query parameters changed, do not retain old rows as if they belong to the new query
    if (!isSameQuery) {
      setData(null);
      setPagination(null);
    }

    try {
      const response = await analyticsApi.getVerifiedPayments(
        {
          from: from || undefined,
          to: to || undefined,
          parishId: parishId || undefined,
          documentType: documentType || undefined,
          search: debouncedSearch || undefined,
          page,
          limit: 20,
        },
        { signal: controller.signal }
      );

      // Ignore obsolete response or aborted request
      if (currentRequestId !== requestIdRef.current || controller.signal.aborted) return;

      setData(response.data);
      setPagination(response.pagination);
      setDataQueryKey(targetKey);
      setError('');
      setErrorQueryKey('');
      setStaleError('');

      // If backend clamped an obsolete page because the dataset shrank, synchronize detailPage safely
      if (response.pagination.page !== page && response.pagination.total > 0) {
        setPage(response.pagination.page);
      }
    } catch (caught: unknown) {
      // Cancellation must NOT become a user-facing API error
      const isCanceled =
        controller.signal.aborted ||
        (caught as { code?: string; name?: string })?.code === 'ERR_CANCELED' ||
        (caught as { code?: string; name?: string })?.name === 'CanceledError';

      if (isCanceled) {
        return;
      }

      // Ignore obsolete error
      if (currentRequestId !== requestIdRef.current) return;

      if (isSameQuery && data) {
        // Refresh failure for the same query retains existing rows with an explicit stale banner
        setStaleError('Unable to refresh verified payment details. Showing previously loaded data.');
      } else {
        // New-query failure clears data and shows retry
        setData(null);
        setPagination(null);
        setDataQueryKey('');
        setError((caught as ApiError)?.message || 'Unable to load verified payment details.');
        setErrorQueryKey(targetKey);
      }
    } finally {
      if (currentRequestId === requestIdRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [buildQueryKey, data, dataQueryKey, debouncedSearch, documentType, from, page, parishId, to]);

  // Trigger fetch whenever query dependencies or manual refresh trigger change
  useEffect(() => {
    void fetchVerifiedPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, parishId, documentType, debouncedSearch, page, refreshTrigger]);

  const isUpdatingSameQuery = loading && isMatchingQuery && Boolean(data);

  return (
    <div className="space-y-4 pt-2">
      {/* Section Header & Search Input */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-gray-900 sm:text-base">
            Verified Payment Details
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Canonical payment records with verified staff authorization and receipt references.
          </p>
        </div>

        {/* Search Input Subsection */}
        <div className="relative w-full sm:w-72">
          <label htmlFor={searchInputId} className="sr-only">
            Search verified payments
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            id={searchInputId}
            type="search"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search reference, tracking, name..."
            maxLength={100}
            className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-xs text-gray-900 shadow-2xs outline-none transition-all placeholder:text-gray-400 hover:border-gray-400 focus:border-crimson-700 focus:ring-2 focus:ring-crimson-700/20"
          />
        </div>
      </div>

      {/* Payment Reference Transparency Subtle Helper Copy */}
      <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 px-3.5 py-2 text-[11px] text-amber-800">
        <span className="font-semibold">Note on Payment References:</span> Payment references may be extracted from the submitted receipt when no stored transaction reference is available.
      </div>

      {/* Same-query Updating Banner */}
      {isUpdatingSameQuery && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-800">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
          <span>Updating verified payment details...</span>
        </div>
      )}

      {/* Stale Data Error Banner (when refresh of same query failed but rows are retained) */}
      {isMatchingQuery && staleError && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>{staleError}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchVerifiedPayments()}
            className="inline-flex items-center gap-1 font-semibold text-amber-800 hover:underline cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton: rendered when query key changed OR when loading without data (FIX H-02) */}
      {(!isMatchingQuery || (loading && !data)) && !(error && errorQueryKey === currentQueryKey) && (
        <TableSkeleton showParish={showParishColumn} />
      )}

      {/* Error State for New Query Failure */}
      {error && errorQueryKey === currentQueryKey && !data && (
        <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-red-200 bg-white p-6 text-center shadow-xs">
          <AlertCircle className="h-6 w-6 text-red-500" />
          <h4 className="mt-2 text-xs font-bold text-gray-900">Unable to load verified payment details</h4>
          <p className="mt-1 text-xs text-gray-500 max-w-sm">{error}</p>
          <button
            type="button"
            onClick={() => void fetchVerifiedPayments()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 active:bg-gray-100 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {/* Data Table: rendered ONLY when currentQueryKey matches the loaded data (FIX H-02) */}
      {isMatchingQuery && data && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
          {data.length === 0 ? (
            <div className="flex h-44 flex-col items-center justify-center p-6 text-center">
              <p className="text-xs font-medium text-gray-500">
                {debouncedSearch || documentType
                  ? 'No verified payments match the selected filters.'
                  : 'No verified payments were recorded for this period.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50/75 text-gray-600 font-semibold">
                    <tr>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">
                        Request Reference
                      </th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">
                        Payment Reference
                      </th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">
                        Parishioner
                      </th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">
                        Document Type
                      </th>
                      {showParishColumn && (
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">
                          Parish
                        </th>
                      )}
                      <th scope="col" className="px-4 py-3 text-right whitespace-nowrap">
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">
                        Payment Submitted
                      </th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">
                        Verified At / Verifier
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
                    {data.map((row) => (
                      <tr key={row.id} className="transition-colors hover:bg-gray-50/60">
                        {/* Request Reference */}
                        <td className="px-4 py-3 font-mono font-medium text-gray-900 whitespace-nowrap">
                          {row.requestReference || '—'}
                        </td>

                        {/* Payment Reference */}
                        <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">
                          {row.paymentReference || '—'}
                        </td>

                        {/* Parishioner */}
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {row.parishioner.name || '—'}
                        </td>

                        {/* Document Type */}
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap capitalize">
                          {row.documentType ? row.documentType.replaceAll('_', ' ').toLowerCase() : '—'}
                        </td>

                        {/* Parish (Coordinator diocese-wide only) */}
                        {showParishColumn && (
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                            {row.parish.name || '—'}
                          </td>
                        )}

                        {/* Amount */}
                        <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                          {formatAmount(row.amount)}
                        </td>

                        {/* Payment Submitted */}
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {formatManilaDateTime(row.paymentSubmittedAt)}
                        </td>

                        {/* Verified At + Verifier */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-gray-900">
                            {formatManilaDateTime(row.verifiedAt)}
                          </div>
                          {row.verifiedBy && (
                            <div className="text-[11px] text-gray-500">
                              by {row.verifiedBy.name}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Guard: do NOT render when total === 0; render only when totalPages > 1 */}
              {pagination && pagination.totalPages > 1 && pagination.total > 0 && (
                <Pagination
                  currentPage={page}
                  totalPages={pagination.totalPages}
                  total={pagination.total}
                  pageSize={pagination.limit}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
