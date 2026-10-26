import { client } from '../../../api/client';
import { useQuery } from '../../../hooks/useService';
import { SecureFileActions } from '../../../components/files/SecureFileActions';

interface Attachment { id: number; requirementLabel: string; fileName: string; fileType: string }

export function ScheduleAttachments({ scheduleId }: { scheduleId: string }) {
  const endpoint = `/schedule-requests/${scheduleId}/attachments`;
  const query = useQuery(() => client.get<Attachment[]>(endpoint), ['schedules', scheduleId, 'attachments'], { pollInterval: false });
  if (!query.loading && !query.error && !query.data?.length) return null;
  return <section className='space-y-3 border-t border-border pt-4'>
    <h3 className='font-bold text-text-primary'>Submitted Requirements</h3>
    {query.loading && <p className='text-xs text-text-muted'>Loading documents...</p>}
    {query.error && <div role='alert' className='text-xs text-red-600'>Unable to load documents. <button type='button' className='underline' onClick={() => void query.refetch()}>Retry</button></div>}
    {query.data?.map((file) => <div key={file.id} className='rounded-xl border border-border p-3 space-y-2'>
      <p className='text-sm font-semibold'>{file.requirementLabel}</p>
      <p className='text-xs text-text-muted break-all'>{file.fileName}</p>
      <SecureFileActions endpoint={`${endpoint}/${file.id}/file`} fileName={file.fileName} mimeType={file.fileType} compact />
    </div>)}
  </section>;
}
