import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { apiClient } from "@/services/api/client";
import { firebaseAuth } from "@/services/firebase";
import { stopAndroidPush, synchronizeAndroidPush } from "@/features/notifications/nativePush";
import { notificationDestination, pushNotificationId } from "@/features/notifications/pushNavigation";
import type { NotificationItem } from "@/features/notifications/types";

jest.mock("@/services/api/client", () => ({ apiClient: { request: jest.fn() } }));
jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 }, AndroidNotificationVisibility: { PRIVATE: 0 },
  setNotificationChannelAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(async () => ({ type: "android", data: "native-fcm-token-a" })),
  unregisterForNotificationsAsync: jest.fn(async () => {}),
  dismissAllNotificationsAsync: jest.fn(async () => {}),
}));

const granted = { status: "granted", granted: true, canAskAgain: true };
const currentUser = (uid: string | null) => {
  Object.defineProperty(firebaseAuth, "currentUser", { configurable: true, writable: true, value: uid ? { uid } : null });
};
beforeEach(async () => {
  jest.replaceProperty(Platform, "OS", "android");
  currentUser(null);
  await stopAndroidPush();
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.mocked(Notifications.unregisterForNotificationsAsync).mockResolvedValue(undefined);
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(granted as never);
  jest.mocked(apiClient.request).mockResolvedValue(undefined);
  currentUser("account-a");
});
afterEach(async () => {
  await stopAndroidPush();
  jest.restoreAllMocks();
});

test("permission grant registers a native Android token through authenticated API", async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: "undetermined", granted: false, canAskAgain: true } as never);
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(granted as never);
  await synchronizeAndroidPush("account-a");
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith("testimonium-important", expect.objectContaining({ importance: 4 }));
  expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
    path: "/notifications/devices", method: "POST", auth: true,
    body: expect.objectContaining({ token: "native-fcm-token-a", platform: "android" }),
  }));
});

test("previous denial does not reprompt or register and does not reject login", async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: "denied", granted: false, canAskAgain: false } as never);
  await expect(synchronizeAndroidPush("account-a")).resolves.toBeUndefined();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
  expect(apiClient.request).not.toHaveBeenCalled();
});

test("token rotation sends the replacement and old owned token without another native token lookup", async () => {
  await synchronizeAndroidPush("account-a");
  jest.clearAllMocks();
  await synchronizeAndroidPush("account-a", "native-fcm-token-b");
  expect(Notifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
  expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
    body: { token: "native-fcm-token-b", platform: "android", previousToken: "native-fcm-token-a" },
  }));
});

test("logout revokes natively and dismisses alerts even if server unregister is offline", async () => {
  await synchronizeAndroidPush("account-a");
  jest.mocked(apiClient.request).mockRejectedValue(new Error("offline"));
  await stopAndroidPush();
  expect(Notifications.unregisterForNotificationsAsync).toHaveBeenCalled();
  expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalled();
  expect(await AsyncStorage.getItem("testimonium.androidPush.registration")).toBeNull();
});

test("failed native revocation blocks push registration for the next account until it succeeds", async () => {
  await synchronizeAndroidPush("account-a");
  jest.mocked(Notifications.unregisterForNotificationsAsync).mockRejectedValue(new Error("offline native revoke"));
  await stopAndroidPush();
  currentUser("account-b");
  jest.mocked(apiClient.request).mockClear();
  await synchronizeAndroidPush("account-b");
  expect(apiClient.request).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem("testimonium.androidPush.mustRevoke")).toBe("true");
  jest.mocked(Notifications.unregisterForNotificationsAsync).mockResolvedValue(undefined);
  await synchronizeAndroidPush("account-b");
  expect(apiClient.request).toHaveBeenCalledTimes(1);
});

test("stale token completion after logout cannot register an old account", async () => {
  let resolveToken!: (value: never) => void;
  jest.mocked(Notifications.getDevicePushTokenAsync).mockImplementationOnce(() => new Promise(resolve => { resolveToken = resolve; }));
  const registration = synchronizeAndroidPush("account-a");
  await waitFor(() => expect(resolveToken).toBeDefined());
  const stopping = stopAndroidPush();
  currentUser(null);
  resolveToken({ data: "stale-token" } as never);
  await Promise.all([registration, stopping]);
  expect(apiClient.request).not.toHaveBeenCalled();
});

test("direct account switch revokes the previous native registration before registering the next", async () => {
  await synchronizeAndroidPush("account-a");
  jest.clearAllMocks();
  currentUser("account-b");
  jest.mocked(Notifications.getDevicePushTokenAsync).mockResolvedValueOnce({ type: "android", data: "native-fcm-token-b" });
  await synchronizeAndroidPush("account-b");
  expect(Notifications.unregisterForNotificationsAsync).toHaveBeenCalledTimes(1);
  expect(apiClient.request).toHaveBeenCalledTimes(1);
  expect(jest.mocked(Notifications.unregisterForNotificationsAsync).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(apiClient.request).mock.invocationCallOrder[0]);
  expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
    body: { platform: "android", token: "native-fcm-token-b", previousToken: undefined },
  }));
});

test("push parsing rejects arbitrary URLs/invalid identifiers; destinations use saved references", () => {
  expect(pushNotificationId({ notificationId: "101", url: "https://untrusted.test" })).toBe(101);
  for (const value of [null, {}, { notificationId: "../1" }, { notificationId: "0" }, { notificationId: 1 }, { notificationId: "9007199254740993" }]) {
    expect(pushNotificationId(value)).toBeNull();
  }
  expect(notificationDestination({ referenceType: "DOCUMENT_REQUEST", referenceId: 33 } as NotificationItem)).toBe("/(app)/requests/33");
  expect(notificationDestination({ referenceType: "SCHEDULE_REQUEST", referenceId: 7 } as NotificationItem)).toBe("/(app)/schedule/7");
  expect(notificationDestination({ referenceType: "GENERAL", referenceId: 9 } as NotificationItem)).toBe("/(app)/notifications");
  expect(notificationDestination({ referenceType: "DOCUMENT_REQUEST", referenceId: -1 } as NotificationItem)).toBe("/(app)/notifications");
});
