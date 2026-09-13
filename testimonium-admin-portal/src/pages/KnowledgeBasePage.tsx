import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
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
import { CustomSelect } from '@/components/ui/CustomSelect';

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

  const isFormDirty = Boolean(
    formTitle.trim() ||
    formSourceText.trim() ||
    formCategory.trim() ||
    formSourceReference.trim() ||
    formChunks.some((c) => c.content.trim().length > 0)
  );

  const resetForm = useCallback(() => {
    setFormTitle('');
    setFormSourceText('');
    setFormCategory('');
    setFormSourceType('SYSTEM_GUIDE');
    setFormScope('DIOCESE');
    setFormParishId(null);
    setFormSourceReference('');
    setFormChunks([{ content: '' }]);
    setCreateError(null);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsCreateOpen(false);
    resetForm();
  }, [resetForm]);

  useEffect(() => {
    if (!isCreateOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isFormDirty) {
          handleCloseModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateOpen, isFormDirty, handleCloseModal]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      if (!isFormDirty) {
        handleCloseModal();
      }
    }
  };

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
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson-700/30 shadow-sm transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => {
                resetForm();
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-crimson-700 rounded-lg hover:bg-crimson-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson-700/30 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Source
            </button>
          </div>
        }
      />

      {/* Unified Panel: Vector Engine & Knowledge Base Telemetry */}
      {knowledgeStats && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Panel Header */}
          <div className="px-5 py-3.5 border-b border-gray-200 bg-gray-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
              <Database className="w-4 h-4 text-crimson-700" />
              Vector Engine &amp; Knowledge Base Telemetry
            </h3>
            <span className="text-xs text-gray-500 font-medium">Fixed vector architecture [read only]</span>
          </div>

          {/* Engine Spec Sub-bar */}
          <div className="px-5 py-2.5 bg-gray-50/40 border-b border-gray-200 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-gray-800 uppercase tracking-wider">Embedding Engine:</span>
            <span className="font-mono text-gray-900 font-bold text-sm">{knowledgeStats.embeddingConfig.model}</span>
            <span className="text-gray-600 font-medium">
              ({knowledgeStats.embeddingConfig.dimensions} dimensions · {knowledgeStats.embeddingConfig.provider})
            </span>
          </div>

          {/* 4 Core Telemetry Metrics in Responsive Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200">
            <div className="bg-white p-4 flex flex-col justify-between">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Knowledge Sources</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {knowledgeStats.sourceCounts.active} <span className="text-xs font-normal text-gray-500">/ {knowledgeStats.sourceCounts.total} Active</span>
              </div>
              <span className="text-xs text-gray-600 mt-1 font-medium">
                {knowledgeStats.sourceCounts.draft} Drafts · {knowledgeStats.sourceCounts.retired} Retired
              </span>
            </div>

            <div className="bg-white p-4 flex flex-col justify-between">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Chunk Status</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {knowledgeStats.chunkCounts.ready} <span className="text-xs font-normal text-gray-500">Ready</span>
              </div>
              <span className="text-xs text-gray-600 mt-1 font-medium">
                {knowledgeStats.chunkCounts.pending} Pending · {knowledgeStats.chunkCounts.failed} Failed
              </span>
            </div>

            <div className="bg-white p-4 flex flex-col justify-between">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">RAG Queries</span>
              <div className="text-2xl font-bold text-purple-700 mt-1">{knowledgeStats.ragQueryCount}</div>
              <span className="text-xs text-gray-600 mt-1 font-medium">
                {knowledgeStats.insufficientEvidenceCount} Insufficient Evidence
              </span>
            </div>

            <div className="bg-white p-4 flex flex-col justify-between">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Avg Top Retrieval Score</span>
              <div className="text-2xl font-bold text-indigo-700 mt-1">
                {knowledgeStats.averageRetrievalScore !== null
                  ? `${(knowledgeStats.averageRetrievalScore * 100).toFixed(1)}%`
                  : 'No activity'}
              </div>
              <span className="text-xs text-gray-600 mt-1 font-medium">
                {knowledgeStats.averageRetrievalScore !== null
                  ? 'Cosine similarity score'
                  : 'No retrieval activity for this period.'}
              </span>
            </div>
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
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold whitespace-nowrap">
            <Filter className="w-3.5 h-3.5" />
            Filters:
          </div>

          <div className="w-36">
            <CustomSelect
              value={scopeFilter}
              onChange={(val) => {
                setScopeFilter(String(val));
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All Scopes' },
                { value: 'DIOCESE', label: 'Diocese' },
                { value: 'PARISH', label: 'Parish' },
              ]}
              size="sm"
              aria-label="Filter by Scope"
            />
          </div>

          <div className="w-36">
            <CustomSelect
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(String(val));
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'RETIRED', label: 'Retired' },
              ]}
              size="sm"
              aria-label="Filter by Status"
            />
          </div>

          <div className="w-40">
            <CustomSelect
              value={authorityFilter}
              onChange={(val) => {
                setAuthorityFilter(String(val));
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All Authorities' },
                { value: 'PROVISIONAL', label: 'Provisional' },
                { value: 'CONFIRMED', label: 'Confirmed' },
              ]}
              size="sm"
              aria-label="Filter by Authority"
            />
          </div>
        </div>
      </div>

      {/* Content Table / Cards */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <Loader2 className="w-8 h-8 text-crimson-700 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600 font-medium">Loading knowledge base records...</p>
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
              <thead className="bg-gray-50/90 text-gray-700 text-xs font-bold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3.5">Title &amp; Category</th>
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
                        <div className="font-semibold text-gray-900 line-clamp-1">{source.title}</div>
                        {source.category && (
                          <div className="text-xs text-gray-600 font-medium mt-0.5">{source.category}</div>
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

                      <td className="px-5 py-4 text-xs text-gray-700 font-medium">
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

                      <td className="px-5 py-4 text-xs text-gray-600 font-mono font-medium">
                        v{source.version}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/caloy/knowledge-base/${source.id}`);
                          }}
                          className="text-xs font-semibold text-crimson-700 hover:text-crimson-900 hover:underline"
                        >
                          View &amp; Govern &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50/60 px-5 py-3 text-sm text-gray-700 font-medium sm:flex-row sm:items-center sm:justify-between">
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
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs font-semibold text-gray-700">
                Page {page} of {Math.max(totalPages, 1)}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages || loading}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal - Portal to document.body */}
      {isCreateOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-knowledge-source-title"
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 id="new-knowledge-source-title" className="text-lg font-bold text-gray-900">New Knowledge Source</h3>
                <p className="text-xs text-gray-600 font-medium mt-0.5">
                  Creates a new entry in DRAFT and PROVISIONAL status.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                aria-label="Close dialog"
                className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {createError && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">{createError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1">
                  Title <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Baptismal Certificate Guidelines"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">Scope</label>
                  <CustomSelect
                    value={formScope}
                    onChange={(val) => {
                      const newScope = String(val) as KnowledgeScope;
                      setFormScope(newScope);
                      if (newScope === 'DIOCESE') setFormParishId(null);
                    }}
                    options={[
                      { value: 'DIOCESE', label: 'Diocese (All Parishes)' },
                      { value: 'PARISH', label: 'Specific Parish' },
                    ]}
                    aria-label="Scope"
                  />
                </div>

                {formScope === 'PARISH' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1">Parish</label>
                    <CustomSelect
                      value={formParishId || ''}
                      onChange={(val) => setFormParishId(Number(val) || null)}
                      options={[
                        { value: '', label: 'Select parish...' },
                        ...parishes.map((p) => ({ value: p.id, label: p.name })),
                      ]}
                      placeholder="Select parish..."
                      required
                      aria-label="Parish"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">Source Type</label>
                  <CustomSelect
                    value={formSourceType}
                    onChange={(val) => setFormSourceType(String(val) as KnowledgeSourceType)}
                    options={[
                      { value: 'SYSTEM_GUIDE', label: 'System Guide' },
                      { value: 'PARISH_PROCEDURE', label: 'Parish Procedure' },
                      { value: 'DIOCESE_PROCEDURE', label: 'Diocese Procedure' },
                      { value: 'CLERGY_INTERVIEW', label: 'Clergy Interview' },
                      { value: 'OFFICIAL_SOURCE', label: 'Official Source' },
                      { value: 'ADMIN_ENTRY', label: 'Admin Entry' },
                    ]}
                    aria-label="Source Type"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">Category</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="e.g. SACRAMENT, GUIDELINES"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1">Source Reference (HTTPS URL or note)</label>
                <input
                  type="text"
                  value={formSourceReference}
                  onChange={(e) => setFormSourceReference(e.target.value)}
                  placeholder="https://testimonium.sanctuary/guides/..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1">
                  Full Source Text <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={formSourceText}
                  onChange={(e) => setFormSourceText(e.target.value)}
                  placeholder="Paste the full authoritative text here..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700"
                />
              </div>

              {/* Chunks Section */}
              <div className="border-t border-gray-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Knowledge Chunks (Retrieval Passages)
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Break the text into focused passages (typically 1-3 paragraphs each).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddChunk}
                    className="text-xs font-semibold text-crimson-700 hover:text-crimson-800 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Chunk
                  </button>
                </div>

                {formChunks.map((chunk, idx) => (
                  <div key={idx} className="p-3 bg-gray-50/80 rounded-xl border border-gray-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                      <span>Chunk #{idx + 1}</span>
                      {formChunks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveChunk(idx)}
                          className="text-rose-600 hover:text-rose-800 p-0.5 rounded transition-colors"
                          aria-label={`Remove chunk ${idx + 1}`}
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
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700"
                    />
                  </div>
                ))}
              </div>

              {/* Modal Footer: Cancel (secondary ghost) + Create Knowledge Source (dominant primary) */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-crimson-700 rounded-xl hover:bg-crimson-800 disabled:opacity-50 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson-700/30 transition-colors"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Knowledge Source
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
