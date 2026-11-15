import React from "react";
import { cleanup, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ScheduleDetailScreen } from "@/features/schedule/ScheduleDetailScreen";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "42" }),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("@/hooks/useAutomaticRefresh", () => ({
  useScreenRefresh: () => ({}),
}));

jest.mock("@/components/files/SecureFileViewerModal", () => ({
  SecureFileViewerModal: () => null,
}));

jest.mock("@/features/schedule/components/SchedulingCalendar", () => ({
  SchedulingCalendar: () => null,
}));

jest.mock("@/features/schedule/api", () => ({
  useScheduleDetail: () => ({
    data: {
      id: 42,
      userId: 7,
      parishId: 1,
      parish: {
        id: 1,
        parishName: "San Carlos Cathedral",
        address: "Cathedral Compound",
        municipalityCity: "San Carlos City",
        province: "Pangasinan",
      },
      eventType: "BAPTISM",
      requestedDate: "2026-11-20T00:00:00.000Z",
      startDatetime: "2026-11-20T09:00:00.000Z",
      endDatetime: "2026-11-20T10:00:00.000Z",
      status: "CONFIRMED",
      remarks: "Time Slot: 09:00 AM",
      createdAt: "2026-11-01T08:00:00.000Z",
      updatedAt: "2026-11-02T08:00:00.000Z",
    },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: jest.fn(),
  }),
  useScheduleAttachments: () => ({
    data: [],
    isLoading: false,
  }),
  useAvailabilityDates: () => ({
    data: [],
    isLoading: false,
  }),
  useAvailableSlots: () => ({
    data: [],
    isLoading: false,
  }),
  useRespondReschedule: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useProposeAlternativeDate: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useWithdrawAlternativeDate: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
};

describe("ScheduleDetailScreen calendar export removal", () => {
  afterEach(async () => {
    await cleanup();
    jest.clearAllMocks();
  });

  it("renders schedule details without the removed Save to Your Calendar section", async () => {
    const view = await render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <ScheduleDetailScreen />
      </SafeAreaProvider>
    );

    expect(view.getByText("San Carlos Cathedral")).toBeTruthy();
    expect(view.queryByText("Save to Your Calendar")).toBeNull();
    expect(view.queryByText("Google Calendar")).toBeNull();
    expect(view.queryByText("Export .ICS")).toBeNull();
  });
});

