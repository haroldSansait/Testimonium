import React from "react";
import { Animated } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { EventDetailScreen } from "@/features/events/EventDetailScreen";
import { ParishDirectoryScreen } from "@/features/parishes/ParishDirectoryScreen";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, left: 0, right: 0, bottom: 24 }),
  SafeAreaView: ({ children }: any) => children,
}));

beforeAll(() => {
  jest.spyOn(Animated, "timing").mockImplementation(() => ({
    start: (cb?: any) => cb && cb({ finished: true }),
    stop: jest.fn(),
    reset: jest.fn(),
  } as any));

  jest.spyOn(Animated, "spring").mockImplementation(() => ({
    start: (cb?: any) => cb && cb({ finished: true }),
    stop: jest.fn(),
    reset: jest.fn(),
  } as any));

  jest.spyOn(Animated, "parallel").mockImplementation(() => ({
    start: (cb?: any) => cb && cb({ finished: true }),
    stop: jest.fn(),
    reset: jest.fn(),
  } as any));
});

const mockPush = jest.fn();
const mockSetParams = jest.fn();
let mockSearchParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
    setParams: mockSetParams,
  }),
  useLocalSearchParams: () => mockSearchParams,
}));

const mockUseCurrentMonthEvents = jest.fn();
jest.mock("@/features/events/api", () => ({
  useCurrentMonthEvents: () => mockUseCurrentMonthEvents(),
}));

const mockUseParishDetail = jest.fn();
const mockUseInfiniteParishes = jest.fn();
jest.mock("@/features/parishes/api", () => ({
  useParishDetail: (id?: string) => mockUseParishDetail(id),
  useInfiniteParishes: () => mockUseInfiniteParishes(),
}));

jest.mock("@/hooks/useRequireCompleteProfile", () => ({
  useRequireCompleteProfile: () => ({
    requireCompleteProfile: (cb: () => void) => cb(),
  }),
}));

jest.mock("@/features/parishes/components/ParishMapDOM", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  return function MockParishMapDOM({ selectedParishId }: any) {
    return (
      <View testID="mock-parish-map">
        <Text testID="map-selected-parish">{selectedParishId ?? "none"}</Text>
      </View>
    );
  };
});

describe("EventDetailScreen parish navigation and contact button removal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = { id: "101", year: "2026", month: "11" };
    mockUseCurrentMonthEvents.mockReturnValue({
      isLoading: false,
      data: [
        {
          id: 101,
          parishId: 42,
          title: "Feast of Christ the King",
          eventType: "FEAST_DAY",
          eventDate: "2026-11-22",
          startTime: "09:00",
          endTime: "11:00",
          location: "Main Sanctuary",
          description: "Solemn Eucharistic Celebration",
          parish: {
            id: 42,
            parishName: "San Carlos Cathedral",
          },
        },
      ],
    });
    mockUseParishDetail.mockReturnValue({
      isLoading: false,
      data: {
        id: 42,
        name: "San Carlos Cathedral",
        address: "123 Cathedral St",
        municipalityCity: "San Carlos City",
        province: "Negros Occidental",
        contactNumber: "+63 34 312 1234",
        email: "cathedral@diocese.org",
      },
    });
  });

  it("navigates to Parish Directory tab with parishId param and shows updated hint", async () => {
    const { getByLabelText, getByText } = await render(<EventDetailScreen />);

    expect(getByText("Feast of Christ the King")).toBeTruthy();
    expect(getByText("Solemn Eucharistic Celebration")).toBeTruthy();
    expect(getByText("Tap to view parish in directory →")).toBeTruthy();

    fireEvent.press(getByLabelText("View San Carlos Cathedral"));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(app)/(tabs)/(parishes)",
      params: { parishId: "42" },
    });
  });

  it("completely removes Call Parish and Email buttons", async () => {
    const { queryByText } = await render(<EventDetailScreen />);

    expect(queryByText("Call Parish")).toBeNull();
    expect(queryByText("Email")).toBeNull();
    expect(queryByText("Tap to view full parish profile →")).toBeNull();
  });
});

describe("ParishDirectoryScreen deep selection via route params", () => {
  const parish42 = {
    id: 42,
    name: "San Carlos Cathedral",
    latitude: 10.48,
    longitude: 123.41,
  };
  const parish99 = {
    id: 99,
    name: "St. Joseph Parish",
    latitude: 10.38,
    longitude: 123.22,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParishDetail.mockReturnValue({ data: undefined, isLoading: false });
  });

  it("auto-selects requested parish once async directory data finishes loading", async () => {
    mockSearchParams = { parishId: "42" };
    mockUseInfiniteParishes.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isError: false,
      refetch: jest.fn(),
    });

    const { rerender, getByTestId, queryByText } = await render(<ParishDirectoryScreen />);
    expect(queryByText("San Carlos Cathedral")).toBeNull();

    mockUseInfiniteParishes.mockReturnValue({
      data: { pages: [{ items: [parish42, parish99], total: 2 }] },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isError: false,
      refetch: jest.fn(),
    });

    await rerender(<ParishDirectoryScreen />);

    expect(getByTestId("map-selected-parish").props.children).toBe("42");
    expect(mockSetParams).toHaveBeenCalledWith({ parishId: undefined });
  });

  it("updates selection when navigating from a different event's parishId", async () => {
    mockSearchParams = { parishId: "42" };
    mockUseInfiniteParishes.mockReturnValue({
      data: { pages: [{ items: [parish42, parish99], total: 2 }] },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isError: false,
      refetch: jest.fn(),
    });

    const { rerender, getByTestId } = await render(<ParishDirectoryScreen />);
    expect(getByTestId("map-selected-parish").props.children).toBe("42");

    mockSearchParams = { parishId: "99" };
    await rerender(<ParishDirectoryScreen />);
    expect(getByTestId("map-selected-parish").props.children).toBe("99");
  });
});

