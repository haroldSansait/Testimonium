import React from "react";
import { Animated } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { ParishInfoSheet } from "@/features/parishes/components/ParishInfoSheet";
import { ParishDirectoryScreen } from "@/features/parishes/ParishDirectoryScreen";
import { ScheduleWizardScreen } from "@/features/schedule/ScheduleWizardScreen";
import type { ParishDto } from "@/features/parishes/types";
import {
  getOfficeOpenStatus,
  parseOfficeTimeString,
} from "@/features/parishes/utils";

// Mock safe area insets
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, left: 0, right: 0, bottom: 24 }),
  SafeAreaView: ({ children }: any) => children,
}));

// Mock Animated timing, spring, and parallel
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
let mockSearchParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => mockSearchParams,
}));

// Mock API hooks
const mockUseInfiniteParishes = jest.fn();
const mockUseParishDetail = jest.fn();
const mockUseParishes = jest.fn();
jest.mock("@/features/parishes/api", () => ({
  useInfiniteParishes: () => mockUseInfiniteParishes(),
  useParishDetail: (id?: string) => mockUseParishDetail(id),
  useParishes: () => mockUseParishes(),
}));

// Mock useRequireCompleteProfile
const mockRequireCompleteProfile = jest.fn((cb: () => void) => cb());
jest.mock("@/hooks/useRequireCompleteProfile", () => ({
  useRequireCompleteProfile: () => ({
    requireCompleteProfile: mockRequireCompleteProfile,
  }),
}));

// Mock Auth Provider
jest.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    profile: { needsProfileCompletion: false, isGovernmentIdVerified: true },
    user: { id: "1" },
  }),
}));

// Mock Feedback Provider
jest.mock("@/providers/FeedbackProvider", () => ({
  useFeedback: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
  }),
}));

