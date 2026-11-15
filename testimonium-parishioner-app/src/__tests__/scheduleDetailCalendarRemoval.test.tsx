import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ScheduleDetailScreen } from "@/features/schedule/ScheduleDetailScreen";
import { useEligiblePriests, useRequestPriestChange, useScheduleDetail } from "@/features/schedule/api";

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
  useScheduleDetail: jest.fn(() => ({
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
  })),
  useEligiblePriests: jest.fn(() => ({ data: [], isLoading: false, isError: false })),
  useRequestPriestChange: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
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

describe("ScheduleDetailScreen priest change and secretary contacts", () => {
  let baseDetail: ReturnType<typeof useScheduleDetail>;

  beforeEach(() => {
    baseDetail = useScheduleDetail("42");
    jest.mocked(useScheduleDetail).mockReturnValue({
      ...baseDetail,
      data: {
        ...baseDetail.data!,
        version: 3,
        assignedPriestId: 21,
        priestResponseStatus: "ACCEPTED",
        parishSecretary: { id: 90, fullName: "Secretary Clara", contactNumber: "09171234567" },
      },
    } as ReturnType<typeof useScheduleDetail>);
    jest.mocked(useEligiblePriests).mockReturnValue({
      data: [
        { id: 21, name: "Current Priest", isAssistant: false },
        { id: 22, name: "Replacement Priest", isAssistant: true },
      ],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useEligiblePriests>);
  });

  afterEach(async () => {
    await cleanup();
    jest.mocked(useScheduleDetail).mockReturnValue(baseDetail);
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  const renderDetail = () => render(
    <SafeAreaProvider initialMetrics={initialMetrics}><ScheduleDetailScreen /></SafeAreaProvider>
  );

  it("submits the replacement and optional note once and refreshes", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const mutateAsync = jest.fn(() => pending);
    jest.mocked(useRequestPriestChange).mockReturnValue({ mutateAsync, isPending: false } as unknown as ReturnType<typeof useRequestPriestChange>);
    const view = await renderDetail();
    await fireEvent.press(view.getByText("Request a Different Priest"));
    expect(useEligiblePriests).toHaveBeenLastCalledWith(1, { enabled: true });
    expect(view.queryByLabelText("Select Rev. Fr. Current Priest")).toBeNull();
    await fireEvent.press(view.getByLabelText("Select Rev. Fr. Replacement Priest"));
    await fireEvent.changeText(view.getByLabelText("Optional note explaining priest change request"), "  Prefer this priest  ");
    await fireEvent.press(view.getByText("Confirm Priest Change"));
    await fireEvent.press(view.getByText("Confirm Priest Change"));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({ scheduleId: 42, replacementPriestId: 22, note: "Prefer this priest", expectedVersion: 3 });
    await act(async () => { finish(); await pending; });
    expect(view.getByText("Priest change requested. Your parish secretary will review and assign the appropriate priest.")).toBeTruthy();
    expect(baseDetail.refetch).toHaveBeenCalled();
  });

  it("shows submission errors and keeps the form available", async () => {
    jest.mocked(useRequestPriestChange).mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue(new Error("Schedule changed. Refresh and retry.")), isPending: false,
    } as unknown as ReturnType<typeof useRequestPriestChange>);
    const view = await renderDetail();
    await fireEvent.press(view.getByText("Request a Different Priest"));
    await fireEvent.press(view.getByLabelText("Select Rev. Fr. Replacement Priest"));
    await fireEvent.press(view.getByText("Confirm Priest Change"));
    expect(view.getByText("Schedule changed. Refresh and retry.")).toBeTruthy();
    expect(baseDetail.refetch).toHaveBeenCalled();
  });

  it("uses the secretary profile phone for the dial action", async () => {
    jest.spyOn(Linking, "canOpenURL").mockResolvedValue(true);
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    const view = await renderDetail();
    expect(view.getByText("Secretary Clara")).toBeTruthy();
    await fireEvent.press(view.getByText("09171234567"));
    expect(Linking.openURL).toHaveBeenCalledWith("tel:09171234567");
  });

  it("does not show a previous schedule submission error on newly selected details", async () => {
    let fail!: (error: Error) => void;
    const pending = new Promise<void>((_resolve, reject) => { fail = reject; });
    jest.mocked(useRequestPriestChange).mockReturnValue({ mutateAsync: jest.fn(() => pending), isPending: false } as unknown as ReturnType<typeof useRequestPriestChange>);
    const view = await renderDetail();
    await fireEvent.press(view.getByText("Request a Different Priest"));
    await fireEvent.press(view.getByLabelText("Select Rev. Fr. Replacement Priest"));
    await fireEvent.press(view.getByText("Confirm Priest Change"));
    const current = useScheduleDetail("42");
    jest.mocked(useScheduleDetail).mockReturnValue({ ...current, data: { ...current.data!, id: 43 } } as ReturnType<typeof useScheduleDetail>);
    await view.rerender(<SafeAreaProvider initialMetrics={initialMetrics}><ScheduleDetailScreen /></SafeAreaProvider>);
    await fireEvent.press(view.getByText("Request a Different Priest"));
    await act(async () => { fail(new Error("Previous schedule failed")); await pending.catch(() => {}); });
    expect(view.queryByText("Previous schedule failed")).toBeNull();
    expect(view.getByText("Preferred Replacement Priest")).toBeTruthy();
  });

  it("hides reassignment for terminal requests and shows unavailable secretary details", async () => {
    const current = useScheduleDetail("42");
    jest.mocked(useScheduleDetail).mockReturnValue({ ...current, data: { ...current.data!, status: "COMPLETED", parishSecretary: null } } as ReturnType<typeof useScheduleDetail>);
    const view = await renderDetail();
    expect(view.queryByText("Request a Different Priest")).toBeNull();
    expect(view.queryByText("Secretary Clara")).toBeNull();
    expect(view.queryByText("09171234567")).toBeNull();
  });
});

