import React from "react";
import { Animated } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { ParishDirectoryScreen } from "@/features/parishes/ParishDirectoryScreen";
import { ParishInfoSheet } from "@/features/parishes/components/ParishInfoSheet";
import type { ParishDto } from "@/features/parishes/types";

// Mock safe area insets
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, left: 0, right: 0, bottom: 24 }),
  SafeAreaView: ({ children }: any) => children,
}));

// Mock Animated timing and parallel to complete synchronously in tests
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

// Mock router
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

// Mock API hooks
const mockUseInfiniteParishes = jest.fn();
const mockUseParishDetail = jest.fn();
jest.mock("@/features/parishes/api", () => ({
  useInfiniteParishes: () => mockUseInfiniteParishes(),
  useParishDetail: (id?: string) => mockUseParishDetail(id),
}));

// Mock useRequireCompleteProfile
jest.mock("@/hooks/useRequireCompleteProfile", () => ({
  useRequireCompleteProfile: () => ({
    requireCompleteProfile: (cb: () => void) => cb(),
  }),
}));

// Mock ParishMapDOM component to verify props passed from native
jest.mock("@/features/parishes/components/ParishMapDOM", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, TouchableOpacity } = require("react-native");
  return {
    __esModule: true,
    default: ({ parishes, selectedParishId, onSelectParish, resetSignal }: any) => (
      <View testID="parish-map-dom">
        <Text testID="map-parish-count">{parishes.length} parishes</Text>
        <Text testID="map-selected-id">{selectedParishId || "none"}</Text>
        <Text testID="map-reset-signal">{resetSignal}</Text>
        {parishes.map((p: any) => (
          <TouchableOpacity
            key={p.id}
            testID={`marker-${p.id}`}
            onPress={() => onSelectParish?.(p.id)}
          >
            <Text>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
  };
});

describe("ParishDirectoryScreen (Map-First Redesign)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParishDetail.mockReturnValue({
      data: null,
      isLoading: false,
    });
  });

  const mockParishes: ParishDto[] = [
    {
      id: "1",
      name: "San Carlos Borromeo Cathedral",
      type: "Parish",
      latitude: 10.485,
      longitude: 123.415,
      pinColor: "#7B1C2A",
      showLabel: true,
      address: "Rizal St., San Carlos City",
      patronSaint: "Saint Charles Borromeo",
      feastDay: "November 4",
      isMotherParish: true,
    },
    {
      id: "2",
      name: "St. Vincent Ferrer Parish",
      type: "Parish",
      latitude: 10.35,
      longitude: 123.3,
      pinColor: "#153E35",
      showLabel: true,
      address: "Calatrava, Negros Occidental",
      patronSaint: "Saint Vincent Ferrer",
    },
    {
      id: "3",
      name: "Parish Without Coordinates",
      type: "Quasi-Parish",
      latitude: null,
      longitude: null,
    },
  ];

  it("renders AppHeader with correct title, subtitle, and action buttons", async () => {
    mockUseInfiniteParishes.mockReturnValue({
      data: {
        pages: [{ items: mockParishes, total: 3 }],
      },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isError: false,
      refetch: jest.fn(),
    });

    const { findByText, findByLabelText } = await render(<ParishDirectoryScreen />);

    expect(await findByText("Parish Directory")).toBeTruthy();
    expect(await findByText("Diocese of San Carlos")).toBeTruthy();
    expect(await findByLabelText("Reset map overview")).toBeTruthy();
    expect(await findByLabelText("Refresh parish directory")).toBeTruthy();
  });

  it("renders only parishes with valid coordinates to the map component", async () => {
    mockUseInfiniteParishes.mockReturnValue({
      data: {
        pages: [{ items: mockParishes, total: 3 }],
      },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isError: false,
      refetch: jest.fn(),
    });

    const { findByTestId, queryByTestId } = await render(<ParishDirectoryScreen />);

    const countElem = await findByTestId("map-parish-count");
    expect(countElem.props.children).toEqual([2, " parishes"]);
    expect(await findByTestId("marker-1")).toBeTruthy();
    expect(await findByTestId("marker-2")).toBeTruthy();
    expect(queryByTestId("marker-3")).toBeNull();
  });

  it("does not render the legacy search bar or card list", async () => {
    mockUseInfiniteParishes.mockReturnValue({
      data: {
        pages: [{ items: mockParishes, total: 3 }],
      },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isError: false,
      refetch: jest.fn(),
    });

    const { queryByPlaceholderText, queryByText } = await render(<ParishDirectoryScreen />);

    expect(queryByPlaceholderText("Search parish or patron saint...")).toBeNull();
    expect(queryByText("Filter Parishes")).toBeNull();
    expect(queryByText("Load more parishes")).toBeNull();
  });

  it("opens ParishInfoSheet when a marker is tapped on the map", async () => {
    mockUseInfiniteParishes.mockReturnValue({
      data: {
        pages: [{ items: mockParishes, total: 3 }],
      },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isError: false,
      refetch: jest.fn(),
    });

    const { findByTestId, findByText } = await render(<ParishDirectoryScreen />);

    // Tap marker 1
    const marker1 = await findByTestId("marker-1");
    fireEvent.press(marker1);

    // Bottom sheet should now display parish information
    expect(await findByText("San Carlos Borromeo Cathedral")).toBeTruthy();
    expect(await findByText("Patron Saint: Saint Charles Borromeo")).toBeTruthy();
  });

  it("triggers map overview reset signal when locate button is pressed", async () => {
    mockUseInfiniteParishes.mockReturnValue({
      data: {
        pages: [{ items: mockParishes, total: 3 }],
      },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isError: false,
      refetch: jest.fn(),
    });

    const { findByLabelText, findByTestId } = await render(<ParishDirectoryScreen />);

    const signalBefore = await findByTestId("map-reset-signal");
    expect(signalBefore.props.children).toBe(0);

    const locateBtn = await findByLabelText("Reset map overview");
    fireEvent.press(locateBtn);

    const signalAfter = await findByTestId("map-reset-signal");
    expect(signalAfter.props.children).toBe(1);
  });
});

