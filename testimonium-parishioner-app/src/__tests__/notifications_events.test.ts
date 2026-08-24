import { notificationKeys } from "../features/notifications/queryKeys";
import type { NotificationItem } from "../features/notifications/types";
import {
  filterUpcomingEvents,
  formatEventDate,
  parseEventDateOnly,
  parseTimeToMinutes,
  sortEventsChronologically,
} from "../features/events/presentation";
import type { PublicEventDto } from "../features/events/types";

describe("Phase 5B: Notifications Reference Routing & Query Keys", () => {
  it("generates UID-scoped query keys for notifications", () => {
    const key1 = notificationKeys.list("user-1");
    const key2 = notificationKeys.list("user-2");
    expect(key1).not.toEqual(key2);
    expect(key1).toEqual(["notifications", "list", "user-1"]);
  });

  it("calculates unread count correctly from notification items", () => {
    const items: NotificationItem[] = [
      {
        id: 1,
        userId: 10,
        title: "Doc Ready",
        message: "Ready",
        type: "IN_APP",
        isRead: false,
        dateSent: "2026-08-25T00:00:00.000Z",
        createdAt: "2026-08-25T00:00:00.000Z",
        referenceType: "DOCUMENT_REQUEST",
        referenceId: 101,
      },
      {
        id: 2,
        userId: 10,
        title: "Schedule Confirmed",
        message: "Confirmed",
        type: "IN_APP",
        isRead: true,
        dateSent: "2026-08-24T00:00:00.000Z",
        createdAt: "2026-08-24T00:00:00.000Z",
        referenceType: "SCHEDULE_REQUEST",
        referenceId: 202,
      },
      {
        id: 3,
        userId: 10,
        title: "Diocese Notice",
        message: "Notice",
        type: "IN_APP",
        isRead: false,
        dateSent: "2026-08-23T00:00:00.000Z",
        createdAt: "2026-08-23T00:00:00.000Z",
        referenceType: "GENERAL",
      },
    ];

    const unread = items.filter((i) => !i.isRead);
    expect(unread).toHaveLength(2);
    expect(unread[0].id).toBe(1);
    expect(unread[1].id).toBe(3);
  });

  it("differentiates reference routing targets safely", () => {
    const resolveTarget = (item: NotificationItem): { type: string; path?: string } => {
      if (item.referenceType === "DOCUMENT_REQUEST" && item.referenceId) {
        return { type: "nav", path: `/(app)/requests/${item.referenceId}` };
      }
      if (item.referenceType === "SCHEDULE_REQUEST" && item.referenceId) {
        return { type: "nav", path: `/(app)/schedule/${item.referenceId}` };
      }
      return { type: "alert" };
    };

    expect(
      resolveTarget({
        id: 1,
        userId: 1,
        title: "T",
        message: "M",
        type: "IN_APP",
        isRead: false,
        dateSent: "",
        createdAt: "",
        referenceType: "DOCUMENT_REQUEST",
        referenceId: 55,
      })
    ).toEqual({ type: "nav", path: "/(app)/requests/55" });

    expect(
      resolveTarget({
        id: 2,
        userId: 1,
        title: "T",
        message: "M",
        type: "IN_APP",
        isRead: false,
        dateSent: "",
        createdAt: "",
        referenceType: "SCHEDULE_REQUEST",
        referenceId: 99,
      })
    ).toEqual({ type: "nav", path: "/(app)/schedule/99" });

    expect(
      resolveTarget({
        id: 3,
        userId: 1,
        title: "T",
        message: "M",
        type: "IN_APP",
        isRead: false,
        dateSent: "",
        createdAt: "",
        referenceType: "GENERAL",
      })
    ).toEqual({ type: "alert" });
  });
});

describe("Phase 5B: Events Date Parsing, Filtering, and Chronological Sorting", () => {
  it("formats and parses event dates without UTC shift", () => {
    const parsed = parseEventDateOnly("2026-08-25");
    expect(parsed.year).toBe(2026);
    expect(parsed.month).toBe(8);
    expect(parsed.day).toBe(25);
    expect(parsed.dateKey).toBe("2026-08-25");

    expect(formatEventDate("2026-08-25", "full")).toBe("August 25, 2026");
  });

  it("converts AM/PM time strings to total minutes for sorting", () => {
    expect(parseTimeToMinutes("06:00 AM")).toBe(360);
    expect(parseTimeToMinutes("12:00 PM")).toBe(720);
    expect(parseTimeToMinutes("01:30 PM")).toBe(810);
    expect(parseTimeToMinutes("12:00 AM")).toBe(0);
    expect(parseTimeToMinutes("invalid")).toBe(0);
  });

  it("sorts events chronologically by date and start time", () => {
    const events: PublicEventDto[] = [
      {
        id: 1,
        parishId: 1,
        title: "Late Mass",
        eventType: "MASS",
        description: null,
        location: "Church",
        eventDate: "2026-08-25",
        startTime: "05:00 PM",
        endTime: "06:00 PM",
      },
      {
        id: "mass-t-1",
        parishId: 1,
        title: "Early Mass",
        eventType: "MASS",
        description: null,
        location: "Church",
        eventDate: "2026-08-25",
        startTime: "06:00 AM",
        endTime: "07:00 AM",
      },
      {
        id: 2,
        parishId: 1,
        title: "Next Day Mass",
        eventType: "MASS",
        description: null,
        location: "Church",
        eventDate: "2026-08-26",
        startTime: "06:00 AM",
        endTime: "07:00 AM",
      },
    ];

    const sorted = sortEventsChronologically(events);
    expect(sorted[0].id).toBe("mass-t-1");
    expect(sorted[1].id).toBe(1);
    expect(sorted[2].id).toBe(2);
  });

  it("filters upcoming events relative to current calendar date", () => {
    const today = new Date("2026-08-25T00:00:00.000Z");
    const events: PublicEventDto[] = [
      {
        id: 1,
        parishId: 1,
        title: "Yesterday",
        eventType: "MASS",
        description: null,
        location: null,
        eventDate: "2026-08-24",
        startTime: "06:00 AM",
        endTime: null,
      },
      {
        id: 2,
        parishId: 1,
        title: "Today",
        eventType: "MASS",
        description: null,
        location: null,
        eventDate: "2026-08-25",
        startTime: "06:00 AM",
        endTime: null,
      },
      {
        id: 3,
        parishId: 1,
        title: "Tomorrow",
        eventType: "MASS",
        description: null,
        location: null,
        eventDate: "2026-08-26",
        startTime: "06:00 AM",
        endTime: null,
      },
    ];

    const upcoming = filterUpcomingEvents(events, today);
    expect(upcoming).toHaveLength(2);
    expect(upcoming.map((e) => e.id)).toEqual([2, 3]);
  });
});
