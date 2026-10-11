import { CANONICAL_DOCUMENT_IDS } from '@/config/documents';
import type { CanonicalDocumentType } from '@/types';

export const UserRole = {
  PARISHIONER: 'PARISHIONER',
  SECRETARY: 'SECRETARY',
  PRIEST: 'PRIEST',
  DIOCESE_COORDINATOR: 'DIOCESE_COORDINATOR'
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

export const DocumentRequestStatus = {
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  NEEDS_CORRECTION: 'NEEDS_CORRECTION',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_UNDER_REVIEW: 'PAYMENT_UNDER_REVIEW',
  PAYMENT_NEEDS_CORRECTION: 'PAYMENT_NEEDS_CORRECTION',
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
  PROCESSING: 'PROCESSING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  COMPLETED: 'COMPLETED',
  RETURNED: 'RETURNED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
} as const;

export type DocumentRequestStatusType = typeof DocumentRequestStatus[keyof typeof DocumentRequestStatus];

export const ScheduleStatus = {
  PENDING: 'PENDING',
  REQUESTED: 'REQUESTED',
  PROPOSED_RESCHEDULE: 'PROPOSED_RESCHEDULE',
  WAITING_PARISHIONER_RESPONSE: 'WAITING_PARISHIONER_RESPONSE',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED'
} as const;

export type ScheduleStatusType = typeof ScheduleStatus[keyof typeof ScheduleStatus];

export const DocumentType = Object.fromEntries(
  CANONICAL_DOCUMENT_IDS.map((id) => [id, id])
) as { [K in CanonicalDocumentType]: K };

export type DocumentTypeType = typeof DocumentType[keyof typeof DocumentType];

// Date/Time Formatting Functions
export function formatLocalDate(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatLocalDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatLocalTime(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}
