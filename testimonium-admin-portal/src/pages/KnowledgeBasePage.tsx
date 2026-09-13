import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2,
  X,
  Database,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  knowledgeApi,
  type KnowledgeSource,
  type KnowledgeListParams,
  type KnowledgeScope,
  type KnowledgeAuthority,
  type KnowledgeSourceStatus,
  type KnowledgeSourceType,
} from '@/api/knowledgeApi';
import { caloyAdminApi, type CaloyKnowledgeStatsResponse } from '@/api/caloyAdminApi';
import { ParishManagementService } from '@/services/ParishManagementService';
import type { Parish } from '@/types';

export function KnowledgeBasePage({
  initialKnowledgeStats = null,
  initialSources = null,
}: {
  initialKnowledgeStats?: CaloyKnowledgeStatsResponse | null;
  initialSources?: KnowledgeSource[] | null;
} = {}) {
  const navigate = useNavigate();

  const [sources, setSources] = useState<KnowledgeSource[]>(initialSources ?? []);
  const [knowledgeStats, setKnowledgeStats] = useState<CaloyKnowledgeStatsResponse | null>(initialKnowledgeStats);
  const [loading, setLoading] = useState(!initialKnowledgeStats && !initialSources);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [authorityFilter, setAuthorityFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 20;

  // Parishes lookup for selector
  const [parishes, setParishes] = useState<Parish[]>([]);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formSourceText, setFormSourceText] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSourceType, setFormSourceType] = useState<KnowledgeSourceType>('SYSTEM_GUIDE');
  const [formScope, setFormScope] = useState<KnowledgeScope>('DIOCESE');
  const [formParishId, setFormParishId] = useState<number | null>(null);
  const [formSourceReference, setFormSourceReference] = useState('');
  const [formChunks, setFormChunks] = useState<Array<{ content: string }>>([
    { content: '' },
  ]);

  const loadSources = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: KnowledgeListParams = { page, limit: pageSize };
      if (scopeFilter !== 'ALL') params.scope = scopeFilter as KnowledgeScope;
      if (statusFilter !== 'ALL') params.status = statusFilter as KnowledgeSourceStatus;
      if (authorityFilter !== 'ALL') params.authority = authorityFilter as KnowledgeAuthority;
      if (search.trim()) params.search = search.trim();

      const res = await knowledgeApi.list(params);
      setSources(res.data || []);
      setTotal(res.total);
      setTotalPages(res.totalPages);

      try {
        const stats = await caloyAdminApi.getKnowledgeStats();
        setKnowledgeStats(stats);
      } catch (statsErr) {
        console.warn('Knowledge stats fetch non-fatal error:', statsErr);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load knowledge sources';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, search, scopeFilter, statusFilter, authorityFilter]);

  useEffect(() => {
    if (!initialKnowledgeStats && !initialSources) loadSources();
  }, [loadSources, initialKnowledgeStats, initialSources]);

  useEffect(() => {
    ParishManagementService.getParishes()
      .then((data) => setParishes(data || []))
      .catch(() => setParishes([]));
  }, []);

  const handleAddChunk = () => {
    setFormChunks([...formChunks, { content: '' }]);
  };

  const handleRemoveChunk = (index: number) => {
    if (formChunks.length <= 1) return;
    setFormChunks(formChunks.filter((_, i) => i !== index));
  };

  const handleChunkChange = (index: number, val: string) => {
    const updated = [...formChunks];
    updated[index].content = val;
    setFormChunks(updated);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!formTitle.trim()) {
      setCreateError('Title is required');
      return;
    }
    if (!formSourceText.trim()) {
      setCreateError('Source text is required');
      return;
    }
    const validChunks = formChunks.filter((c) => c.content.trim().length > 0);
    if (validChunks.length === 0) {
      setCreateError('At least one non-empty chunk is required');
      return;
    }

    try {
      setSubmitting(true);
      await knowledgeApi.create({
        title: formTitle.trim(),
        sourceText: formSourceText.trim(),
        category: formCategory.trim() || null,
        sourceType: formSourceType,
        sourceReference: formSourceReference.trim() || null,
        scope: formScope,
        parishId: formScope === 'PARISH' ? formParishId : null,
        chunks: validChunks.map((c, idx) => ({ content: c.content.trim(), chunkOrder: idx })),
      });

      setIsCreateOpen(false);
      resetForm();
      loadSources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create knowledge source';
      setCreateError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormSourceText('');
    setFormCategory('');
    setFormSourceType('SYSTEM_GUIDE');
    setFormScope('DIOCESE');
    setFormParishId(null);
    setFormSourceReference('');
    setFormChunks([{ content: '' }]);
    setCreateError(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        subtitle="Curate and govern verified diocesan and parish procedures for Caloy AI assistant"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadSources()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => {
                resetForm();
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Source
            </button>
          </div>
        }
      />

      {/* Embedding Engine Read-Only Banner */}
      {knowledgeStats && (
        <div className="p-3.5 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-bold text-gray-800">Embedding Engine:</span>
            <span className="font-mono text-gray-900 font-semibold">{knowledgeStats.embeddingConfig.model}</span>
            <span className="text-gray-500">
              ({knowledgeStats.embeddingConfig.dimensions} dimensions · {knowledgeStats.embeddingConfig.provider})
            </span>
          </div>
          <span className="text-gray-400 text-[11px]">Fixed vector architecture [read only]</span>
        </div>
      )}

      {/* Diagnostic Summary Cards */}
      {knowledgeStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-[11px] font-semibold text-gray-400 uppercase">Knowledge Sources</span>
            <div className="text-xl font-bold text-gray-900 mt-1">
              {knowledgeStats.sourceCounts.active} <span className="text-xs font-normal text-gray-400">/ {knowledgeStats.sourceCounts.total} Active</span>
            </div>
            <span className="text-[10px] text-gray-400">
              {knowledgeStats.sourceCounts.draft} Drafts · {knowledgeStats.sourceCounts.retired} Retired
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-[11px] font-semibold text-gray-400 uppercase">Chunk Status</span>
            <div className="text-xl font-bold text-emerald-700 mt-1">
              {knowledgeStats.chunkCounts.ready} <span className="text-xs font-normal text-gray-400">Ready</span>
            </div>
            <span className="text-[10px] text-gray-400">
              {knowledgeStats.chunkCounts.pending} Pending · {knowledgeStats.chunkCounts.failed} Failed
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-[11px] font-semibold text-gray-400 uppercase">RAG Queries</span>
            <div className="text-xl font-bold text-purple-700 mt-1">{knowledgeStats.ragQueryCount}</div>
            <span className="text-[10px] text-gray-400">
              {knowledgeStats.insufficientEvidenceCount} Insufficient Evidence
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-[11px] font-semibold text-gray-400 uppercase">Avg Top Retrieval Score</span>
            <div className="text-xl font-bold text-indigo-700 mt-1">
              {knowledgeStats.averageRetrievalScore !== null
                ? `${(knowledgeStats.averageRetrievalScore * 100).toFixed(1)}%`
                : 'No activity'}
            </div>
            <span className="text-[10px] text-gray-400">
              {knowledgeStats.averageRetrievalScore !== null
                ? 'Cosine similarity score'
                : 'No retrieval activity for this period.'}
            </span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title, category, or parish..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Filter className="w-3.5 h-3.5" />
            Filters:
          </div>

          <select
            value={scopeFilter}
            onChange={(e) => {
              setScopeFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by Scope"
            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="ALL">All Scopes</option>
            <option value="DIOCESE">Diocese</option>
            <option value="PARISH">Parish</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by Status"
            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="RETIRED">Retired</option>
          </select>

          <select
            value={authorityFilter}
            onChange={(e) => {
              setAuthorityFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by Authority"
            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="ALL">All Authorities</option>
            <option value="PROVISIONAL">Provisional</option>
            <option value="CONFIRMED">Confirmed</option>
          </select>
        </div>
      </div>

      {/* Content Table / Cards */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading knowledge base records...</p>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => loadSources()} />
      ) : sources.length === 0 ? (
        <EmptyState
          title="No Knowledge Sources Found"
          description={
            search || scopeFilter !== 'ALL' || statusFilter !== 'ALL' || authorityFilter !== 'ALL'
              ? 'No records match the current filter criteria.'
              : 'The knowledge base is currently empty. Click "New Source" to create the first verified guide.'
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3.5">Title & Category</th>
                  <th className="px-5 py-3.5">Scope</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Authority</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Version</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sources.map((source) => {
                  const isConfirmed = source.authority === 'CONFIRMED';
                  const isActive = source.status === 'ACTIVE';
                  const isRetired = source.status === 'RETIRED';

                  return (
                    <tr
                      key={source.id}
                      className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                      onClick={() => navigate(`/caloy/knowledge-base/${source.id}`)}
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-900 line-clamp-1">{source.title}</div>
                        {source.category && (
                          <div className="text-xs text-gray-500 mt-0.5">{source.category}</div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {source.scope === 'DIOCESE' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            Diocese
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                            {source.parish?.parishName || `Parish #${source.parishId}`}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs text-gray-600">
                        {source.sourceType.replaceAll('_', ' ')}
                      </td>

                      <td className="px-5 py-4">
                        {isConfirmed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3" />
                            Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            Provisional
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                            Active
                          </span>
                        ) : isRetired ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            Retired
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                            Draft
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs text-gray-500 font-mono">
                        v{source.version}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/caloy/knowledge-base/${source.id}`);
                          }}
                          className="text-xs font-medium text-brand-600 hover:text-brand-800 hover:underline"
                        >
                          View & Govern &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50/60 px-5 py-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {total === 0
                ? '0 sources'
                : `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}`}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs font-medium">
                Page {page} of {Math.max(totalPages, 1)}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages || loading}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">New Knowledge Source</h3>
                <p className="text-xs text-gray-500">
                  Creates a new entry in DRAFT and PROVISIONAL status.
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {createError && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Baptismal Certificate Guidelines"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Scope</label>
                  <select
                    value={formScope}
                    onChange={(e) => {
                      const newScope = e.target.value as KnowledgeScope;
                      setFormScope(newScope);
                      if (newScope === 'DIOCESE') setFormParishId(null);
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="DIOCESE">Diocese (All Parishes)</option>
                    <option value="PARISH">Specific Parish</option>
                  </select>
                </div>

                {formScope === 'PARISH' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Parish</label>
                    <select
                      value={formParishId || ''}
                      onChange={(e) => setFormParishId(Number(e.target.value) || null)}
                      required
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 bg-white"
                    >
                      <option value="">Select parish...</option>
                      {parishes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Source Type</label>
                  <select
                    value={formSourceType}
                    onChange={(e) => setFormSourceType(e.target.value as KnowledgeSourceType)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="SYSTEM_GUIDE">System Guide</option>
                    <option value="PARISH_PROCEDURE">Parish Procedure</option>
                    <option value="DIOCESE_PROCEDURE">Diocese Procedure</option>
                    <option value="CLERGY_INTERVIEW">Clergy Interview</option>
                    <option value="OFFICIAL_SOURCE">Official Source</option>
                    <option value="ADMIN_ENTRY">Admin Entry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="e.g. SACRAMENT, GUIDELINES"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Source Reference (HTTPS URL or note)</label>
                <input
                  type="text"
                  value={formSourceReference}
                  onChange={(e) => setFormSourceReference(e.target.value)}
                  placeholder="https://testimonium.sanctuary/guides/..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Full Source Text <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={formSourceText}
                  onChange={(e) => setFormSourceText(e.target.value)}
                  placeholder="Paste the full authoritative text here..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Chunks Section */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Knowledge Chunks (Retrieval Passages)
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Break the text into focused passages (typically 1-3 paragraphs each).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddChunk}
                    className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Chunk
                  </button>
                </div>

                {formChunks.map((chunk, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                      <span>Chunk #{idx + 1}</span>
                      {formChunks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveChunk(idx)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      required
                      value={chunk.content}
                      onChange={(e) => handleChunkChange(idx, e.target.value)}
                      placeholder="Chunk passage text..."
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 shadow-sm"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
