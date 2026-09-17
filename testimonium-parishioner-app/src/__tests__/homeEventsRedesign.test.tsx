import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  screen,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getManilaDateString,
  getManilaThreeDayRange,
} from "@/features/events/presentation";
import {
  EventBannerCarousel,
  getEventDetailRoute,
} from "@/features/events/components/EventBannerCarousel";
import {
  getMonthParamsForDateWindow,
  mergeEventsForDateWindow,
} from "@/features/events/api";
import { apiClient } from "@/services/api/client";

// Mock router
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock apiClient
jest.mock("@/services/api/client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

describe("Phase D — Home + Three-Day Events Redesign", () => {
  const queryClients: QueryClient[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await cleanup();
    queryClients.forEach((client) => client.clear());
    queryClients.length = 0;
  });

  describe("Manila 3-Day Range Computation", () => {
    it("computes 3 consecutive dates in Asia/Manila calendar timezone", () => {
      // 2026-09-16 10:00:00 UTC = 2026-09-16 18:00:00 Manila (UTC+8)
      const base = new Date("2026-09-16T10:00:00.000Z");
      const range = getManilaThreeDayRange(base);

      expect(range.startDate).toBe("2026-09-16");
      expect(range.endDate).toBe("2026-09-18");
      expect(range.dates).toEqual(["2026-09-16", "2026-09-17", "2026-09-18"]);
    });

    it("correctly rolls over month boundaries", () => {
      // 2026-08-31 02:00:00 UTC = 2026-08-31 10:00:00 Manila
      const base = new Date("2026-08-31T02:00:00.000Z");
      const range = getManilaThreeDayRange(base);

      expect(range.startDate).toBe("2026-08-31");
      expect(range.endDate).toBe("2026-09-02");
      expect(range.dates).toEqual(["2026-08-31", "2026-09-01", "2026-09-02"]);
    });

    it("correctly rolls over year boundaries", () => {
      // 2026-12-31 04:00:00 UTC = 2026-12-31 12:00:00 Manila
      const base = new Date("2026-12-31T04:00:00.000Z");
      const range = getManilaThreeDayRange(base);

      expect(range.startDate).toBe("2026-12-31");
      expect(range.endDate).toBe("2027-01-02");
      expect(range.dates).toEqual(["2026-12-31", "2027-01-01", "2027-01-02"]);
    });

    it("correctly handles leap years", () => {
      // 2028-02-28
      const base = new Date("2028-02-28T04:00:00.000Z");
      const range = getManilaThreeDayRange(base);

      expect(range.startDate).toBe("2028-02-28");
      expect(range.endDate).toBe("2028-03-01");
      expect(range.dates).toEqual(["2028-02-28", "2028-02-29", "2028-03-01"]);
    });

    it("selects one monthly feed normally and two at month or year boundaries", () => {
      expect(
        getMonthParamsForDateWindow(["2026-08-20", "2026-08-21", "2026-08-22"])
      ).toEqual([{ year: 2026, month: 8 }]);
      expect(
        getMonthParamsForDateWindow(["2026-08-31", "2026-09-01", "2026-09-02"])
      ).toEqual([
        { year: 2026, month: 8 },
        { year: 2026, month: 9 },
      ]);
      expect(
        getMonthParamsForDateWindow(["2026-12-31", "2027-01-01", "2027-01-02"])
      ).toEqual([
        { year: 2026, month: 12 },
        { year: 2027, month: 1 },
      ]);
      expect(
        getMonthParamsForDateWindow(["2028-02-28", "2028-02-29", "2028-03-01"])
      ).toEqual([
        { year: 2028, month: 2 },
        { year: 2028, month: 3 },
      ]);
    });

    it("filters, sorts, and deduplicates stored and generated recurring events", () => {
      const stored = {
        id: 7,
        parishId: 1,
        title: "Stored Event",
        eventType: "PARISH_EVENT",
        description: null,
        location: null,
        eventDate: "2026-09-01T00:00:00.000Z",
        startTime: "10:00 AM",
        endTime: null,
      };
      const generated = {
        ...stored,
        id: "mass-t-3-2026-09-01",
        title: "Generated Mass",
        startTime: "06:00 AM",
      };

      expect(
        mergeEventsForDateWindow(
          [
            [stored, generated],
            [generated, { ...stored, id: 9, eventDate: "2026-09-03" }],
          ],
          ["2026-08-31", "2026-09-01", "2026-09-02"]
        ).map((event) => event.id)
      ).toEqual(["mass-t-3-2026-09-01", 7]);
    });

    it.each([
      [201, "2026-08-20", "201", "2026", "8"],
      ["mass-t-8-2026-08-21", "2026-08-21", "mass-t-8-2026-08-21", "2026", "8"],
      [202, "2026-08-31", "202", "2026", "8"],
      ["mass-t-9-2026-09-01", "2026-09-01", "mass-t-9-2026-09-01", "2026", "9"],
      [203, "2026-12-31", "203", "2026", "12"],
      ["mass-t-10-2027-01-01", "2027-01-01", "mass-t-10-2027-01-01", "2027", "1"],
      [204, "2028-02-29", "204", "2028", "2"],
      ["mass-t-11-2028-03-01", "2028-03-01", "mass-t-11-2028-03-01", "2028", "3"],
    ])(
      "routes event %s on %s with its actual year and month",
      (id, eventDate, expectedId, year, month) => {
        expect(
          getEventDetailRoute({
            id,
            parishId: 5,
            title: "Boundary Event",
            eventType: "PARISH_EVENT",
            description: null,
            location: null,
            eventDate,
            startTime: "06:00 AM",
            endTime: null,
          })
        ).toEqual({
          pathname: "/(app)/events/[id]",
          params: { id: expectedId, year, month },
        });
      }
    );
  });

  describe("EventBannerCarousel UI & State Isolation", () => {
    const createWrapper = () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Infinity },
        },
      });
      queryClients.push(queryClient);
      const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 44, left: 0, right: 0, bottom: 34 },
          }}
        >
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </SafeAreaProvider>
      );
      Wrapper.displayName = "QueryWrapper";
      return Wrapper;
    };

    it("renders empty state cleanly when no events are scheduled", async () => {
      (apiClient.request as jest.Mock).mockResolvedValueOnce([]);

      await render(<EventBannerCarousel />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(
          screen.getByText("No events scheduled for the next three days.")
        ).toBeTruthy();
      });

      expect(screen.getByText("Browse Monthly Calendar")).toBeTruthy();
    });

    it("renders events with day badge, title, and parish without stock imagery", async () => {
      const todayStr = getManilaDateString();
      (apiClient.request as jest.Mock).mockResolvedValueOnce([
        {
          id: 101,
          parishId: 5,
          title: "Parish Fiesta Mass",
          eventType: "MASS",
          description: null,
          location: "Main Church",
          eventDate: `${todayStr}T00:00:00.000Z`,
          startTime: "09:00 AM",
          endTime: "10:30 AM",
          parish: { id: 5, parishName: "St. John the Baptist Parish" },
        },
      ]);

      await render(<EventBannerCarousel />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Parish Fiesta Mass")).toBeTruthy();
        expect(screen.getByText("St. John the Baptist Parish")).toBeTruthy();
        expect(screen.getByText("TODAY")).toBeTruthy();
      });
      expect(apiClient.request).toHaveBeenCalledTimes(1);
      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringMatching(
            /^\/parish-events\/all\?year=\d{4}&month=\d{1,2}$/
          ),
        })
      );
    });

    it("isolates errors cleanly with retry button without crashing", async () => {
      (apiClient.request as jest.Mock).mockRejectedValueOnce(
        new Error("Network connection error")
      );

      await render(<EventBannerCarousel />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Could not load upcoming events.")).toBeTruthy();
        expect(screen.getByText("Retry")).toBeTruthy();
      });
    });

    it("loads both monthly feeds at a boundary and opens detail with the event month", async () => {
      const now = new Date("2026-08-31T02:00:00.000Z");
      (apiClient.request as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "mass-t-4-2026-09-01",
            parishId: 5,
            title: "September Morning Mass",
            eventType: "PRIVATE_MASS",
            description: null,
            location: "Main Church",
            eventDate: "2026-09-01T00:00:00.000Z",
            startTime: "06:00 AM",
            endTime: "07:00 AM",
            parish: { id: 5, parishName: "St. John Parish" },
          },
        ]);

      await render(<EventBannerCarousel now={now} />, {
        wrapper: createWrapper(),
      });

      const title = await screen.findByText("September Morning Mass");
      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/parish-events/all?year=2026&month=8",
        })
      );
      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/parish-events/all?year=2026&month=9",
        })
      );

      fireEvent.press(title);
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/(app)/events/[id]",
        params: {
          id: "mass-t-4-2026-09-01",
          year: "2026",
          month: "9",
        },
      });
    });
  });
});
