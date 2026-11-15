import React from "react";
import { BackHandler } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { RequestWizardScreen } from "@/features/requests/RequestWizardScreen";
import { ScheduleWizardScreen } from "@/features/schedule/ScheduleWizardScreen";

jest.setTimeout(25_000);

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockSearchParams: Record<string, string> = {};

const mockFeedback = {
  showWarning: jest.fn(),
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showConfirm: jest.fn(),
};

const mockProfile = {
  id: 1,
  firebaseUid: "uid-1",
  fullName: "Juan Santos Dela Cruz",
  firstName: "Juan",
  middleName: "Santos",
  lastName: "Dela Cruz",
  needsProfileCompletion: false,
  needsLegalNameConfirmation: false,
  isGovernmentIdVerified: true,
};
const mockUser = { uid: "uid-1" };

const mockCreateReqDraft = jest.fn();
const mockUpdateReqDraft = jest.fn();
const mockSubmitReqDraft = jest.fn();
const mockUploadReqFile = jest.fn();
const mockUploadReqId = jest.fn();
let mockReqDraftDetail: any = undefined;

const mockCreateSchedDraft = jest.fn();
const mockUpdateSchedDraft = jest.fn();
const mockSubmitSchedDraft = jest.fn();
const mockUploadSchedAtt = jest.fn();
const mockCreateSched = jest.fn();
let mockSchedDraftDetail: any = undefined;
const mockSchedDraftRefetch = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-file-system/legacy", () => ({ getInfoAsync: jest.fn(async () => ({ exists: true, size: 1024 })) }));
jest.mock("@/providers/AuthProvider", () => ({ useAuth: () => ({ user: mockUser, profile: mockProfile }) }));
jest.mock("@/providers/FeedbackProvider", () => ({ useFeedback: () => mockFeedback }));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/components/Screen", () => ({ Screen: jest.requireActual("react-native").View }));
jest.mock("@/components/ui/AppHeader", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    AppHeader: ({ onBack }: any) => (
      <Pressable onPress={onBack} accessibilityLabel="Go back">
        <Text>Back</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/components/ui/SafeBottomActionBar", () => ({ SafeBottomActionBar: jest.requireActual("react-native").View }));
jest.mock("@/components/layout/useAppLayoutMetrics", () => ({
  useAppLayoutMetrics: () => ({ contentBottomInset: () => 0, onBottomActionLayout: jest.fn() }),
}));
jest.mock("@/components/ui/SelectionRow", () => ({
  SelectionRow: ({ title, onSelect, accessibilityLabel }: { title: string; onSelect: () => void; accessibilityLabel?: string }) => {
    const { Pressable, Text } = jest.requireActual("react-native");
    return (
      <Pressable onPress={() => onSelect?.()} accessibilityLabel={accessibilityLabel ?? title}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));
const mockParishItems = [{ id: 1, name: "St. Jude Parish", municipalityCity: "Manila", availableDocuments: null }];
const mockParishesPaged = { items: mockParishItems };
const mockDocRequirementsData = {
  baseFee: 100,
  requiredDocuments: [{ id: "valid_id", label: "Valid Government ID", category: "primary", required: true }],
  relationshipEvidence: [],
};
const mockSchedConfigData = {
  parishId: 1,
  schedulingAvailable: true,
  configurationUnavailable: false,
  services: [
    { eventType: "CONFESSION", label: "Confession", requirements: [] },
    { eventType: "WEDDING", label: "Marriage (Canonical Interview)", requirements: [{ id: "cenomar", label: "CENOMAR" }] },
  ],
  timeSlots: ["09:00 AM", "10:00 AM"],
  capacity: null,
  venueCapacity: 150,
  horizonDays: 60,
  configurationUpdatedAt: "2026-10-26T00:00:00.000Z",
};
const mockAvailabilityDatesData = { serviceAvailable: true, dates: ["2026-12-01"] };
const mockSlotsData = ["09:00 AM", "10:00 AM"];
const mockEmptyArray: any[] = [];
const mockRecsData = { recommendations: [] };

jest.mock("@/features/parishes/api", () => ({
  useParishes: () => ({ data: mockParishesPaged, isLoading: false }),
  useAllActiveParishes: () => ({ data: mockParishItems, isLoading: false }),
}));

jest.mock("@/features/requests/api", () => ({
  useDocumentRequirements: () => ({
    data: mockDocRequirementsData,
    isLoading: false,
  }),
  useRequestDetail: () => ({ data: mockReqDraftDetail, isLoading: false }),
  useCreateRequestDraft: () => ({ mutateAsync: mockCreateReqDraft }),
  useUpdateRequestDraft: () => ({ mutateAsync: mockUpdateReqDraft }),
  useSubmitRequestDraft: () => ({ mutateAsync: mockSubmitReqDraft }),
  useUploadSupportingFile: () => ({ mutateAsync: mockUploadReqFile }),
  useUploadRegistrantId: () => ({ mutateAsync: mockUploadReqId }),
}));

jest.mock("@/features/schedule/api", () => ({
  useSchedulingConfiguration: () => ({
    data: mockSchedConfigData,
    refetch: jest.fn(async () => ({ data: mockSchedConfigData })),
    isLoading: false,
  }),
  useAvailabilityDates: () => ({ data: mockAvailabilityDatesData, refetch: jest.fn(async () => ({})), isLoading: false }),
  useAvailableSlots: () => ({ data: mockSlotsData, refetch: jest.fn(async () => ({})), isLoading: false }),
  useEligiblePriests: () => ({ data: mockEmptyArray, isLoading: false, isError: false, refetch: jest.fn(async () => ({})) }),
  useRecommendations: () => ({ data: mockRecsData, isLoading: false, isError: false, refetch: jest.fn(async () => ({})) }),
  useScheduleDraftDetail: () => ({ data: mockSchedDraftDetail, isLoading: false, refetch: mockSchedDraftRefetch }),
  useCreateSchedule: () => ({ mutateAsync: mockCreateSched, isPending: false }),
  useCreateScheduleDraft: () => ({ mutateAsync: mockCreateSchedDraft }),
  useUpdateScheduleDraft: () => ({ mutateAsync: mockUpdateSchedDraft }),
  useUploadScheduleDraftAttachment: () => ({ mutateAsync: mockUploadSchedAtt }),
  useSubmitScheduleDraft: () => ({ mutateAsync: mockSubmitSchedDraft }),
}));

beforeEach(() => {
  jest.useFakeTimers({
    doNotFake: ["nextTick", "setImmediate", "queueMicrotask"],
  });
  jest.clearAllMocks();
  mockSearchParams = {};
  mockReqDraftDetail = undefined;
  mockSchedDraftDetail = undefined;
  mockCreateReqDraft.mockResolvedValue({ id: 301, isDraft: true });
  mockUpdateReqDraft.mockResolvedValue({ id: 301, isDraft: true });
  mockSubmitReqDraft.mockResolvedValue({ id: 301, isDraft: false });
  mockCreateSchedDraft.mockResolvedValue({ id: 401, status: "DRAFT" });
  mockUpdateSchedDraft.mockResolvedValue({ id: 401, status: "DRAFT" });
  mockSubmitSchedDraft.mockResolvedValue({ id: 401, createdAt: "2026-11-15T00:00:00.000Z" });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("RequestWizardScreen form-only autosave", () => {
  it("debounces 1500ms, coalesces edits, updates same draft ID, and never uploads files on autosave", async () => {
    await render(<RequestWizardScreen />);

    // Select parish -> move to doc type -> no autosave before minimum details
    await fireEvent.press(screen.getByLabelText("Parish: St. Jude Parish"));
    await fireEvent.press(screen.getByText("Continue to Document Type"));
    await fireEvent.press(screen.getByLabelText("Document type: Baptismal Certificate"));
    await fireEvent.press(screen.getByText("Continue to Details"));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockCreateReqDraft).not.toHaveBeenCalled();

    // Edit Purpose twice inside debounce window -> one create after 1500ms
    const purposeInput = screen.getByLabelText("Purpose or reason for requesting this certificate");
    await fireEvent.changeText(purposeInput, "Scho");
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockCreateReqDraft).not.toHaveBeenCalled();

    await fireEvent.changeText(purposeInput, "School requirement");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockCreateReqDraft).toHaveBeenCalledTimes(1);
    expect(mockCreateReqDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          parishId: 1,
          documentType: "BAPTISMAL_CERTIFICATE",
          applicantFirstName: "Juan",
          applicantLastName: "Dela Cruz",
          purpose: "School requirement",
        }),
      })
    );
    expect(mockUploadReqFile).not.toHaveBeenCalled();
    expect(mockUploadReqId).not.toHaveBeenCalled();
    expect(screen.getByText("All changes saved")).toBeTruthy();

    // Subsequent edit updates existing draft ID without calling create again
    await fireEvent.changeText(purposeInput, "Employment application");
    await act(async () => {
      jest.advanceTimersByTime(1500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockCreateReqDraft).toHaveBeenCalledTimes(1);
    expect(mockUpdateReqDraft).toHaveBeenCalledTimes(1);
    expect(mockUpdateReqDraft).toHaveBeenCalledWith({
      requestId: 301,
      payload: expect.objectContaining({ purpose: "Employment application" }),
    });
    expect(mockUploadReqFile).not.toHaveBeenCalled();
    expect(mockUploadReqId).not.toHaveBeenCalled();
  });

  it("does not autosave during resumed draft hydration and preserves newer edits while a save is in flight", async () => {
    let resolveInFlight!: (value: any) => void;
    mockUpdateReqDraft
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveInFlight = resolve;
          })
      )
      .mockRejectedValueOnce(new Error("Offline"));

    mockReqDraftDetail = {
      id: 350,
      isDraft: true,
      parishId: 1,
      documentType: "BAPTISMAL_CERTIFICATE",
      applicantName: "Juan Santos Dela Cruz",
      relationship: "Self",
      purpose: "Original saved purpose",
      attachments: [],
    };

    await render(<RequestWizardScreen draftId="350" />);

    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    expect(mockCreateReqDraft).not.toHaveBeenCalled();
    expect(mockUpdateReqDraft).not.toHaveBeenCalled();
    expect(screen.getByText("All changes saved")).toBeTruthy();

    const purposeInput = screen.getByLabelText("Purpose or reason for requesting this certificate");
    await fireEvent.changeText(purposeInput, "First live edit");

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.getByText("Saving...")).toBeTruthy();

    // Type newer edit before in-flight request resolves
    await fireEvent.changeText(purposeInput, "Newer edit during save");
    await act(async () => {
      resolveInFlight({ id: 350, isDraft: true });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Newer input value is preserved, not overwritten
    expect(purposeInput.props.value).toBe("Newer edit during save");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();

    // Second save fails -> error indicator shown
    await act(async () => {
      jest.advanceTimersByTime(1500);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Unable to save changes")).toBeTruthy();
  });

  it("does not rehydrate an autosaved new draft over newer local inputs", async () => {
    let resolveCreate!: (value: any) => void;
    mockCreateReqDraft.mockImplementationOnce(() => new Promise(resolve => { resolveCreate = resolve; }));
    const view = await render(<RequestWizardScreen />);
    await fireEvent.press(screen.getByLabelText("Parish: St. Jude Parish"));
    await fireEvent.press(screen.getByText("Continue to Document Type"));
    await fireEvent.press(screen.getByLabelText("Document type: Baptismal Certificate"));
    await fireEvent.press(screen.getByText("Continue to Details"));
    const input = screen.getByLabelText("Purpose or reason for requesting this certificate");
    await fireEvent.changeText(input, "Initial create");
    await act(async () => { jest.advanceTimersByTime(1500); });
    await fireEvent.changeText(input, "Newer local purpose");
    await act(async () => { resolveCreate({ id: 301, isDraft: true }); });
    mockReqDraftDetail = { ...documentExitDraft, id: 301, purpose: "Initial create" };
    await view.rerender(<RequestWizardScreen />);
    expect(screen.getByLabelText("Purpose or reason for requesting this certificate").props.value).toBe("Newer local purpose");
    await act(async () => { jest.advanceTimersByTime(1500); });
    expect(mockCreateReqDraft).toHaveBeenCalledTimes(1);
    expect(mockUpdateReqDraft).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 301, payload: expect.objectContaining({ purpose: "Newer local purpose" }),
    }));
  });
});

