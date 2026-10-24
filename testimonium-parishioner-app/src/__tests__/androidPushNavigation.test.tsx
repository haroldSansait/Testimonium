import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { useAndroidPush } from "@/features/notifications/useAndroidPush";
import { markNotificationRead } from "@/features/notifications/api";
import { useAuth } from "@/providers/AuthProvider";
import { firebaseAuth } from "@/services/firebase";
import { apiClient } from "@/services/api/client";
import { AppError } from "@/services/api/errors";
import { Platform } from "react-native";
import type { NotificationItem } from "@/features/notifications/types";
import { useRootNavigationState } from "expo-router";

const mockPush = jest.fn();
const mockRouter = { push: mockPush };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter, useRootNavigationState: jest.fn(() => ({ key: "root" })) }));
jest.mock("@/providers/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("@/features/notifications/api", () => ({ markNotificationRead: jest.fn() }));
jest.mock("@/services/api/client", () => ({ apiClient: { request: jest.fn() } }));
jest.mock("@/services/queryClient", () => ({ queryClient: { invalidateQueries: jest.fn(async () => {}) } }));
jest.mock("@/features/notifications/nativePush", () => ({
  synchronizeAndroidPush: jest.fn(async () => {}), stopAndroidPush: jest.fn(async () => {}),
  canPresentAndroidPush: jest.fn(() => true),
  getNativeNotifications: async () => jest.requireMock("expo-notifications"),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(),
}));

const setAuth = (ready: boolean) => {
  jest.mocked(useAuth).mockReturnValue({ state: ready ? "AUTHENTICATED_READY" : "NO_FIREBASE_USER", user: ready ? { uid: "account-a" } : null } as ReturnType<typeof useAuth>);
  Object.defineProperty(firebaseAuth, "currentUser", { configurable: true, writable: true, value: ready ? { uid: "account-a" } : null });
};
const tap = (id = "101", remote = false) => ({
  actionIdentifier: "default",
  notification: { request: { identifier: `push-${id}`,
    content: { data: remote ? {} : { notificationId: id, referenceId: "999", referenceType: "GENERAL", url: "/forged" } },
    trigger: remote ? { type: "push", remoteMessage: { data: { notificationId: id } } } : null,
  } },
} as unknown as Notifications.NotificationResponse);

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, "OS", "android");
  jest.mocked(useRootNavigationState).mockReturnValue({ key: "root" } as ReturnType<typeof useRootNavigationState>);
  setAuth(true);
  jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(null);
  jest.mocked(markNotificationRead).mockResolvedValue({ id: 101, referenceType: "DOCUMENT_REQUEST", referenceId: 33 } as NotificationItem);
  jest.mocked(apiClient.request).mockResolvedValue({});
});
afterEach(() => jest.restoreAllMocks());

test.each([false, true])("running/background tap uses ownership-checked saved reference (remote payload %s)", async remote => {
  await renderHook(() => useAndroidPush());
  await waitFor(() => expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled());
  const receive = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls[0][0];
  await act(async () => receive(tap("101", remote)));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/(app)/requests/33"));
  expect(markNotificationRead).toHaveBeenCalledWith(101);
  expect(apiClient.request).toHaveBeenCalledWith({ path: "/requests/33", auth: true });
  await act(async () => receive(tap("101", remote)));
  expect(mockPush).toHaveBeenCalledTimes(1);
});

test("cold-start tap waits for authenticated bootstrap and then opens the existing schedule", async () => {
  setAuth(false);
  jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(tap());
  jest.mocked(markNotificationRead).mockResolvedValue({ id: 101, referenceType: "SCHEDULE_REQUEST", referenceId: 7 } as NotificationItem);
  const view = await renderHook(() => useAndroidPush());
  await waitFor(() => expect(Notifications.getLastNotificationResponseAsync).toHaveBeenCalled());
  expect(markNotificationRead).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  setAuth(true);
  await view.rerender({});
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/(app)/schedule/7"));
});

test.each(["foreignNotification", "deletedResource"])("%s safely falls back to Notification Center", async scenario => {
  if (scenario === "foreignNotification") jest.mocked(markNotificationRead).mockRejectedValueOnce(new AppError({ kind: "NOT_FOUND", status: 404, message: "Unavailable" }));
  else jest.mocked(apiClient.request).mockRejectedValueOnce(new AppError({ kind: "NOT_FOUND", status: 404, message: "Unavailable" }));
  jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(tap());
  await renderHook(() => useAndroidPush());
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/(app)/notifications"));
});

test("logout during ownership check prevents protected navigation", async () => {
  let resolveRead!: (item: NotificationItem) => void;
  jest.mocked(markNotificationRead).mockImplementationOnce(() => new Promise(resolve => { resolveRead = resolve; }));
  jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(tap());
  const view = await renderHook(() => useAndroidPush());
  await waitFor(() => expect(markNotificationRead).toHaveBeenCalled());
  setAuth(false);
  await view.rerender({});
  await act(async () => resolveRead({ id: 101, referenceType: "DOCUMENT_REQUEST", referenceId: 33 } as NotificationItem));
  expect(mockPush).not.toHaveBeenCalled();
});

test("foreground presentation uses native handler without scheduling a duplicate", async () => {
  await renderHook(() => useAndroidPush());
  await waitFor(() => expect(Notifications.setNotificationHandler).toHaveBeenCalled());
  const handler = jest.mocked(Notifications.setNotificationHandler).mock.calls[0][0];
  expect(await handler?.handleNotification({} as Notifications.Notification)).toMatchObject({ shouldShowBanner: true, shouldShowList: true });
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test("pending tap waits for the intro guard and a mounted root navigator", async () => {
  jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(tap());
  jest.mocked(useRootNavigationState).mockReturnValue(undefined as unknown as ReturnType<typeof useRootNavigationState>);
  const view = await renderHook(({ allowed }: { allowed: boolean }) => useAndroidPush(allowed), { initialProps: { allowed: false } });
  await waitFor(() => expect(Notifications.getLastNotificationResponseAsync).toHaveBeenCalled());
  expect(markNotificationRead).not.toHaveBeenCalled();
  await view.rerender({ allowed: true });
  expect(markNotificationRead).not.toHaveBeenCalled();
  jest.mocked(useRootNavigationState).mockReturnValue({ key: "root" } as ReturnType<typeof useRootNavigationState>);
  await view.rerender({ allowed: true });
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/(app)/requests/33"));
});
