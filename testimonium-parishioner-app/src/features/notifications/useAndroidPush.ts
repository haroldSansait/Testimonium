import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { useRootNavigationState, useRouter } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { firebaseAuth } from "@/services/firebase";
import { apiClient } from "@/services/api/client";
import { isAppError } from "@/services/api/errors";
import { queryClient } from "@/services/queryClient";
import { markNotificationRead } from "./api";
import { notificationKeys } from "./queryKeys";
import { canPresentAndroidPush, getNativeNotifications, stopAndroidPush, synchronizeAndroidPush } from "./nativePush";
import { notificationDestination, pushNotificationId } from "./pushNavigation";

export function useAndroidPush(navigationAllowed = true) {
  const { user, state } = useAuth();
  const router = useRouter();
  const navigation = useRootNavigationState();
  const readyUid = navigationAllowed && state === "AUTHENTICATED_READY" ? user?.uid : undefined;
  const currentUid = useRef(readyUid);
  useEffect(() => { currentUid.current = readyUid; }, [readyUid]);
  const [pending, setPending] = useState<{ id: number; key: string } | null>(null);
  const [foreground, setForeground] = useState(0);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (Platform.OS !== "android") return;
    let disposed = false;
    const subscriptions: { remove(): void }[] = [];
    void getNativeNotifications().then(native => {
      if (disposed) return;
      native.setNotificationHandler({ handleNotification: async () => ({
        shouldShowBanner: canPresentAndroidPush(), shouldShowList: canPresentAndroidPush(),
        shouldPlaySound: canPresentAndroidPush(), shouldSetBadge: false,
      }) });
      const receiveTap = (response: import("expo-notifications").NotificationResponse) => {
        const request = response.notification.request;
        const trigger = request.trigger;
        const remote = trigger && "remoteMessage" in trigger ? trigger.remoteMessage?.data : undefined;
        const id = pushNotificationId(request.content.data) || pushNotificationId(remote);
        const key = `${id}:${response.actionIdentifier}`;
        if (id && !handled.current.has(key)) setPending({ id, key });
      };
      subscriptions.push(native.addNotificationResponseReceivedListener(receiveTap));
      subscriptions.push(native.addNotificationReceivedListener(() => {
        const uid = currentUid.current;
        if (uid) void queryClient.invalidateQueries({ queryKey: notificationKeys.list(uid) });
      }));
      subscriptions.push(native.addPushTokenListener(token => {
        const uid = currentUid.current;
        // Do not getDevicePushTokenAsync in this listener (it fires the listener).
        if (uid && typeof token.data === "string") void synchronizeAndroidPush(uid, token.data);
      }));
      void native.getLastNotificationResponseAsync().then(response => {
        if (!disposed && response) receiveTap(response);
      }).catch(() => undefined);
    }).catch(() => undefined);
    subscriptions.push(AppState.addEventListener("change", next => {
      if (next === "active") {
        setForeground(count => count + 1);
        const uid = currentUid.current;
        if (uid) void synchronizeAndroidPush(uid);
      }
    }));
    return () => { disposed = true; subscriptions.forEach(subscription => subscription.remove()); };
  }, []);

  useEffect(() => {
    if (readyUid) void synchronizeAndroidPush(readyUid);
    // BOOTING must retain the native token of a restored account. Session resets
    // revoke before sign-out through AuthProvider; unavailable accounts revoke here.
    else if (state === "SESSION_ERROR" || state === "NO_FIREBASE_USER") void stopAndroidPush();
  }, [readyUid, state]);

  useEffect(() => {
    if (!navigation?.key || !readyUid || !pending || handled.current.has(pending.key)) return;
    let cancelled = false;
    const isCurrent = () => !cancelled && currentUid.current === readyUid && firebaseAuth.currentUser?.uid === readyUid;
    void (async () => {
      let destination = "/(app)/notifications";
      try {
        const item = await markNotificationRead(pending.id);
        if (!isCurrent()) return;
        destination = notificationDestination(item);
        if (destination !== "/(app)/notifications") {
          const path = item.referenceType === "DOCUMENT_REQUEST"
            ? `/requests/${item.referenceId}` : `/schedule-requests/${item.referenceId}`;
          await apiClient.request({ path, auth: true });
        }
      } catch (error) {
        if (!isAppError(error) || ![403, 404].includes(error.status || 0)) return;
        destination = "/(app)/notifications";
      }
      if (!isCurrent()) return;
      handled.current.add(pending.key);
      setPending(null);
      void getNativeNotifications().then(native => native.clearLastNotificationResponseAsync()).catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list(readyUid) });
      void queryClient.invalidateQueries({ queryKey: ["requests", readyUid] });
      void queryClient.invalidateQueries({ queryKey: ["schedules"] });
      router.push(destination as Parameters<typeof router.push>[0]);
    })();
    return () => { cancelled = true; };
  }, [readyUid, pending, router, foreground, navigation?.key]);
}
