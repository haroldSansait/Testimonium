import {
  fetchPublicEvents,
  eventKeys,
} from "@/features/events/api";
import {
  filterEventsByParish,
  filterUpcomingEvents,
  formatEventDate,
  formatEventTime,
  getCurrentLocalMonthParams,
  parseEventDateOnly,
  sortEventsChronologically,
} from "@/features/events/presentation";
import type { PublicEventDto } from "@/features/events/types";
import { apiClient } from "@/services/api/client";

jest.mock("@/services/api/client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

describe("Events Feature & Presentation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("eventKeys", () => {
    it("generates structured month query keys", () => {
      expect(eventKeys.all).toEqual(["events"]);
      expect(eventKeys.months()).toEqual(["events", "month"]);
      expect(eventKeys.month({ year: 2026, month: 8 })).toEqual([
        "events",
        "month",
        { year: 2026, month: 8 },
      ]);
    });
  });

  describe("fetchPublicEvents", () => {
    it("calls /parish-events/all with year and month query parameters", async () => {
      (apiClient.request as jest.Mock).mockResolvedValueOnce([]);

      await fetchPublicEvents({ year: 2026, month: 8 });

      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/parish-events/all?year=2026&month=8",
        })
      );
    });
  });

  describe("getCurrentLocalMonthParams", () => {
    it("returns correct year and 1-indexed month", () => {
      const fixedDate = new Date(2026, 7, 22); // Month index 7 = August (month 8)
      const params = getCurrentLocalMonthParams(fixedDate);
      expect(params).toEqual({ year: 2026, month: 8 });
    });
  });

  describe("parseEventDateOnly (Safe & Resilient Parsing)", () => {
    it("extracts year, month, day accurately without UTC timezone shifting", () => {
      const parsed1 = parseEventDateOnly("2026-08-25T00:00:00.000Z");
      expect(parsed1.year).toBe(2026);
      expect(parsed1.month).toBe(8);
      expect(parsed1.day).toBe(25);
      expect(parsed1.dateKey).toBe("2026-08-25");

      const parsed2 = parseEventDateOnly("2026-12-08");
      expect(parsed2.year).toBe(2026);
      expect(parsed2.month).toBe(12);
      expect(parsed2.day).toBe(8);
      expect(parsed2.dateKey).toBe("2026-12-08");
    });

    it("handles null, undefined, and malformed date strings without throwing", () => {
      expect(parseEventDateOnly(null)).toEqual({
        year: 0,
        month: 0,
        day: 0,
        dateKey: "",
      });
      expect(parseEventDateOnly(undefined)).toEqual({
        year: 0,
        month: 0,
        day: 0,
        dateKey: "",
      });
      expect(parseEventDateOnly("")).toEqual({
        year: 0,
        month: 0,
        day: 0,
        dateKey: "",
      });
      expect(parseEventDateOnly("invalid-date-string")).toEqual({
        year: 0,
        month: 0,
        day: 0,
        dateKey: "",
      });
    });
  });

  describe("formatEventDate", () => {
    it("formats short date with day of week and month", () => {
      const short = formatEventDate("2026-08-25");
      expect(short).toContain("Aug 25");
    });

    it("formats full date with month name, day, and year", () => {
      const full = formatEventDate("2026-08-25", "full");
      expect(full).toBe("August 25, 2026");
    });

    it("returns safe fallback on invalid/missing date", () => {
      expect(formatEventDate(null)).toBe("Date to be announced");
      expect(formatEventDate("")).toBe("Date to be announced");
    });
  });

  describe("formatEventTime", () => {
    it("formats start and end time range", () => {
      expect(formatEventTime("06:00 AM", "07:30 AM")).toBe("06:00 AM - 07:30 AM");
    });

    it("formats single time if only startTime is provided", () => {
      expect(formatEventTime("06:00 AM", null)).toBe("06:00 AM");
    });

    it("formats single time if start and end are identical", () => {
      expect(formatEventTime("06:00 AM", "06:00 AM")).toBe("06:00 AM");
    });

    it("returns null when no time is provided", () => {
      expect(formatEventTime(null, null)).toBeNull();
      expect(formatEventTime(undefined, undefined)).toBeNull();
    });
  });

  describe("filterUpcomingEvents", () => {
    const mockEvents: PublicEventDto[] = [
      {
        id: 1,
        parishId: 10,
        title: "Past Mass",
        eventType: "HOLY_MASS",
        description: null,
        location: "Sanctuary",
        eventDate: "2026-08-10T00:00:00.000Z",
        startTime: "06:00 AM",
        endTime: null,
      },
      {
        id: 2,
        parishId: 10,
        title: "Today Mass",
        eventType: "HOLY_MASS",
        description: null,
        location: "Sanctuary",
        eventDate: "2026-08-22T00:00:00.000Z",
        startTime: "06:00 AM",
        endTime: null,
      },
      {
        id: 3,
        parishId: 11,
        title: "Future Mass",
        eventType: "HOLY_MASS",
        description: null,
        location: "Sanctuary",
        eventDate: "2026-08-28T00:00:00.000Z",
        startTime: "05:00 PM",
        endTime: null,
      },
    ];

    it("excludes events before today and includes today and future events", () => {
      const fixedToday = new Date(2026, 7, 22); // Aug 22, 2026
      const upcoming = filterUpcomingEvents(mockEvents, fixedToday);
      expect(upcoming).toHaveLength(2);
      expect(upcoming.map((e) => e.id)).toEqual([2, 3]);
    });

    it("gracefully filters out malformed event entries", () => {
      const malformed = [
        ...mockEvents,
        { id: 4, parishId: 1, title: "No Date", eventDate: "" } as any,
        null as any,
      ];
      const fixedToday = new Date(2026, 7, 22);
      const upcoming = filterUpcomingEvents(malformed, fixedToday);
      expect(upcoming).toHaveLength(2);
    });
  });

  describe("sortEventsChronologically", () => {
    const unorderedEvents: PublicEventDto[] = [
      {
        id: "e3",
        parishId: 1,
        title: "Later Date",
        eventType: "PARISH_EVENT",
        description: null,
        location: null,
        eventDate: "2026-08-30",
        startTime: "08:00 AM",
        endTime: null,
      },
      {
        id: "e2",
        parishId: 1,
        title: "Same Date Afternoon",
        eventType: "PARISH_EVENT",
        description: null,
        location: null,
        eventDate: "2026-08-25",
        startTime: "04:00 PM",
        endTime: null,
      },
      {
        id: "e1",
        parishId: 1,
        title: "Same Date Morning",
        eventType: "PARISH_EVENT",
        description: null,
        location: null,
        eventDate: "2026-08-25",
        startTime: "06:00 AM",
        endTime: null,
      },
    ];

    it("sorts by date ascending, then time ascending (12-hour AM/PM safe)", () => {
      const sorted = sortEventsChronologically(unorderedEvents);
      expect(sorted.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
    });
  });

  describe("filterEventsByParish", () => {
    const events: PublicEventDto[] = [
      {
        id: 1,
        parishId: 10,
        title: "Parish 10 Event",
        eventType: "MASS",
        description: null,
        location: null,
        eventDate: "2026-08-25",
        startTime: null,
        endTime: null,
      },
      {
        id: 2,
        parishId: 20,
        title: "Parish 20 Event",
        eventType: "MASS",
        description: null,
        location: null,
        eventDate: "2026-08-25",
        startTime: null,
        endTime: null,
      },
    ];

    it("returns only events matching the specified parish ID", () => {
      expect(filterEventsByParish(events, 10)).toHaveLength(1);
      expect(filterEventsByParish(events, "10")).toHaveLength(1);
      expect(filterEventsByParish(events, 10)[0].id).toBe(1);

      expect(filterEventsByParish(events, 99)).toHaveLength(0);
      expect(filterEventsByParish(events, "invalid")).toHaveLength(0);
    });
  });
});
