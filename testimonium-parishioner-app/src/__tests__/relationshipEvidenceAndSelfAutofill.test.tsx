import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as DocumentPicker from "expo-document-picker";
import { RequestWizardScreen } from "@/features/requests/RequestWizardScreen";
import { resolveSelfProfileName } from "@/features/requests/presentation";

jest.setTimeout(20_000);

const mockFeedback = { showWarning: jest.fn(), showError: jest.fn(), showSuccess: jest.fn(), showConfirm: jest.fn() };
const mockUpload = jest.fn();
const mockUploadId = jest.fn();
const mockSubmit = jest.fn();
const mockCreate = jest.fn();

let mockProfile: any = {
  id: 1,
  firebaseUid: "uid-1",
  fullName: "Juan Santos Dela Cruz",
  isGovernmentIdVerified: true,
};
let mockUser: any = { uid: "uid-1" };
let mockLoadingRequirements = false;

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("@/providers/AuthProvider", () => ({ useAuth: () => ({ user: mockUser, profile: mockProfile }) }));
jest.mock("@/providers/FeedbackProvider", () => ({ useFeedback: () => mockFeedback }));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock("@/components/Screen", () => ({ Screen: jest.requireActual("react-native").View }));
jest.mock("@/components/ui/AppHeader", () => ({ AppHeader: () => null }));
jest.mock("@/components/ui/SafeBottomActionBar", () => ({ SafeBottomActionBar: jest.requireActual("react-native").View }));
jest.mock("@/components/layout/useAppLayoutMetrics", () => ({ useAppLayoutMetrics: () => ({ contentBottomInset: () => 0, onBottomActionLayout: jest.fn() }) }));
jest.mock("@/components/ui/SelectionRow", () => ({
  SelectionRow: ({ title, onSelect, accessibilityLabel }: { title: string; onSelect: () => void; accessibilityLabel: string }) => {
    const { Pressable, Text } = jest.requireActual("react-native");
    return (
      <Pressable onPress={onSelect} accessibilityLabel={accessibilityLabel}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));
jest.mock("@/features/parishes/api", () => ({
  useParishes: () => ({ data: { items: [{ id: 1, name: "Fixture Parish", availableDocuments: null }] }, isLoading: false }),
  useAllActiveParishes: () => ({ data: [{ id: 1, name: "Fixture Parish", availableDocuments: null }], isLoading: false }),
}));
jest.mock("@/features/requests/components/RegistrantIdCapturePicker", () => ({
  RegistrantIdCapturePicker: ({ side, onSelected }: any) => {
    const { Pressable, Text } = jest.requireActual("react-native");
    return (
      <Pressable onPress={() => onSelected({ uri: `file:///cache/${side}.jpg`, name: `${side}.jpg`, mimeType: "image/jpeg" })}>
        <Text>{`Pick Registrant ${side}`}</Text>
      </Pressable>
    );
  },
}));
jest.mock("@/features/requests/api", () => ({
  useDocumentRequirements: (params?: { relationship?: string }) => {
    const rel = params?.relationship || "Self";
    const isFamily = ["Parent", "Child", "Spouse", "Sibling"].includes(rel);
    return {
      data: {
        baseFee: 100,
        requiredDocuments: [{ id: "valid_id", label: "Valid Government ID", category: "primary", required: true }],
        relationshipEvidence:
          rel === "Self"
            ? []
            : [
                {
                  id: "authorization_letter",
                  label: isFamily ? "Proof of Relationship / Authorization Letter" : "Authorization Letter",
                  description: isFamily
                    ? "Upload the registrant's birth certificate, an authorization letter, or another supporting document that proves your relationship to the registrant."
                    : "Signed authorization letter for a request made for another person.",
                  category: "authorization_letter",
                  required: true,
                },
              ],
      },
      isLoading: mockLoadingRequirements,
    };
  },
  useCreateRequestDraft: () => ({ mutateAsync: mockCreate }),
  useRequestDetail: () => ({ data: undefined, isLoading: false }),
  useUpdateRequestDraft: () => ({ mutateAsync: jest.fn() }),
  useDeleteRequestDraft: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useSubmitRequestDraft: () => ({ mutateAsync: mockSubmit }),
  useUploadSupportingFile: () => ({ mutateAsync: mockUpload }),
  useUploadRegistrantId: () => ({ mutateAsync: mockUploadId }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { uid: "uid-1" };
  mockLoadingRequirements = false;
  mockProfile = {
    id: 1,
    firebaseUid: "uid-1",
    fullName: "Juan Santos Dela Cruz",
    firstName: "Juan",
    middleName: "Santos",
    lastName: "Dela Cruz",
    isGovernmentIdVerified: true,
  };
  mockCreate.mockResolvedValue({ id: 41 });
  mockSubmit.mockResolvedValue({ id: 41 });
  mockUpload.mockResolvedValue([]);
  mockUploadId.mockResolvedValue({});
  (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ name: "birth_cert.pdf", uri: "file:///cache/birth_cert.pdf", size: 128, mimeType: "application/pdf" }],
  });
});

describe("Android relationship evidence and Self name auto-fill", () => {
  it("uses structured multi-word name parts without guessing ambiguous combined names", () => {
    expect(resolveSelfProfileName({ firstName: "Juan Miguel", middleName: "Santos", lastName: "Dela Cruz" })).toEqual({ firstName: "Juan Miguel", middleName: "Santos", lastName: "Dela Cruz" });
    for (const fullName of ["Juan Miguel Santos", "Juan Santos Dela Cruz", "Maria Clara Delos Reyes", "Dela Cruz, Juan Miguel Jr."]) {
      expect(resolveSelfProfileName({ fullName })).toBeNull();
    }
    expect(resolveSelfProfileName({ fullName: "Juan Cruz" })).toEqual({ firstName: "Juan", middleName: "", lastName: "Cruz" });
    const withSuffix = { firstName: "Juan Miguel", lastName: "Dela Cruz", suffix: "Jr.", fullName: "Juan Miguel Dela Cruz Jr." };
    expect(resolveSelfProfileName(withSuffix)).toEqual({ firstName: "Juan Miguel", middleName: "", lastName: "Dela Cruz" });
  });

  it("ignores old accounts and unowned profiles and clears obsolete Self auto-fill", async () => {
    const view = await render(<RequestWizardScreen initialParishId="1" />);
    await fireEvent.press(screen.getByText("Continue to Document Type"));
    await fireEvent.press(screen.getByLabelText("Document type: Baptismal Certificate"));
    await fireEvent.press(screen.getByText("Continue to Details"));
    expect(screen.getByLabelText("First name of the applicant").props.value).toBe("Juan");
    mockUser = { uid: "uid-2" };
    mockProfile = { firebaseUid: "uid-1", firstName: "Old", lastName: "Account", isGovernmentIdVerified: true };
    await view.rerender(<RequestWizardScreen initialParishId="1" />);
    expect(screen.getByLabelText("First name of the applicant").props.value).toBe("");
    mockProfile = { firstName: "Unowned", lastName: "Profile", isGovernmentIdVerified: true };
    await view.rerender(<RequestWizardScreen initialParishId="1" />);
    expect(screen.getByLabelText("First name of the applicant").props.value).toBe("");
    mockProfile = { firebaseUid: "uid-2", firstName: "Maria Clara", lastName: "Delos Reyes", suffix: "III", isGovernmentIdVerified: true };
    await view.rerender(<RequestWizardScreen initialParishId="1" />);
    expect(screen.getByLabelText("First name of the applicant").props.value).toBe("Maria Clara");
    expect(screen.getByLabelText("Last name of the applicant").props.value).toBe("Delos Reyes");
    mockProfile = { firebaseUid: "uid-2", fullName: "Maria Clara Santos Delos Reyes", firstName: null, middleName: null, lastName: null, isGovernmentIdVerified: true };
    await view.rerender(<RequestWizardScreen initialParishId="1" />);
    expect(screen.getByLabelText("First name of the applicant").props.value).toBe("");
    expect(screen.getByLabelText("Last name of the applicant").props.value).toBe("");
  });

  it("handles delayed profiles and preserves manual names, non-Self entries and Self no-op selections", async () => {
    mockProfile = { id: 1, firebaseUid: "uid-1", fullName: "", isGovernmentIdVerified: true };
    const view = await render(<RequestWizardScreen initialParishId="1" />);
    await fireEvent.press(screen.getByText("Continue to Document Type"));
    await fireEvent.press(screen.getByLabelText("Document type: Baptismal Certificate"));
    await fireEvent.press(screen.getByText("Continue to Details"));
    mockProfile = { ...mockProfile, firstName: "Juan Miguel", middleName: "Santos", lastName: "Dela Cruz" };
    await view.rerender(<RequestWizardScreen initialParishId="1" />);
    expect(screen.getByLabelText("First name of the applicant").props.value).toBe("Juan Miguel");
    await fireEvent.changeText(screen.getByLabelText("First name of the applicant"), "Manual");
    mockProfile = { ...mockProfile };
    await view.rerender(<RequestWizardScreen initialParishId="1" />);
    await fireEvent.press(screen.getByLabelText(/Relationship to Record Holder/));
    await fireEvent.press(screen.getByLabelText("Relationship: Self"));
    expect(screen.getByLabelText("First name of the applicant").props.value).toBe("Manual");
    await fireEvent.press(screen.getByLabelText(/Relationship to Record Holder/));
    await fireEvent.press(screen.getByLabelText("Relationship: Parent"));
    await fireEvent.changeText(screen.getByLabelText("First name of the applicant"), "Elena");
    await fireEvent.changeText(screen.getByLabelText("Last name of the applicant"), "Gomez");
    mockProfile = { ...mockProfile, firstName: "Juan" };
    await view.rerender(<RequestWizardScreen initialParishId="1" />);
    expect(screen.getByLabelText("First name of the applicant").props.value).toBe("Elena");
    await fireEvent.press(screen.getByLabelText(/Relationship to Record Holder/));
    await fireEvent.press(screen.getByLabelText("Relationship: Self"));
    expect(screen.getByLabelText("First name of the applicant").props.value).toBe("Juan");
    expect(screen.getByLabelText("Last name of the applicant").props.value).toBe("Dela Cruz");
    expect(screen.getByRole("button", { name: "Continue to Attachments" }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("Purpose or reason for requesting this certificate"), "   ");
    await fireEvent.press(screen.getByText("Continue to Attachments"));
    expect(screen.queryByText("Continue to Review")).toBeNull();
  });

  it("blocks progression and submission while relationship requirements are loading", async () => {
    const view = await render(<RequestWizardScreen initialParishId="1" />);
    await fireEvent.press(screen.getByText("Continue to Document Type"));
    await fireEvent.press(screen.getByLabelText("Document type: Baptismal Certificate"));
    await fireEvent.press(screen.getByText("Continue to Details"));
    await fireEvent.changeText(screen.getByLabelText("Purpose or reason for requesting this certificate"), "School");
    await fireEvent.press(screen.getByText("Continue to Attachments"));
    mockLoadingRequirements = true;
    await view.rerender(<RequestWizardScreen initialParishId="1" />);
    await fireEvent.press(screen.getByText("Continue to Review"));
    expect(screen.queryByText("Confirm & Submit Request")).toBeNull();
    mockLoadingRequirements = false;
    await view.rerender(<RequestWizardScreen initialParishId="1" />);
    await fireEvent.press(screen.getByText("Continue to Review"));
    mockLoadingRequirements = true;
    await view.rerender(<RequestWizardScreen initialParishId="1" />);
    await fireEvent.press(screen.getByText("Confirm & Submit Request"));
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("keeps the submitted Self name stable during an in-flight profile refresh and ignores duplicate submission", async () => {
    let finishCreate!: () => void;
    mockCreate.mockImplementationOnce(() => new Promise(resolve => { finishCreate = () => resolve({ id: 41 }); }));
    const view = await render(<RequestWizardScreen initialParishId="1" />);
    await fireEvent.press(screen.getByText("Continue to Document Type"));
    await fireEvent.press(screen.getByLabelText("Document type: Baptismal Certificate"));
    await fireEvent.press(screen.getByText("Continue to Details"));
    await fireEvent.changeText(screen.getByLabelText("Purpose or reason for requesting this certificate"), "School");
    await fireEvent.press(screen.getByText("Continue to Attachments"));
    await fireEvent.press(screen.getByText("Continue to Review"));
    await fireEvent.press(screen.getByText("Confirm & Submit Request"));
    mockProfile = { ...mockProfile, firstName: "Juan Miguel" };
    await view.rerender(<RequestWizardScreen initialParishId="1" />);
    expect(screen.queryByText("Juan Miguel Santos Dela Cruz")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Confirm and submit your document request"));
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ applicantFirstName: "Juan", applicantMiddleName: "Santos", applicantLastName: "Dela Cruz", relationship: "Self" }) }));
    finishCreate();
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith(41));
  });

  it("auto-fills Self name from profile, handles rapid relationship switching, and uses Proof of Relationship / Authorization Letter for family relationships", async () => {
    await render(<RequestWizardScreen initialParishId="1" />);
    await fireEvent.press(screen.getByText("Continue to Document Type"));
    await fireEvent.press(screen.getByLabelText("Document type: Baptismal Certificate"));
    await fireEvent.press(screen.getByText("Continue to Details"));

    expect(screen.getByLabelText("First name of the applicant").props.value).toBe("Juan");
    expect(screen.getByLabelText("Middle name of the applicant").props.value).toBe("Santos");
    expect(screen.getByLabelText("Last name of the applicant").props.value).toBe("Dela Cruz");

    // Self -> Parent -> Self -> Child
    await fireEvent.press(screen.getByLabelText(/Relationship to Record Holder/));
    await fireEvent.press(screen.getByLabelText("Relationship: Parent"));
    expect(screen.getByLabelText("First name of the applicant").props.value).toBe("");

    await fireEvent.changeText(screen.getByLabelText("First name of the applicant"), "Maria");
    await fireEvent.changeText(screen.getByLabelText("Last name of the applicant"), "Reyes");

    await fireEvent.press(screen.getByLabelText(/Relationship to Record Holder/));
    await fireEvent.press(screen.getByLabelText("Relationship: Self"));
    expect(screen.getByLabelText("First name of the applicant").props.value).toBe("Juan");
    expect(screen.getByLabelText("Middle name of the applicant").props.value).toBe("Santos");
    expect(screen.getByLabelText("Last name of the applicant").props.value).toBe("Dela Cruz");

    await fireEvent.press(screen.getByLabelText(/Relationship to Record Holder/));
    await fireEvent.press(screen.getByLabelText("Relationship: Child"));
    expect(screen.getByLabelText("First name of the applicant").props.value).toBe("");

    await fireEvent.changeText(screen.getByLabelText("First name of the applicant"), "Pedro");
    await fireEvent.changeText(screen.getByLabelText("Last name of the applicant"), "Dela Cruz");
    await fireEvent.changeText(screen.getByLabelText("Purpose or reason for requesting this certificate"), "School");
    await fireEvent.press(screen.getByText("Continue to Attachments"));

    expect(screen.getByText("Proof of Relationship / Authorization Letter *")).toBeTruthy();
    expect(
      screen.getByText(
        "Upload the registrant's birth certificate, an authorization letter, or another supporting document that proves your relationship to the registrant."
      )
    ).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(/Attach document for Proof of Relationship \/ Authorization Letter/));
    await waitFor(() => expect(screen.getByText("birth_cert.pdf")).toBeTruthy());
    await fireEvent.press(screen.getByText("Pick Registrant front"));
    await fireEvent.press(screen.getByText("Pick Registrant back"));
    await fireEvent.press(screen.getByText("Continue to Review"));
    await fireEvent.press(screen.getByText("Confirm & Submit Request"));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith(41));
    expect(mockUpload).toHaveBeenCalledWith({
      requestId: 41,
      category: "authorization_letter",
      file: expect.objectContaining({ name: "birth_cert.pdf" }),
    });
    expect(mockUploadId).toHaveBeenCalledWith(expect.objectContaining({ requestId: 41 }));
  });

  it("keeps mandatory Authorization Letter label for Authorized Representative", async () => {
    await render(<RequestWizardScreen initialParishId="1" />);
    await fireEvent.press(screen.getByText("Continue to Document Type"));
    await fireEvent.press(screen.getByLabelText("Document type: Baptismal Certificate"));
    await fireEvent.press(screen.getByText("Continue to Details"));

    await fireEvent.press(screen.getByLabelText(/Relationship to Record Holder/));
    await fireEvent.press(screen.getByLabelText("Relationship: Authorized Representative"));
    await fireEvent.changeText(screen.getByLabelText("First name of the applicant"), "Elena");
    await fireEvent.changeText(screen.getByLabelText("Last name of the applicant"), "Gomez");
    await fireEvent.changeText(screen.getByLabelText("Purpose or reason for requesting this certificate"), "Legal");
    await fireEvent.press(screen.getByText("Continue to Attachments"));

    expect(screen.getByText("Authorization Letter *")).toBeTruthy();
  });
});

