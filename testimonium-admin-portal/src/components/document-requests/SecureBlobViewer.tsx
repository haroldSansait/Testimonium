import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Download, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import api from '@/api/api';

interface Props {
  endpoint: string;
  fileName: string;
  mimeType?: string | null;
  alt: string;
  compact?: boolean;
}

export function SecureBlobViewer({ endpoint, fileName, mimeType, alt, compact = false }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null);
  }, []);

  useEffect(() => revoke, [revoke, endpoint]);

  const fetchBlob = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(endpoint, { responseType: 'blob' });
      revoke();
      const objectUrl = URL.createObjectURL(response.data);
      urlRef.current = objectUrl;
      setUrl(objectUrl);
      return objectUrl;
    } catch {
      setError('Secure file could not be loaded. Refresh your session and try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [endpoint, revoke]);

  const download = async () => {
    const objectUrl = url || await fetchBlob();
    if (!objectUrl) return;
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
  };

  const isImage = String(mimeType || '').startsWith('image/');

  return (
    <div className="space-y-2">
      {url && isImage ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-900 flex justify-center shadow-xs">
          <img src={url} alt={alt} className={compact ? 'object-contain max-h-56' : 'object-contain max-h-80'} />
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void fetchBlob()}
          disabled={loading}
          className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-[10px] font-bold rounded-md flex-1 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 transition-colors focus:ring-1 focus:ring-crimson"
        >
          {loading ? (
            <>
              <RefreshCw className="w-3 h-3 animate-spin text-gray-500" />
              <span>Loading...</span>
            </>
          ) : url ? (
            <>
              <RefreshCw className="w-3 h-3 text-gray-500" />
              <span>Refresh Preview</span>
            </>
          ) : (
            <>
              <Eye className="w-3 h-3 text-gray-500" />
              <span>Secure Preview</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => void download()}
          disabled={loading}
          className="px-3 py-1.5 bg-[#7B1C2A] hover:bg-[#681824] text-white text-[10px] font-bold rounded-md flex-1 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 transition-colors shadow-2xs focus:ring-1 focus:ring-crimson"
        >
          <Download className="w-3 h-3" />
          <span>Download</span>
        </button>
      </div>
      {url && !isImage ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline font-medium"
        >
          <FileText className="w-3 h-3" />
          <span>Open secure preview</span>
        </a>
      ) : null}
      {error ? (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-700 flex items-center gap-1.5" role="alert">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
