import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HomeScreen } from "@/features/home/HomeScreen";
import EditProfileRoute from "../../app/(app)/profile/edit";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockUpdateProfile = jest.fn();

jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    canGoBack: () => true,
  }),
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

jest.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    profile: {
      fullName: "Maria Santos",
      email: "maria@example.com",
      contactNumber: null,
      address: null,
      needsProfileCompletion: true,
    },
    updateProfile: mockUpdateProfile,
    isUpdatingProfile: false,
    isRegistrationSession: false,
  }),
}));

jest.mock("@/features/requests/api", () => ({
  useRequestList: () => ({ data: { data: [] }, isFetching: false }),
}));

jest.mock("@/features/schedule/api", () => ({
  useScheduleList: () => ({ data: [], isFetching: false }),
}));

jest.mock("@/features/notifications/api", () => ({
  useUnreadNotificationCount: () => 0,
}));

jest.mock("@/features/events/components/EventBannerCarousel", () => ({
  EventBannerCarousel: () => null,
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

describe("Home profile completion navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateProfile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("pushes the existing Edit Profile route when Complete is pressed", async () => {
    const view = await render(<HomeScreen />, { wrapper });

    await fireEvent.press(view.getByRole("button", { name: "Complete" }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/(app)/profile/edit");
  });

  it("keeps the existing profile fields and Save Changes flow available at the destination", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const view = await render(<EditProfileRoute />, { wrapper });

    expect(view.getByText("Edit Profile")).toBeTruthy();
    expect(view.getByText("maria@example.com")).toBeTruthy();
    expect(view.getByLabelText("Full Name *").props.value).toBe("Maria Santos");
    await fireEvent.changeText(view.getByLabelText("Contact Number"), "09171234567");
    await fireEvent.changeText(view.getByLabelText("Home / Residential Address"), "San Carlos City");
    await fireEvent.press(view.getByRole("button", { name: "Save profile changes" }));

    expect(mockUpdateProfile).toHaveBeenCalledWith({
      fullName: "Maria Santos",
      contactNumber: "09171234567",
      address: "San Carlos City",
    });
    expect(alert).toHaveBeenCalledWith(
      "Profile Updated",
      expect.any(String),
      expect.any(Array)
    );
    await act(async () => alert.mock.calls[0][2]?.[0].onPress?.());
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("returns through navigation history when Edit Profile's back button is pressed", async () => {
    const view = await render(<EditProfileRoute />, { wrapper });

    await fireEvent.press(view.getByRole("button", { name: "Go back" }));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
