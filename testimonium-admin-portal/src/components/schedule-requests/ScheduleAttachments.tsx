import api from '@/api/api';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { SecureBlobViewer } from '@/components/document-requests/SecureBlobViewer';

interface Attachment { id: number; requirementLabel: string; fileName: string; fileType: string }

export function ScheduleAttachments({ scheduleId }: { scheduleId: string }) {
  const endpoint = `/schedule-requests/${scheduleId}/attachments`;
  const query = useCachedQuery<Attachment[]>(['schedules', scheduleId, 'attachments'], async () => {
    const response = await api.get(endpoint);
    return response.data.data;
  });
  if (!query.loading && !query.error && !query.data?.length) return null;
  return <section className='space-y-3 border-t border-gray-200 pt-4'>
    <h3 className='font-bold text-gray-800'>Submitted Prerequisites</h3>
    {query.loading && <p className='text-xs text-gray-500'>Loading documents...</p>}
    {query.error && <div role='alert' className='text-xs text-red-600'>Unable to load documents. <button type='button' className='underline' onClick={() => void query.refetch()}>Retry</button></div>}
    {query.data?.map((file) => <div key={file.id} className='rounded-lg border border-gray-200 p-3 space-y-2'>
      <p className='text-xs font-bold'>{file.requirementLabel}</p>
      <p className='text-xs text-gray-500 break-all'>{file.fileName}</p>
      <SecureBlobViewer endpoint={`${endpoint}/${file.id}/file`} fileName={file.fileName} mimeType={file.fileType} alt={file.requirementLabel} compact />
    </div>)}
  </section>;
}
