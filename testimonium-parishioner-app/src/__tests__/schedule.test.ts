import {
  CANONICAL_SCHEDULE_EVENT_TYPES,
  SCHEDULE_EVENT_LABELS,
  getScheduleEventLabel,
} from "../features/schedule/types";
import { scheduleKeys } from "../features/schedule/queryKeys";
import {
  extractTimeSlotFromSchedule,
  formatScheduleDate,
  getScheduleStatusBadge,
  isRescheduleProposalPending,
  makeSchedulePayloadSignature,
  normalizeScheduleRemarks,
  parseDateOnlySafe,
} from "../features/schedule/presentation";

describe("Phase 5A: Mobile Scheduling Types and Labels", () => {
  it("includes all 16 canonical ScheduleEventType values", () => {
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toHaveLength(16);
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("WEDDING");
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("MARRIAGE_SPECIAL");
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("BAPTISM");
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("CONFIRMATION");
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("FIRST_COMMUNION");
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("CONFESSION");
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("ANOINTING_OF_THE_SICK");
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("PRIVATE_MASS");
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("MASS_INTENTION");
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("WAKE_MASS");
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("FUNERAL");
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("MASS_OF_HOLY_SPIRIT");
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("FIESTA");
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("THANKSGIVING");
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("BLESSING");
    expect(CANONICAL_SCHEDULE_EVENT_TYPES).toContain("DELIVERANCE");
  });

  it("maps every canonical type to a friendly display label matching Web and Admin", () => {
    for (const type of CANONICAL_SCHEDULE_EVENT_TYPES) {
      expect(SCHEDULE_EVENT_LABELS[type]).toBeDefined();
      expect(getScheduleEventLabel(type)).toBe(SCHEDULE_EVENT_LABELS[type]);
    }
    expect(SCHEDULE_EVENT_LABELS.WEDDING).toBe("Marriage (Canonical Interview)");
    expect(SCHEDULE_EVENT_LABELS.MARRIAGE_SPECIAL).toBe("Marriage (Special)");
    expect(SCHEDULE_EVENT_LABELS.BAPTISM).toBe("Baptism");
    expect(SCHEDULE_EVENT_LABELS.CONFIRMATION).toBe("Confirmation");
    expect(SCHEDULE_EVENT_LABELS.FIRST_COMMUNION).toBe("First Communion");
    expect(SCHEDULE_EVENT_LABELS.CONFESSION).toBe("Confession");
    expect(SCHEDULE_EVENT_LABELS.ANOINTING_OF_THE_SICK).toBe("Anointing of the Sick");
    expect(SCHEDULE_EVENT_LABELS.PRIVATE_MASS).toBe("Mass");
    expect(SCHEDULE_EVENT_LABELS.MASS_INTENTION).toBe("Mass Intention");
    expect(SCHEDULE_EVENT_LABELS.WAKE_MASS).toBe("Wake Mass");
    expect(SCHEDULE_EVENT_LABELS.FUNERAL).toBe("Funeral");
    expect(SCHEDULE_EVENT_LABELS.MASS_OF_HOLY_SPIRIT).toBe("Mass of the Holy Spirit");
    expect(SCHEDULE_EVENT_LABELS.FIESTA).toBe("Fiesta");
    expect(SCHEDULE_EVENT_LABELS.THANKSGIVING).toBe("Thanksgiving");
    expect(SCHEDULE_EVENT_LABELS.BLESSING).toBe("Blessing");
    expect(SCHEDULE_EVENT_LABELS.DELIVERANCE).toBe("Deliverance");
    expect(getScheduleEventLabel(null)).toBe("Schedule");
  });
});

