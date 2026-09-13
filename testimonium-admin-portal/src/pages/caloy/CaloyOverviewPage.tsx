import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  HelpCircle,
  Layers,
  MessageSquare,
  RefreshCw,
  Server,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { caloyAdminApi, type CaloyOverviewResponse } from '@/api/caloyAdminApi';

export function CaloyOverviewPage({ initialData = null }: { initialData?: CaloyOverviewResponse | null } = {}) {
  const [data, setData] = useState<CaloyOverviewResponse | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await caloyAdminApi.getOverview();
      setData(res);
    } catch (err: any) {
      console.error('Failed to fetch Caloy overview:', err);
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to load Caloy overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) fetchOverview();
  }, [fetchOverview, initialData]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
        <RefreshCw className="w-8 h-8 text-crimson-700 animate-spin mb-3" />
        <p className="text-sm text-gray-500 font-medium">Loading Caloy operational telemetry...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center shadow-sm">
        <ShieldAlert className="w-10 h-10 text-red-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-red-800">Operational Overview Unavailable</h3>
        <p className="text-sm text-red-600 mt-1 max-w-md mx-auto">{error}</p>
        <button
          onClick={fetchOverview}
          className="mt-4 px-4 py-2 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800 transition-colors shadow-sm inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Overview
        </button>
      </div>
    );
  }

  if (!data) return null;

  const renderStatusBadge = (status: CaloyOverviewResponse['status']) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Active & Available
          </span>
        );
      case 'DISABLED_BY_COORDINATOR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Disabled by Coordinator
          </span>
        );
      case 'DISABLED_BY_DEPLOYMENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-300">
            <ShieldAlert className="w-3.5 h-3.5" />
            Disabled by Deployment
          </span>
        );
      case 'CONFIGURATION_WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Configuration Warning
          </span>
        );
      case 'CONFIGURATION_DEGRADED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Using Last-Known-Good Config
          </span>
        );
      case 'CONFIGURATION_ERROR':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            <ShieldAlert className="w-3.5 h-3.5" />
            Configuration Error
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Refresh Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {renderStatusBadge(data.status)}
          {!data.runtimeModelValid && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Fallback model active
            </span>
          )}
        </div>
        <button
          onClick={fetchOverview}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Warning Banner if runtime model invalid */}
      {!data.runtimeModelValid && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Configured runtime model is unavailable.</p>
            <p className="text-amber-700 mt-0.5">
              The model configured in settings (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded">{data.configuredGenerationModel}</code>) is not in the approved server catalog. Caloy is safely operating using the deployment fallback (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded">{data.responseGenerationModel}</code>).
            </p>
          </div>
        </div>
      )}

      {/* Top Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Response Generation Model */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Response Generation Model</span>
            <Cpu className="w-4 h-4 text-crimson-700" />
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900 font-mono">{data.responseGenerationModel}</div>
            <p className="text-xs text-gray-500 mt-1">Provider: Gemini (Google GenAI)</p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Configured: {data.configuredGenerationModel || 'Environment Default'}</span>
            <Link to="/caloy/settings" className="text-crimson-700 hover:underline inline-flex items-center gap-1 font-medium">
              Change
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Semantic Router Model */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Semantic Router Model</span>
            <Server className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900 font-mono">{data.semanticRouterModel}</div>
            <p className="text-xs text-gray-500 mt-1">Dedicated intent classification & tool router</p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
            Fixed architecture [read only]
          </div>
        </div>

        {/* Embedding Model */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Embedding Model</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900 font-mono">{data.embeddingModel}</div>
            <p className="text-xs text-gray-500 mt-1">{data.embeddingDimensions} dimensions (Gemini Embeddings)</p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
            Fixed knowledge vectors [read only]
          </div>
        </div>
      </div>

      {/* Primary Telemetry Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Queries Today */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-xs font-semibold uppercase">Queries Today</span>
            <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{data.metrics.queriesToday}</div>
          <div className="text-[11px] text-gray-400 mt-1">Accepted chats</div>
        </div>

        {/* Generation Requests Today */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-xs font-semibold uppercase">Gen. Requests</span>
            <Cpu className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{data.metrics.generationRequestsToday}</div>
          <div className="text-[11px] text-gray-400 mt-1">Measured provider calls</div>
        </div>

        {/* Embedding Requests Today */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-xs font-semibold uppercase">Embeddings</span>
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{data.metrics.embeddingRequestsToday}</div>
          <div className="text-[11px] text-gray-400 mt-1">Query + Doc calls</div>
        </div>

        {/* Measured RPM */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-xs font-semibold uppercase">Measured RPM</span>
            <Zap className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{data.metrics.measuredRpm}</div>
          <div className="text-[11px] text-gray-400 mt-1">Last 60s attempts</div>
        </div>

        {/* Fallback Rate */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-xs font-semibold uppercase">Fallback Rate</span>
            <HelpCircle className="w-3.5 h-3.5 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{data.metrics.fallbackRate.toFixed(1)}%</div>
          <div className="text-[11px] text-gray-400 mt-1">RAG / Tool fallbacks</div>
        </div>

        {/* Average Latency */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-xs font-semibold uppercase">Avg Latency</span>
            <Clock className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{data.metrics.averageResponseTimeMs}ms</div>
          <div className="text-[11px] text-gray-400 mt-1">End-to-end response</div>
        </div>

        {/* Errors Today */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-xs font-semibold uppercase">Errors Today</span>
            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600">{data.metrics.failedInteractionsToday}</div>
          <div className="text-[10px] text-gray-400 mt-1">{data.metrics.failedProviderAttemptsToday} failed provider attempts</div>
          <div className="text-[11px] text-gray-400 mt-1">Provider & system errors</div>
        </div>
      </div>

      {/* Two Lower Panels: Knowledge Base Health + Recent Errors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Knowledge Base Health Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-crimson-700" />
                Knowledge Base Health
              </h3>
              <Link
                to="/caloy/knowledge-base"
                className="text-xs font-medium text-crimson-700 hover:text-crimson-800 hover:underline inline-flex items-center gap-1"
              >
                Manage Knowledge Base
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <div className="text-xl font-bold text-gray-900">{data.knowledgeHealth.totalSources}</div>
                <div className="text-xs text-gray-500 mt-0.5">Total Sources</div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg text-center">
                <div className="text-xl font-bold text-emerald-700">{data.knowledgeHealth.activeSources}</div>
                <div className="text-xs text-emerald-600 mt-0.5">Active Sources</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-700">{data.knowledgeHealth.readyChunks}</div>
                <div className="text-xs text-blue-600 mt-0.5">Ready Chunks</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-center">
                <div className="text-xl font-bold text-red-600">{data.knowledgeHealth.failedChunks}</div>
                <div className="text-xs text-red-600 mt-0.5">Failed Chunks</div>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Chunks with status READY provide grounded vector embeddings for procedural diocesan knowledge. Failed chunks can be retried individually in the Knowledge Base tab.
            </p>
          </div>
        </div>

        {/* Recent Errors Panel */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                Recent Operational Errors
              </h3>
              <Link
                to="/caloy/logs"
                className="text-xs font-medium text-crimson-700 hover:text-crimson-800 hover:underline inline-flex items-center gap-1"
              >
                View Operational Logs
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {data.recentErrors.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">No operational errors recorded today</p>
                <p className="text-xs text-gray-400 mt-1">Provider calls and semantic routes are healthy.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Time</th>
                      <th className="py-2 px-3 font-semibold">Category</th>
                      <th className="py-2 px-3 font-semibold">Error / Fallback</th>
                      <th className="py-2 px-3 font-semibold">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.recentErrors.slice(0, 5).map((err) => (
                      <tr key={err.id} className="hover:bg-gray-50/60">
                        <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                          {new Date(err.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-2 px-3 text-gray-900 font-medium">{err.category}</td>
                        <td className="py-2 px-3 text-red-600 font-mono">
                          {err.errorCategory || err.fallbackReason || 'ERROR'}
                        </td>
                        <td className="py-2 px-3 text-gray-500">{err.latencyMs}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
            Privacy Safe: Error entries display operational error categories and latencies only. No parishioner message text is exposed.
          </div>
        </div>
      </div>
    </div>
  );
}
