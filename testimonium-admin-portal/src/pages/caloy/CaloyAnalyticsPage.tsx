import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart2,
  Filter,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { caloyAdminApi, type CaloyAnalyticsResponse } from '@/api/caloyAdminApi';
import { ParishManagementService } from '@/services/ParishManagementService';
import type { Parish } from '@/types';
import { CustomSelect } from '@/components/ui/CustomSelect';

const DATE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
  { id: 'custom', label: 'Custom' },
];

export function CaloyAnalyticsPage({ initialData = null }: { initialData?: CaloyAnalyticsResponse | null } = {}) {
  const [preset, setPreset] = useState('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedParishId, setSelectedParishId] = useState<string>('all');
  const [parishes, setParishes] = useState<Parish[]>([]);

  const [data, setData] = useState<CaloyAnalyticsResponse | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestGenerationRef = useRef(0);

  // Load parishes for parish context filter
  useEffect(() => {
    ParishManagementService.getParishes()
      .then((p: Parish[]) => setParishes(p || []))
      .catch((err: unknown) => console.warn('Failed to load parishes for filter:', err));
  }, []);

  const fetchAnalytics = useCallback(async () => {
    const generation = ++requestGenerationRef.current;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const params: Record<string, any> = { preset };
      if (preset === 'custom') {
        if (!from || !to) {
          setError('Please select both start and end dates for custom range.');
          setLoading(false);
          return;
        }
        if (new Date(from) > new Date(to)) {
          setError('Start date cannot be after end date.');
          setLoading(false);
          return;
        }
        params.from = from;
        params.to = to;
      }
      if (selectedParishId !== 'all') {
        params.parishId = Number(selectedParishId);
      }

      const res = await caloyAdminApi.getAnalytics(params, controller.signal);
      if (generation !== requestGenerationRef.current) return;
      setData(res);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return;
      }
      if (generation !== requestGenerationRef.current) return;
      console.error('Analytics fetch error:', err);
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to fetch analytics.');
    } finally {
      if (generation === requestGenerationRef.current) setLoading(false);
    }
  }, [preset, from, to, selectedParishId]);

  useEffect(() => {
    if (!initialData) fetchAnalytics();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAnalytics, initialData]);

  return (
    <div className="space-y-6">
      {/* Filter Controls Header */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPreset(p.id);
                if (p.id !== 'custom') {
                  setFrom('');
                  setTo('');
                }
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                preset === p.id
                  ? 'bg-crimson-700 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range if selected */}
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg text-gray-800 font-medium focus:outline-none focus:ring-1 focus:ring-crimson-700"
            />
            <span className="text-xs text-gray-600 font-medium">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg text-gray-800 font-medium focus:outline-none focus:ring-1 focus:ring-crimson-700"
            />
            <button
              onClick={fetchAnalytics}
              className="px-2.5 py-1.5 bg-gray-100 text-gray-800 text-xs font-semibold rounded-lg hover:bg-gray-200 border border-gray-200 transition-colors"
            >
              Apply
            </button>
          </div>
        )}

        {/* Parish Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 whitespace-nowrap">
            <Filter className="w-3.5 h-3.5" />
            Parish Context:
          </label>
          <div className="w-56 min-w-[180px]">
            <CustomSelect
              value={selectedParishId}
              onChange={(val) => setSelectedParishId(String(val))}
              options={[
                { value: 'all', label: 'All Parishes' },
                ...parishes.map((p) => ({ value: String(p.id), label: p.name })),
              ]}
              size="sm"
              aria-label="Filter by parish context"
            />
          </div>

          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-1.5 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            title="Refresh Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
          <RefreshCw className="w-8 h-8 text-crimson-700 animate-spin mb-3" />
          <p className="text-sm text-gray-600 font-medium">Aggregating Caloy analytics data (Asia/Manila)...</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Unified Panel: Performance & Volume Telemetry */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-200 bg-gray-50/70 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-crimson-700" />
                Performance &amp; Volume Telemetry
              </h3>
              <span className="text-xs text-gray-500 font-medium hidden sm:inline">Aggregated period summary</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-px bg-gray-200">
              <div className="bg-white p-4 flex flex-col justify-between">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Queries</span>
                <div className="text-2xl font-bold text-gray-900 mt-1">{data.summary.userQueries}</div>
                <span className="text-xs text-gray-600 mt-1 font-medium">Accepted chats</span>
              </div>
              <div className="bg-white p-4 flex flex-col justify-between">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Provider Gen</span>
                <div className="text-2xl font-bold text-purple-700 mt-1">{data.summary.generationRequests}</div>
                <span className="text-xs text-gray-600 mt-1 font-medium">Measured requests</span>
              </div>
              <div className="bg-white p-4 flex flex-col justify-between">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Provider Embed</span>
                <div className="text-2xl font-bold text-emerald-700 mt-1">{data.summary.embeddingRequests}</div>
                <span className="text-xs text-gray-600 mt-1 font-medium">Measured requests</span>
              </div>
              <div className="bg-white p-4 flex flex-col justify-between">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Fallback Rate</span>
                <div className="text-2xl font-bold text-orange-600 mt-1">{data.summary.fallbackRate.toFixed(1)}%</div>
                <span className="text-xs text-gray-600 mt-1 font-medium">Low confidence / unhandled</span>
              </div>
              <div className="bg-white p-4 flex flex-col justify-between">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Avg Latency</span>
                <div className="text-2xl font-bold text-blue-700 mt-1">{data.summary.averageLatencyMs}ms</div>
                <span className="text-xs text-gray-600 mt-1 font-medium">Mean response time</span>
              </div>
              <div className="bg-white p-4 flex flex-col justify-between">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">P95 Latency</span>
                <div className="text-2xl font-bold text-indigo-700 mt-1">{data.summary.p95LatencyMs}ms</div>
                <span className="text-xs text-gray-600 mt-1 font-medium">95th percentile</span>
              </div>
              <div className="bg-white p-4 flex flex-col justify-between">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Failed Chats</span>
                <div className="text-2xl font-bold text-red-600 mt-1">{data.summary.failedInteractions}</div>
                <span className="text-xs text-gray-600 mt-1 font-medium">Final outcome</span>
              </div>
              <div className="bg-white p-4 flex flex-col justify-between">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Failed Provider</span>
                <div className="text-2xl font-bold text-amber-600 mt-1">{data.summary.failedProviderAttempts}</div>
                <span className="text-xs text-gray-600 mt-1 font-medium">{data.summary.providerRateLimits} were 429s</span>
              </div>
            </div>
          </div>

          {/* Time Series: Queries vs Measured Provider Requests */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-crimson-700" />
                  Activity Over Time: User Queries vs Measured Provider Requests
                </h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Aggregated in Asia/Manila timezone. Provider requests are global date/model-filtered SDK attempts including retries; parish, response, and category filters apply only to user-query metrics.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-crimson-700 rounded-sm" />
                  <span className="text-gray-700 font-semibold">User Queries</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-purple-600 rounded-sm" />
                  <span className="text-gray-700 font-semibold">Provider Generation</span>
                </div>
              </div>
            </div>

            {data.timeSeries.length === 0 ? (
              <div className="text-center py-12 text-gray-500 font-medium text-sm">No activity recorded for this date range.</div>
            ) : (
              <div className="space-y-2 mt-4">
                {data.timeSeries.map((bucket) => {
                  const maxVal = Math.max(
                    ...data.timeSeries.map((b) => Math.max(b.queries, b.generationRequests, 1))
                  );
                  const queryPct = (bucket.queries / maxVal) * 100;
                  const genPct = (bucket.generationRequests / maxVal) * 100;
                  return (
                    <div key={bucket.bucket} className="flex items-center gap-3 text-xs">
                      <div className="w-24 text-gray-700 font-mono flex-shrink-0 text-right font-medium">{bucket.bucket}</div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 bg-crimson-700 rounded transition-all duration-300 min-w-[3px]"
                            style={{ width: `${Math.max(queryPct, 2)}%` }}
                          />
                          <span className="text-xs text-gray-800 font-semibold">{bucket.queries}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 bg-purple-600 rounded transition-all duration-300 min-w-[3px]"
                            style={{ width: `${Math.max(genPct, 2)}%` }}
                          />
                          <span className="text-xs text-gray-700 font-medium">{bucket.generationRequests}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Two Columns: Route Distribution & Queries by Parish Context */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Route Distribution */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1">
                Route Distribution
              </h3>
              <p className="text-xs text-gray-600 mb-4">
                Categorization of accepted chatbot queries across operational execution paths. Legacy records appear as UNKNOWN / LEGACY.
              </p>

              <div className="space-y-3">
                {data.routeDistribution.map((item) => (
                  <div key={item.responseType} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-gray-800">
                      <span>{item.responseType}</span>
                      <span>
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-crimson-700 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Queries by Parish Context */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1">
                Queries by Parish Context
              </h3>
              <p className="text-xs text-gray-600 mb-4">
                Volume of inquiries with specific parish context selected or detected. Does not imply user parish registration.
              </p>

              {data.parishContext.length === 0 ? (
                <div className="text-center py-8 text-gray-500 font-medium text-xs">No parish context inquiries recorded.</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {data.parishContext.map((pc) => (
                    <div
                      key={pc.parishId ?? 'none'}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs"
                    >
                      <span className="font-semibold text-gray-900">{pc.parishName}</span>
                      <span className="px-2.5 py-0.5 bg-gray-200/80 text-gray-800 rounded font-mono font-semibold">
                        {pc.queryCount} queries
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Two Columns: Model Usage & Error / Fallback Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Model Usage Telemetry */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1">
                Model Usage &amp; Success Rates
              </h3>
              <p className="text-xs text-gray-600 mb-4">
                Recorded provider generation attempts by model, including success rate and average latency.
              </p>

              {data.modelUsage.length === 0 ? (
                <div className="text-center py-8 text-gray-500 font-medium text-xs">No model usage recorded.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Model</th>
                        <th className="py-2.5 px-3 font-semibold">Requests</th>
                        <th className="py-2.5 px-3 font-semibold">Success Rate</th>
                        <th className="py-2.5 px-3 font-semibold">Avg Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.modelUsage.map((m) => (
                        <tr key={m.model}>
                          <td className="py-2 px-3 font-mono font-bold text-gray-900">{m.model}</td>
                          <td className="py-2 px-3 text-gray-800 font-medium">{m.count}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded font-semibold text-[11px] ${
                                m.successRate >= 95
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {m.successRate}%
                            </span>
                          </td>
                          <td className="py-2 px-3 text-gray-700 font-medium">{m.avgLatencyMs}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Fallback Reasons & Error Categories */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1">
                Fallback Reasons &amp; Errors
              </h3>
              <p className="text-xs text-gray-600 mb-4">
                Primary causes for fallback responses or operational provider errors.
              </p>

              {data.fallbackReasons.length === 0 && data.providerErrors.length === 0 ? (
                <div className="text-center py-8 text-gray-500 font-medium text-xs">No fallbacks or errors in this period.</div>
              ) : (
                <div className="space-y-4">
                  {data.fallbackReasons.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 mb-2">Fallback Triggers:</h4>
                      <div className="space-y-1.5">
                        {data.fallbackReasons.map((fr) => (
                          <div key={fr.reason} className="flex justify-between text-xs bg-gray-50 border border-gray-200 p-2 rounded text-gray-800 font-medium">
                            <span className="font-mono text-gray-800">{fr.reason}</span>
                            <span className="font-bold text-gray-900">{fr.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.providerErrors.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-red-700 mb-2">Provider Error Categories:</h4>
                      <div className="space-y-1.5">
                        {data.providerErrors.map((eb) => (
                          <div key={eb.errorCategory} className="flex justify-between text-xs bg-red-50 border border-red-200 p-2 rounded text-red-700 font-medium">
                            <span className="font-mono">{eb.errorCategory}</span>
                            <span className="font-bold text-red-800">{eb.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
