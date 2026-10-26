import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as DocumentPicker from "expo-document-picker";
import { RequestWizardScreen } from "@/features/requests/RequestWizardScreen";
import { RequestDetailScreen } from "@/features/requests/RequestDetailScreen";
import { CANONICAL_DOCUMENT_TYPES, type DocumentRequestDetail, type RequiredDocument } from "@/features/requests/types";
import { formatDocumentType } from "@/features/requests/presentation";

jest.setTimeout(20_000);

const mockFeedback = { showWarning: jest.fn(), showError: jest.fn(), showSuccess: jest.fn(), showConfirm: jest.fn() };
const mockUpload = jest.fn();
const mockSubmit = jest.fn();
const mockCreate = jest.fn();
const mockResubmit = jest.fn();
const mockRefetch = jest.fn();
let mockRequiredDocuments: RequiredDocument[];
let mockRequest: DocumentRequestDetail;

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("@/providers/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "fixture" }, profile: { isGovernmentIdVerified: true, firstName: "Juan", lastName: "Cruz" } }) }));
jest.mock("@/providers/FeedbackProvider", () => ({ useFeedback: () => mockFeedback }));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));
jest.mock("@/hooks/useAutomaticRefresh", () => ({ useScreenRefresh: () => ({ enabled: true }), useManualRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock("@/components/Screen", () => ({ Screen: jest.requireActual("react-native").View }));
jest.mock("@/components/ui/AppHeader", () => ({ AppHeader: () => null }));
jest.mock("@/components/ui/SafeBottomActionBar", () => ({ SafeBottomActionBar: jest.requireActual("react-native").View }));
jest.mock("@/components/layout/ContentColumn", () => ({ ContentColumn: jest.requireActual("react-native").View }));
jest.mock("@/components/layout/useAppLayoutMetrics", () => ({ useAppLayoutMetrics: () => ({ contentBottomInset: () => 0, onBottomActionLayout: jest.fn() }) }));
jest.mock("@/components/ui/SelectionRow", () => ({ SelectionRow: ({ title, onSelect, accessibilityLabel }: { title: string; onSelect: () => void; accessibilityLabel: string }) => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return <Pressable onPress={onSelect} accessibilityLabel={accessibilityLabel}><Text>{title}</Text></Pressable>;
} }));
jest.mock("@/features/parishes/api", () => ({ useParishes: () => ({ data: { items: [{ id: 1, name: "Fixture Parish", availableDocuments: null }] }, isLoading: false }) }));
jest.mock("@/features/requests/components/RegistrantIdCapturePicker", () => ({ RegistrantIdCapturePicker: () => null }));
jest.mock("@/features/requests/components/ReturnDocumentModal", () => ({ ReturnDocumentModal: () => null }));
jest.mock("@/features/requests/components/RequestStatusTimeline", () => ({ RequestStatusTimeline: () => null }));
jest.mock("@/features/requests/api", () => ({
  useDocumentRequirements: () => ({ data: { baseFee: 100, requiredDocuments: mockRequiredDocuments }, isLoading: false }),
  useRequestDetail: () => ({ data: mockRequest, isLoading: false, refetch: mockRefetch }),
  useCreateRequestDraft: () => ({ mutateAsync: mockCreate }),
  useSubmitRequestDraft: () => ({ mutateAsync: mockSubmit }),
  useUploadSupportingFile: () => ({ mutateAsync: mockUpload }),
  useUploadRegistrantId: () => ({ mutateAsync: jest.fn() }),
  useCancelRequest: () => ({ mutateAsync: jest.fn() }),
  useResubmitCorrections: () => ({ mutateAsync: mockResubmit }),
}));

const endorsement: RequiredDocument = { id: "endorsement_letter", label: "Endorsement Letter", category: "supporting", required: true };
const asset = { name: "endorsement.pdf", uri: "file:///cache/endorsement.pdf", size: 128, mimeType: "application/pdf" };

beforeEach(() => {
  jest.clearAllMocks();
  mockRequiredDocuments = [{ id: "valid_id", label: "Valid Government ID", category: "primary", required: true }, endorsement];
  mockRequest = { id: 41, userId: 12, parishId: 1, documentType: "BAPTISMAL_CERTIFICATE", status: "PENDING", isDraft: true, relationship: "Self", applicantName: "Juan Cruz", purpose: "School", fee: 100, attachments: [], history: [] } as unknown as DocumentRequestDetail;
  mockCreate.mockResolvedValue({ id: 41 });
  mockSubmit.mockResolvedValue({ id: 41 });
  mockUpload.mockResolvedValue([]);
  mockResubmit.mockResolvedValue({ id: 41 });
  (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [asset] });
});

async function openWizardAttachments(type: string) {
  await render(<RequestWizardScreen initialParishId="1" />);
  await fireEvent.press(screen.getByText("Continue to Document Type"));
  await fireEvent.press(screen.getByLabelText(`Document type: ${formatDocumentType(type)}`));
  await fireEvent.press(screen.getByText("Continue to Details"));
  await fireEvent.changeText(screen.getByLabelText("First name of the applicant"), "Juan");
  await fireEvent.changeText(screen.getByLabelText("Last name of the applicant"), "Cruz");
  await fireEvent.changeText(screen.getByLabelText("Purpose or reason for requesting this certificate"), "School");
  await fireEvent.press(screen.getByText("Continue to Attachments"));
}

describe("dynamic Endorsement Letter on Android screens", () => {
  it.each(CANONICAL_DOCUMENT_TYPES)("requires and uploads Endorsement Letter for %s using the existing picker", async (type) => {
    await openWizardAttachments(type);
    expect(screen.getByText("Endorsement Letter")).toBeTruthy();
    await fireEvent.press(screen.getByText("Continue to Review"));
    expect(mockFeedback.showWarning).toHaveBeenCalledWith("Required Documents Missing", expect.stringContaining("Endorsement Letter"));
    expect(mockCreate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText(/Attach document for Endorsement Letter/));
    await waitFor(() => expect(screen.getByText("endorsement.pdf")).toBeTruthy());
    await fireEvent.press(screen.getByText("Continue to Review"));
    await fireEvent.press(screen.getByText("Confirm & Submit Request"));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith(41));
    expect(mockUpload).toHaveBeenCalledWith({ requestId: 41, category: "endorsement_letter", file: expect.objectContaining({ requirementId: "endorsement_letter", name: "endorsement.pdf" }) });
  });

  it("omits a disabled requirement and permits review and submission without an upload", async () => {
    mockRequiredDocuments = mockRequiredDocuments.filter((d) => d.id !== "endorsement_letter");
    await openWizardAttachments("BAPTISMAL_CERTIFICATE");
    expect(screen.queryByText("Endorsement Letter")).toBeNull();
    await fireEvent.press(screen.getByText("Continue to Review"));
    await fireEvent.press(screen.getByText("Confirm & Submit Request"));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith(41));
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("uses existing file validation for Endorsement Letter", async () => {
    await openWizardAttachments("BAPTISMAL_CERTIFICATE");
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({ canceled: false, assets: [{ ...asset, size: 6 * 1024 * 1024 }] });
    await fireEvent.press(screen.getByLabelText(/Attach document for Endorsement Letter/));
    await waitFor(() => expect(mockFeedback.showError).toHaveBeenCalledWith("Invalid File", expect.stringContaining("5 MB")));
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("restores an attached letter on draft detail and renders a picker when it is missing", async () => {
    mockRequest.attachments = [{ id: 2, category: "endorsement_letter", fileName: "existing.pdf", uploadedAt: "2026-10-01" }] as DocumentRequestDetail["attachments"];
    const view = await render(<RequestDetailScreen requestId="41" />);
    expect(screen.getByText("Endorsement Letter")).toBeTruthy();
    expect(screen.getByText("Finalize & Submit Request")).toBeTruthy();
    mockRequest = { ...mockRequest, attachments: [] };
    await view.rerender(<RequestDetailScreen requestId="41" />);
    expect(screen.getByText("Submit Request (1 Missing)")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/Attach document for Endorsement Letter/));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({ requestId: 41, category: "endorsement_letter" })));
  });

  it("requires a correction replacement and sends it through the existing category", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    try {
      mockRequest = { ...mockRequest, isDraft: false, status: "NEEDS_CORRECTION", correctionRequirementIds: ["endorsement_letter"], correctionNote: "Replace Endorsement Letter" };
      await render(<RequestDetailScreen requestId="41" />);
      await fireEvent.press(screen.getByLabelText(/Attach document for Endorsement Letter/));
      await waitFor(() => expect(screen.getByText("endorsement.pdf")).toBeTruthy());
      await fireEvent.press(screen.getByText("Resubmit Corrected Documents"));
      await waitFor(() => expect(mockResubmit).toHaveBeenCalled());
      expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({ requestId: 41, category: "endorsement_letter" }));
    } finally {
      alert.mockRestore();
    }
  });
});
