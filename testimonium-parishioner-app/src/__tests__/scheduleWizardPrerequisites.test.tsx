import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react-native";
import * as DocumentPicker from "expo-document-picker";
import { getInfoAsync } from "expo-file-system/legacy";
import { ScheduleWizardScreen } from "../features/schedule/ScheduleWizardScreen";
import type { ScheduleEventType, SchedulingConfiguration } from "../features/schedule/types";
import { AppError } from "@/services/api/errors";

// Mock SelectionRow for reliable test press handling
jest.mock("@/components/ui/SelectionRow", () => ({
  SelectionRow: ({ title, onSelect, accessibilityLabel, selected }: any) => {
    const { TouchableOpacity, Text } = jest.requireActual("react-native");
    return (
      <TouchableOpacity
        onPress={() => onSelect?.()}
        accessibilityRole="radio"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ selected }}
      >
        <Text>{title}</Text>
      </TouchableOpacity>
    );
  },
}));

// Mock safe area insets and layout metrics
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, left: 0, right: 0, bottom: 24 }),
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock("@/components/layout/useAppLayoutMetrics", () => ({
  useAppLayoutMetrics: () => ({
    contentBottomInset: () => 80,
    onBottomActionLayout: jest.fn(),
  }),
}));

// Mock router
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockSearchParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => mockSearchParams,
}));

// Mock Auth Provider
jest.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    profile: {
      needsProfileCompletion: false,
      isGovernmentIdVerified: true,
    },
    user: { uid: "user-123" },
  }),
}));

// Mock Feedback Provider
const mockShowSuccess = jest.fn();
const mockShowWarning = jest.fn();
const mockShowError = jest.fn();

jest.mock("@/providers/FeedbackProvider", () => ({
  useFeedback: () => ({
    showSuccess: mockShowSuccess,
    showWarning: mockShowWarning,
    showError: mockShowError,
  }),
}));

// Mock Parishes API
const mockParishes = [
  { id: 1, name: "St. Jude Parish", municipalityCity: "Manila" },
  { id: 2, name: "San Agustin Church", municipalityCity: "Intramuros" },
];

jest.mock("@/features/parishes/api", () => ({
  useParishes: () => ({
    data: { items: mockParishes },
    isLoading: false,
  }),
}));

// Mock schedule API hooks
const initialConfigData: SchedulingConfiguration = {
  parishId: 1,
  schedulingAvailable: true,
  configurationUnavailable: false,
  services: [
    {
      eventType: "CONFESSION",
      label: "Confession",
      requirements: [],
    },
    {
      eventType: "WEDDING",
      label: "Marriage (Canonical Interview)",
      requirements: [
        { id: "cenomar", label: "CENOMAR" },
        { id: "marriage_license", label: "Marriage License" },
      ],
    },
  ],
  timeSlots: ["09:00 AM", "10:00 AM", "02:00 PM"],
  capacity: null,
  venueCapacity: 150,
  horizonDays: 60,
  configurationUpdatedAt: "2026-10-26T00:00:00.000Z",
};

let mockConfigData: SchedulingConfiguration = JSON.parse(JSON.stringify(initialConfigData));

const mockRefetchConfiguration = jest.fn().mockImplementation(async () => ({ data: mockConfigData }));
const mockMutateAsync = jest.fn().mockImplementation(async () => ({ id: 999 }));
let mockIsPending = false;

jest.mock("@/features/schedule/api", () => ({
  useSchedulingConfiguration: () => ({
    data: mockConfigData,
    refetch: mockRefetchConfiguration,
    isLoading: false,
  }),
  useAvailabilityDates: () => ({
    data: { serviceAvailable: true, dates: ["2026-10-30"] },
    refetch: jest.fn(),
    isLoading: false,
  }),
  useAvailableSlots: () => ({
    data: ["09:00 AM", "10:00 AM"],
    refetch: jest.fn(),
    isLoading: false,
  }),
  useEligiblePriests: () => ({
    data: [{ id: 1, name: "Fr. John", isAssistant: false }],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useRecommendations: () => ({
    data: { recommendations: [] },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useCreateSchedule: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
  }),
}));

// Mock DocumentPicker
jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));
jest.mock("expo-file-system/legacy", () => ({ getInfoAsync: jest.fn() }));