describe("Phase 5A: Schedule Presentation and Manila-safe Date Helpers", () => {
  it("parses date-only strings without UTC shift", () => {
    const result = parseDateOnlySafe("2026-08-25");
    expect(result.year).toBe(2026);
    expect(result.month).toBe(8);
    expect(result.day).toBe(25);
    expect(result.dateKey).toBe("2026-08-25");
  });

  it("formats schedule dates consistently", () => {
    const formattedShort = formatScheduleDate("2026-08-25", "short");
    expect(formattedShort).toContain("Aug 25");

    const formattedFull = formatScheduleDate("2026-08-25", "full");
    expect(formattedFull).toContain("August 25, 2026");
  });

  it("extracts time slot from remarks or timestamps safely", () => {
    const scheduleWithRemarks: any = {
      remarks: "Time Slot: 08:00 AM. Please arrive 15 minutes early.",
    };
    expect(extractTimeSlotFromSchedule(scheduleWithRemarks)).toBe("08:00 AM");

    const scheduleWithoutSlot: any = { remarks: "" };
    expect(extractTimeSlotFromSchedule(scheduleWithoutSlot)).toBe("TBD");
  });

  it("evaluates proposal pending and status badges correctly", () => {
    expect(isRescheduleProposalPending("PROPOSED_RESCHEDULE")).toBe(true);
    expect(isRescheduleProposalPending("WAITING_PARISHIONER_RESPONSE")).toBe(true);
    expect(isRescheduleProposalPending("CONFIRMED")).toBe(false);
    expect(isRescheduleProposalPending("PENDING")).toBe(false);

    expect(getScheduleStatusBadge("CONFIRMED").label).toBe("Confirmed");
    expect(getScheduleStatusBadge("PROPOSED_RESCHEDULE").label).toContain("Reschedule Proposed");
    expect(getScheduleStatusBadge("CANCELLED").label).toBe("Cancelled");
  });
});

describe("Phase 5A: Remarks Normalization & Canonical Idempotency Signatures", () => {
  it("normalizes remarks identically to backend canonical hashing", () => {
    expect(normalizeScheduleRemarks("")).toBe("");
    expect(normalizeScheduleRemarks(null)).toBe("");
    expect(normalizeScheduleRemarks("   ")).toBe("");
    expect(normalizeScheduleRemarks("  House   Blessing   with Family  ")).toBe(
      "House Blessing with Family"
    );
  });

  it("generates identical canonical signature when whitespace differs in non-semantic ways", () => {
    const base = {
      parishId: 1,
      eventType: "BAPTISM",
      date: "2026-09-01",
      timeSlot: "08:00 AM",
      remarks: "Please prepare certificate",
    };

    const sameNormalized = {
      parishId: "1",
      eventType: "baptism",
      date: "2026-09-01T00:00:00.000Z",
      timeSlot: " 08:00 AM ",
      remarks: "  Please   prepare   certificate  ",
    };

    expect(makeSchedulePayloadSignature(base)).toBe(
      makeSchedulePayloadSignature(sameNormalized)
    );
  });

  it("changes signature and triggers new key when ANY of the 5 canonical fields changes", () => {
    const base = {
      parishId: 1,
      eventType: "BAPTISM",
      date: "2026-09-01",
      timeSlot: "08:00 AM",
      remarks: "Initial notes",
    };

    let currentSig = "";
    let currentKey = "";
    const getKey = (payload: typeof base) => {
      const sig = makeSchedulePayloadSignature(payload);
      if (currentSig === sig && currentKey) {
        return currentKey;
      }
      currentSig = sig;
      currentKey = `test-key-${Math.random()}`;
      return currentKey;
    };

    const k1 = getKey(base);
    const k1Retry = getKey(base);
    expect(k1).toBe(k1Retry);

    // 1. Change parishId -> new key
    const kParish = getKey({ ...base, parishId: 2 });
    expect(kParish).not.toBe(k1);

    // 2. Change eventType -> new key
    const kEvent = getKey({ ...base, eventType: "WEDDING" });
    expect(kEvent).not.toBe(kParish);

    // 3. Change date -> new key
    const kDate = getKey({ ...base, date: "2026-09-02" });
    expect(kDate).not.toBe(kEvent);

    // 4. Change timeSlot -> new key
    const kSlot = getKey({ ...base, timeSlot: "09:30 AM" });
    expect(kSlot).not.toBe(kDate);

    // 5. Change remarks -> new key
    const kRemarks = getKey({ ...base, remarks: "Updated notes with sponsor names" });
    expect(kRemarks).not.toBe(kSlot);
  });
});

