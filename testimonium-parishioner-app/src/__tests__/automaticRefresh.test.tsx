import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useForegroundRefresh, useScreenRefresh, useManualRefresh } from "@/hooks/useAutomaticRefresh";
import { useRequestList, useRequestDetail } from "@/features/requests/api";
import { useScheduleList, useScheduleDetail } from "@/features/schedule/api";
import { useNotifications, useUnreadNotificationCount, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/features/notifications/api";
import { apiClient } from "@/services/api/client";
import { notificationKeys } from "@/features/notifications/queryKeys";

let mockUid: string | undefined = "account-a";
let mockFocused = true;
jest.mock("@/providers/AuthProvider", () => ({ useAuth: () => ({ user: mockUid ? { uid: mockUid } : null }) }));
jest.mock("@/services/api/client", () => ({ apiClient: { request: jest.fn() } }));
jest.mock("expo-router", () => ({
  useIsFocused: () => mockFocused,
}));

const request = jest.mocked(apiClient.request);
let client: QueryClient;
let listeners: Set<(state: AppStateStatus) => void>;
let status = "PENDING";
let fail = false;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const flush = async () => { await act(async () => { await jest.advanceTimersByTimeAsync(1); }); };
const advance = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };
const changeState = async (state: AppStateStatus) => {
  await act(async () => {
    Object.defineProperty(AppState, "currentState", { configurable: true, value: state });
    listeners.forEach((listener) => listener(state));
  });
  await flush();
};