const navigateToConfirmation = async (withRequirements: boolean) => {
  await render(<ScheduleWizardScreen initialParishId="1" />);
  await fireEvent.press(screen.getByLabelText("Continue to Service"));
  await fireEvent.press(screen.getByLabelText(withRequirements ? "Marriage (Canonical Interview)" : "Confession"));
  await fireEvent.press(screen.getByLabelText("Continue to Date"));
  await fireEvent.press(screen.getByLabelText("2026-10-30, available"));
  await fireEvent.press(screen.getByLabelText("Continue to Time Slot"));
  await fireEvent.press(screen.getByLabelText("09:00 AM"));
  if (withRequirements) {
    await fireEvent.press(screen.getByLabelText("Continue to Upload Requirements"));
    for (const name of ["c.pdf", "l.pdf"]) {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{ name, uri: `file:///${name}`, size: 100_000, mimeType: "application/pdf" }],
      });
      await fireEvent.press(screen.getAllByText("Choose Document")[0]);
      await waitFor(() => expect(screen.getByText(name)).toBeTruthy());
    }
  }
  await fireEvent.press(screen.getByLabelText("Continue to Confirmation"));
};

describe("ScheduleWizardScreen: Conditional Steps & Prerequisite Workflow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    mockIsPending = false;
    mockConfigData = JSON.parse(JSON.stringify(initialConfigData));
    mockMutateAsync.mockReset().mockResolvedValue({ id: 999 });
    (getInfoAsync as jest.Mock).mockReset().mockResolvedValue({
      exists: true, isDirectory: false, size: 100_000, md5: "a".repeat(32),
    });
  });

  it("reuses keys after ambiguous failures, identical reselection, and editing then reverting content", async () => {
    await navigateToConfirmation(true);
    mockMutateAsync.mockRejectedValue(new AppError({ kind: "TIMEOUT", message: "Upload timed out" }));
    const submit = async (expectedCalls: number) => {
      await fireEvent.press(screen.getByLabelText("Submit Schedule Request"));
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(expectedCalls));
      await waitFor(() => expect(screen.getByLabelText("Submit Schedule Request").props.accessibilityState.busy).toBe(false));
      return mockMutateAsync.mock.calls[expectedCalls - 1][0].idempotencyKey;
    };
    const originalKey = await submit(1);
    await fireEvent.press(screen.getByLabelText("Go back"));
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ name: "same-content.pdf", uri: "file:///new-cache-path.pdf", size: 100_000, mimeType: "application/pdf" }],
    });
    await fireEvent.press(screen.getByLabelText("Replace CENOMAR document"));
    await waitFor(() => expect(screen.getByText("same-content.pdf")).toBeTruthy());
    await fireEvent.press(screen.getByLabelText("Continue to Confirmation"));
    expect(await submit(2)).toBe(originalKey);
    // Same URI, filename and reported size, but a different native content checksum.
    (getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, isDirectory: false, size: 100_000, md5: "b".repeat(32) });
    expect(await submit(3)).not.toBe(originalKey);
    (getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, isDirectory: false, size: 100_000, md5: "a".repeat(32) });
    expect(await submit(4)).toBe(originalKey);
  }, 15_000);

  it("keeps no-prerequisite booking keys after network failure and notes/priest edit then revert", async () => {
    await navigateToConfirmation(false);
    mockMutateAsync.mockRejectedValue(new AppError({ kind: "NETWORK", message: "Connection failed" }));
    const submit = async (expectedCalls: number) => {
      await fireEvent.press(screen.getByLabelText("Submit Schedule Request"));
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(expectedCalls));
      await waitFor(() => expect(screen.getByLabelText("Submit Schedule Request").props.accessibilityState.busy).toBe(false));
      return mockMutateAsync.mock.calls[expectedCalls - 1][0].idempotencyKey;
    };
    const originalKey = await submit(1);
    expect(await submit(2)).toBe(originalKey);
    const notes = screen.getByPlaceholderText("Add relevant details or special assistance needs");
    await fireEvent.changeText(notes, "Please assist");
    expect(await submit(3)).not.toBe(originalKey);
    await fireEvent.changeText(notes, "");
    expect(await submit(4)).toBe(originalKey);
    await fireEvent.press(screen.getByLabelText("Go back"));
    await fireEvent.press(screen.getByLabelText("Fr. John"));
    await fireEvent.press(screen.getByLabelText("Continue to Confirmation"));
    expect(await submit(5)).not.toBe(originalKey);
    expect(mockMutateAsync.mock.calls[4][0].payload.requestedPriestId).toBe(1);
  });

  it("returns confirmation to uploads when refreshed configuration adds a required file", async () => {
    await navigateToConfirmation(true);
    mockConfigData = {
      ...mockConfigData,
      services: mockConfigData.services.map((service) => service.eventType === "WEDDING" ? {
        ...service,
        requirements: [...service.requirements!, { id: "baptismal_cert", label: "Baptismal Certificate" }],
      } : service),
    };
    await screen.rerender(<ScheduleWizardScreen initialParishId="1" />);
    expect(screen.getByText("Step 5 of 6")).toBeTruthy();
    expect(screen.getByText("Baptismal Certificate")).toBeTruthy();
    expect(screen.getByText("c.pdf")).toBeTruthy();
    expect(screen.getByText("l.pdf")).toBeTruthy();
    expect(screen.getByLabelText("Continue to Confirmation").props.accessibilityState.disabled).toBe(true);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("returns to five-step confirmation and prunes files when refreshed requirements are removed", async () => {
    await navigateToConfirmation(true);
    mockConfigData = {
      ...mockConfigData,
      services: mockConfigData.services.map((service) => ({ ...service, requirements: [] })),
    };
    await screen.rerender(<ScheduleWizardScreen initialParishId="1" />);
    expect(screen.getByText("Step 5 of 5")).toBeTruthy();
    expect(screen.queryByText("Uploaded Prerequisite Documents")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Submit Schedule Request"));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync.mock.calls[0][0].files).toBeUndefined();
  });

  it("returns unreadable native documents to the upload step without creating a booking", async () => {
    await navigateToConfirmation(true);
    (getInfoAsync as jest.Mock).mockRejectedValueOnce(new Error("Cache file missing"));
    await fireEvent.press(screen.getByLabelText("Submit Schedule Request"));
    await waitFor(() => expect(screen.getByText("Step 5 of 6")).toBeTruthy());
    expect(screen.getByText(/no longer readable/)).toBeTruthy();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("locks navigation and double taps while native fingerprinting is pending", async () => {
    await navigateToConfirmation(true);
    let resolveInfo: (value: unknown) => void = () => {};
    (getInfoAsync as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { resolveInfo = resolve; }));
    await fireEvent.press(screen.getByLabelText("Submit Schedule Request"));
    await fireEvent.press(screen.getByLabelText("Go back"));
    await fireEvent.press(screen.getByLabelText("Submit Schedule Request"));
    expect(screen.getByText("Step 6 of 6")).toBeTruthy();
    expect(mockMutateAsync).not.toHaveBeenCalled();
    await act(async () => resolveInfo({ exists: true, isDirectory: false, size: 100_000, md5: "a".repeat(32) }));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
  });

  it.each<ScheduleEventType>(["WEDDING", "MARRIAGE_SPECIAL", "BAPTISM", "CONFIRMATION", "WAKE_MASS", "FUNERAL"])(
    "renders only parish-configured requirements for %s",
    async (eventType) => {
      mockConfigData = {
        ...mockConfigData,
        services: [{ eventType, label: "Configured Service", requirements: [{ id: "enabled", label: "Enabled Document" }] }],
      };
      await render(<ScheduleWizardScreen initialParishId="1" />);
      await fireEvent.press(screen.getByLabelText("Continue to Service"));
      await fireEvent.press(screen.getByLabelText("Configured Service"));
      await fireEvent.press(screen.getByLabelText("Continue to Date"));
      await fireEvent.press(screen.getByLabelText("2026-10-30, available"));
      await fireEvent.press(screen.getByLabelText("Continue to Time Slot"));
      await fireEvent.press(screen.getByLabelText("09:00 AM"));
      await fireEvent.press(screen.getByLabelText("Continue to Upload Requirements"));
      expect(screen.getByText("Step 5 of 6")).toBeTruthy();
      expect(screen.getByText("Enabled Document")).toBeTruthy();
      expect(screen.getAllByText("Choose Document")).toHaveLength(1);
      expect(screen.queryByText("CENOMAR")).toBeNull();
    }
  );

  it("clears selected documents when switching parishes even if requirement IDs overlap", async () => {
    await navigateToConfirmation(true);
    for (let step = 6; step > 1; step--) await fireEvent.press(screen.getByLabelText("Go back"));
    await fireEvent.press(screen.getByLabelText("San Agustin Church"));
    mockConfigData = { ...mockConfigData, parishId: 2 };
    await fireEvent.press(screen.getByLabelText("Continue to Service"));
    await fireEvent.press(screen.getByLabelText("Marriage (Canonical Interview)"));
    await fireEvent.press(screen.getByLabelText("Continue to Date"));
    await fireEvent.press(screen.getByLabelText("2026-10-30, available"));
    await fireEvent.press(screen.getByLabelText("Continue to Time Slot"));
    await fireEvent.press(screen.getByLabelText("09:00 AM"));
    await fireEvent.press(screen.getByLabelText("Continue to Upload Requirements"));
    expect(screen.getAllByText("Choose Document")).toHaveLength(2);
    expect(screen.queryByText("c.pdf")).toBeNull();
    expect(screen.queryByText("l.pdf")).toBeNull();
  }, 15_000);

  it("1. Retains standard 5-step flow for services without prerequisites", async () => {
    await render(<ScheduleWizardScreen initialParishId="1" />);

    // Step 1: Select Parish (starts with Parish 1 selected)
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();

    // Verify parish selection can be switched
    await fireEvent.press(screen.getByLabelText("San Agustin Church"));
    await fireEvent.press(screen.getByLabelText("St. Jude Parish"));

    // Continue to Service
    await fireEvent.press(screen.getByLabelText("Continue to Service"));

    // Step 2: Choose Service (Confession has no prerequisites)
    expect(screen.getByText("Step 2 of 5")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Confession"));

    // Continue to Date
    await fireEvent.press(screen.getByLabelText("Continue to Date"));

    // Step 3: Select Date
    expect(screen.getByText("Step 3 of 5")).toBeTruthy();
    // Select date 2026-10-30
    const dateCell = screen.getByLabelText("2026-10-30, available");
    await fireEvent.press(dateCell);

    // Continue to Time Slot
    await fireEvent.press(screen.getByLabelText("Continue to Time Slot"));

    // Step 4: Choose Time Slot
    expect(screen.getByText("Step 4 of 5")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("09:00 AM"));

    // Since CONFESSION has no requirements, button must say "Continue to Confirmation"
    expect(screen.getByText("Continue to Confirmation")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Continue to Confirmation"));

    // Step 5: Confirmation (Total steps: 5)
    expect(screen.getByText("Step 5 of 5")).toBeTruthy();
    expect(screen.getByText("Confirm Your Appointment Request")).toBeTruthy();
    expect(screen.getByText("Submit Schedule Request")).toBeTruthy();
    // Prerequisite section should NOT be present
    expect(screen.queryByText("Uploaded Prerequisite Documents")).toBeNull();
  });

  it("2. Conditionally adds Upload Requirements step (6-step flow) for prerequisite services", async () => {
    await render(<ScheduleWizardScreen initialParishId="1" />);

    // Step 1: Parish -> Continue to Service
    await fireEvent.press(screen.getByLabelText("Continue to Service"));

    // Step 2: Choose Wedding (has 2 prerequisites)
    await fireEvent.press(screen.getByLabelText("Marriage (Canonical Interview)"));

    // Once a service with prerequisites is selected, total steps is 6!
    expect(screen.getByText("Step 2 of 6")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Continue to Date"));

    // Step 3: Date
    expect(screen.getByText("Step 3 of 6")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("2026-10-30, available"));
    await fireEvent.press(screen.getByLabelText("Continue to Time Slot"));

    // Step 4: Time Slot
    expect(screen.getByText("Step 4 of 6")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("09:00 AM"));

    // Button should now say "Continue to Upload Requirements"
    expect(screen.getByText("Continue to Upload Requirements")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Continue to Upload Requirements"));

    // Step 5: Upload Requirements
    expect(screen.getByText("Step 5 of 6")).toBeTruthy();
    expect(screen.getByText("Upload Requirements")).toBeTruthy();
    expect(screen.getByText("CENOMAR")).toBeTruthy();
    expect(screen.getByText("Marriage License")).toBeTruthy();

    // The "Continue to Confirmation" button should be disabled because files are missing
    const continueButton = screen.getByLabelText("Continue to Confirmation");
    expect(continueButton).toBeTruthy();

    // Mock picking CENOMAR
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          name: "cenomar_cert.pdf",
          uri: "file:///cache/cenomar_cert.pdf",
          size: 200_000,
          mimeType: "application/pdf",
        },
      ],
    });

    // Tap Choose Document for CENOMAR
    const pickButtons = screen.getAllByText("Choose Document");
    await fireEvent.press(pickButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("cenomar_cert.pdf")).toBeTruthy();
    });

    // Marriage License still missing; button should still be disabled or blocked
    await fireEvent.press(screen.getByLabelText("Continue to Confirmation"));
    // Still on Step 5 of 6
    expect(screen.getByText("Step 5 of 6")).toBeTruthy();

    // Mock picking Marriage License
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          name: "marriage_license.jpg",
          uri: "file:///cache/marriage_license.jpg",
          size: 350_000,
          mimeType: "image/jpeg",
        },
      ],
    });

    // Pick remaining document
    const pickLicenseButton = screen.getByText("Choose Document");
    await fireEvent.press(pickLicenseButton);

    await waitFor(() => {
      expect(screen.getByText("marriage_license.jpg")).toBeTruthy();
    });

    // Both files now uploaded! Continue to Confirmation
    await fireEvent.press(screen.getByLabelText("Continue to Confirmation"));

    // Step 6: Confirmation
    await waitFor(() => {
      expect(screen.getByText("Step 6 of 6")).toBeTruthy();
      expect(screen.getByText("Confirm Your Appointment Request")).toBeTruthy();
      expect(screen.getByText("Uploaded Prerequisite Documents")).toBeTruthy();
      expect(screen.getByText(/cenomar_cert\.pdf/)).toBeTruthy();
      expect(screen.getByText(/marriage_license\.jpg/)).toBeTruthy();
    });

    // Submit schedule request
    await fireEvent.press(screen.getByLabelText("Submit Schedule Request"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
      const call = mockMutateAsync.mock.calls[0][0];
      expect(call.payload.eventType).toBe("WEDDING");
      expect(call.requirements).toHaveLength(2);
      expect(call.files.cenomar.name).toBe("cenomar_cert.pdf");
      expect(call.files.marriage_license.name).toBe("marriage_license.jpg");
      expect(call.idempotencyKey).toMatch(/^mobile-sched-/);
    });
  });

  it("3. File removal and replacement in Upload Requirements step", async () => {
    await render(<ScheduleWizardScreen initialParishId="1" />);

    // Navigate directly to step 4 with Wedding
    await fireEvent.press(screen.getByLabelText("Continue to Service"));
    await fireEvent.press(screen.getByLabelText("Marriage (Canonical Interview)"));
    await fireEvent.press(screen.getByLabelText("Continue to Date"));
    await fireEvent.press(screen.getByLabelText("2026-10-30, available"));
    await fireEvent.press(screen.getByLabelText("Continue to Time Slot"));
    await fireEvent.press(screen.getByLabelText("09:00 AM"));
    await fireEvent.press(screen.getByLabelText("Continue to Upload Requirements"));

    // Pick CENOMAR
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          name: "initial_cenomar.pdf",
          uri: "file:///cache/initial_cenomar.pdf",
          size: 200_000,
          mimeType: "application/pdf",
        },
      ],
    });
    await fireEvent.press(screen.getAllByText("Choose Document")[0]);

    await waitFor(() => {
      expect(screen.getByText("initial_cenomar.pdf")).toBeTruthy();
    });

    // Replace action: pick new file
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          name: "replaced_cenomar.pdf",
          uri: "file:///cache/replaced_cenomar.pdf",
          size: 220_000,
          mimeType: "application/pdf",
        },
      ],
    });

    const replaceButton = screen.getByLabelText("Replace CENOMAR document");
    await fireEvent.press(replaceButton);

    await waitFor(() => {
      expect(screen.getByText("replaced_cenomar.pdf")).toBeTruthy();
      expect(screen.queryByText("initial_cenomar.pdf")).toBeNull();
    });

    // Remove action
    const removeButton = screen.getByLabelText("Remove replaced_cenomar.pdf for CENOMAR");
    await fireEvent.press(removeButton);

    await waitFor(() => {
      expect(screen.queryByText("replaced_cenomar.pdf")).toBeNull();
    });
  });

  it("4. Changing parish or service removes stale attachments", async () => {
    await render(<ScheduleWizardScreen initialParishId="1" />);

    // Step 1 & 2: select Wedding
    await fireEvent.press(screen.getByLabelText("Continue to Service"));
    await fireEvent.press(screen.getByLabelText("Marriage (Canonical Interview)"));
    await fireEvent.press(screen.getByLabelText("Continue to Date"));
    await fireEvent.press(screen.getByLabelText("2026-10-30, available"));
    await fireEvent.press(screen.getByLabelText("Continue to Time Slot"));
    await fireEvent.press(screen.getByLabelText("09:00 AM"));
    await fireEvent.press(screen.getByLabelText("Continue to Upload Requirements"));

    // Pick CENOMAR
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          name: "stale_cenomar.pdf",
          uri: "file:///cache/stale_cenomar.pdf",
          size: 150_000,
          mimeType: "application/pdf",
        },
      ],
    });
    await fireEvent.press(screen.getAllByText("Choose Document")[0]);

    await waitFor(() => {
      expect(screen.getByText("stale_cenomar.pdf")).toBeTruthy();
    });

    // Navigate back to Step 2 (Choose Service)
    await fireEvent.press(screen.getByLabelText("Go back")); // back to step 4
    await fireEvent.press(screen.getByLabelText("Go back")); // back to step 3
    await fireEvent.press(screen.getByLabelText("Go back")); // back to step 2

    // Switch service to Confession (no prerequisites)
    await fireEvent.press(screen.getByLabelText("Confession"));

    // Flow is now 5 steps
    expect(screen.getByText("Step 2 of 5")).toBeTruthy();

    // Re-select Wedding
    await fireEvent.press(screen.getByLabelText("Marriage (Canonical Interview)"));
    expect(screen.getByText("Step 2 of 6")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Continue to Date"));
    await fireEvent.press(screen.getByLabelText("2026-10-30, available"));
    await fireEvent.press(screen.getByLabelText("Continue to Time Slot"));
    await fireEvent.press(screen.getByLabelText("09:00 AM"));
    await fireEvent.press(screen.getByLabelText("Continue to Upload Requirements"));

    // Verified: stale file was cleared!
    expect(screen.queryByText("stale_cenomar.pdf")).toBeNull();
  });

  it("5. Handles SCHEDULE_REQUIREMENTS_CHANGED by refreshing config, pruning stale files, and returning to upload step", async () => {
    await render(<ScheduleWizardScreen initialParishId="1" />);

    // Navigate to step 5 and upload both documents
    await fireEvent.press(screen.getByLabelText("Continue to Service"));
    await fireEvent.press(screen.getByLabelText("Marriage (Canonical Interview)"));
    await fireEvent.press(screen.getByLabelText("Continue to Date"));
    await fireEvent.press(screen.getByLabelText("2026-10-30, available"));
    await fireEvent.press(screen.getByLabelText("Continue to Time Slot"));
    await fireEvent.press(screen.getByLabelText("09:00 AM"));
    await fireEvent.press(screen.getByLabelText("Continue to Upload Requirements"));

    (DocumentPicker.getDocumentAsync as jest.Mock)
      .mockResolvedValueOnce({
        canceled: false,
        assets: [{ name: "c.pdf", uri: "file:///c.pdf", size: 100_000, mimeType: "application/pdf" }],
      })
      .mockResolvedValueOnce({
        canceled: false,
        assets: [{ name: "l.jpg", uri: "file:///l.jpg", size: 100_000, mimeType: "image/jpeg" }],
      });

    await fireEvent.press(screen.getAllByText("Choose Document")[0]);
    await waitFor(() => expect(screen.getByText("c.pdf")).toBeTruthy());
    await fireEvent.press(screen.getByText("Choose Document"));
    await waitFor(() => expect(screen.getByText("l.jpg")).toBeTruthy());

    await fireEvent.press(screen.getByLabelText("Continue to Confirmation"));
    await waitFor(() => expect(screen.getByText("Step 6 of 6")).toBeTruthy());

    // Mock backend returning SCHEDULE_REQUIREMENTS_CHANGED error
    const reqChangeError = new AppError({
      kind: "CONFLICT",
      code: "SCHEDULE_REQUIREMENTS_CHANGED",
      message: "The parish updated its document requirements. Please review the updated requirements.",
    });
    mockMutateAsync.mockRejectedValueOnce(reqChangeError);

    // Mock parish updating its config to also require baptismal_cert
    mockConfigData = {
      ...mockConfigData,
      services: [
        {
          eventType: "WEDDING",
          label: "Marriage (Canonical Interview)",
          requirements: [
            { id: "cenomar", label: "CENOMAR" },
            { id: "baptismal_cert", label: "Baptismal Certificate" }, // marriage_license removed, baptismal_cert added
          ],
        },
      ],
    };

    await fireEvent.press(screen.getByLabelText("Submit Schedule Request"));

    await waitFor(() => {
      expect(mockShowWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Requirements Updated",
        })
      );
      // Config refetched
      expect(mockRefetchConfiguration).toHaveBeenCalled();
      // Returned to Upload Requirements step (Step 5 of 6)
      expect(screen.getByText("Step 5 of 6")).toBeTruthy();
      // cenomar preserved, baptismal_cert now displayed
      expect(screen.getByText("c.pdf")).toBeTruthy();
      expect(screen.getByText("Baptismal Certificate")).toBeTruthy();
      // Old marriage_license is no longer shown
      expect(screen.queryByText("Marriage License")).toBeNull();
    });
  });

  it("6. Prevents duplicate submissions on rapid multiple taps", async () => {
    await render(<ScheduleWizardScreen initialParishId="1" />);

    // Navigate through confession (5-step)
    await fireEvent.press(screen.getByLabelText("Continue to Service"));
    await fireEvent.press(screen.getByLabelText("Confession"));
    await fireEvent.press(screen.getByLabelText("Continue to Date"));
    await fireEvent.press(screen.getByLabelText("2026-10-30, available"));
    await fireEvent.press(screen.getByLabelText("Continue to Time Slot"));
    await fireEvent.press(screen.getByLabelText("09:00 AM"));
    await fireEvent.press(screen.getByLabelText("Continue to Confirmation"));

    await waitFor(() => expect(screen.getByText("Confirm Your Appointment Request")).toBeTruthy());

    // Slow promise to simulate in-flight submission
    let resolveSubmit: (val: any) => void;
    mockMutateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      })
    );

    const submitBtn = screen.getByLabelText("Submit Schedule Request");
    // Fire multiple rapid taps
    await fireEvent.press(submitBtn);
    await fireEvent.press(submitBtn);
    await fireEvent.press(submitBtn);

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmit!({ id: 888 });
    });
  });
});
