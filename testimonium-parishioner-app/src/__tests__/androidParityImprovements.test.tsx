import React from "react";
import { render } from "@testing-library/react-native";
import { StatusLabel } from "@/components/ui/StatusLabel";
import {
  DOCUMENT_SPECIALIZED_GUIDANCE,
  RELATIONSHIP_OPTIONS,
  formatPurposeWithRegistryYear,
  formatStatus,
  getDocumentTypeDescription,
  getDocumentWorkflowStages,
  parsePurposeAndRegistryYear,
} from "@/features/requests/presentation";
import { mergeRequestPages } from "@/features/requests/api";
import {
  formatScheduleConfirmationRef,
  getScheduleMilestones,
  isValidScheduleTrackingReference,
} from "@/features/schedule/presentation";
import { mergeSchedulePages } from "@/features/schedule/api";
import { fetchAllActiveParishes } from "@/features/parishes/api";
import {
  buildEventIcsContent,
  buildGoogleCalendarUrl,
} from "@/services/calendar/calendarExport";
import { apiClient } from "@/services/api/client";
import type { DocumentRequestDetail } from "@/features/requests/types";
import type { ScheduleItem } from "@/features/schedule/types";

jest.mock("@/services/api/client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

describe("Android Parity Improvements Coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("M1 & D3: deduplicates paginated request and schedule pages", () => {
    const req1 = { id: 1, isDraft: false, status: "PENDING" } as unknown as DocumentRequestDetail;
    const req2 = { id: 2, isDraft: true, status: "DRAFT" } as unknown as DocumentRequestDetail;
    const mergedReqs = mergeRequestPages([
      { data: [req1, req2], pagination: { total: 2, page: 1, limit: 20, totalPages: 2 } },
      { data: [req2], pagination: { total: 2, page: 2, limit: 20, totalPages: 2 } },
    ]);
    expect(mergedReqs.map((r) => r.id)).toEqual([1, 2]);

    const sched1 = { id: 10, status: "CONFIRMED" } as ScheduleItem;
    const sched2 = { id: 11, status: "PENDING" } as ScheduleItem;
    const mergedSched = mergeSchedulePages([
      { data: [sched1] },
      { data: [sched1, sched2] },
    ]);
    expect(mergedSched.map((s) => s.id)).toEqual([10, 11]);
  });

  it("M4 & R3: formats CONF-YYYY-NNNN schedule confirmation refs and validates search inputs", () => {
    expect(formatScheduleConfirmationRef(26, "2026-04-12T08:00:00.000Z")).toBe("CONF-2026-0026");
    expect(isValidScheduleTrackingReference("conf-2026-0026")).toBe(true);
    expect(isValidScheduleTrackingReference("26")).toBe(true);
    expect(isValidScheduleTrackingReference("SR-2026-000452")).toBe(false);
    expect(isValidScheduleTrackingReference("#SCH-26")).toBe(false);
  });

  it("M5 & M6: includes Other Relative and preserves approximate registry year in purpose", () => {
    expect(RELATIONSHIP_OPTIONS).toContain("Other Relative");
    expect(RELATIONSHIP_OPTIONS).toHaveLength(7);

    const encoded = formatPurposeWithRegistryYear("For employment", "2004");
    expect(encoded).toContain("(Approximate Registry Year: 2004)");
    const decoded = parsePurposeAndRegistryYear(encoded);
    expect(decoded.purpose).toBe("For employment");
    expect(decoded.approximateYear).toBe("2004");
  });

  it("M7 & U3: separates completed stages from upcoming stages for documents and schedules", () => {
    expect(formatStatus("PAYMENT_UNDER_REVIEW").label).toBe("Awaiting Payment Review");
    expect(formatStatus("PROCESSING").label).toBe("In Preparation");
    expect(formatStatus("COMPLETED").label).toBe("Released");

    const docStages = getDocumentWorkflowStages({
      status: "READY_FOR_SIGNING",
      isDraft: false,
    });
    const releasedStage = docStages.find((s) => s.key === "released");
    expect(releasedStage?.state).toBe("upcoming");

    const milestones = getScheduleMilestones({
      id: 26,
      userId: 1,
      parishId: 1,
      eventType: "BAPTISM",
      requestedDate: "2026-11-20",
      status: "PENDING",
      createdAt: "2026-11-01T08:00:00.000Z",
      updatedAt: "2026-11-01T08:00:00.000Z",
    });
    expect(milestones[0].state).toBe("completed");
    expect(milestones[4].state).toBe("upcoming");
  });

  it("M9: builds Asia/Manila calendar exports and avoids fabricated times for date-only events", () => {
    const timedUrl = buildGoogleCalendarUrl({
      id: 5,
      title: "Parish Fiesta Mass",
      date: "2026-11-20",
      startTime: "09:00 AM",
      endTime: "10:30 AM",
      location: "Cathedral",
    });
    expect(timedUrl).toContain("ctz=Asia%2FManila");
    expect(timedUrl).toContain("20261120T010000Z%2F20261120T023000Z");

    const dateOnlyIcs = buildEventIcsContent({
      id: 6,
      title: "All Day Recollection",
      date: "2026-11-21",
    });
    expect(dateOnlyIcs).toContain("DTSTART;VALUE=DATE:20261121");
    expect(dateOnlyIcs).toContain("DTEND;VALUE=DATE:20261122");
  });

  it("U10: retrieves all parish pages beyond 50 and provides authoritative document descriptions", async () => {
    (apiClient.request as jest.Mock)
      .mockResolvedValueOnce({
        items: [{ id: "1", name: "Parish 1" }],
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        items: [{ id: "2", name: "Parish 2" }],
        total: 2,
        page: 2,
        limit: 100,
        totalPages: 2,
      });

    const parishes = await fetchAllActiveParishes();
    expect(parishes).toHaveLength(2);
    expect(getDocumentTypeDescription("BAPTISMAL_CERTIFICATE")).toContain("Baptism");
    expect(DOCUMENT_SPECIALIZED_GUIDANCE.MARRIAGE_BANNS).toContain("Marriage Banns");
    expect(DOCUMENT_SPECIALIZED_GUIDANCE.PERMIT_TO_MARRY).toContain("Permit to Marry");
    expect(DOCUMENT_SPECIALIZED_GUIDANCE.STATUS_OF_LIBERTY).toContain("Status of Liberty");
  });

  it("Accessibility: StatusLabel uses custom label override for screen readers", async () => {
    const view = await render(<StatusLabel status="PENDING" label="Custom Status Override" />);
    expect(view.getByLabelText("Status: Custom Status Override")).toBeTruthy();
  });
});
