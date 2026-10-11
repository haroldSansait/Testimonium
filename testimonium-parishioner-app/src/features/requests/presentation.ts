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
    label: status ? status.replace(/_/g, " ") : "Unknown",
    variant: "neutral",
    description: "Status update pending.",
    icon: "help-circle-outline",
  };
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
