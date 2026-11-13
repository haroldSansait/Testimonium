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

export const DOCUMENT_TYPE_DESCRIPTIONS: Record<string, string> = {
  BAPTISMAL_CERTIFICATE: "Official copy of the Sacrament of Baptism registry entry.",
  CONFIRMATION_CERTIFICATE: "Official record of the Sacrament of Confirmation.",
  MARRIAGE_CERTIFICATE: "Official sacramental record of Holy Matrimony.",
  FIRST_COMMUNION_CERTIFICATE: "Official record of First Holy Communion.",
  MARRIAGE_BANNS: "Public notification of prospective marriage posted across parishes.",
  PERMIT_TO_MARRY: "Canonical clearance granted to marry in another parish or jurisdiction.",
  STATUS_OF_LIBERTY: "Attestation of canonical freedom to marry (Status Liber).",
};

export const DOCUMENT_SPECIALIZED_GUIDANCE: Record<string, string> = {
  MARRIAGE_BANNS:
    "For Marriage Banns, state the solemnizing parish, target wedding date, and both parties' names in your purpose if applicable. Endorsement letters from partner parishes may be required.",
  PERMIT_TO_MARRY:
    "For Permit to Marry, specify the canonical parish where the marriage will take place and your intended ceremony date. Parish endorsement documents may be required.",
  STATUS_OF_LIBERTY:
    "Status of Liberty (Status Liber) certifies canonical freedom to marry based on parish baptismal/registry records. Specify the intended marriage parish or purpose.",
};

export const RELATIONSHIP_OPTIONS = [
  "Self",
  "Parent",
  "Child",
  "Spouse",
  "Sibling",
  "Other Relative",
  "Authorized Representative",
] as const;

const REGISTRY_YEAR_SUFFIX_REGEX = /\s*\(Approximate Registry Year:\s*(\d{4})\)\s*$/i;

export const parsePurposeAndRegistryYear = (
  savedPurpose?: string | null
): { purpose: string; approximateYear: string } => {
  const raw = typeof savedPurpose === "string" ? savedPurpose.trim() : "";
  if (!raw) return { purpose: "", approximateYear: "" };
  const match = raw.match(REGISTRY_YEAR_SUFFIX_REGEX);
  if (!match) return { purpose: raw, approximateYear: "" };
  return {
    purpose: raw.replace(REGISTRY_YEAR_SUFFIX_REGEX, "").trim(),
    approximateYear: match[1],
  };
};

export const formatPurposeWithRegistryYear = (
  purpose: string,
  approximateYear?: string | null
): string => {
  const basePurpose = purpose.replace(REGISTRY_YEAR_SUFFIX_REGEX, "").trim();
  const cleanYear = typeof approximateYear === "string" ? approximateYear.trim() : "";
  if (!cleanYear) return basePurpose;
  return `${basePurpose} (Approximate Registry Year: ${cleanYear})`;
};

export const getDocumentTypeDescription = (type?: string | null): string => {
  if (!type) return "Official authenticated sacramental certificate.";
  return (
    DOCUMENT_TYPE_DESCRIPTIONS[type] ||
    "Official authenticated sacramental certificate."
  );
};

export const FAMILY_PROOF_RELATIONSHIPS = new Set([
  "Parent",
  "Child",
  "Spouse",
  "Sibling",
]);

export const FAMILY_PROOF_LABEL = "Proof of Relationship / Authorization Letter";
export const FAMILY_PROOF_DESCRIPTION =
  "Upload the registrant's birth certificate, an authorization letter, or another supporting document that proves your relationship to the registrant.";

export const isFamilyProofRelationship = (relationship?: string | null): boolean =>
  Boolean(relationship && FAMILY_PROOF_RELATIONSHIPS.has(relationship));

const SURNAME_PARTICLES = new Set([
  "DA", "DE", "DEL", "DELA", "DI", "DOS", "LA", "LAS", "LOS", "SAN", "SANTA", "VAN", "VON",
]);

const SUFFIXES = new Set([
  "JR", "JR.", "JUNIOR", "SR", "SR.", "SENIOR", "II", "III", "IV", "V",
]);

