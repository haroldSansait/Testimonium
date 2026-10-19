import type { RequestHistoryEntry, RequestStatus } from '../../types';

export const CANONICAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending Review',
  UNDER_REVIEW: 'Under Staff Review',
  NEEDS_CORRECTION: 'Needs Correction',
  PAYMENT_PENDING: 'Payment Required',
  PAYMENT_UNDER_REVIEW: 'Payment Under Review',
  PAYMENT_NEEDS_CORRECTION: 'Payment Correction',
  PAYMENT_VERIFIED: 'Payment Verified',
  PROCESSING: 'In Preparation',
  READY_FOR_SIGNING: 'In Preparation',
  READY_FOR_PICKUP: 'Ready for Pickup',
  COMPLETED: 'Completed',
  RETURNED: 'Returned for Correction',
  REJECTED: 'Declined',
  CANCELLED: 'Cancelled',
};

export const humanizeSnakeCase = (raw?: string | null): string => {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export const formatStatus = (
  status?: RequestStatus | string | null,
  isDraft = false
): { label: string } => {
  if (isDraft) {
    return { label: 'Draft' };
  }
  if (status && status in CANONICAL_STATUS_LABELS) {
    return { label: CANONICAL_STATUS_LABELS[status] };
  }
  return {
    label: status ? humanizeSnakeCase(status) : 'Unknown',
  };
};

export const formatActionLabel = (
  actionOrItem?:
    | string
    | Partial<RequestHistoryEntry>
    | {
        action?: string | null;
        newStatus?: string | null;
        remarks?: string | null;
      }
    | null,
  itemContext?: {
    newStatus?: string | null;
    remarks?: string | null;
  } | null
): string => {
  const item =
    typeof actionOrItem === 'object' && actionOrItem !== null
      ? actionOrItem
      : itemContext
        ? { action: typeof actionOrItem === 'string' ? actionOrItem : null, ...itemContext }
        : null;

  const action = typeof actionOrItem === 'string' ? actionOrItem : actionOrItem?.action;

  if (!action) return 'Activity';

  if (action === 'STATUS_UPDATED') {
    if (item?.newStatus) {
      return formatStatus(item.newStatus).label;
    }
    if (item?.remarks) {
      const match = item.remarks.match(/^Status updated from\s+[A-Za-z0-9_]+\s+to\s+([A-Za-z0-9_]+)/i);
      if (match && match[1]) {
        return formatStatus(match[1]).label;
      }
    }
    return 'Status Updated';
  }

  switch (action) {
    case 'DRAFT_CREATED':
      return 'Draft Initialized';
    case 'DRAFT_UPDATED':
      return 'Draft Updated';
    case 'SUBMITTED':
      return 'Request Submitted';
    case 'UNDER_REVIEW':
      return 'Staff Review Started';
    case 'NEEDS_CORRECTION':
      return 'Correction Requested';
    case 'RESUBMITTED':
      return 'Corrections Resubmitted';
    case 'RECEIPT_UPLOADED':
      return 'Receipt Uploaded';
    case 'CORRECTED_PAYMENT_SUBMITTED':
      return 'Replacement Receipt Submitted';
    case 'RECEIPT_QUALITY_PASSED':
      return 'Receipt Quality Passed';
    case 'PAYMENT_PROOF_LOW_CONFIDENCE':
      return 'Payment Receipt Under Review';
    case 'PAYMENT_PROOF_ANALYSIS_UNAVAILABLE':
      return 'Receipt Quality Verified';
    case 'PAYMENT_VERIFIED':
      return 'Payment Confirmed';
    case 'PROCESSING':
    case 'READY_FOR_SIGNING':
      return 'Preparation Underway';
    case 'READY_FOR_PICKUP':
      return 'Marked Ready for Pickup';
    case 'COMPLETED':
      return 'Completed & Released';
    case 'DOCUMENT_RETURNED':
      return 'Document Returned for Correction';
    case 'CORRECTED_DOCUMENT_UPLOADED':
      return 'Corrected Document Prepared';
    case 'CANCELLED':
      return 'Request Cancelled';
    case 'REJECTED':
      return 'Request Declined';
    default:
      return humanizeSnakeCase(action);
  }
};

const RECOGNIZED_STATUS_TOKENS: { token: string; label: string }[] = [
  { token: 'PAYMENT_NEEDS_CORRECTION', label: 'Payment Correction' },
  { token: 'PAYMENT_UNDER_REVIEW', label: 'Payment Under Review' },
  { token: 'READY_FOR_SIGNING', label: 'In Preparation' },
  { token: 'NEEDS_CORRECTION', label: 'Needs Correction' },
  { token: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
  { token: 'PAYMENT_VERIFIED', label: 'Payment Verified' },
  { token: 'PAYMENT_PENDING', label: 'Payment Required' },
  { token: 'UNDER_REVIEW', label: 'Under Staff Review' },
  { token: 'PROCESSING', label: 'In Preparation' },
  { token: 'CANCELLED', label: 'Cancelled' },
  { token: 'RETURNED', label: 'Returned for Correction' },
  { token: 'REJECTED', label: 'Declined' },
  { token: 'PENDING', label: 'Pending Review' },
  { token: 'COMPLETED', label: 'Completed' },
  { token: 'DRAFT', label: 'Draft' },
];

export const replaceRecognizedStatusTokens = (text?: string | null): string => {
  if (!text) return '';
  let result = text;
  for (const { token, label } of RECOGNIZED_STATUS_TOKENS) {
    const regex = new RegExp(`\\b${token}\\b`, 'g');
    result = result.replace(regex, label);
  }
  return result;
};

export const formatHistoryRemarks = (item?: {
  remarks?: string | null;
  oldStatus?: string | null;
  newStatus?: string | null;
  action?: string | null;
} | null): string => {
  if (!item) return '';

  const oldFriendly = item.oldStatus ? formatStatus(item.oldStatus).label : null;
  const newFriendly = item.newStatus ? formatStatus(item.newStatus).label : null;

  // 1. Authoritative oldStatus and newStatus present
  if (oldFriendly && newFriendly) {
    if (!item.remarks || !item.remarks.trim()) {
      return `Status updated from ${oldFriendly} to ${newFriendly}`;
    }

    const match = item.remarks.match(/^Status updated from\s+([A-Za-z0-9_]+)\s+to\s+([A-Za-z0-9_]+)(.*)$/i);
    if (match) {
      const rest = match[3] || '';
      const formattedRest = replaceRecognizedStatusTokens(rest);
      return `Status updated from ${oldFriendly} to ${newFriendly}${formattedRest}`;
    }
  }

  if (!item.remarks || !item.remarks.trim()) {
    return '';
  }

  // 2. Legacy status transition remarks matching pattern without explicit oldStatus/newStatus
  const transitionMatch = item.remarks.match(/^Status updated from\s+([A-Za-z0-9_]+)\s+to\s+([A-Za-z0-9_]+)(.*)$/i);
  if (transitionMatch) {
    const rawOld = transitionMatch[1];
    const rawNew = transitionMatch[2];
    const rest = transitionMatch[3] || '';
    const oldFormatted = formatStatus(rawOld).label;
    const newFormatted = formatStatus(rawNew).label;
    const formattedRest = replaceRecognizedStatusTokens(rest);
    return `Status updated from ${oldFormatted} to ${newFormatted}${formattedRest}`;
  }

  // 3. Other remarks: replace recognized status tokens, preserving other content
  return replaceRecognizedStatusTokens(item.remarks);
};
