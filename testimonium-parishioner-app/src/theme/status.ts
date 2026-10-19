import { colors } from "./tokens";

export type StatusIntent = "neutral" | "info" | "success" | "warning" | "danger";

export interface StatusConfig {
  label: string;
  intent: StatusIntent;
  color: string;
  accessibilityLabel: string;
}

/**
 * Normalized status intent and styling configuration for requests, schedules, and payments.
 * Ensures text names the state clearly and color is supplementary (WCAG compliant).
 */
export function getStatusConfig(rawStatus: string | undefined | null): StatusConfig {
  if (!rawStatus) {
    return {
      label: "Unknown",
      intent: "neutral",
      color: colors.neutral[500],
      accessibilityLabel: "Status: Unknown",
    };
  }

  const normalized = rawStatus.toUpperCase().replace(/[\s-]/g, "_");

  switch (normalized) {
    // Request statuses
    case "DRAFT":
      return {
        label: "Draft",
        intent: "neutral",
        color: colors.neutral[650],
        accessibilityLabel: "Status: Draft, not yet submitted",
      };
    case "SUBMITTED":
    case "PENDING":
    case "PENDING_REVIEW":
      return {
        label: "Pending Review",
        intent: "neutral",
        color: colors.brand[700],
        accessibilityLabel: "Status: Pending Review by parish staff",
      };
    case "UNDER_REVIEW":
      return {
        label: "Under Staff Review",
        intent: "info",
        color: colors.information,
        accessibilityLabel: "Status: Under Staff Review by parish staff",
      };
    case "PROCESSING":
    case "READY_FOR_SIGNING":
      return {
        label: "In Preparation",
        intent: "info",
        color: colors.information,
        accessibilityLabel: "Status: In Preparation by parish records",
      };
    case "NEEDS_CORRECTION":
    case "CORRECTION_REQUIRED":
      return {
        label: "Needs Correction",
        intent: "warning",
        color: colors.warning,
        accessibilityLabel: "Status: Needs Correction, action required",
      };
    case "RETURNED":
      return {
        label: "Returned for Correction",
        intent: "warning",
        color: colors.warning,
        accessibilityLabel: "Status: Returned for Correction, staff preparing replacement",
      };
    case "PAYMENT_PENDING":
    case "READY_FOR_PAYMENT":
    case "AWAITING_PAYMENT":
      return {
        label: "Payment Required",
        intent: "info",
        color: colors.brand[700],
        accessibilityLabel: "Status: Payment Required from parishioner",
      };
    case "PAYMENT_UNDER_REVIEW":
    case "RECEIPT_UNDER_REVIEW":
      return {
        label: "Payment Under Review",
        intent: "info",
        color: colors.information,
        accessibilityLabel: "Status: Payment Under Review by parish staff",
      };
    case "PAYMENT_NEEDS_CORRECTION":
      return {
        label: "Payment Correction",
        intent: "danger",
        color: colors.danger,
        accessibilityLabel: "Status: Payment Correction, replacement receipt needed",
      };
    case "PAYMENT_VERIFIED":
      return {
        label: "Payment Verified",
        intent: "success",
        color: colors.success,
        accessibilityLabel: "Status: Payment Verified",
      };
    case "READY_FOR_PICKUP":
    case "READY":
      return {
        label: "Ready for Pickup",
        intent: "success",
        color: colors.success,
        accessibilityLabel: "Status: Document ready for pickup at parish",
      };
    case "COMPLETED":
    case "ISSUED":
      return {
        label: "Completed",
        intent: "success",
        color: colors.success,
        accessibilityLabel: "Status: Completed and issued",
      };
    case "REJECTED":
      return {
        label: "Declined",
        intent: "danger",
        color: colors.danger,
        accessibilityLabel: "Status: Declined by parish staff",
      };
    case "CANCELLED":
    case "CANCELED":
      return {
        label: "Cancelled",
        intent: "neutral",
        color: colors.neutral[500],
        accessibilityLabel: "Status: Cancelled",
      };

    // Schedule statuses
    case "CONFIRMED":
      return {
        label: "Confirmed",
        intent: "success",
        color: colors.success,
        accessibilityLabel: "Status: Schedule confirmed",
      };
    case "REQUESTED":
      return {
        label: "Pending Review",
        intent: "neutral",
        color: colors.brand[700],
        accessibilityLabel: "Status: Pending Review by parish staff",
      };
    case "PROPOSED_RESCHEDULE":
    case "RESCHEDULE_PROPOSED":
    case "WAITING_PARISHIONER_RESPONSE":
      return {
        label: "Reschedule Proposed",
        intent: "info",
        color: colors.brand[700],
        accessibilityLabel: "Status: Reschedule proposed by parish, action required",
      };

    // Fallback
    default: {
      // Humanize UPPER_SNAKE_CASE
      const humanized = rawStatus
        .toLowerCase()
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      return {
        label: humanized,
        intent: "neutral",
        color: colors.neutral[650],
        accessibilityLabel: `Status: ${humanized}`,
      };
    }
  }
}
