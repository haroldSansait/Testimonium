import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  RefreshCw,
  Send,
  Archive,
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import {
  knowledgeApi,
  type KnowledgeSource,
  type KnowledgeScope,
  type KnowledgeSourceType,
} from '@/api/knowledgeApi';
import { ParishManagementService } from '@/services/ParishManagementService';
import type { Parish } from '@/types';

export function KnowledgeSourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [source, setSource] = useState<KnowledgeSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [concurrencyError, setConcurrencyError] = useState<string | null>(null);

  // Parishes lookup
  const [parishes, setParishes] = useState<Parish[]>([]);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSourceText, setEditSourceText] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSourceType, setEditSourceType] = useState<KnowledgeSourceType>('SYSTEM_GUIDE');
  const [editScope, setEditScope] = useState<KnowledgeScope>('DIOCESE');
  const [editParishId, setEditParishId] = useState<number | null>(null);
  const [editSourceReference, setEditSourceReference] = useState('');
  const [editChunks, setEditChunks] = useState<Array<{ content: string; chunkOrder?: number }>>([]);

  const loadSource = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      setConcurrencyError(null);
      const data = await knowledgeApi.getById(Number(id));
      setSource(data);

      // Populate edit fields
      setEditTitle(data.title);
      setEditSourceText(data.sourceText);
      setEditCategory(data.category || '');
      setEditSourceType(data.sourceType);
      setEditScope(data.scope);
      setEditParishId(data.parishId || null);
      setEditSourceReference(data.sourceReference || '');

      const currentChunks = (data.chunks || [])
        .filter((c) => c.sourceVersion === data.version)
        .sort((a, b) => a.chunkOrder - b.chunkOrder);

      setEditChunks(
        currentChunks.length > 0
          ? currentChunks.map((c) => ({ content: c.content, chunkOrder: c.chunkOrder }))
          : [{ content: '' }]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load source details';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSource();
  }, [loadSource]);

  useEffect(() => {
    ParishManagementService.getParishes()
      .then((data) => setParishes(data || []))
      .catch(() => setParishes([]));
  }, []);

  const handleConfirm = async () => {
    if (!source) return;
    try {
      setActionLoading(true);
      setActionMessage(null);
      setConcurrencyError(null);
      await knowledgeApi.confirm(source.id, source.version);
      setActionMessage('Knowledge source confirmed successfully. Chunks are now queued for embedding.');
      await loadSource();
    } catch (err: unknown) {
      handleApiError(err, 'confirm source');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!source) return;
    try {
      setActionLoading(true);
      setActionMessage(null);
      setConcurrencyError(null);
      await knowledgeApi.publish(source.id, source.version);
      setActionMessage('Knowledge source is now ACTIVE and retrievable by Caloy.');
      await loadSource();
    } catch (err: unknown) {
      handleApiError(err, 'publish source');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetire = async () => {
    if (!source) return;
    if (!window.confirm('Are you sure you want to retire this knowledge source? It will no longer be retrievable by Caloy.')) {
      return;
    }
    try {
      setActionLoading(true);
      setActionMessage(null);
      setConcurrencyError(null);
      await knowledgeApi.retire(source.id, source.version);
      setActionMessage('Knowledge source retired.');
      await loadSource();
    } catch (err: unknown) {
      handleApiError(err, 'retire source');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!source) return;
    try {
      setActionLoading(true);
      setActionMessage(null);
      setConcurrencyError(null);
      const res = await knowledgeApi.retryEmbedding(source.id, source.version);
      setActionMessage(`Re-queued ${res.retriedCount} failed chunk(s) for embedding.`);
      await loadSource();
    } catch (err: unknown) {
      handleApiError(err, 'retry embedding');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source) return;

    try {
      setActionLoading(true);
      setActionMessage(null);
      setConcurrencyError(null);

      const validChunks = editChunks.filter((c) => c.content.trim().length > 0);
      if (validChunks.length === 0) {
        setError('At least one chunk is required');
        setActionLoading(false);
        return;
      }

      await knowledgeApi.update(source.id, {
        expectedVersion: source.version,
        title: editTitle.trim(),
        sourceText: editSourceText.trim(),
        category: editCategory.trim() || null,
        sourceType: editSourceType,
        sourceReference: editSourceReference.trim() || null,
        scope: editScope,
        parishId: editScope === 'PARISH' ? editParishId : null,
        chunks: validChunks.map((c, idx) => ({ content: c.content.trim(), chunkOrder: idx })),
      });

      setIsEditing(false);
      setActionMessage('Knowledge source updated. Version bumped to v' + (source.version + 1) + '. Status reset to DRAFT / PROVISIONAL.');
      await loadSource();
    } catch (err: unknown) {
      handleApiError(err, 'save edits');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApiError = (err: unknown, actionName: string) => {
    if (typeof err === 'object' && err !== null && 'response' in err) {
      const resp = (err as { response?: { status?: number; data?: { code?: string; message?: string } } }).response;
      if (resp?.status === 409 || resp?.data?.code === 'KNOWLEDGE_CONCURRENCY_CONFLICT') {
        setConcurrencyError(
          resp.data?.message ||
            'Conflict: This source was updated by another administrator. Please reload to see the latest version.'
        );
        return;
      }
      setError(resp?.data?.message || `Failed to ${actionName}`);
      return;
    }
    setError(err instanceof Error ? err.message : `Failed to ${actionName}`);
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading source details...</p>
      </div>
    );
  }

  if (error && !source) {
    return (
      <div className="p-6 bg-rose-50 rounded-xl border border-rose-200 text-rose-700 space-y-3">
        <p className="text-sm font-semibold">{error}</p>
        <button
          onClick={() => navigate('/caloy/knowledge-base')}
          className="text-xs font-medium underline"
        >
          &larr; Back to Knowledge Base
        </button>
      </div>
    );
  }

  if (!source) return null;

  const currentChunks = (source.chunks || []).filter(
    (c) => c.sourceVersion === source.version
  );
  const totalChunks = currentChunks.length;
  const readyChunks = currentChunks.filter((c) => c.embeddingStatus === 'READY').length;
  const failedChunks = currentChunks.filter((c) => c.embeddingStatus === 'FAILED').length;
  const pendingChunks = currentChunks.filter(
    (c) => c.embeddingStatus === 'PENDING' || c.embeddingStatus === 'PROCESSING'
  ).length;

  const allReady = totalChunks > 0 && readyChunks === totalChunks;
  const isConfirmed = source.authority === 'CONFIRMED';
  const isDraft = source.status === 'DRAFT';
  const isActive = source.status === 'ACTIVE';
  const isRetired = source.status === 'RETIRED';

  const canPublish = isConfirmed && isDraft && allReady;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumbs & Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <nav className="flex items-center gap-2 text-xs text-gray-500 font-medium">
          <button
            type="button"
            onClick={() => navigate('/caloy')}
            className="hover:text-crimson-700"
          >
            Caloy
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => navigate('/caloy/knowledge-base')}
            className="hover:text-crimson-700"
          >
            Knowledge Base
          </button>
          <span>/</span>
          <span className="text-gray-900 font-semibold truncate max-w-xs">{source.title}</span>
        </nav>

        <button
          onClick={() => navigate('/caloy/knowledge-base')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Knowledge Base
        </button>
      </div>

      {/* Concurrency Conflict Banner */}
      {concurrencyError && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-start gap-3 shadow-sm animate-in fade-in">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-bold">{concurrencyError}</p>
            <button
              onClick={() => loadSource()}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold"
            >
              Reload Latest Version
            </button>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {actionMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center justify-between shadow-sm">
          <span>{actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Status Bar */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                v{source.version}
              </span>
              <h1 className="text-xl font-bold text-gray-900">{source.title}</h1>
            </div>
            {source.category && (
              <p className="text-xs text-gray-500 font-medium">Category: {source.category}</p>
            )}
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Authority Badge */}
            {isConfirmed ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle className="w-3.5 h-3.5" />
                Confirmed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="w-3.5 h-3.5" />
                Provisional
              </span>
            )}

            {/* Status Badge */}
            {isActive ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                Active (Retrievable)
              </span>
            ) : isRetired ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                Retired
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                Draft
              </span>
            )}

            {/* Scope Badge */}
            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
              {source.scope === 'DIOCESE'
                ? 'Diocese Scope'
                : source.parish?.parishName || `Parish #${source.parishId}`}
            </span>
          </div>
        </div>

        {/* Governance Lifecycle Workflow Bar */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-gray-700">Governance Actions:</div>
            <div className="text-xs text-gray-500">
              {isDraft && !isConfirmed && '1. Confirm knowledge to approve text and allow embedding worker processing.'}
              {isDraft && isConfirmed && !allReady && '2. Chunks are embedding. Once all chunks reach READY, publication is unlocked.'}
              {isDraft && isConfirmed && allReady && '3. All chunks READY! Click Publish to activate for Caloy retrieval.'}
              {isActive && 'This source is actively retrievable by Caloy. Click Retire when superseded.'}
              {isRetired && 'This source is retired and will never be retrieved.'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Action 1: Confirm (if Provisional & not Retired) */}
            {!isConfirmed && !isRetired && (
              <button
                onClick={handleConfirm}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Confirm Knowledge
              </button>
            )}

            {/* Action 2: Retry Failed (if any chunks failed) */}
            {failedChunks > 0 && (
              <button
                onClick={handleRetryFailed}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-100 rounded-lg hover:bg-amber-200 disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Failed Chunks ({failedChunks})
              </button>
            )}

            {/* Action 3: Publish (if Confirmed, Draft, and all chunks ready) */}
            {isDraft && (
              <button
                onClick={handlePublish}
                disabled={!canPublish || actionLoading}
                title={!canPublish ? 'All current-version chunks must be READY to publish' : ''}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all ${
                  canPublish
                    ? 'text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                    : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                Publish to Caloy
              </button>
            )}

            {/* Action 4: Retire (if Active) */}
            {isActive && (
              <button
                onClick={handleRetire}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" />
                Retire Source
              </button>
            )}

            {/* Edit Mode Toggle */}
            {!isRetired && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {isEditing ? 'Cancel Edit' : 'Edit Source'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edit Form or View Details */}
      {isEditing ? (
        <form onSubmit={handleSaveEdit} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-base font-bold text-gray-900">Edit Knowledge Source (v{source.version} &rarr; v{source.version + 1})</h2>
            <p className="text-xs text-amber-700 mt-1">
              Saving updates will bump the version to v{source.version + 1}, reset status to DRAFT and authority to PROVISIONAL, and mark existing embeddings STALE.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Title</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Scope</label>
                <select
                  value={editScope}
                  onChange={(e) => {
                    const sc = e.target.value as KnowledgeScope;
                    setEditScope(sc);
                    if (sc === 'DIOCESE') setEditParishId(null);
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white"
                >
                  <option value="DIOCESE">Diocese (All Parishes)</option>
                  <option value="PARISH">Specific Parish</option>
                </select>
              </div>

              {editScope === 'PARISH' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Parish</label>
                  <select
                    value={editParishId || ''}
                    onChange={(e) => setEditParishId(Number(e.target.value) || null)}
                    required
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white"
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
                  value={editSourceType}
                  onChange={(e) => setEditSourceType(e.target.value as KnowledgeSourceType)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white"
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
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Source Reference URL (HTTPS only)</label>
              <input
                type="text"
                value={editSourceReference}
                onChange={(e) => setEditSourceReference(e.target.value)}
                placeholder="https://testimonium.sanctuary/guides/..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Full Source Text</label>
              <textarea
                rows={5}
                required
                value={editSourceText}
                onChange={(e) => setEditSourceText(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Chunks Editor */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Passage Chunks (for v{source.version + 1})
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Modifying chunks creates a fresh current-version set in PENDING state.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditChunks([...editChunks, { content: '' }])}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Chunk
                </button>
              </div>

              {editChunks.map((chunk, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                    <span>Chunk #{idx + 1}</span>
                    {editChunks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setEditChunks(editChunks.filter((_, i) => i !== idx))}
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
                    onChange={(e) => {
                      const updated = [...editChunks];
                      updated[idx].content = e.target.value;
                      setEditChunks(updated);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 bg-white"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 shadow-sm"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Save & Create v{source.version + 1}
            </button>
          </div>
        </form>
      ) : (
        /* View Mode */
        <div className="space-y-6">
          {/* Source Text Card */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Full Source Text
            </h2>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100 font-sans">
              {source.sourceText}
            </div>

            {source.sourceReference && (
              <div className="pt-2 flex items-center gap-2 text-xs text-gray-500">
                <span className="font-semibold">Reference:</span>
                {source.sourceReference.startsWith('https://') ? (
                  <a
                    href={source.sourceReference}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline inline-flex items-center gap-1"
                  >
                    {source.sourceReference}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span>{source.sourceReference}</span>
                )}
              </div>
            )}
          </div>

          {/* Chunks Status & Embedding Health Card */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Current Version Chunks (v{source.version})
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {readyChunks} of {totalChunks} chunks ready for retrieval
                </p>
              </div>

              {/* Summary Badges */}
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  {readyChunks} Ready
                </span>
                {pendingChunks > 0 && (
                  <span className="px-2.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full">
                    {pendingChunks} Pending
                  </span>
                )}
                {failedChunks > 0 && (
                  <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full">
                    {failedChunks} Failed
                  </span>
                )}
              </div>
            </div>

            {currentChunks.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No chunks exist for current version.</p>
            ) : (
              <div className="space-y-3">
                {currentChunks.map((chunk) => {
                  const isReady = chunk.embeddingStatus === 'READY';
                  const isProcessing = chunk.embeddingStatus === 'PROCESSING';
                  const isFailed = chunk.embeddingStatus === 'FAILED';
                  const isStale = chunk.embeddingStatus === 'STALE';

                  let badgeClass = 'bg-gray-100 text-gray-700 border-gray-200';
                  if (isReady) badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  if (isProcessing) badgeClass = 'bg-sky-50 text-sky-700 border-sky-200';
                  if (isFailed) badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                  if (isStale) badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';

                  return (
                    <div
                      key={chunk.id}
                      className="p-4 bg-gray-50/70 rounded-xl border border-gray-200 space-y-2 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-700">
                            Chunk #{chunk.chunkOrder + 1}
                          </span>
                          <span className="text-[11px] text-gray-400 font-mono">
                            (ID: {chunk.id})
                          </span>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}`}
                        >
                          {chunk.embeddingStatus}
                        </span>
                      </div>

                      <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {chunk.content}
                      </p>

                      {chunk.embeddingErrorCode && (
                        <div className="text-[11px] text-rose-600 font-mono bg-rose-50 p-1.5 rounded border border-rose-100">
                          Error: {chunk.embeddingErrorCode}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
