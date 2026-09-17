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
    case "PROCESSING":
      return {
        label: "Under Review",
        intent: "info",
        color: colors.information,
        accessibilityLabel: "Status: Under Review by parish staff",
      };
    case "NEEDS_CORRECTION":
    case "CORRECTION_REQUIRED":
      return {
        label: "Needs Correction",
        intent: "warning",
        color: colors.warning,
        accessibilityLabel: "Status: Needs Correction, action required",
      };
    case "READY_FOR_PAYMENT":
    case "AWAITING_PAYMENT":
      return {
        label: "Awaiting Payment",
        intent: "info",
        color: colors.brand[700],
        accessibilityLabel: "Status: Awaiting Payment from parishioner",
      };
    case "PAYMENT_UNDER_REVIEW":
    case "RECEIPT_UNDER_REVIEW":
      return {
        label: "Payment Review",
        intent: "info",
        color: colors.information,
        accessibilityLabel: "Status: Payment receipt under review by staff",
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
        label: "Rejected",
        intent: "danger",
        color: colors.danger,
        accessibilityLabel: "Status: Rejected by parish staff",
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
    case "PROPOSED_RESCHEDULE":
    case "RESCHEDULE_PROPOSED":
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
        .split(/[_\s-]/)
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
