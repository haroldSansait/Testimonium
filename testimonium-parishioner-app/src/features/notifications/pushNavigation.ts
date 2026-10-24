import type { NotificationItem } from "./types";

export function pushNotificationId(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const value = (data as Record<string, unknown>).notificationId;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

// References come from the ownership-checked mark-read response, never the push.
export function notificationDestination(item: NotificationItem) {
  const id = item.referenceId;
  if (!Number.isSafeInteger(id) || Number(id) <= 0) return "/(app)/notifications";
  if (item.referenceType === "DOCUMENT_REQUEST") return `/(app)/requests/${id}`;
  if (item.referenceType === "SCHEDULE_REQUEST") return `/(app)/schedule/${id}`;
  return "/(app)/notifications";
}
