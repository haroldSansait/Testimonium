import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ProfileScreen } from "@/features/profile/ProfileScreen";
import { EditProfileScreen } from "@/features/profile/EditProfileScreen";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockUpdateProfile = jest.fn();
const mockLogout = jest.fn();
let mockProfile: any = null;

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => true,
  }),
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

jest.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    profile: mockProfile,
    updateProfile: mockUpdateProfile,
    logout: mockLogout,
    isUpdatingProfile: false,
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 44, left: 0, right: 0, bottom: 34 },
    }}
  >
    {children}
  </SafeAreaProvider>
);

describe("Android Google Legal-Name Confirmation & Verified Name Lock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateProfile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does NOT show legal-name confirmation for existing users with NULL structured names", async () => {
    mockProfile = {
      id: 10,
      firebaseUid: "uid-10",
      email: "existing.google@example.com",
      fullName: "Maria Santos",
      firstName: null,
      lastName: null,
      needsLegalNameConfirmation: false,
      isGovernmentIdVerified: false,
      governmentIdVerificationStatus: "NOT_SUBMITTED",
      role: "PARISHIONER",
      status: "ACTIVE",
    };

    const view = await render(<ProfileScreen />, { wrapper });
    expect(
      view.queryByText(
        "Is this your actual full legal name as shown on your Government ID?"
      )
    ).toBeNull();
  });

  it("prompts new Google users on ProfileScreen, validates Option A mismatch, saves Option B, and offers Verify Government ID Now", async () => {
    mockProfile = {
      id: 20,
      firebaseUid: "uid-20",
      email: "new.google@example.com",
      fullName: "Johnny D",
      firstName: null,
      lastName: null,
      needsLegalNameConfirmation: true,
      isGovernmentIdVerified: false,
      governmentIdVerificationStatus: "NOT_SUBMITTED",
      role: "PARISHIONER",
      status: "ACTIVE",
    };

    mockUpdateProfile.mockImplementation(async (payload) => {
      mockProfile = {
        ...mockProfile,
        fullName: "Juan Santos Dela Cruz",
        firstName: payload.firstName,
        middleName: payload.middleName || null,
        lastName: payload.lastName,
        suffix: payload.suffix || null,
        needsLegalNameConfirmation: false,
      };
      return mockProfile;
    });

    const view = await render(<ProfileScreen />, { wrapper });

    expect(
      view.getByText(
        "Is this your actual full legal name as shown on your Government ID?"
      )
    ).toBeTruthy();

    // Option A: mismatch rejected client-side
    await fireEvent.press(view.getByText("Yes, this is my legal name"));
    await fireEvent.changeText(view.getByLabelText("First Name *"), "Juan");
    await fireEvent.changeText(view.getByLabelText("Last Name *"), "Dela Cruz");
    await fireEvent.press(view.getByText("Confirm Legal Name"));

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(
      view.getByText(/do not match your displayed full name/i)
    ).toBeTruthy();

    // Option B: correct legal name
    await fireEvent.press(view.getByText("No, I need to correct my name"));
    await fireEvent.changeText(view.getByLabelText("First Name *"), "Juan");
    await fireEvent.changeText(
      view.getByLabelText("Middle Name (Optional)"),
      "Santos"
    );
    await fireEvent.changeText(view.getByLabelText("Last Name *"), "Dela Cruz");
    await fireEvent.press(view.getByText("Save Corrected Legal Name"));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        firstName: "Juan",
        middleName: "Santos",
        lastName: "Dela Cruz",
        suffix: "",
        legalNameConfirmationAction: "correct",
      });
    });

    await view.rerender(<ProfileScreen />);

    expect(
      view.getByText(
        "Your legal name has been saved successfully. Please verify your Government ID to confirm your identity and access document requests."
      )
    ).toBeTruthy();

    await fireEvent.press(view.getByText("Verify Government ID Now"));
    expect(mockPush).toHaveBeenCalledWith("/(app)/profile/id-verification");
  });

  it.each([true, false])("keeps Full Name read-only for database VERIFIED users (effective: %s) and saves unrelated profile info", async (effective) => {
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    mockProfile = {
      id: 30,
      firebaseUid: "uid-30",
      email: "verified@example.com",
      fullName: "Juan Santos Dela Cruz",
      firstName: "Juan",
      middleName: "Santos",
      lastName: "Dela Cruz",
      suffix: null,
      contactNumber: "09171112222",
      address: "Old Address",
      isGovernmentIdVerified: effective,
      governmentIdVerificationStatus: "VERIFIED",
      needsLegalNameConfirmation: false,
    };

    const view = await render(<EditProfileScreen />, { wrapper });

    expect(view.getByText("Full Name")).toBeTruthy();
    expect(view.getByText("Juan Santos Dela Cruz")).toBeTruthy();
    expect(
      view.getByText(
        "Your legal name is locked after Government ID verification."
      )
    ).toBeTruthy();
    expect(view.queryByLabelText("Full Name *")).toBeNull();

    await fireEvent.changeText(
      view.getByLabelText("Contact Number"),
      "09189990000"
    );
    await fireEvent.changeText(
      view.getByLabelText("Home / Residential Address"),
      "New Address"
    );
    await fireEvent.press(
      view.getByRole("button", { name: "Save profile changes" })
    );

    expect(mockUpdateProfile).toHaveBeenCalledWith({
      contactNumber: "09189990000",
      address: "New Address",
    });
  });

  it("shows a failed save without announcing confirmation success", async () => {
    mockProfile = { fullName: "Google Nickname", needsLegalNameConfirmation: true };
    mockUpdateProfile.mockRejectedValueOnce(new Error("Save failed"));
    const view = await render(<EditProfileScreen />, { wrapper });
    await fireEvent.press(view.getByText("No, I need to correct my name"));
    await fireEvent.changeText(view.getByLabelText("First Name *"), "Juan");
    await fireEvent.changeText(view.getByLabelText("Last Name *"), "Cruz");
    await fireEvent.press(view.getByText("Save Corrected Legal Name"));
    await waitFor(() => expect(view.getByText("Save failed")).toBeTruthy());
    expect(view.queryByText("Verify Government ID Now")).toBeNull();
  });

  it("confirms Option A using explicit components without guessing and offers verification", async () => {
    mockProfile = { fullName: "MARIA CLARA REYES JR.", needsLegalNameConfirmation: true };
    mockUpdateProfile.mockImplementation(async payload => {
      mockProfile = { ...mockProfile, ...payload, needsLegalNameConfirmation: false };
      return mockProfile;
    });
    const view = await render(<EditProfileScreen />, { wrapper });
    await fireEvent.press(view.getByText("Yes, this is my legal name"));
    expect(view.getByLabelText("First Name *").props.value).toBe("");
    await fireEvent.changeText(view.getByLabelText("First Name *"), "Maria");
    await fireEvent.changeText(view.getByLabelText("Middle Name (Optional)"), "Clara");
    await fireEvent.changeText(view.getByLabelText("Last Name *"), "Reyes");
    await fireEvent.changeText(view.getByLabelText("Suffix (Optional)"), "Jr.");
    await fireEvent.press(view.getByText("Confirm Legal Name"));
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith({
      firstName: "Maria", middleName: "Clara", lastName: "Reyes", suffix: "Jr.", legalNameConfirmationAction: "confirm",
    }));
    expect(view.getByText("Verify Government ID Now")).toBeTruthy();
  });

  it("does not submit an old full name in a contact-only save after the authenticated profile changes", async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    mockProfile = { fullName: "Google Nickname", contactNumber: "09171112222", address: "Address" };
    const view = await render(<EditProfileScreen />, { wrapper });
    mockProfile = { ...mockProfile, fullName: "Juan Cruz", firstName: "Juan", lastName: "Cruz" };
    await view.rerender(<EditProfileScreen />);
    expect(view.getByLabelText("Full Name *").props.value).toBe("Juan Cruz");
    await fireEvent.changeText(view.getByLabelText("Contact Number"), "09189990000");
    await fireEvent.press(view.getByRole("button", { name: "Save profile changes" }));
    expect(mockUpdateProfile).toHaveBeenCalledWith({ contactNumber: "09189990000", address: "Address" });
  });
});