// Mock schedule API hooks
jest.mock("@/features/schedule/api", () => ({
  useAvailabilityDates: () => ({ data: { dates: [] }, refetch: jest.fn() }),
  useAvailableSlots: () => ({ data: [], refetch: jest.fn() }),
  useEligiblePriests: () => ({ data: [] }),
  useRecommendations: () => ({ data: { recommendations: [] } }),
  useSchedulingConfiguration: () => ({
    data: { schedulingAvailable: true, services: [] },
    refetch: jest.fn(),
    isLoading: false,
  }),
  useCreateSchedule: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

// Mock ParishMapDOM component to verify controls passed from native
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

describe("Parish Directory Web Parity Redesign", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    mockUseParishDetail.mockReturnValue({
      data: null,
      isLoading: false,
    });
    mockUseParishes.mockReturnValue({
      data: {
        items: [
          { id: "10", name: "Our Lady of Peace Parish", municipalityCity: "San Carlos" },
          { id: "20", name: "St. Joseph Parish", municipalityCity: "Toboso" },
        ],
      },
      isLoading: false,
    });
  });

  describe("1. Open Now / Closed Status Logic", () => {
    it("parses valid 12-hour and 24-hour time strings correctly", () => {
      expect(parseOfficeTimeString("08:00 AM")).toEqual({ hour: 8, minute: 0 });
      expect(parseOfficeTimeString("12:00 PM")).toEqual({ hour: 12, minute: 0 });
      expect(parseOfficeTimeString("05:30 PM")).toEqual({ hour: 17, minute: 30 });
      expect(parseOfficeTimeString("12:15 AM")).toEqual({ hour: 0, minute: 15 });
      expect(parseOfficeTimeString("17:00")).toEqual({ hour: 17, minute: 0 });
      expect(parseOfficeTimeString("invalid")).toBeNull();
      expect(parseOfficeTimeString(null)).toBeNull();
    });

    it("evaluates open/closed status for configured schedule and boundaries", () => {
      const officeHours = {
        Monday: { openTime: "08:00 AM", closeTime: "05:00 PM", isClosed: false },
        Wednesday: { isClosed: true },
        Sunday: { isClosed: true },
      };

      // Monday 10:30 AM => Open
      // 2026-10-26 is a Monday
      const mondayMidday = new Date(2026, 9, 26, 10, 30);
      expect(getOfficeOpenStatus(officeHours, mondayMidday)).toEqual({
        isOpen: true,
        isUnavailable: false,
        status: "OPEN",
        label: "Open Now",
      });

      // Monday 07:59 AM => Closed (before opening)
      const mondayEarly = new Date(2026, 9, 26, 7, 59);
      expect(getOfficeOpenStatus(officeHours, mondayEarly)).toEqual({
        isOpen: false,
        isUnavailable: false,
        status: "CLOSED",
        label: "Closed",
      });

      // Monday 05:00 PM => Open (boundary inclusive)
      const mondayExactClose = new Date(2026, 9, 26, 17, 0);
      expect(getOfficeOpenStatus(officeHours, mondayExactClose)).toEqual({
        isOpen: true,
        isUnavailable: false,
        status: "OPEN",
        label: "Open Now",
      });

      // Monday 05:01 PM => Closed (after closing)
      const mondayLate = new Date(2026, 9, 26, 17, 1);
      expect(getOfficeOpenStatus(officeHours, mondayLate)).toEqual({
        isOpen: false,
        isUnavailable: false,
        status: "CLOSED",
        label: "Closed",
      });

      // Wednesday 11:00 AM (configured closed day) => Closed
      // 2026-10-28 is a Wednesday
      const wednesday = new Date(2026, 9, 28, 11, 0);
      expect(getOfficeOpenStatus(officeHours, wednesday)).toEqual({
        isOpen: false,
        isUnavailable: false,
        status: "CLOSED",
        label: "Closed",
      });

      // Tuesday (unlisted day in configured schedule) => Closed
      // 2026-10-27 is a Tuesday
      const tuesday = new Date(2026, 9, 27, 11, 0);
      expect(getOfficeOpenStatus(officeHours, tuesday)).toEqual({
        isOpen: false,
        isUnavailable: false,
        status: "CLOSED",
        label: "Closed",
      });
    });

    it("returns UNAVAILABLE when office hours information is insufficient", () => {
      expect(getOfficeOpenStatus(null)).toEqual({
        isOpen: false,
        isUnavailable: true,
        status: "UNAVAILABLE",
        label: "Hours Unavailable",
      });

      expect(getOfficeOpenStatus({})).toEqual({
        isOpen: false,
        isUnavailable: true,
        status: "UNAVAILABLE",
        label: "Hours Unavailable",
      });
    });
  });

  describe("2. Absence of Generic Badge & Retention of Meaningful Indicators", () => {
    const parishWithType: ParishDto = {
      id: "10",
      name: "St. John Parish",
      type: "Quasi-Parish",
      isMotherParish: true,
      feastDay: "December 27",
    };

    it("does not render generic Parish/Quasi-Parish badge but renders Mother Parish and Feast Day", async () => {
      const { queryByText, findByText } = await render(
        <ParishInfoSheet parish={parishWithType} visible={true} onClose={jest.fn()} />
      );

      // Generic type should NOT be rendered as a badge
      expect(queryByText("Quasi-Parish")).toBeNull();
      expect(queryByText("Mission Station")).toBeNull();

      // Mother Parish & Feast Day are preserved
      expect(await findByText("Mother Parish")).toBeTruthy();
      expect(await findByText("Feast: December 27")).toBeTruthy();
    });
  });

  describe("3. Contact Information Card & Removal of Oversized Action Buttons", () => {
    const fullContactParish: ParishDto = {
      id: "10",
      name: "Our Lady of Peace Parish",
      type: "Parish",
      address: "123 Catholic Ave, Poblacion",
      municipalityCity: "San Carlos City",
      province: "Negros Occidental",
      contactNumber: "0917-111-2233",
      email: "peace.parish@testimonium.ph",
      facebookPage: "https://facebook.com/peaceparish",
      venueCapacity: 1250,
      directoryDescription: "A peaceful sanctuary.",
    };

    it("renders actual contact details, facebook page, and seating capacity", async () => {
      const { findByText } = await render(
        <ParishInfoSheet parish={fullContactParish} visible={true} onClose={jest.fn()} />
      );

      expect(await findByText("123 Catholic Ave, Poblacion")).toBeTruthy();
      expect(await findByText("San Carlos City, Negros Occidental")).toBeTruthy();
      expect(await findByText("0917-111-2233")).toBeTruthy();
      expect(await findByText("peace.parish@testimonium.ph")).toBeTruthy();
      expect(await findByText("Official Facebook Page")).toBeTruthy();
      expect(await findByText("~1,250 attendees")).toBeTruthy();
    });
  });

  describe("4. Offered Certificates Presentation", () => {
    it("renders configured certificates as tags", async () => {
      const parishWithDocs: ParishDto = {
        id: "10",
        name: "San Carlos Cathedral",
        type: "Parish",
        availableDocuments: ["BAPTISMAL_CERTIFICATE", "MARRIAGE_CERTIFICATE"],
      };

      const { findByText, queryByText } = await render(
        <ParishInfoSheet parish={parishWithDocs} visible={true} onClose={jest.fn()} />
      );

      expect(await findByText("Offered Certificates")).toBeTruthy();
      expect(await findByText("Baptismal Certificate")).toBeTruthy();
      expect(await findByText("Marriage Certificate")).toBeTruthy();
      expect(queryByText("Confirmation Certificate")).toBeNull();
    });

    it("renders all 7 canonical documents when availableDocuments is null or undefined", async () => {
      const defaultDocsParish: ParishDto = {
        id: "10",
        name: "San Carlos Cathedral",
        type: "Parish",
        availableDocuments: null as any,
      };

      const { findByText } = await render(
        <ParishInfoSheet parish={defaultDocsParish} visible={true} onClose={jest.fn()} />
      );

      expect(await findByText("Offered Certificates")).toBeTruthy();
      expect(await findByText("Baptismal Certificate")).toBeTruthy();
      expect(await findByText("Confirmation Certificate")).toBeTruthy();
      expect(await findByText("Marriage Certificate")).toBeTruthy();
      expect(await findByText("First Communion Certificate")).toBeTruthy();
      expect(await findByText("Marriage Banns")).toBeTruthy();
      expect(await findByText("Permit to Marry")).toBeTruthy();
      expect(await findByText("Status of Liberty")).toBeTruthy();
    });

    it("omits the Offered Certificates section when availableDocuments is empty array", async () => {
      const noDocsParish: ParishDto = {
        id: "10",
        name: "Mission Chapel",
        type: "Parish",
        availableDocuments: [],
      };

      const { queryByText } = await render(
        <ParishInfoSheet parish={noDocsParish} visible={true} onClose={jest.fn()} />
      );

      expect(queryByText("Offered Certificates")).toBeNull();
    });
  });

  describe("5. Parish Administration", () => {
    const adminParish: ParishDto = {
      id: "10",
      name: "St. Jude Parish",
      type: "Parish",
      priest: "Rev. Fr. Juan Dela Cruz",
      assistantPriests: [
        { id: "101", name: "Rev. Fr. Pedro Santos" },
        { id: "102", name: "Rev. Fr. Mateo Reyes" },
      ],
      secretary: "Maria Clara",
    };

    it("renders priest, assistant priests, and secretary", async () => {
      const { findByText } = await render(
        <ParishInfoSheet parish={adminParish} visible={true} onClose={jest.fn()} />
      );

      expect(await findByText("Parish Administration")).toBeTruthy();
      expect(await findByText("Parish Priest: Rev. Fr. Juan Dela Cruz")).toBeTruthy();
      expect(await findByText("Parochial Vicar: Rev. Fr. Pedro Santos")).toBeTruthy();
      expect(await findByText("Parochial Vicar: Rev. Fr. Mateo Reyes")).toBeTruthy();
      expect(await findByText("Secretary: Maria Clara")).toBeTruthy();
    });

    it("falls back to Unassigned when staff names are missing", async () => {
      const unassignedParish: ParishDto = {
        id: "10",
        name: "St. Jude Parish",
        type: "Parish",
      };

      const { findByText } = await render(
        <ParishInfoSheet parish={unassignedParish} visible={true} onClose={jest.fn()} />
      );

      expect(await findByText("Parish Priest: Unassigned")).toBeTruthy();
      expect(await findByText("Secretary: Unassigned")).toBeTruthy();
    });
  });

  describe("6. Parish Pastoral & Finance Councils", () => {
    it("renders populated pastoral council and enabled finance council", async () => {
      const councilParish: ParishDto = {
        id: "10",
        name: "St. Francis Parish",
        type: "Parish",
        councils: {
          pastoral: {
            members: [
              { positionTitle: "President", memberName: "Carlos Miguel", photoUrl: null },
              { positionTitle: "Secretary", memberName: "Ana Marie", photoUrl: "http://example.com/ana.jpg" },
            ],
          },
          finance: {
            members: [
              { positionTitle: "Treasurer", memberName: "Roberto Gomez", photoUrl: null },
            ],
          },
        },
      };

      mockUseParishDetail.mockReturnValue({
        data: councilParish,
        isLoading: false,
      });

      const { findByText } = await render(
        <ParishInfoSheet parish={councilParish} visible={true} onClose={jest.fn()} />
      );

      expect(await findByText("Parish Pastoral Council")).toBeTruthy();
      expect(await findByText("2 Officers")).toBeTruthy();
      expect(await findByText("Carlos Miguel")).toBeTruthy();
      expect(await findByText("Ana Marie")).toBeTruthy();

      expect(await findByText("Parish Finance Council")).toBeTruthy();
      expect(await findByText("1 Officer")).toBeTruthy();
      expect(await findByText("Roberto Gomez")).toBeTruthy();
    });

    it("omits Finance Council when finance is null (disabled)", async () => {
      const pastoralOnlyParish: ParishDto = {
        id: "10",
        name: "St. Francis Parish",
        type: "Parish",
        councils: {
          pastoral: {
            members: [
              { positionTitle: "President", memberName: "Carlos Miguel" },
            ],
          },
          finance: null,
        },
      };

      mockUseParishDetail.mockReturnValue({
        data: pastoralOnlyParish,
        isLoading: false,
      });

      const { findByText, queryByText } = await render(
        <ParishInfoSheet parish={pastoralOnlyParish} visible={true} onClose={jest.fn()} />
      );

      expect(await findByText("Parish Pastoral Council")).toBeTruthy();
      expect(queryByText("Parish Finance Council")).toBeNull();
    });

    it("renders empty state messages for configured but empty rosters", async () => {
      const emptyCouncilsParish: ParishDto = {
        id: "10",
        name: "St. Francis Parish",
        type: "Parish",
        councils: {
          pastoral: { members: [] },
          finance: { members: [] },
        },
      };

      mockUseParishDetail.mockReturnValue({
        data: emptyCouncilsParish,
        isLoading: false,
      });

      const { findByText } = await render(
        <ParishInfoSheet parish={emptyCouncilsParish} visible={true} onClose={jest.fn()} />
      );

      expect(
        await findByText("Parish Pastoral Council information has not yet been added.")
      ).toBeTruthy();
      expect(
        await findByText("Parish Finance Council information has not yet been added.")
      ).toBeTruthy();
    });

    it("renders unavailable notice when council configuration is null", async () => {
      const noConfigParish: ParishDto = {
        id: "10",
        name: "St. Francis Parish",
        type: "Parish",
        councils: null,
      };

      mockUseParishDetail.mockReturnValue({
        data: noConfigParish,
        isLoading: false,
      });

      const { findByText } = await render(
        <ParishInfoSheet parish={noConfigParish} visible={true} onClose={jest.fn()} />
      );

      expect(await findByText("Council information is currently unavailable.")).toBeTruthy();
    });
  });

  describe("7. Compact Web-Style Sticky Footer & Navigation", () => {
    const sampleParish: ParishDto = {
      id: "10",
      name: "Our Lady of Peace Parish",
      type: "Parish",
      availableDocuments: ["BAPTISMAL_CERTIFICATE"],
    };

    it("navigates to schedule route with parishId preselection when Schedule Rite is tapped", async () => {
      const { findByLabelText } = await render(
        <ParishInfoSheet parish={sampleParish} visible={true} onClose={jest.fn()} />
      );

      const scheduleBtn = await findByLabelText("Schedule rite at Our Lady of Peace Parish");
      fireEvent.press(scheduleBtn);

      expect(mockRequireCompleteProfile).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/(app)/schedule/new?parishId=10");
    });
  });

  describe("8. Schedule Wizard Route Parish Preselection", () => {
    it("preselects parish from route query parameter in ScheduleWizardScreen", async () => {
      mockSearchParams = { parishId: "10" };

      const { findByText } = await render(<ScheduleWizardScreen />);

      // Step 1 title
      expect(await findByText("Choose Target Parish")).toBeTruthy();
      expect(await findByText("Our Lady of Peace Parish")).toBeTruthy();
    });
  });

  describe("9. Duplicate Reset Button Removal", () => {
    it("has exactly one reset-view control in the directory (the native header button)", async () => {
      mockUseInfiniteParishes.mockReturnValue({
        data: {
          pages: [
            {
              items: [
                {
                  id: "1",
                  name: "San Carlos Cathedral",
                  latitude: 10.48,
                  longitude: 123.41,
                },
              ],
              total: 1,
            },
          ],
        },
        isLoading: false,
        isFetching: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: jest.fn(),
        isError: false,
        refetch: jest.fn(),
      });

      const { getAllByLabelText } = await render(<ParishDirectoryScreen />);

      // Exactly one "Reset map overview" control in the whole screen
      const resetButtons = getAllByLabelText("Reset map overview");
      expect(resetButtons).toHaveLength(1);
    });
  });
});
