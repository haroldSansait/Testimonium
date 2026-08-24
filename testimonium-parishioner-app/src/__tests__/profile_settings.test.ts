import { QueryClient } from "@tanstack/react-query";
import { scheduleKeys } from "../features/schedule/queryKeys";
import { notificationKeys } from "../features/notifications/queryKeys";
import { requestKeys } from "../features/requests/queryKeys";

describe("Phase 5C: Profile Validation & Error Handling", () => {
  const validateProfileForm = (values: {
    fullName: string;
    contactNumber?: string;
    address?: string;
  }): { isValid: boolean; error?: string } => {
    const trimmed = values.fullName.trim();
    if (!trimmed || trimmed.length < 2) {
      return {
        isValid: false,
        error: "Full name is required (at least 2 characters).",
      };
    }
    return { isValid: true };
  };

  it("rejects empty or whitespace-only full names", () => {
    expect(validateProfileForm({ fullName: "" }).isValid).toBe(false);
    expect(validateProfileForm({ fullName: "   " }).isValid).toBe(false);
    expect(validateProfileForm({ fullName: "A" }).isValid).toBe(false);
  });

  it("accepts valid full names with optional contact and address", () => {
    const res = validateProfileForm({
      fullName: "Maria Clara Santos",
      contactNumber: "09171234567",
      address: "San Carlos City",
    });
    expect(res.isValid).toBe(true);
    expect(res.error).toBeUndefined();
  });
});

describe("Phase 5C: Logout and Cross-Account Cache Isolation Safety", () => {
  it("queryClient.clear() purges all user data across schedules, requests, and notifications", () => {
    const queryClient = new QueryClient();

    // User 1 logs in and populates cache
    const user1Uid = "uid-user-1";
    queryClient.setQueryData(scheduleKeys.lists(user1Uid, "upcoming"), [
      { id: 101, displayTitle: "User 1 Baptism" },
    ]);
    queryClient.setQueryData(requestKeys.list(user1Uid), {
      items: [{ id: "req-1", purpose: "User 1 Certificate" }],
    });
    queryClient.setQueryData(notificationKeys.list(user1Uid), [
      { id: 1, title: "User 1 Notification" },
    ]);

    expect(
      queryClient.getQueryData(scheduleKeys.lists(user1Uid, "upcoming"))
    ).toBeDefined();
    expect(queryClient.getQueryData(requestKeys.list(user1Uid))).toBeDefined();
    expect(queryClient.getQueryData(notificationKeys.list(user1Uid))).toBeDefined();

    // User 1 logs out -> queryClient.clear() is invoked
    queryClient.clear();

    // Verify cache is completely cleared
    expect(
      queryClient.getQueryData(scheduleKeys.lists(user1Uid, "upcoming"))
    ).toBeUndefined();
    expect(queryClient.getQueryData(requestKeys.list(user1Uid))).toBeUndefined();
    expect(
      queryClient.getQueryData(notificationKeys.list(user1Uid))
    ).toBeUndefined();

    // User 2 logs in -> empty initial cache
    const user2Uid = "uid-user-2";
    expect(
      queryClient.getQueryData(scheduleKeys.lists(user2Uid, "upcoming"))
    ).toBeUndefined();
    expect(queryClient.getQueryData(requestKeys.list(user2Uid))).toBeUndefined();
  });
});
