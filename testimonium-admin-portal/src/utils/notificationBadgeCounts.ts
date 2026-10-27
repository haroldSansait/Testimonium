import type { Notification } from '../types';

export interface NotificationBadgeCounts {
  unreadCount: number;
  documentRequestsCount: number;
  scheduleRequestsCount: number;
}

/**
 * Pure calculation helper for notification badge counts.
 * Uses exact normalized new-request titles and reference metadata:
 * - Document Requests: referenceType === 'DOCUMENT_REQUEST' and title === 'new document request'
 * - Schedule Requests: referenceType === 'SCHEDULE_REQUEST' and title === 'new appointment request'
 * Deduplicates multiple notifications referencing the same request.
 */
export function calculateNotificationBadgeCounts(
  notifications: Notification[] | Array<{
    id: string;
    title?: string;
    referenceType?: string | null;
    referenceId?: string | number | null;
    isRead?: boolean;
  }>
): NotificationBadgeCounts {
  const unread = (notifications || []).filter((n) => !n.isRead);
  const unreadCount = unread.length;

  const docSeen = new Set<string>();
  let documentRequestsCount = 0;
  for (const n of unread) {
    const refType = (n.referenceType || '').toUpperCase();
    const titleNorm = (n.title || '').trim().toLowerCase();
    if (refType === 'DOCUMENT_REQUEST' && titleNorm === 'new document request') {
      const key = n.referenceId != null && String(n.referenceId).trim() !== ''
        ? `ref:${n.referenceId}`
        : `id:${n.id}`;
      if (!docSeen.has(key)) {
        docSeen.add(key);
        documentRequestsCount++;
      }
    }
  }

  const schedSeen = new Set<string>();
  let scheduleRequestsCount = 0;
  for (const n of unread) {
    const refType = (n.referenceType || '').toUpperCase();
    const titleNorm = (n.title || '').trim().toLowerCase();
    if (refType === 'SCHEDULE_REQUEST' && titleNorm === 'new appointment request') {
      const key = n.referenceId != null && String(n.referenceId).trim() !== ''
        ? `ref:${n.referenceId}`
        : `id:${n.id}`;
      if (!schedSeen.has(key)) {
        schedSeen.add(key);
        scheduleRequestsCount++;
      }
    }
  }

  return {
    unreadCount,
    documentRequestsCount,
    scheduleRequestsCount,
  };
}