describe("Phase 5A: Schedule Query Keys UID Scoping", () => {
  it("scopes schedule lists and detail by user ID to prevent data leakage", () => {
    const user1List = scheduleKeys.lists(101, "upcoming");
    const user2List = scheduleKeys.lists(202, "upcoming");
    expect(user1List).not.toEqual(user2List);
    expect(user1List).toEqual(["schedules", "list", 101, "upcoming"]);

    const user1Detail = scheduleKeys.detail(101, 55);
    const user2Detail = scheduleKeys.detail(202, 55);
    expect(user1Detail).not.toEqual(user2Detail);
    expect(user1Detail).toEqual(["schedules", "detail", 101, "55"]);

    const availDatesKey = scheduleKeys.availabilityDates(1, "BAPTISM");
    expect(availDatesKey).toEqual(["schedules", "availability-dates", "1", "BAPTISM"]);

    const availSlotsKey = scheduleKeys.availableSlots(1, "2026-09-01", "BAPTISM");
    expect(availSlotsKey).toEqual([
      "schedules",
      "available-slots",
      "1",
      "2026-09-01",
      "BAPTISM",
    ]);
  });
});

describe("Phase 5-7 Regression: Schedule Terminology and Tab Route Purity", () => {
  it("strictly prohibits invented embellishments in canonical schedule labels", () => {
    // Baptism must NOT be Baptism Interview
    expect(SCHEDULE_EVENT_LABELS.BAPTISM).toBe("Baptism");
    expect(SCHEDULE_EVENT_LABELS.BAPTISM).not.toContain("Interview");

    // Funeral must NOT be Funeral Mass
    expect(SCHEDULE_EVENT_LABELS.FUNERAL).toBe("Funeral");
    expect(SCHEDULE_EVENT_LABELS.FUNERAL).not.toContain("Mass");

    // Fiesta must NOT be Fiesta Mass
    expect(SCHEDULE_EVENT_LABELS.FIESTA).toBe("Fiesta");
    expect(SCHEDULE_EVENT_LABELS.FIESTA).not.toContain("Mass");

    // Thanksgiving must NOT be Thanksgiving Mass
    expect(SCHEDULE_EVENT_LABELS.THANKSGIVING).toBe("Thanksgiving");
    expect(SCHEDULE_EVENT_LABELS.THANKSGIVING).not.toContain("Mass");

    // Blessing must NOT be House / Vehicle / Item Blessing
    expect(SCHEDULE_EVENT_LABELS.BLESSING).toBe("Blessing");
    expect(SCHEDULE_EVENT_LABELS.BLESSING).not.toContain("House");
    expect(SCHEDULE_EVENT_LABELS.BLESSING).not.toContain("Vehicle");

    // Deliverance must NOT be Deliverance / Healing Prayer
    expect(SCHEDULE_EVENT_LABELS.DELIVERANCE).toBe("Deliverance");
    expect(SCHEDULE_EVENT_LABELS.DELIVERANCE).not.toContain("Healing Prayer");

    // Marriage (Special) and Marriage (Canonical Interview) exact parenthesized format
    expect(SCHEDULE_EVENT_LABELS.WEDDING).toBe("Marriage (Canonical Interview)");
    expect(SCHEDULE_EVENT_LABELS.MARRIAGE_SPECIAL).toBe("Marriage (Special)");
  });

  it("does not use 'Book Appointment' or 'Appointment' as canonical schedule fallback", () => {
    expect(getScheduleEventLabel(null)).toBe("Schedule");
    expect(getScheduleEventLabel(undefined)).toBe("Schedule");
  });

  it("targets root stack routes for schedule wizard and detail rather than tab routes", () => {
    const resolveScheduleRoutes = (scheduleId?: number | string) => ({
      list: "/(app)/(tabs)/(schedule)",
      create: "/(app)/schedule/new",
      detail: scheduleId ? `/(app)/schedule/${scheduleId}` : "/(app)/schedule/[id]",
    });

    const routes = resolveScheduleRoutes(42);
    expect(routes.list).toBe("/(app)/(tabs)/(schedule)");
    expect(routes.create).toBe("/(app)/schedule/new");
    expect(routes.detail).toBe("/(app)/schedule/42");

    // Ensure create and detail routes are NOT nested under (tabs)
    expect(routes.create).not.toContain("/(tabs)/");
    expect(routes.detail).not.toContain("/(tabs)/");
  });
});

