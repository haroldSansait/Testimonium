import {
  CANONICAL_DOCUMENT_TYPES,
  CanonicalDocumentType,
  DocumentRequestDetail,
  DocumentRequestStatus,
} from "./types";
import { BadgeVariant } from "@/components/ui/Badge";

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  BAPTISMAL_CERTIFICATE: "Baptismal Certificate",
  CONFIRMATION_CERTIFICATE: "Confirmation Certificate",
  MARRIAGE_CERTIFICATE: "Marriage Certificate",
  FIRST_COMMUNION_CERTIFICATE: "First Communion Certificate",
  MARRIAGE_BANNS: "Marriage Banns",
  PERMIT_TO_MARRY: "Permit to Marry",
  STATUS_OF_LIBERTY: "Status of Liberty",
};

export const formatDocumentType = (type?: string | null): string => {
  if (!type) return "Sacramental Certificate";
  return DOCUMENT_TYPE_LABELS[type] || type.replace(/_/g, " ");
};

/**
 * Resolves effective offered document types for a parish:
 * - undefined / null => all 7 canonical document types
 * - [] (empty array) => [] (parish offers NO document products)
 * - Array => filtered canonical document types
 */
export const getEffectiveOfferedDocuments = (
  availableDocuments?: string[] | null
): CanonicalDocumentType[] => {
  if (availableDocuments === null || availableDocuments === undefined) {
    return [...CANONICAL_DOCUMENT_TYPES];
  }
  if (!Array.isArray(availableDocuments) || availableDocuments.length === 0) {
    return [];
  }
  const validSet = new Set(availableDocuments);
  return CANONICAL_DOCUMENT_TYPES.filter((type) => validSet.has(type));
};

export const STATUS_PRESENTATION: Record<
  DocumentRequestStatus,
  {
    label: string;
    variant: BadgeVariant;
    description: string;
    icon: string;
  }
> = {
  PENDING: {
    label: "Pending Review",
    variant: "warning",
    description: "Your request has been submitted and is awaiting staff initial review.",
    icon: "time-outline",
  },
  UNDER_REVIEW: {
    label: "Under Staff Review",
    variant: "info",
    description: "Parish staff is reviewing your application details and documents.",
    icon: "search-outline",
  },
  NEEDS_CORRECTION: {
    label: "Needs Correction",
    variant: "danger",
    description: "Staff requested corrections for your documents. Please review the note and resubmit.",
    icon: "alert-circle-outline",
  },
  PAYMENT_PENDING: {
    label: "Payment Required",
    variant: "primary",
    description: "Please pay the sacramental fee and upload proof of payment.",
    icon: "card-outline",
  },
  PAYMENT_UNDER_REVIEW: {
    label: "Payment Under Review",
    variant: "info",
    description: "Receipt submitted. Payment proof is being reviewed by parish staff.",
    icon: "receipt-outline",
  },
  PAYMENT_NEEDS_CORRECTION: {
    label: "Payment Correction",
    variant: "danger",
    description: "Your payment proof needs correction. Please upload a clear replacement receipt.",
    icon: "warning-outline",
  },
  PAYMENT_VERIFIED: {
    label: "Payment Verified",
    variant: "success",
    description: "Payment has been confirmed. Processing will begin shortly.",
    icon: "checkmark-done-circle-outline",
  },
  PROCESSING: {
    label: "In Preparation",
    variant: "info",
    description: "Your certificate is being generated and prepared by parish records.",
    icon: "cog-outline",
  },
  READY_FOR_SIGNING: {
    label: "In Preparation",
    variant: "info",
    description: "Your certificate is being generated and prepared by parish records.",
    icon: "cog-outline",
  },
  READY_FOR_PICKUP: {
    label: "Ready for Pickup",
    variant: "success",
    description: "Your document is ready! Please visit the parish office during operating hours.",
    icon: "file-tray-full-outline",
  },
  COMPLETED: {
    label: "Completed",
    variant: "success",
    description: "Document has been released and completed.",
    icon: "checkmark-circle-outline",
  },
  RETURNED: {
    label: "Returned for Correction",
    variant: "warning",
    description: "Document returned for post-release correction. Parish staff is preparing your corrected document.",
    icon: "return-down-back-outline",
  },
  REJECTED: {
    label: "Declined",
    variant: "neutral",
    description: "Your request could not be processed.",
    icon: "close-circle-outline",
  },
  CANCELLED: {
    label: "Cancelled",
    variant: "neutral",
    description: "This request was cancelled.",
    icon: "ban-outline",
  },
};

