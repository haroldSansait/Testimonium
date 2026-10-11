import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Eye, Loader2 } from 'lucide-react';
import { client } from '../../api/client';

interface SecureFileActionsProps {
  endpoint: string;
  fileName: string;
  mimeType?: string | null;
  autoPreview?: boolean;
  compact?: boolean;
  showDownload?: boolean;
  viewLabel?: string;
}

export const SecureFileActions: React.FC<SecureFileActionsProps> = ({
  endpoint,
  fileName,
  mimeType,
  autoPreview = false,
  compact = false,
  showDownload = true,
  viewLabel = 'View',
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const loadGenerationRef = useRef(0);

  const clearObjectUrl = useCallback((updateState = true) => {
    loadGenerationRef.current += 1;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    if (updateState) setObjectUrl(null);
  }, []);

  const load = useCallback(async () => {
    if (objectUrlRef.current) return objectUrlRef.current;
    const generation = loadGenerationRef.current;
    setLoading(true);
    setError(null);
    try {
      const blob = await client.getBlob(endpoint);
      const nextUrl = URL.createObjectURL(blob);
      if (generation !== loadGenerationRef.current) {
        URL.revokeObjectURL(nextUrl);
        return null;
      }
      objectUrlRef.current = nextUrl;
      setObjectUrl(nextUrl);
      return nextUrl;
    } catch (err: any) {
      if (generation === loadGenerationRef.current) {
        setError(err?.message || 'Secure file could not be loaded.');
      }
      return null;
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    clearObjectUrl();
    setError(null);
    setLoading(false);
    if (autoPreview) void load();
    return () => clearObjectUrl(false);
  }, [autoPreview, clearObjectUrl, endpoint, load]);

  const download = async () => {
    const url = await load();
    if (!url) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  };

  const view = async () => {
    const url = await load();
    if (!url || !compact) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const isImage = String(mimeType || '').startsWith('image/');
  const isPdf = String(mimeType || '').toLowerCase() === 'application/pdf';
  const buttonClass = compact
    ? 'inline-flex items-center gap-1 text-crimson hover:underline font-bold text-xs focus-ring rounded disabled:opacity-50'
    : 'inline-flex items-center justify-center gap-1.5 rounded-button border border-border bg-white px-3 py-2 text-xs font-bold text-text-primary hover:bg-app-page focus-ring disabled:opacity-50';

  return (
    <div className={compact ? 'space-y-2 shrink-0' : 'space-y-3'}>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void view()} disabled={loading} className={buttonClass}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
          {loading ? 'Loading…' : viewLabel}
        </button>
        {showDownload && (
          <button type="button" onClick={() => void download()} disabled={loading} className={buttonClass}>
            <Download size={14} /> Download
          </button>
        )}
      </div>

      {objectUrl && !compact && isImage && (
        <img src={objectUrl} alt={fileName} className="max-h-64 w-full rounded-lg border border-border bg-gray-950 object-contain" />
      )}
      {objectUrl && !compact && isPdf && (
        <iframe src={objectUrl} title={fileName} className="h-72 w-full rounded-lg border border-border bg-white" />
      )}
      {objectUrl && !compact && !isImage && !isPdf && (
        <a href={objectUrl} target="_blank" rel="noopener noreferrer" className="block text-xs font-semibold text-blue-600 hover:underline">
          Open authenticated document preview
        </a>
      )}
      {error && <p className="max-w-sm text-[11px] text-red-600" role="alert">{error}</p>}
    </div>
  );
};

export default SecureFileActions;
