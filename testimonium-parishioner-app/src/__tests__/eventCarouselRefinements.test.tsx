import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventBannerCarousel } from "@/features/events/components/EventBannerCarousel";
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

describe("EventBannerCarousel UI Refinements", () => {
  const queryClients: QueryClient[] = [];

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
    Wrapper.displayName = "RefinementQueryWrapper";
    return Wrapper;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await cleanup();
    queryClients.forEach((client) => client.clear());
    queryClients.length = 0;
  });

  it("limits pagination indicators to at most 5 dots when there are more than 5 events", async () => {
    const manyEvents = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      parishId: 2,
      title: `Event ${i + 1}`,
      eventType: "PARISH_EVENT",
      description: null,
      location: null,
      eventDate: "2026-10-18T00:00:00.000Z",
      startTime: "08:00 AM",
      endTime: "09:00 AM",
      parish: { id: 2, parishName: "St. Joseph Parish" },
    }));

    (apiClient.request as jest.Mock).mockResolvedValueOnce(manyEvents);

    await render(<EventBannerCarousel />, {
      wrapper: createWrapper(),
    });


    await screen.findByText("Event 1");

    // The pagination container accessibilityLabel reports full count
    const indicatorContainer = screen.getByLabelText("Event 1 of 8");
    expect(indicatorContainer).toBeTruthy();

    // Verify exactly 5 visible dots in the indicator container
    // Indicator container has View children for visible dots
    const dots = indicatorContainer.props.children;
    expect(dots).toHaveLength(5);
  });

  it("shows exactly N dots when there are 5 or fewer events", async () => {
    const threeEvents = Array.from({ length: 3 }, (_, i) => ({
      id: i + 1,
      parishId: 2,
      title: `Small Event ${i + 1}`,
      eventType: "PARISH_EVENT",
      description: null,
      location: null,
      eventDate: "2026-10-18T00:00:00.000Z",
      startTime: "08:00 AM",
      endTime: "09:00 AM",
      parish: { id: 2, parishName: "St. Joseph Parish" },
    }));

    (apiClient.request as jest.Mock).mockResolvedValueOnce(threeEvents);

    await render(<EventBannerCarousel />, {
      wrapper: createWrapper(),
    });

    await screen.findByText("Small Event 1");

    const indicatorContainer = screen.getByLabelText("Event 1 of 3");
    expect(indicatorContainer).toBeTruthy();
    expect(indicatorContainer.props.children).toHaveLength(3);
  });

  it("advances carousel automatically every 8 seconds with fake timers", async () => {
    jest.useFakeTimers();

    const twoEvents = [
      {
        id: 101,
        parishId: 2,
        title: "First Autoplay Event",
        eventType: "MASS",
        description: null,
        location: null,
        eventDate: "2026-10-18T00:00:00.000Z",
        startTime: "06:00 AM",
        endTime: "07:00 AM",
        parish: { id: 2, parishName: "St. Joseph Parish" },
      },
      {
        id: 102,
        parishId: 3,
        title: "Second Autoplay Event",
        eventType: "MASS",
        description: null,
        location: null,
        eventDate: "2026-10-19T00:00:00.000Z",
        startTime: "07:00 AM",
        endTime: "08:00 AM",
        parish: { id: 3, parishName: "Miraculous Medal Parish" },
      },
    ];

    (apiClient.request as jest.Mock).mockResolvedValueOnce(twoEvents);

    const view = await render(<EventBannerCarousel />, {
      wrapper: createWrapper(),
    });

    expect(await view.findByText("First Autoplay Event")).toBeTruthy();
    expect(view.getByLabelText("Event 1 of 2")).toBeTruthy();

    // Fast-forward 8 seconds to trigger autoplay advance
    await act(async () => {
      jest.advanceTimersByTime(8000);
    });

    expect(view.getByLabelText("Event 2 of 2")).toBeTruthy();

    // Fast-forward another 8 seconds to trigger cyclic wrap-around to index 0
    await act(async () => {
      jest.advanceTimersByTime(8000);
    });

    expect(view.getByLabelText("Event 1 of 2")).toBeTruthy();


    jest.useRealTimers();
  });
});
