import React from "react";
import { Alert } from "react-native";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SettingsScreen } from "@/features/profile/SettingsScreen";
import { useAuth } from "@/providers/AuthProvider";
import { authApi } from "@/services/api/endpoints/auth";
import { apiClient } from "@/services/api/client";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    canGoBack: () => true,
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("@/providers/AuthProvider", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/services/api/client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
};

const profile = (emailNotificationsEnabled: boolean) => ({
  id: 7,
  firebaseUid: "uid-7",
  email: "parishioner@example.com",
  fullName: "Maria Parishioner",
  isVerified: true,
  emailVerified: true,
  termsAccepted: true,
  privacyAccepted: true,
  needsProfileCompletion: false,
  emailNotificationsEnabled,
  status: "ACTIVE",
  role: "PARISHIONER",
});

let authState: {
  profile: ReturnType<typeof profile>;
  logout: jest.Mock;
  refreshProfile: jest.Mock;
  updateProfile: jest.Mock;
};

const renderSettings = () =>
  render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <SettingsScreen />
    </SafeAreaProvider>
  );

describe("Settings recovery regressions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    authState = {
      profile: profile(false),
      logout: jest.fn().mockResolvedValue(undefined),
      refreshProfile: jest.fn().mockResolvedValue(profile(false)),
      updateProfile: jest.fn(),
    };
    (useAuth as jest.Mock).mockImplementation(() => authState);
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  it("reads the email preference from profile, updates optimistically, and persists on remount", async () => {
    let resolveUpdate!: (value: ReturnType<typeof profile>) => void;
    authState.updateProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );

    const view = await renderSettings();
    expect(view.getByLabelText("Email notifications").props.value).toBe(false);

    fireEvent(
      view.getByLabelText("Email notifications"),
      "onValueChange",
      true
    );

    await waitFor(() => {
      expect(view.getByLabelText("Email notifications").props.value).toBe(true);
    });
    expect(authState.updateProfile).toHaveBeenCalledWith({
      emailNotificationsEnabled: true,
    });

    authState.profile = profile(true);
    await act(async () => {
      resolveUpdate(authState.profile);
    });
    await view.rerender(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <SettingsScreen />
      </SafeAreaProvider>
    );
    expect(view.getByLabelText("Email notifications").props.value).toBe(true);

  });

  it("shows the persisted profile value on a fresh mount", async () => {
    authState.profile = profile(true);

    const view = await renderSettings();

    expect(view.getByLabelText("Email notifications").props.value).toBe(true);
  });

  it("rolls back and refetches the authoritative preference when saving fails", async () => {
    authState.profile = profile(true);
    let rejectUpdate!: (reason: Error) => void;
    authState.updateProfile.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectUpdate = reject;
      })
    );
    authState.refreshProfile.mockResolvedValue(profile(true));

    const view = await renderSettings();
    fireEvent(
      view.getByLabelText("Email notifications"),
      "onValueChange",
      false
    );
    await waitFor(() => {
      expect(view.getByLabelText("Email notifications").props.value).toBe(false);
    });

    await act(async () => {
      rejectUpdate(new Error("Save failed"));
    });

    await waitFor(() => {
      expect(authState.refreshProfile).toHaveBeenCalledTimes(1);
      expect(view.getByLabelText("Email notifications").props.value).toBe(true);
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      "Preference Not Saved",
      "Save failed"
    );
  });

  it("launches the Settings replay action in preview mode", async () => {
    const view = await renderSettings();
    fireEvent.press(view.getByText("Replay Welcome Tour"));

    const replayAlert = (Alert.alert as jest.Mock).mock.calls.find(
      ([title]) => title === "Replay Welcome Tour"
    );
    expect(replayAlert).toBeDefined();
    replayAlert?.[2]?.[1]?.onPress?.();

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(product-onboarding)",
      params: { preview: "true" },
    });
  });

  it("uses the existing PUT /auth/profile API for the preference", async () => {
    (apiClient.request as jest.Mock).mockResolvedValue(profile(true));

    await authApi.updateProfile({ emailNotificationsEnabled: true });

    expect(apiClient.request).toHaveBeenCalledWith({
      method: "PUT",
      path: "/auth/profile",
      body: { emailNotificationsEnabled: true },
    });
  });
});