export const humanizeSnakeCase = (raw?: string | null): string => {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

export const formatStatus = (
  status?: DocumentRequestStatus | string | null,
  isDraft = false
): {
  label: string;
  variant: BadgeVariant;
  description: string;
  icon: string;
} => {
  if (isDraft) {
    return {
      label: "Draft",
      variant: "neutral",
      description: "Draft created on server. Supporting attachments or submission pending.",
      icon: "create-outline",
    };
  }

  if (status && status in STATUS_PRESENTATION) {
    return STATUS_PRESENTATION[status as DocumentRequestStatus];
  }

  return {
    label: status ? humanizeSnakeCase(status) : "Unknown",
    variant: "neutral",
    description: "Status update pending.",
    icon: "help-circle-outline",
  };
};

export const formatActionLabel = (
  actionOrItem?:
    | string
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
    typeof actionOrItem === "object" && actionOrItem !== null
      ? actionOrItem
      : itemContext
        ? { action: typeof actionOrItem === "string" ? actionOrItem : null, ...itemContext }
        : null;

  const action = typeof actionOrItem === "string" ? actionOrItem : actionOrItem?.action;

  if (!action) return "Activity";

  if (action === "STATUS_UPDATED") {
    if (item?.newStatus) {
      return formatStatus(item.newStatus).label;
    }
    if (item?.remarks) {
      const match = item.remarks.match(/^Status updated from\s+[A-Za-z0-9_]+\s+to\s+([A-Za-z0-9_]+)/i);
      if (match && match[1]) {
        return formatStatus(match[1]).label;
      }
    }
    return "Status Updated";
  }

  switch (action) {
    case "DRAFT_CREATED":
      return "Draft Initialized";
    case "DRAFT_UPDATED":
      return "Draft Updated";
    case "SUBMITTED":
      return "Request Submitted";
    case "UNDER_REVIEW":
      return "Staff Review Started";
    case "NEEDS_CORRECTION":
      return "Correction Requested";
    case "RESUBMITTED":
      return "Corrections Resubmitted";
    case "RECEIPT_UPLOADED":
      return "Receipt Uploaded";
    case "CORRECTED_PAYMENT_SUBMITTED":
      return "Replacement Receipt Submitted";
    case "RECEIPT_QUALITY_PASSED":
      return "Receipt Quality Passed";
    case "PAYMENT_PROOF_LOW_CONFIDENCE":
      return "Payment Receipt Under Review";
    case "PAYMENT_PROOF_ANALYSIS_UNAVAILABLE":
      return "Receipt Quality Verified";
    case "PAYMENT_VERIFIED":
      return "Payment Confirmed";
    case "PROCESSING":
    case "READY_FOR_SIGNING":
      return "Preparation Underway";
    case "READY_FOR_PICKUP":
      return "Marked Ready for Pickup";
    case "COMPLETED":
      return "Completed & Released";
    case "DOCUMENT_RETURNED":
      return "Document Returned for Correction";
    case "CORRECTED_DOCUMENT_UPLOADED":
      return "Corrected Document Prepared";
    case "CANCELLED":
      return "Request Cancelled";
    case "REJECTED":
      return "Request Declined";
    default:
      return humanizeSnakeCase(action);
  }
};

const RECOGNIZED_STATUS_TOKENS: { token: string; label: string }[] = [
  { token: "PAYMENT_NEEDS_CORRECTION", label: "Payment Correction" },
  { token: "PAYMENT_UNDER_REVIEW", label: "Payment Under Review" },
  { token: "READY_FOR_SIGNING", label: "In Preparation" },
  { token: "NEEDS_CORRECTION", label: "Needs Correction" },
  { token: "READY_FOR_PICKUP", label: "Ready for Pickup" },
  { token: "PAYMENT_VERIFIED", label: "Payment Verified" },
  { token: "PAYMENT_PENDING", label: "Payment Required" },
  { token: "UNDER_REVIEW", label: "Under Staff Review" },
  { token: "PROCESSING", label: "In Preparation" },
  { token: "CANCELLED", label: "Cancelled" },
  { token: "RETURNED", label: "Returned for Correction" },
  { token: "REJECTED", label: "Declined" },
  { token: "PENDING", label: "Pending Review" },
  { token: "COMPLETED", label: "Completed" },
  { token: "DRAFT", label: "Draft" },
];

export const replaceRecognizedStatusTokens = (text?: string | null): string => {
  if (!text) return "";
  let result = text;
  for (const { token, label } of RECOGNIZED_STATUS_TOKENS) {
    const regex = new RegExp(`\\b${token}\\b`, "g");
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
  if (!item) return "";

  const oldFriendly = item.oldStatus ? formatStatus(item.oldStatus).label : null;
  const newFriendly = item.newStatus ? formatStatus(item.newStatus).label : null;

  // 1. Authoritative oldStatus and newStatus present
  if (oldFriendly && newFriendly) {
    if (!item.remarks || !item.remarks.trim()) {
      return `Status updated from ${oldFriendly} to ${newFriendly}`;
    }

    const match = item.remarks.match(/^Status updated from\s+([A-Za-z0-9_]+)\s+to\s+([A-Za-z0-9_]+)(.*)$/i);
    if (match) {
      const rest = match[3] || "";
      const formattedRest = replaceRecognizedStatusTokens(rest);
      return `Status updated from ${oldFriendly} to ${newFriendly}${formattedRest}`;
    }
  }

  if (!item.remarks || !item.remarks.trim()) {
    return "";
  }

  // 2. Legacy status transition remarks matching pattern without explicit oldStatus/newStatus
  const transitionMatch = item.remarks.match(/^Status updated from\s+([A-Za-z0-9_]+)\s+to\s+([A-Za-z0-9_]+)(.*)$/i);
  if (transitionMatch) {
    const rawOld = transitionMatch[1];
    const rawNew = transitionMatch[2];
    const rest = transitionMatch[3] || "";
    const oldFormatted = formatStatus(rawOld).label;
    const newFormatted = formatStatus(rawNew).label;
    const formattedRest = replaceRecognizedStatusTokens(rest);
    return `Status updated from ${oldFormatted} to ${newFormatted}${formattedRest}`;
  }

  // 3. Other remarks: replace recognized status tokens, preserving other content
  return replaceRecognizedStatusTokens(item.remarks);
};


export const isCancelEligible = (request?: DocumentRequestDetail | null): boolean => {
  if (!request) return false;
  if (request.isDraft) return false;
  const eligibleStatuses: DocumentRequestStatus[] = [
    "PENDING",
    "PAYMENT_PENDING",
    "NEEDS_CORRECTION",
    "PAYMENT_NEEDS_CORRECTION",
  ];
  return eligibleStatuses.includes(request.status);
};

export const isPaymentEligible = (request?: DocumentRequestDetail | null): boolean => {
  if (!request || request.isDraft) return false;
  const hasFee = hasAuthoritativeFee(request.fee) && Number(request.fee) > 0;
  const eligibleStatuses: DocumentRequestStatus[] = [
    "PAYMENT_PENDING",
    "PAYMENT_NEEDS_CORRECTION",
  ];
  return eligibleStatuses.includes(request.status) && hasFee;
};

export const isDocumentCorrectionEligible = (
  request?: DocumentRequestDetail | null
): boolean => {
  if (!request || request.isDraft) return false;
  return request.status === "NEEDS_CORRECTION";
};

export const isDocumentReturnEligible = (
  request?: DocumentRequestDetail | null
): boolean => {
  if (!request || request.isDraft) return false;
  return request.status === "COMPLETED";
};

export const isZeroFee = (fee?: number | string | null): boolean => {
  return hasAuthoritativeFee(fee) && Number(fee) === 0;
};

export const hasAuthoritativeFee = (fee?: number | string | null): boolean => {
  if (fee === null || fee === undefined || (typeof fee === "string" && !fee.trim())) return false;
  const numeric = typeof fee === "string" ? Number(fee) : fee;
  return typeof numeric === "number" && Number.isFinite(numeric) && numeric >= 0;
};

export const formatFee = (fee?: number | string | null): string => {
  if (!hasAuthoritativeFee(fee)) return "Fee unavailable";
  return `\u20B1${Number(fee).toFixed(2)}`;
};
export const formatDate = (dateString?: string | null): string => {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

export const formatDateTime = (dateString?: string | null): string => {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
};