export function parseSavedApplicantName(savedName?: string | null): {
  firstName: string;
  middleName: string;
  lastName: string;
} {
  if (!savedName || typeof savedName !== "string") {
    return { firstName: "", middleName: "", lastName: "" };
  }

  const trimmed = savedName.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.includes(",")) {
    return { firstName: "", middleName: "", lastName: "" };
  }

  const tokens = trimmed.split(" ");
  if (tokens.length < 2) {
    return { firstName: "", middleName: "", lastName: "" };
  }

  const lastTokenUpper = tokens[tokens.length - 1].toUpperCase();
  if (SUFFIXES.has(lastTokenUpper)) {
    return { firstName: "", middleName: "", lastName: "" };
  }

  if (tokens.length === 2) {
    return {
      firstName: tokens[0],
      middleName: "",
      lastName: tokens[1],
    };
  }

  if (tokens.length === 3) {
    const middleUpper = tokens[1].toUpperCase();
    if (SURNAME_PARTICLES.has(middleUpper)) {
      return {
        firstName: tokens[0],
        middleName: "",
        lastName: `${tokens[1]} ${tokens[2]}`,
      };
    }
    return {
      firstName: tokens[0],
      middleName: tokens[1],
      lastName: tokens[2],
    };
  }

  if (tokens.length === 4) {
    const secondUpper = tokens[1].toUpperCase();
    const thirdUpper = tokens[2].toUpperCase();
    if (SURNAME_PARTICLES.has(secondUpper) && SURNAME_PARTICLES.has(thirdUpper)) {
      return {
        firstName: tokens[0],
        middleName: "",
        lastName: `${tokens[1]} ${tokens[2]} ${tokens[3]}`,
      };
    }
    if (SURNAME_PARTICLES.has(thirdUpper)) {
      return {
        firstName: tokens[0],
        middleName: tokens[1],
        lastName: `${tokens[2]} ${tokens[3]}`,
      };
    }
  }

  return { firstName: "", middleName: "", lastName: "" };
}

export function resolveSelfProfileName(profile?: {
  fullName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
} | null): { firstName: string; middleName: string; lastName: string } | null {
  if (!profile) return null;
  const first = typeof profile.firstName === "string" ? profile.firstName.trim() : "";
  const last = typeof profile.lastName === "string" ? profile.lastName.trim() : "";
  const middle = typeof profile.middleName === "string" ? profile.middleName.trim() : "";
  if (first && last) {
    return { firstName: first, middleName: middle, lastName: last };
  }
  if (typeof profile.fullName === "string" && profile.fullName.trim()) {
    // A combined name does not identify the boundaries of multi-word parts.
    // Keep those fields available for manual entry rather than guessing.
    if (profile.fullName.trim().split(/\s+/).length !== 2) return null;
    const parsed = parseSavedApplicantName(profile.fullName);
    return parsed.firstName && parsed.lastName ? parsed : null;
  }
  return null;
}

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
    label: "Awaiting Payment Review",
    variant: "info",
    description: "Receipt submitted. Awaiting parish staff review of your payment proof.",
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
    description: "Your certificate is being prepared by parish records.",
    icon: "cog-outline",
  },
  READY_FOR_SIGNING: {
    label: "Ready for Signing",
    variant: "info",
    description: "Your certificate has been prepared and is awaiting clergy signature.",
    icon: "create-outline",
  },
  READY_FOR_PICKUP: {
    label: "Ready for Pickup",
    variant: "success",
    description: "Your document is ready for pickup at the parish office during operating hours (not yet released).",
    icon: "file-tray-full-outline",
  },
  COMPLETED: {
    label: "Released",
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
      return "Awaiting Payment Review";
    case "PAYMENT_PROOF_ANALYSIS_UNAVAILABLE":
      return "Receipt Quality Verified";
    case "PAYMENT_VERIFIED":
      return "Payment Confirmed";
    case "PROCESSING":
      return "In Preparation";
    case "READY_FOR_SIGNING":
      return "Ready for Signing";
    case "READY_FOR_PICKUP":
      return "Marked Ready for Pickup";
    case "COMPLETED":
      return "Released";
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
  { token: "PAYMENT_UNDER_REVIEW", label: "Awaiting Payment Review" },
  { token: "READY_FOR_SIGNING", label: "Ready for Signing" },
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
  { token: "COMPLETED", label: "Released" },
  { token: "DRAFT", label: "Draft" },
];

