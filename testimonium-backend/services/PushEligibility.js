// Server-authored event metadata only. Unknown events fail closed; never inspect copy.
const documentStatuses = [
  "PAYMENT_PENDING", "PAYMENT_VERIFIED", "NEEDS_CORRECTION",
  "PAYMENT_NEEDS_CORRECTION", "READY_FOR_PICKUP", "COMPLETED", "CANCELLED", "REJECTED",
];
const scheduleStatuses = [
  "CONFIRMED", "DECLINED", "REJECTED", "CANCELLED",
  "PROPOSED_RESCHEDULE", "WAITING_PARISHIONER_RESPONSE",
];
export const ANDROID_PUSH_EVENTS = Object.freeze([
  ...documentStatuses.map(status => `DOCUMENT:${status}`),
  ...scheduleStatuses.map(status => `SCHEDULE:${status}`),
  "PAYMENT:QUALITY_FAILED", "SCHEDULE:EMERGENCY_RESCHEDULE",
  "ALTERNATIVE:DECLINED", "ALTERNATIVE:APPLIED",
]);
const allowed = new Set(ANDROID_PUSH_EVENTS);
export function isAndroidPushEligible(notification) {
  if (notification?.type !== "IN_APP" || !allowed.has(notification.pushEvent)) return false;
  const document = notification.pushEvent.startsWith("DOCUMENT:") || notification.pushEvent.startsWith("PAYMENT:");
  return notification.referenceType === (document ? "DOCUMENT_REQUEST" : "SCHEDULE_REQUEST");
}
