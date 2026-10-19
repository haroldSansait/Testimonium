import React from "react";
import { cleanup, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  getManilaDateKey,
  groupNotificationsByManilaDate,
  NotificationListScreen,
} from "@/features/notifications/NotificationListScreen";
import type { NotificationItem } from "@/features/notifications/types";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/features/notifications/api";

jest.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "notification-test" } }),
}));

jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("@/features/notifications/api", () => ({
  useNotifications: jest.fn(),
  useUnreadNotificationCount: jest.fn(),
  useMarkNotificationRead: jest.fn(),
  useMarkAllNotificationsRead: jest.fn(),
}));

const item = (
  id: number,
  title: string,
  timestamp: string,
  message = `${title} message`
): NotificationItem => ({
  id,
  userId: 9,
  title,
  message,
  type: "IN_APP",
  isRead: true,
  dateSent: timestamp,
  createdAt: timestamp,
  referenceType: "GENERAL",
});

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
};

describe("Notification Manila grouping recovery", () => {
  afterEach(async () => {
    await cleanup();
    jest.clearAllMocks();
  });

  it("groups timestamps immediately before and after Manila midnight", () => {
    const now = new Date("2026-09-16T00:05:00.000Z");
    const notifications = [
      item(1, "After midnight", "2026-09-15T16:01:00.000Z"),
      item(2, "Before midnight", "2026-09-15T15:59:00.000Z"),
      item(3, "Older", "2026-09-14T15:59:00.000Z"),
    ];

    const groups = groupNotificationsByManilaDate(notifications, now);

    expect(groups.map((group) => group.title)).toEqual([
      "Today",
      "Yesterday",
      "Earlier",
    ]);
    expect(groups[0].data.map(({ id }) => id)).toEqual([1]);
    expect(groups[1].data.map(({ id }) => id)).toEqual([2]);
    expect(groups[2].data.map(({ id }) => id)).toEqual([3]);
  });

  it("uses Asia/Manila rather than the runtime calendar date", () => {
    const timestamp = new Date("2026-09-15T16:01:00.000Z");

    expect(timestamp.toISOString().slice(0, 10)).toBe("2026-09-15");
    expect(getManilaDateKey(timestamp)).toBe("2026-09-16");
  });

  it("allows two title lines and four message lines for long content", async () => {
    const longTitle =
      "A detailed notification title that needs enough room to remain meaningful";
    const longMessage =
      "This notification contains a longer explanation about a parishioner request, its current status, and the next action the parishioner should take.";
    const notification = item(
      4,
      longTitle,
      "2026-09-15T16:01:00.000Z",
      longMessage
    );

    (useNotifications as jest.Mock).mockReturnValue({
      data: [notification],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: jest.fn(),
    });
    (useUnreadNotificationCount as jest.Mock).mockReturnValue(0);
    (useMarkNotificationRead as jest.Mock).mockReturnValue({ mutate: jest.fn() });
    (useMarkAllNotificationsRead as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });

    const view = await render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <NotificationListScreen />
      </SafeAreaProvider>
    );

    expect(view.getByText(longTitle).props.numberOfLines).toBe(2);
    expect(view.getByText(longMessage).props.numberOfLines).toBe(4);
  });
});