describe("ParishInfoSheet Component", () => {
  const sampleParish: ParishDto = {
    id: "10",
    name: "Our Lady of Peace Parish",
    type: "Parish",
    latitude: 10.5,
    longitude: 123.4,
    address: "National Highway, San Carlos",
    patronSaint: "Our Lady of Peace",
    feastDay: "January 24",
    contactNumber: "0917-123-4567",
    email: "olp@testimonium.ph",
    directoryDescription: "A welcoming parish dedicated to peace and community.",
    availableDocuments: ["BAPTISMAL_CERTIFICATE"],
  };

  it("renders parish information accurately when visible", async () => {
    const { findByText, findByLabelText } = await render(
      <ParishInfoSheet parish={sampleParish} visible={true} onClose={jest.fn()} />
    );

    expect(await findByText("Our Lady of Peace Parish")).toBeTruthy();
    expect(await findByText("Patron Saint: Our Lady of Peace")).toBeTruthy();
    expect(await findByText("National Highway, San Carlos")).toBeTruthy();
    expect(await findByText("A welcoming parish dedicated to peace and community.")).toBeTruthy();
    expect(await findByLabelText("Close parish information sheet")).toBeTruthy();
  });

  it("navigates to the full parish route when 'Full Details & Events' is pressed", async () => {
    const { findByLabelText } = await render(
      <ParishInfoSheet parish={sampleParish} visible={true} onClose={jest.fn()} />
    );

    const fullDetailsBtn = await findByLabelText(
      "View complete details and scheduled events for Our Lady of Peace Parish"
    );
    fireEvent.press(fullDetailsBtn);

    expect(mockPush).toHaveBeenCalledWith("/parishes/10");
  });

  it("navigates to document request when 'Request Document' is pressed", async () => {
    const { findByLabelText } = await render(
      <ParishInfoSheet parish={sampleParish} visible={true} onClose={jest.fn()} />
    );

    const requestBtn = await findByLabelText(
      "Request sacramental certificate from Our Lady of Peace Parish"
    );
    fireEvent.press(requestBtn);

    expect(mockPush).toHaveBeenCalledWith("/(app)/requests/new?parishId=10");
  });

  it("returns null when visible is false", async () => {
    const { queryByText } = await render(
      <ParishInfoSheet parish={sampleParish} visible={false} onClose={jest.fn()} />
    );

    expect(queryByText("Our Lady of Peace Parish")).toBeNull();
  });
});
