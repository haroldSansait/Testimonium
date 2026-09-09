export const scheduleKeys = {
  all: ["schedules"] as const,
  lists: (userId?: number | string | null, scope?: "upcoming" | "history") =>
    [...scheduleKeys.all, "list", userId ?? "anon", scope ?? "all"] as const,
  detail: (userId?: number | string | null, scheduleId?: number | string) =>
    [...scheduleKeys.all, "detail", userId ?? "anon", String(scheduleId ?? "")] as const,
  configuration: (parishId?: number | string | null) =>
    [...scheduleKeys.all, "configuration", String(parishId ?? "")] as const,
  availabilityDates: (parishId?: number | string | null, eventType?: string | null) =>
    [...scheduleKeys.all, "availability-dates", String(parishId ?? ""), eventType ?? ""] as const,
  availableSlots: (
    parishId?: number | string | null,
    date?: string | null,
    eventType?: string | null
  ) =>
    [
      ...scheduleKeys.all,
      "available-slots",
      String(parishId ?? ""),
      date ?? "",
      eventType ?? "",
    ] as const,
  eligiblePriests: (parishId?: number | string | null) =>
    [...scheduleKeys.all, "eligible-priests", String(parishId ?? "")] as const,
  recommendations: (
    parishId?: number | string | null,
    eventType?: string | null,
    preferredDate?: string | null,
    dateFrom?: string | null,
    dateTo?: string | null,
    preferredTimeSlot?: string | null,
    requestedPriestId?: number | string | null
  ) =>
    [
      ...scheduleKeys.all,
      "recommendations",
      String(parishId ?? ""),
      eventType ?? "",
      preferredDate ?? "",
      dateFrom ?? "",
      dateTo ?? "",
      preferredTimeSlot ?? "",
      String(requestedPriestId ?? ""),
    ] as const,
};
