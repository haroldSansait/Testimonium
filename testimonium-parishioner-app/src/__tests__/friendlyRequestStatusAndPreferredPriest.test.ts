import {
  formatActionLabel,
  formatHistoryRemarks,
  formatStatus,
  humanizeSnakeCase,
  replaceRecognizedStatusTokens,
  STATUS_PRESENTATION,
} from "../features/requests/presentation";
import type { DocumentRequestStatus } from "../features/requests/types";
import {
  getScheduleStatusBadge,
  PREFERRED_PRIEST_HELPER_COPY,
} from "../features/schedule/presentation";
import type { ScheduleStatus } from "../features/schedule/types";
import { getStatusConfig } from "../theme/status";

describe("Friendly Request Statuses and Preferred Priest UI", () => {
  describe("1. Document Request Status Mappings", () => {
    const expectedDocumentStatuses: Record<DocumentRequestStatus, string> = {
      PENDING: "Pending Review",
      UNDER_REVIEW: "Under Staff Review",
      NEEDS_CORRECTION: "Needs Correction",
      PAYMENT_PENDING: "Payment Required",
      PAYMENT_UNDER_REVIEW: "Payment Under Review",
      PAYMENT_NEEDS_CORRECTION: "Payment Correction",
      PAYMENT_VERIFIED: "Payment Verified",
      PROCESSING: "In Preparation",
      READY_FOR_SIGNING: "In Preparation",
      READY_FOR_PICKUP: "Ready for Pickup",
      COMPLETED: "Completed",
      RETURNED: "Returned for Correction",
      REJECTED: "Declined",
      CANCELLED: "Cancelled",
    };

    it("verifies every canonical Document Request status produces the established friendly label", () => {
      (Object.keys(expectedDocumentStatuses) as DocumentRequestStatus[]).forEach((status) => {
        expect(STATUS_PRESENTATION[status].label).toBe(expectedDocumentStatuses[status]);
        expect(formatStatus(status).label).toBe(expectedDocumentStatuses[status]);
      });
    });

    it("verifies PROCESSING and READY_FOR_SIGNING both map to 'In Preparation'", () => {
      expect(STATUS_PRESENTATION.PROCESSING.label).toBe("In Preparation");
      expect(STATUS_PRESENTATION.READY_FOR_SIGNING.label).toBe("In Preparation");
    });

    it("verifies formatStatus handles draft requests with friendly Draft label", () => {
      expect(formatStatus("PENDING", true).label).toBe("Draft");
      expect(formatStatus(null, true).label).toBe("Draft");
    });

    it("verifies unknown status values fall back to humanized title case instead of raw UPPER_SNAKE_CASE", () => {
      expect(humanizeSnakeCase("AWAITING_EXTERNAL_AUDIT")).toBe("Awaiting External Audit");
      expect(formatStatus("AWAITING_EXTERNAL_AUDIT").label).toBe("Awaiting External Audit");
    });
  });

  describe("2. Schedule Request Status Mappings", () => {
    const expectedScheduleStatuses: { status: ScheduleStatus; label: string }[] = [
      { status: "PENDING", label: "Pending Review" },
      { status: "REQUESTED", label: "Pending Review" },
      { status: "PROPOSED_RESCHEDULE", label: "Action Required: Reschedule Proposed" },
      { status: "WAITING_PARISHIONER_RESPONSE", label: "Action Required: Reschedule Proposed" },
      { status: "CONFIRMED", label: "Confirmed" },
      { status: "COMPLETED", label: "Completed" },
      { status: "CANCELLED", label: "Cancelled" },
      { status: "REJECTED", label: "Declined" },
    ];

    it("verifies getScheduleStatusBadge matches the established schedule presentation labels", () => {
      expectedScheduleStatuses.forEach(({ status, label }) => {
        expect(getScheduleStatusBadge(status).label).toBe(label);
      });
    });
  });

  describe("3. Shared getStatusConfig Consistency", () => {
    it("verifies getStatusConfig accurately maps document statuses", () => {
      expect(getStatusConfig("PENDING").label).toBe("Pending Review");
      expect(getStatusConfig("UNDER_REVIEW").label).toBe("Under Staff Review");
      expect(getStatusConfig("PROCESSING").label).toBe("In Preparation");
      expect(getStatusConfig("READY_FOR_SIGNING").label).toBe("In Preparation");
      expect(getStatusConfig("PAYMENT_PENDING").label).toBe("Payment Required");
      expect(getStatusConfig("PAYMENT_UNDER_REVIEW").label).toBe("Payment Under Review");
      expect(getStatusConfig("PAYMENT_NEEDS_CORRECTION").label).toBe("Payment Correction");
      expect(getStatusConfig("PAYMENT_VERIFIED").label).toBe("Payment Verified");
      expect(getStatusConfig("READY_FOR_PICKUP").label).toBe("Ready for Pickup");
      expect(getStatusConfig("COMPLETED").label).toBe("Completed");
      expect(getStatusConfig("RETURNED").label).toBe("Returned for Correction");
      expect(getStatusConfig("REJECTED").label).toBe("Declined");
      expect(getStatusConfig("CANCELLED").label).toBe("Cancelled");
    });

    it("verifies getStatusConfig maps schedule statuses cleanly without overflow", () => {
      expect(getStatusConfig("CONFIRMED").label).toBe("Confirmed");
      expect(getStatusConfig("REQUESTED").label).toBe("Pending Review");
      expect(getStatusConfig("PROPOSED_RESCHEDULE").label).toBe("Reschedule Proposed");
      expect(getStatusConfig("WAITING_PARISHIONER_RESPONSE").label).toBe("Reschedule Proposed");
    });

    it("verifies getStatusConfig fallback humanizes unknown status names", () => {
      expect(getStatusConfig("CUSTOM_PENDING_ACTION").label).toBe("Custom Pending Action");
    });
  });

  describe("4. Document Request History & Timeline Presentation", () => {
    it("formats authoritative oldStatus and newStatus transitions into human-readable text", () => {
      const formatted = formatHistoryRemarks({
        action: "STATUS_UPDATED",
        oldStatus: "PAYMENT_UNDER_REVIEW",
        newStatus: "PAYMENT_VERIFIED",
        remarks: "Status updated from PAYMENT_UNDER_REVIEW to PAYMENT_VERIFIED",
      });
      expect(formatted).toBe("Status updated from Payment Under Review to Payment Verified");
    });

    it("formats legacy remarks where oldStatus/newStatus were not passed as discrete fields", () => {
      const formatted = formatHistoryRemarks({
        action: "STATUS_UPDATED",
        remarks: "Status updated from PENDING to UNDER_REVIEW",
      });
      expect(formatted).toBe("Status updated from Pending Review to Under Staff Review");
    });

    it("generates transition remarks if authoritative oldStatus and newStatus exist even when remarks string is empty", () => {
      const formatted = formatHistoryRemarks({
        action: "STATUS_UPDATED",
        oldStatus: "PENDING",
        newStatus: "UNDER_REVIEW",
        remarks: null,
      });
      expect(formatted).toBe("Status updated from Pending Review to Under Staff Review");
    });

    it("replaces recognized status tokens in remarks while strictly preserving notes, explanations, and numbers", () => {
      const note = "Reason: Typographical or Spelling Error\nAffected requirements: Registrant ID\nNote: Please re-upload front copy.";
      const formatted = formatHistoryRemarks({
        action: "NEEDS_CORRECTION",
        remarks: note,
      });
      expect(formatted).toBe(note);
    });

    it("replaces recognized status tokens embedded in custom remarks", () => {
      const custom = "Staff changed document state to READY_FOR_PICKUP after manual signing.";
      expect(replaceRecognizedStatusTokens(custom)).toBe(
        "Staff changed document state to Ready for Pickup after manual signing."
      );
    });

    it("derives timeline heading from newStatus for STATUS_UPDATED entries", () => {
      const examples: { oldStatus: string; newStatus: string; expectedHeading: string }[] = [
        { oldStatus: "PENDING", newStatus: "UNDER_REVIEW", expectedHeading: "Under Staff Review" },
        { oldStatus: "UNDER_REVIEW", newStatus: "PAYMENT_PENDING", expectedHeading: "Payment Required" },
        { oldStatus: "PAYMENT_PENDING", newStatus: "PAYMENT_UNDER_REVIEW", expectedHeading: "Payment Under Review" },
        { oldStatus: "PAYMENT_UNDER_REVIEW", newStatus: "PAYMENT_VERIFIED", expectedHeading: "Payment Verified" },
        { oldStatus: "PAYMENT_VERIFIED", newStatus: "PROCESSING", expectedHeading: "In Preparation" },
        { oldStatus: "PROCESSING", newStatus: "READY_FOR_SIGNING", expectedHeading: "In Preparation" },
        { oldStatus: "READY_FOR_SIGNING", newStatus: "READY_FOR_PICKUP", expectedHeading: "Ready for Pickup" },
        { oldStatus: "READY_FOR_PICKUP", newStatus: "COMPLETED", expectedHeading: "Completed" },
        { oldStatus: "UNDER_REVIEW", newStatus: "NEEDS_CORRECTION", expectedHeading: "Needs Correction" },
        { oldStatus: "COMPLETED", newStatus: "RETURNED", expectedHeading: "Returned for Correction" },
        { oldStatus: "UNDER_REVIEW", newStatus: "REJECTED", expectedHeading: "Declined" },
        { oldStatus: "PENDING", newStatus: "CANCELLED", expectedHeading: "Cancelled" },
      ];

      examples.forEach(({ oldStatus, newStatus, expectedHeading }) => {
        const heading = formatActionLabel("STATUS_UPDATED", {
          newStatus,
          remarks: `Status updated from ${oldStatus} to ${newStatus}`,
        });
        expect(heading).toBe(expectedHeading);
      });
    });

    it("derives destination status heading for legacy STATUS_UPDATED records without newStatus field", () => {
      const heading = formatActionLabel("STATUS_UPDATED", {
        remarks: "Status updated from PAYMENT_UNDER_REVIEW to PAYMENT_VERIFIED",
      });
      expect(heading).toBe("Payment Verified");
    });

    it("falls back to Status Updated when no destination status is identifiable", () => {
      expect(formatActionLabel("STATUS_UPDATED")).toBe("Status Updated");
      expect(formatActionLabel("STATUS_UPDATED", { remarks: "Staff updated request." })).toBe("Status Updated");
    });

    it("formats action titles correctly for non-status-updated events", () => {
      expect(formatActionLabel("RECEIPT_QUALITY_PASSED")).toBe("Receipt Quality Passed");
      expect(formatActionLabel("DRAFT_CREATED")).toBe("Draft Initialized");
      expect(formatActionLabel("SUBMITTED")).toBe("Request Submitted");
      expect(formatActionLabel("PAYMENT_VERIFIED")).toBe("Payment Confirmed");
      expect(formatActionLabel("UNKNOWN_NEW_ACTION")).toBe("Unknown New Action");
    });
  });

  describe("5. Preferred Priest Copy Consistency", () => {
    it("verifies preferred priest helper copy remains intact", () => {
      expect(PREFERRED_PRIEST_HELPER_COPY).toBe(
        "Your preferred priest may not be available for every suggested time. The parish can still assign another priest."
      );
    });
  });
});
