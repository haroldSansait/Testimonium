import { useCallback, useEffect, useRef, useState } from 'react';
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
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-900 flex justify-center">
          <img src={url} alt={alt} className={compact ? 'object-contain max-h-56' : 'object-contain max-h-80'} />
        </div>
      ) : null}
      <div className="flex gap-2">
        <button type="button" onClick={() => void fetchBlob()} disabled={loading} className="px-3 py-1 bg-white border border-gray-200 text-gray-700 text-[10px] font-bold rounded-md flex-1 disabled:opacity-50">
          {loading ? 'Loading...' : url ? 'Refresh Preview' : 'Secure Preview'}
        </button>
        <button type="button" onClick={() => void download()} disabled={loading} className="px-3 py-1 bg-[#7B1C2A] text-white text-[10px] font-bold rounded-md flex-1 disabled:opacity-50">
          Download
        </button>
      </div>
      {url && !isImage ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline">Open secure preview</a> : null}
      {error ? <p className="text-[10px] text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
