import type { Notification } from '@/types';

export interface NotificationDestination {
  path: '/document-requests' | '/schedule-requests';
  state: { requestId: string };
  actionLabel: string;
  categoryLabel: 'Document Request' | 'Payment Verification' | 'Schedule Request';
}

export type NotificationVisualCategory =
  | 'document'
  | 'payment'
  | 'schedule'
  | 'pastoral'
  | 'warning'
  | 'system';

const STATIC_SCHEDULE_TITLE_PREFIXES = [
  'pastoral assignment accepted',
  'pastoral assignment declined',
  'pastoral assignment',
];

const hasValidReferenceId = (referenceId?: string | null): boolean => {
  if (!referenceId) return false;
  return /^[1-9]\d*$/.test(String(referenceId).trim());
};

const isStaticInformationalScheduleTitle = (title?: string | null): boolean => {
  const normalized = (title || '').trim().toLowerCase();
  if (!normalized) return false;
  return STATIC_SCHEDULE_TITLE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

/**
 * Resolves the exact in-app destination for request-linked notifications.
 * Returns null for static/informational notifications (such as Pastoral Assignment Accepted)
 * or notifications without a reliable request identifier.
 */
export function getNotificationDestination(notif: Pick<
  Notification,
  'title' | 'type' | 'referenceType' | 'referenceId'
>): NotificationDestination | null {
  if (!hasValidReferenceId(notif.referenceId)) {
    return null;
  }

  const requestId = String(notif.referenceId).trim();
  const titleLower = (notif.title || '').trim().toLowerCase();

  if (notif.referenceType === 'DOCUMENT_REQUEST') {
    const isPayment =
      notif.type === 'payment-uploaded' ||
      notif.type === 'payment-verified' ||
      titleLower.includes('payment') ||
      titleLower.includes('proof');

    return {
      path: '/document-requests',
      state: { requestId },
      actionLabel: isPayment ? 'Review payment' : 'View request',
      categoryLabel: isPayment ? 'Payment Verification' : 'Document Request',
    };
  }

  if (notif.referenceType === 'SCHEDULE_REQUEST') {
    if (isStaticInformationalScheduleTitle(notif.title)) {
      return null;
    }

    return {
      path: '/schedule-requests',
      state: { requestId },
      actionLabel: 'View request',
      categoryLabel: 'Schedule Request',
    };
  }

  return null;
}

export function isNotificationClickable(notif: Pick<
  Notification,
  'title' | 'type' | 'referenceType' | 'referenceId'
>): boolean {
  return getNotificationDestination(notif) !== null;
}

export function getNotificationPresentation(notif: Pick<
  Notification,
  'title' | 'description' | 'type' | 'urgency' | 'referenceType' | 'referenceId'
>): {
  category: NotificationVisualCategory;
  categoryLabel: string;
  statusPill?: { label: string; tone: 'crimson' | 'amber' | 'emerald' | 'slate' };
} {
  const titleLower = (notif.title || '').trim().toLowerCase();
  const destination = getNotificationDestination(notif);

  if (titleLower.startsWith('pastoral assignment')) {
    const declined = titleLower.includes('declined');
    return {
      category: 'pastoral',
      categoryLabel: 'Pastoral Assignment',
      statusPill: {
        label: declined ? 'Declined' : 'Accepted',
        tone: declined ? 'amber' : 'emerald',
      },
    };
  }

  if (notif.type === 'schedule-conflict' || notif.type === 'warning') {
    return {
      category: 'warning',
      categoryLabel: destination?.categoryLabel || 'Schedule Alert',
      statusPill: { label: 'Attention Needed', tone: 'amber' },
    };
  }

  if (
    notif.type === 'payment-uploaded' ||
    titleLower.includes('payment proof') ||
    titleLower.includes('requires verification')
  ) {
    return {
      category: 'payment',
      categoryLabel: 'Payment Verification',
      statusPill: { label: 'Needs Verification', tone: 'amber' },
    };
  }

  if (notif.type === 'payment-verified') {
    return {
      category: 'payment',
      categoryLabel: 'Payment Update',
      statusPill: { label: 'Verified', tone: 'emerald' },
    };
  }

  if (notif.referenceType === 'DOCUMENT_REQUEST') {
    const isCancelled = notif.type === 'document-cancelled' || titleLower.includes('cancel');
    const isReady = notif.type === 'document-ready' || titleLower.includes('ready');
    const isReturned = titleLower.includes('return');

    return {
      category: 'document',
      categoryLabel: 'Document Request',
      statusPill: isCancelled
        ? { label: 'Cancelled', tone: 'slate' }
        : isReady
          ? { label: 'Ready', tone: 'emerald' }
          : isReturned
            ? { label: 'Correction', tone: 'amber' }
            : { label: 'Pending Review', tone: 'crimson' },
    };
  }

  if (notif.referenceType === 'SCHEDULE_REQUEST') {
    return {
      category: 'schedule',
      categoryLabel: 'Schedule Request',
      statusPill:
        titleLower.includes('declined') || titleLower.includes('withdrawn')
          ? { label: 'Update', tone: 'amber' }
          : titleLower.includes('accepted') || titleLower.includes('applied')
            ? { label: 'Confirmed', tone: 'emerald' }
            : { label: 'Pending Review', tone: 'crimson' },
    };
  }

  return {
    category: 'system',
    categoryLabel: 'System Notice',
    statusPill: { label: 'Informational', tone: 'slate' },
  };
}