describe("ScheduleWizardScreen form-only autosave", () => {
  it("excludes removedRequirementIds and attachment uploads during form-only autosave, and preserves WEDDING parish venue", async () => {
    mockSchedDraftDetail = {
      id: 450,
      status: "DRAFT",
      parishId: 1,
      parishName: "St. Jude Parish",
      eventType: "WEDDING",
      preferredDate: "2026-12-01",
      date: "2026-12-01",
      timeSlot: "09:00 AM",
      location: "St. Jude Parish",
      remarks: "Original note",
      requestedPriestId: null,
      attachments: [
        { id: 88, requirementId: "cenomar", fileName: "cenomar.pdf", fileSize: 1200 },
      ],
    };

    await render(<ScheduleWizardScreen draftId="450" />);

    // Hydration must not trigger update or refetch
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    expect(mockUpdateSchedDraft).not.toHaveBeenCalled();
    expect(mockUploadSchedAtt).not.toHaveBeenCalled();
    expect(mockSchedDraftRefetch).not.toHaveBeenCalled();

    // On Step 5 (Upload Requirements), press Replace on saved attachment -> does NOT trigger update/delete via autosave
    await fireEvent.press(screen.getByLabelText("Replace saved CENOMAR"));
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    expect(mockUpdateSchedDraft).not.toHaveBeenCalled();

    // Proceed to Step 6 and edit remarks -> autosave sends form fields ONLY, WITHOUT removedRequirementIds
    await fireEvent.press(screen.getByText("Continue to Confirmation"));
    const notesInput = screen.getByPlaceholderText(
      "e.g., Main Parish Church, or Brgy. San Roque Chapel (near plaza), or Mass Intention names"
    );
    await fireEvent.changeText(notesInput, "Need wheelchair access");

    await act(async () => {
      jest.advanceTimersByTime(1500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUpdateSchedDraft).toHaveBeenCalledTimes(1);
    const updateCall = mockUpdateSchedDraft.mock.calls[0][0];
    expect(updateCall.draftId).toBe(450);
    expect(updateCall.payload).toMatchObject({
      parishId: 1,
      eventType: "WEDDING",
      location: "St. Jude Parish",
      remarks: "Need wheelchair access",
    });
    expect(updateCall.payload.removedRequirementIds).toBeUndefined();
    expect(mockUploadSchedAtt).not.toHaveBeenCalled();
    expect(mockSchedDraftRefetch).not.toHaveBeenCalled();
    expect(screen.getByText("All changes saved")).toBeTruthy();
  });
});

const documentExitDraft = {
  id: 350, isDraft: true, parishId: 1, documentType: "BAPTISMAL_CERTIFICATE",
  applicantName: "Juan Santos Dela Cruz", relationship: "Self", purpose: "Original saved purpose",
  attachments: [],
};
const scheduleExitDraft = {
  id: 450, status: "DRAFT", parishId: 1, parishName: "St. Jude Parish", eventType: "WEDDING",
  preferredDate: "2026-12-01", date: "2026-12-01", timeSlot: "09:00 AM",
  location: "St. Jude Parish", remarks: "Original note", requestedPriestId: null,
  attachments: [{ id: 88, requirementId: "cenomar", fileName: "cenomar.pdf", fileSize: 1200 }],
};

it("does not silently leave a resumed document draft after required fields are cleared", async () => {
  mockReqDraftDetail = documentExitDraft;
  await render(<RequestWizardScreen draftId="350" />);
  await fireEvent.changeText(screen.getByLabelText("Purpose or reason for requesting this certificate"), "");
  await fireEvent.press(screen.getByLabelText("Go back"));
  expect(mockBack).not.toHaveBeenCalled();
  expect(mockUpdateReqDraft).not.toHaveBeenCalled();
  expect(mockFeedback.showConfirm.mock.calls.at(-1)![3].confirmText).toBe("Leave Anyway");
  expect(screen.getByLabelText("Purpose or reason for requesting this certificate").props.value).toBe("");
});

const exitFlows = [
  {
    name: "RequestWizardScreen",
    mutation: mockUpdateReqDraft,
    async open() {
      mockReqDraftDetail = documentExitDraft;
      await render(<RequestWizardScreen draftId="350" />);
    },
    edit: async (value: string) => fireEvent.changeText(screen.getByLabelText("Purpose or reason for requesting this certificate"), value),
    toExit: async () => {},
    value: () => screen.getByLabelText("Purpose or reason for requesting this certificate").props.value,
  },
  {
    name: "ScheduleWizardScreen",
    mutation: mockUpdateSchedDraft,
    async open() {
      mockSchedDraftDetail = scheduleExitDraft;
      await render(<ScheduleWizardScreen draftId="450" />);
      await fireEvent.press(screen.getByText("Continue to Confirmation"));
    },
    edit: async (value: string) => fireEvent.changeText(screen.getByPlaceholderText(
      "e.g., Main Parish Church, or Brgy. San Roque Chapel (near plaza), or Mass Intention names"
    ), value),
    toExit: async () => {
      for (let i = 0; i < 5; i++) await fireEvent.press(screen.getByLabelText("Go back"));
    },
    value: () => screen.getByPlaceholderText(
      "e.g., Main Parish Church, or Brgy. San Roque Chapel (near plaza), or Mass Intention names"
    ).props.value,
  },
];

for (const flow of exitFlows) {
  describe(`${flow.name} navigation autosave`, () => {
    it("saves pending inputs before header Back, excludes attachments, and skips prompts for saved inputs", async () => {
      await flow.open();
      await flow.edit("Pending navigation edit");
      await flow.toExit();
      await fireEvent.press(screen.getByLabelText("Go back"));
      expect(flow.mutation).toHaveBeenCalledTimes(1);
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockFeedback.showConfirm).not.toHaveBeenCalled();
      expect(mockUploadReqFile).not.toHaveBeenCalled();
      expect(mockUploadReqId).not.toHaveBeenCalled();
      expect(mockUploadSchedAtt).not.toHaveBeenCalled();
      expect(flow.mutation.mock.calls[0][0].payload.removedRequirementIds).toBeUndefined();
      await fireEvent.press(screen.getByLabelText("Go back"));
      expect(flow.mutation).toHaveBeenCalledTimes(1);
      expect(mockBack).toHaveBeenCalledTimes(2);
    });

    it("failed final saves stay on the form and offer retry or explicit leave", async () => {
      flow.mutation.mockRejectedValue(new Error("Offline"));
      await flow.open();
      await flow.edit("Preserve this edit");
      await flow.toExit();
      await fireEvent.press(screen.getByLabelText("Go back"));
      expect(mockBack).not.toHaveBeenCalled();
      const [title, message, leave, options] = mockFeedback.showConfirm.mock.calls.at(-1)!;
      expect(title).toBe("Unable to save changes");
      expect(message).toContain("newest unsaved changes may be lost");
      expect(options.confirmText).toBe("Leave Anyway");
      expect(options.cancelText).toBe("Stay and Retry");
      await act(async () => { options.onCancel(); });
      expect(mockBack).not.toHaveBeenCalled();
      expect(flow.mutation).toHaveBeenCalledTimes(2);
      await act(async () => { leave(); });
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockUploadReqFile).not.toHaveBeenCalled();
      expect(mockUploadReqId).not.toHaveBeenCalled();
      expect(mockUploadSchedAtt).not.toHaveBeenCalled();
    });

    it("Stay and Retry saves successfully while remaining on the form", async () => {
      flow.mutation.mockRejectedValueOnce(new Error("Offline"));
      await flow.open();
      await flow.edit("Retry this edit");
      await flow.toExit();
      await fireEvent.press(screen.getByLabelText("Go back"));
      const options = mockFeedback.showConfirm.mock.calls.at(-1)![3];
      await act(async () => { options.onCancel(); });
      expect(flow.mutation).toHaveBeenCalledTimes(2);
      expect(mockBack).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByLabelText("Go back"));
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(flow.mutation).toHaveBeenCalledTimes(2);
    });

    it("hardware Back waits for an active autosave and does not duplicate the saved request", async () => {
      let resolveSave!: (value: any) => void;
      flow.mutation.mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve; }));
      const backListener = jest.spyOn(BackHandler, "addEventListener");
      try {
        await flow.open();
        await flow.edit("Save before hardware back");
        await act(async () => { jest.advanceTimersByTime(1500); });
        await flow.toExit();
        const handler = backListener.mock.calls.at(-1)![1];
        await act(async () => { expect(handler({} as any)).toBe(true); });
        expect(mockBack).not.toHaveBeenCalled();
        expect(flow.mutation).toHaveBeenCalledTimes(1);
        await act(async () => { resolveSave({ id: 450, status: "DRAFT", isDraft: true }); });
        expect(mockBack).toHaveBeenCalledTimes(1);
        expect(flow.mutation).toHaveBeenCalledTimes(1);
      } finally {
        backListener.mockRestore();
      }
    });

    it("flushes the newest edits after waiting for an older autosave", async () => {
      let resolveSave!: (value: any) => void;
      flow.mutation.mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve; }));
      const backListener = jest.spyOn(BackHandler, "addEventListener");
      await flow.open();
      await flow.edit("Older edit");
      await act(async () => { jest.advanceTimersByTime(1500); });
      await flow.edit("Newest edit");
      await flow.toExit();
      await act(async () => { backListener.mock.calls.at(-1)![1]({} as any); });
      expect(mockBack).not.toHaveBeenCalled();
      expect(flow.mutation).toHaveBeenCalledTimes(1);
      await act(async () => { resolveSave({ id: 450, status: "DRAFT", isDraft: true }); });
      expect(flow.mutation).toHaveBeenCalledTimes(2);
      const latest = flow.mutation.mock.calls.at(-1)![0].payload;
      expect(latest.purpose ?? latest.remarks).toBe("Newest edit");
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockUploadReqFile).not.toHaveBeenCalled();
      expect(mockUploadReqId).not.toHaveBeenCalled();
      expect(mockUploadSchedAtt).not.toHaveBeenCalled();
    });
  });
}
