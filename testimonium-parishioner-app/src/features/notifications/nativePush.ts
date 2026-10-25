import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { apiClient } from "@/services/api/client";
import { firebaseAuth } from "@/services/firebase";

export const PUSH_CHANNEL = "testimonium-important";
const registrationKey = "testimonium.androidPush.registration";
const revocationKey = "testimonium.androidPush.mustRevoke";
type Registration = { uid: string; token: string };
let activeUid: string | null = null;
let serial: Promise<unknown> = Promise.resolve();
// Load only on Android so auth/bootstrap remains usable on other platforms and
// in builds that have not yet included the new native module.
export const getNativeNotifications = async (): Promise<typeof import("expo-notifications")> => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-notifications");
};
const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = serial.then(operation, operation);
  serial = result.catch(() => undefined);
  return result;
};
const readRegistration = async (): Promise<Registration | null> => {
  const value = await AsyncStorage.getItem(registrationKey);
  try { return value ? JSON.parse(value) : null; } catch { return null; }
};

async function revokeNativeRegistration() {
  const native = await getNativeNotifications();
  // Persist first. A failed native revocation prevents registration for another
  // account even after a restart; API failure alone is safe once FCM revokes it.
  await AsyncStorage.setItem(revocationKey, "true");
  const prior = await readRegistration();
  // Try the backend independently: a native-provider outage must not prevent
  // removal of ownership when our API is still reachable.
  if (prior && firebaseAuth.currentUser?.uid === prior.uid) {
    try {
      await apiClient.request({ path: "/notifications/devices", method: "DELETE",
        auth: true, body: { token: prior.token }, timeoutMs: 3000 });
    } catch { /* Still attempt native revocation when the server is unreachable. */ }
  }
  await native.unregisterForNotificationsAsync();
  await native.dismissAllNotificationsAsync();
  await AsyncStorage.removeItem(registrationKey);
  await AsyncStorage.removeItem(revocationKey);
}

// Called before Firebase sign-out/local session invalidation. Synchronously gate
// foreground presentation and cancel stale registration completions.
export function stopAndroidPush(): Promise<void> {
  activeUid = null;
  if (Platform.OS !== "android") return Promise.resolve();
  return enqueue(revokeNativeRegistration).catch(() => undefined);
}

export function synchronizeAndroidPush(uid: string, rotatedToken?: string): Promise<void> {
  if (Platform.OS !== "android") return Promise.resolve();
  activeUid = uid;
  return enqueue(async () => {
    const isCurrent = () => activeUid === uid && firebaseAuth.currentUser?.uid === uid;
    if (!isCurrent()) return;
    const native = await getNativeNotifications();
    const prior = await readRegistration();
    if (await AsyncStorage.getItem(revocationKey) || (prior && prior.uid !== uid)) {
      await revokeNativeRegistration();
    }
    if (!isCurrent()) return;
    await native.setNotificationChannelAsync(PUSH_CHANNEL, {
      name: "Important TESTIMONIUM updates", importance: native.AndroidImportance.HIGH,
      lockscreenVisibility: native.AndroidNotificationVisibility.PRIVATE,
    });
    let permission = await native.getPermissionsAsync();
    if (permission.status === "undetermined" && permission.canAskAgain) {
      permission = await native.requestPermissionsAsync();
    }
    if (!permission.granted) {
      if (prior) await revokeNativeRegistration();
      return;
    }
    if (!isCurrent()) return;
    const token = rotatedToken || (await native.getDevicePushTokenAsync()).data;
    if (typeof token !== "string" || !isCurrent()) return;
    // Remember ambiguous network results as well as successful registrations.
    await AsyncStorage.setItem(registrationKey, JSON.stringify({ uid, token }));
    if (!isCurrent()) { await revokeNativeRegistration(); return; }
    await apiClient.request({ path: "/notifications/devices", method: "POST", auth: true,
      body: { platform: "android", token, previousToken: prior?.uid === uid ? prior.token : undefined },
      timeoutMs: 8000 });
    if (!isCurrent()) await revokeNativeRegistration();
  }).catch(() => { /* Push availability must never affect authentication. */ });
}

export function canPresentAndroidPush() {
  return Boolean(activeUid && firebaseAuth.currentUser?.uid === activeUid);
}