export interface DocumentWorkflowStage {
  key: string;
  label: string;
  description: string;
  state: "done" | "current" | "upcoming";
}

export const getDocumentWorkflowStages = (
  request?: Pick<DocumentRequestDetail, "status" | "isDraft"> | null
): DocumentWorkflowStage[] => {
  if (!request) return [];
  const status = request.status;
  if (request.isDraft) {
    return [
      {
        key: "draft",
        label: "Draft Saved",
        description: "Review details and upload required attachments to submit.",
        state: "current",
      },
      {
        key: "review",
        label: "Parish Staff Review",
        description: "Remaining workflow begins once submitted.",
        state: "upcoming",
      },
      {
        key: "payment",
        label: "Payment & Verification",
        description: "Settle fee once application is approved for payment.",
        state: "upcoming",
      },
      {
        key: "prepare",
        label: "Preparation & Clergy Signing",
        description: "Parish records prepares and signs the certificate.",
        state: "upcoming",
      },
      {
        key: "pickup",
        label: "Ready for Pickup",
        description: "Available for claiming at the parish office.",
        state: "upcoming",
      },
      {
        key: "released",
        label: "Released",
        description: "Document released to requester.",
        state: "upcoming",
      },
    ];
  }

  if (status === "CANCELLED" || status === "REJECTED") {
    return [
      {
        key: "closed",
        label: status === "CANCELLED" ? "Request Cancelled" : "Request Declined",
        description:
          status === "CANCELLED"
            ? "This request was cancelled before release."
            : "Parish staff declined this request.",
        state: "current",
      },
    ];
  }

  const orderIndexMap: Record<string, number> = {
    PENDING: 0,
    UNDER_REVIEW: 0,
    NEEDS_CORRECTION: 0,
    PAYMENT_PENDING: 1,
    PAYMENT_NEEDS_CORRECTION: 1,
    PAYMENT_UNDER_REVIEW: 1,
    PAYMENT_VERIFIED: 2,
    PROCESSING: 2,
    READY_FOR_SIGNING: 3,
    READY_FOR_PICKUP: 4,
    COMPLETED: 5,
    RETURNED: 5,
  };
  const currentIdx = orderIndexMap[status] ?? 0;

  const stages: { key: string; label: string; description: string }[] = [
    {
      key: "review",
      label: "Staff Review",
      description:
        status === "NEEDS_CORRECTION"
          ? "Corrections requested by parish staff."
          : currentIdx > 0
            ? "Application requirements reviewed."
            : "Submitted for initial staff review.",
    },
    {
      key: "payment",
      label: "Payment & Review",
      description:
        status === "PAYMENT_NEEDS_CORRECTION"
          ? "Replacement payment receipt requested."
          : status === "PAYMENT_UNDER_REVIEW"
            ? "Receipt uploaded; awaiting parish verification."
            : currentIdx > 1
              ? "Payment verified by parish office."
              : "Awaiting fee settlement and receipt verification.",
    },
    {
      key: "preparation",
      label: "Record Preparation",
      description:
        currentIdx > 2
          ? "Sacramental record prepared."
          : status === "PROCESSING"
            ? "Parish records is preparing your certificate."
            : "Certificate preparation follows payment verification.",
    },
    {
      key: "signing",
      label: "Clergy Signing",
      description:
        currentIdx > 3
          ? "Signed by authorized parish clergy."
          : status === "READY_FOR_SIGNING"
            ? "Certificate prepared and awaiting clergy signature."
            : "Awaiting clergy signature after preparation.",
    },
    {
      key: "pickup",
      label: "Ready for Pickup",
      description:
        currentIdx > 4
          ? "Claimed at the parish office."
          : status === "READY_FOR_PICKUP"
            ? "Ready for pickup at the parish office (not yet released)."
            : "Available for parish office pickup once signed.",
    },
    {
      key: "released",
      label: status === "RETURNED" ? "Returned for Correction" : "Released",
      description:
        status === "RETURNED"
          ? "Returned post-release for free replacement."
          : currentIdx >= 5
            ? "Document officially released."
            : "Marked released upon claiming at the parish.",
    },
  ];

  return stages.map((stage, idx) => ({
    ...stage,
    state: idx < currentIdx ? "done" : idx === currentIdx ? "current" : "upcoming",
  }));
};

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
