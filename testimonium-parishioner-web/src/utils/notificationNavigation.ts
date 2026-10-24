import type { AppNotification } from '../types';

/**
 * Derives the contextual in-app navigation URL for a given notification.
 * - DOCUMENT_REQUEST with valid referenceId -> /dashboard/track?requestId=<id>
 * - SCHEDULE_REQUEST with valid referenceId -> /dashboard/schedule/<id>
 * - Announcements, general notifications, or missing references -> /dashboard/notifications?notificationId=<id>
 */
export const getNotificationUrl = (notif: AppNotification): string => {
  if (notif.referenceType === 'DOCUMENT_REQUEST' && notif.referenceId) {
    return `/dashboard/track?requestId=${encodeURIComponent(String(notif.referenceId))}`;
  }
  if (notif.referenceType === 'SCHEDULE_REQUEST' && notif.referenceId) {
    return `/dashboard/schedule/${encodeURIComponent(String(notif.referenceId))}`;
  }
  return `/dashboard/notifications?notificationId=${encodeURIComponent(String(notif.id))}`;
};