beforeEach(() => {
  jest.useFakeTimers();
  mockUid = "account-a";
  mockFocused = true;
  status = "PENDING";
  fail = false;
  listeners = new Set();
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" });
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
    listeners.add(listener);
    return { remove: () => { listeners.delete(listener); } };
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  request.mockReset().mockImplementation(async ({ path }) => {
    if (fail) throw new Error("Offline");
    if (path === "/notifications") return [{ id: 1, isRead: status === "READ" }];
    if (path.endsWith("/read") || path.endsWith("read-all")) return {};
    if (path.startsWith("/requests?" ) || path === "/requests") return { data: [{ id: 1, status }] };
    if (path.startsWith("/schedule-requests?")) return [{ id: 1, status }];
    return { id: 1, status, statusHistory: [status] };
  });
});
afterEach(() => {
  client.clear();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it.each(["documents", "schedules"])("polls %s lists and details, preserves data on errors, and pauses hidden/background screens", async (resource) => {
  const view = await renderHook(() => {
    const options = useScreenRefresh();
    // Exercise the actual API hooks, shared cache and AbortSignal-aware query functions.
    const documents = useRequestList({}, { ...options, enabled: options.enabled && resource === "documents" });
    const document = useRequestDetail(1, { ...options, enabled: options.enabled && resource === "documents" });
    const schedules = useScheduleList("upcoming", { ...options, enabled: options.enabled && resource === "schedules" });
    const schedule = useScheduleDetail(1, { ...options, enabled: options.enabled && resource === "schedules" });
    return resource === "documents" ? { list: documents, detail: document } : { list: schedules, detail: schedule };
  }, { wrapper });
  await flush();
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal);
  status = "COMPLETED";
  await advance(10_000);
  await flush();
  expect(request).toHaveBeenCalledTimes(4);
  expect(view.result.current.detail.data?.status).toBe("COMPLETED");
  expect(JSON.stringify(view.result.current.list.data)).toContain("COMPLETED");
  fail = true;
  await advance(10_000);
  await flush();
  expect(view.result.current.detail.data?.status).toBe("COMPLETED");
  expect(view.result.current.detail.isLoading).toBe(false);
  fail = false;
  mockFocused = false;
  await view.rerender({});
  const hiddenCalls = request.mock.calls.length;
  await advance(30_000);
  expect(request).toHaveBeenCalledTimes(hiddenCalls);
  mockFocused = true;
  await view.rerender({});
  await flush();
  expect(request).toHaveBeenCalledTimes(hiddenCalls + 2);
  await changeState("background");
  const backgroundCalls = request.mock.calls.length;
  await advance(30_000);
  expect(request).toHaveBeenCalledTimes(backgroundCalls);
  status = "CANCELLED";
  await changeState("active");
  expect(request).toHaveBeenCalledTimes(backgroundCalls + 2);
  expect(view.result.current.detail.data?.status).toBe("CANCELLED");
  await view.unmount();
  expect(listeners.size).toBe(0);
});

it("uses one notification poller for multiple subscribers, resumes, and isolates accounts/logout", async () => {
  const view = await renderHook(() => {
    const owner = useNotifications(useForegroundRefresh(30_000));
    const list = useNotifications();
    const homeCount = useUnreadNotificationCount();
    const tabCount = useUnreadNotificationCount();
    return { owner, list, homeCount, tabCount };
  }, { wrapper });
  await flush();
  expect(request).toHaveBeenCalledTimes(1);
  status = "READ";
  await advance(30_000);
  await flush();
  expect(request).toHaveBeenCalledTimes(2);
  expect(view.result.current.homeCount).toBe(0);
  expect(view.result.current.tabCount).toBe(0);
  expect(view.result.current.list.data?.[0].isRead).toBe(true);
  await changeState("inactive");
  await advance(60_000);
  expect(request).toHaveBeenCalledTimes(2);
  await changeState("active");
  expect(request).toHaveBeenCalledTimes(3);
  mockUid = "account-b";
  status = "PENDING";
  await view.rerender({});
  await flush();
  expect(request).toHaveBeenCalledTimes(4);
  expect(view.result.current.homeCount).toBe(1);
  expect(client.getQueryData(notificationKeys.list("account-a"))).toEqual([{ id: 1, isRead: true }]);
  // AuthProvider cancels and clears queries before completing logout.
  mockUid = undefined;
  await act(async () => { await client.cancelQueries(); client.clear(); });
  await view.rerender({});
  await advance(60_000);
  expect(request).toHaveBeenCalledTimes(4);
  expect(view.result.current.homeCount).toBe(0);
});

it("keeps polling silent and manual refresh functional, including read-action cache updates", async () => {
  const view = await renderHook(() => {
    const query = useNotifications(useForegroundRefresh(30_000));
    const manual = useManualRefresh(() => query.refetch({ cancelRefetch: false }));
    const read = useMarkNotificationRead();
    const readAll = useMarkAllNotificationsRead();
    const count = useUnreadNotificationCount();
    return { query, manual, read, readAll, count };
  }, { wrapper });
  await flush();
  await advance(30_000);
  expect(view.result.current.manual.refreshing).toBe(false);
  await act(async () => { await view.result.current.manual.onRefresh(); });
  expect(request).toHaveBeenCalledTimes(3);
  status = "READ";
  await act(async () => { await view.result.current.read.mutateAsync(1); });
  await flush();
  expect(view.result.current.count).toBe(0);
  await act(async () => { await view.result.current.readAll.mutateAsync(); });
  await flush();
  expect(view.result.current.count).toBe(0);
});

it("shares a slow request across polling, notification-screen focus, resume, and manual refresh", async () => {
  let finish!: (value: unknown) => void;
  request.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const view = await renderHook(() => {
    useNotifications(useForegroundRefresh(30_000));
    const screen = useNotifications(useScreenRefresh(false));
    const manual = useManualRefresh(() => screen.refetch({ cancelRefetch: false }));
    return { screen, manual };
  }, { wrapper });
  await flush();
  expect(request).toHaveBeenCalledTimes(1);
  await advance(60_000);
  mockFocused = false;
  await view.rerender({});
  mockFocused = true;
  await view.rerender({});
  await changeState("background");
  await changeState("active");
  expect(request).toHaveBeenCalledTimes(1);
  expect(view.result.current.manual.refreshing).toBe(false);
  let manualDone!: Promise<void>;
  await act(async () => { manualDone = view.result.current.manual.onRefresh(); });
  expect(view.result.current.manual.refreshing).toBe(true);
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => { finish([{ id: 1, isRead: false }]); await manualDone; });
  await flush();
  expect(view.result.current.manual.refreshing).toBe(false);
  expect(view.result.current.screen.data?.[0].id).toBe(1);
});

it("revalidates notifications promptly when an already-mounted screen becomes focused", async () => {
  mockFocused = false;
  const view = await renderHook(() => {
    useNotifications(useForegroundRefresh(30_000));
    return useNotifications(useScreenRefresh(false));
  }, { wrapper });
  await flush();
  expect(request).toHaveBeenCalledTimes(1);
  status = "READ";
  mockFocused = true;
  await view.rerender({});
  await flush();
  expect(request).toHaveBeenCalledTimes(2);
  expect(view.result.current.data?.[0].isRead).toBe(true);
});
