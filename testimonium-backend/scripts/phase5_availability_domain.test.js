import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeParishId,
  normalizeTimeSlotString,
  extractScheduleTimeSlot,
  validateRequestedPriestEligibility,
  getEligiblePriestsForParish,
  loadParishAvailabilitySnapshot,
  loadPriestConflictSnapshot,
  evaluateCandidateSlot,
  getScheduleRecommendations,
  MAX_RECOMMENDATIONS,
} from "../services/ScheduleAvailabilityDomainService.js";
import {
  evaluatePriestConflictFromSnapshot,
  BLOCKING_SCHEDULE_STATUSES,
  parseManilaDateTime,
  computeOperationalEndDatetime,
  MASS_CONFLICT_DURATION_MS,
} from "../services/ConflictHelper.js";
import { validateSlotAndCapacity } from "../services/BookingValidator.js";

test("Phase 5 Central Domain Foundation Suite", async (t) => {
  // 1. Strict Parish ID validation
  await t.test("normalizeParishId: accepts positive safe integers and strict numeric strings", () => {
    assert.equal(normalizeParishId(1), 1);
    assert.equal(normalizeParishId("42"), 42);
    assert.equal(normalizeParishId(999999), 999999);
  });

  await t.test("normalizeParishId: rejects malformed IDs (fail-closed, no parseInt coercion)", () => {
    const invalidInputs = [0, -1, 1.5, "1.5", "123junk", " 123", "abc", null, undefined, {}, [], NaN, Infinity];
    for (const input of invalidInputs) {
      assert.throws(
        () => normalizeParishId(input),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, "INVALID_PARISH_ID");
          return true;
        }
      );
    }
  });

  // 2. extractScheduleTimeSlot parity
  await t.test("extractScheduleTimeSlot: resolves remarks strictly and returns null when remarks missing or unparseable", () => {
    assert.equal(extractScheduleTimeSlot({ remarks: "Time Slot: 10:30 AM" }), "10:30 AM");
    assert.equal(extractScheduleTimeSlot({ remarks: "Time Slot: 9:00 AM - baptism" }), "09:00 AM");
    assert.equal(extractScheduleTimeSlot({ remarks: "Time Slot: 01:30 PM - notes" }), "01:30 PM");
    // Does NOT derive from startDatetime or timeSlot
    assert.equal(extractScheduleTimeSlot({ startDatetime: new Date("2026-09-20T02:00:00.000Z") }), null);
    assert.equal(extractScheduleTimeSlot({ timeSlot: "10:00 AM" }), null);
    assert.equal(extractScheduleTimeSlot({}), null);
  });

  // 3. evaluatePriestConflictFromSnapshot — 5 Canonical Sources
  await t.test("evaluatePriestConflictFromSnapshot: clear availability when no conflicts exist", () => {
    const snapshot = {
      leaves: [],
      schedules: [],
      events: [],
      massTemplates: [],
      personalSchedules: [],
    };
    const start = new Date("2026-09-20T10:00:00+08:00");
    const end = computeOperationalEndDatetime(start);
    const result = evaluatePriestConflictFromSnapshot(snapshot, start, end);
    assert.deepEqual(result, { available: true });
  });

  await t.test("evaluatePriestConflictFromSnapshot: Source 1 — PRIEST_LEAVE conflict", () => {
    const snapshot = {
      leaves: [
        {
          id: 1,
          startDate: new Date("2026-09-19T00:00:00+08:00"),
          endDate: new Date("2026-09-21T00:00:00+08:00"),
          title: "Annual Retreat",
        },
      ],
      schedules: [],
      events: [],
      massTemplates: [],
      personalSchedules: [],
    };
    const start = new Date("2026-09-20T10:00:00+08:00");
    const end = computeOperationalEndDatetime(start);
    const result = evaluatePriestConflictFromSnapshot(snapshot, start, end);
    assert.equal(result.available, false);
    assert.equal(result.reason, "PRIEST_ON_LEAVE");
  });

  await t.test("evaluatePriestConflictFromSnapshot: Source 2 — Assigned blocking schedule overlap", () => {
    const snapshot = {
      leaves: [],
      schedules: [
        {
          id: 101,
          status: "CONFIRMED",
          startDatetime: new Date("2026-09-20T09:30:00+08:00"),
          endDatetime: new Date("2026-09-20T10:30:00+08:00"),
        },
      ],
      events: [],
      massTemplates: [],
      personalSchedules: [],
    };
    const start = new Date("2026-09-20T10:00:00+08:00");
    const end = computeOperationalEndDatetime(start);
    const result = evaluatePriestConflictFromSnapshot(snapshot, start, end);
    assert.equal(result.available, false);
    assert.equal(result.reason, "OVERLAP_SCHEDULE");
  });

  await t.test("evaluatePriestConflictFromSnapshot: Source 2 — Back-to-back half-open intervals do not conflict", () => {
    const snapshot = {
      leaves: [],
      schedules: [
        {
          id: 102,
          status: "CONFIRMED",
          startDatetime: new Date("2026-09-20T09:00:00+08:00"),
          endDatetime: new Date("2026-09-20T10:00:00+08:00"), // ends exactly at 10:00
        },
      ],
      events: [],
      massTemplates: [],
      personalSchedules: [],
    };
    const start = new Date("2026-09-20T10:00:00+08:00");
    const end = computeOperationalEndDatetime(start);
    const result = evaluatePriestConflictFromSnapshot(snapshot, start, end);
    assert.deepEqual(result, { available: true });
  });

  await t.test("evaluatePriestConflictFromSnapshot: Source 2 — Unresolvable legacy schedule fails closed", () => {
    const snapshot = {
      leaves: [],
      schedules: [
        {
          id: 103,
          status: "PENDING",
          // missing startDatetime, timeSlot, remarks -> completely unresolvable
        },
      ],
      events: [],
      massTemplates: [],
      personalSchedules: [],
    };
    const start = new Date("2026-09-20T10:00:00+08:00");
    const end = computeOperationalEndDatetime(start);
    const result = evaluatePriestConflictFromSnapshot(snapshot, start, end);
    assert.equal(result.available, false);
    assert.equal(result.reason, "UNRESOLVED_SCHEDULE_INTERVAL");
  });

  await t.test("evaluatePriestConflictFromSnapshot: Source 3 — ParishEvent overlap", () => {
    const snapshot = {
      leaves: [],
      schedules: [],
      events: [
        {
          id: 201,
          isActive: true,
          eventDate: new Date("2026-09-20T00:00:00+08:00"),
          startTime: "09:30 AM",
          endTime: "11:00 AM",
        },
      ],
      massTemplates: [],
      personalSchedules: [],
    };
    const start = new Date("2026-09-20T10:00:00+08:00");
    const end = computeOperationalEndDatetime(start);
    const result = evaluatePriestConflictFromSnapshot(snapshot, start, end);
    assert.equal(result.available, false);
    assert.equal(result.reason, "OVERLAP_EVENT");
  });

  await t.test("evaluatePriestConflictFromSnapshot: Source 4 — Mass schedule template overlap", () => {
    // 2026-09-20 is a Sunday
    const snapshot = {
      leaves: [],
      schedules: [],
      events: [],
      massTemplates: [
        {
          id: 301,
          isActive: true,
          dayType: "SUNDAY",
          timeSlot: "10:00 AM",
        },
      ],
      personalSchedules: [],
    };
    const start = new Date("2026-09-20T10:00:00+08:00");
    const end = computeOperationalEndDatetime(start);
    const result = evaluatePriestConflictFromSnapshot(snapshot, start, end);
    assert.equal(result.available, false);
    assert.equal(result.reason, "OVERLAP_MASS_TEMPLATE");
  });

  await t.test("evaluatePriestConflictFromSnapshot: Source 5 — PriestPersonalSchedule overlap", () => {
    const snapshot = {
      leaves: [],
      schedules: [],
      events: [],
      massTemplates: [],
      personalSchedules: [
        {
          id: 401,
          startAt: new Date("2026-09-20T09:45:00+08:00"),
          endAt: new Date("2026-09-20T10:45:00+08:00"),
          title: "Doctor Appointment",
        },
      ],
    };
    const start = new Date("2026-09-20T10:00:00+08:00");
    const end = computeOperationalEndDatetime(start);
    const result = evaluatePriestConflictFromSnapshot(snapshot, start, end);
    assert.equal(result.available, false);
    assert.equal(result.reason, "OVERLAP_PERSONAL_SCHEDULE");
  });

  await t.test("evaluatePriestConflictFromSnapshot: unexpected/malformed input propagates (does NOT return available: false)", () => {
    // Missing required arrays
    assert.throws(() => evaluatePriestConflictFromSnapshot(null, new Date(), new Date()));
    assert.throws(() => evaluatePriestConflictFromSnapshot({}, new Date(), new Date()));

    // Invalid interval
    const validSnapshot = { leaves: [], schedules: [], events: [], massTemplates: [], personalSchedules: [] };
    const d1 = new Date("2026-09-20T10:00:00+08:00");
    const d2 = new Date("2026-09-20T09:00:00+08:00"); // end < start
    assert.throws(() => evaluatePriestConflictFromSnapshot(validSnapshot, d1, d2));
  });

  // 4. Requested Priest Eligibility Helper
  await t.test("validateRequestedPriestEligibility: passes for active priest in same parish", async () => {
    const mockClient = {
      user: {
        findUnique: async ({ where }) => {
          if (where.id === 5) {
            return {
              id: 5,
              name: "Fr. Juan",
              fullName: "Fr. Juan dela Cruz",
              isAssistant: false,
              status: "ACTIVE",
              parishId: 1,
              role: { roleName: "PRIEST" },
            };
          }
          return null;
        },
      },
    };

    const priest = await validateRequestedPriestEligibility(5, 1, mockClient);
    assert.deepEqual(priest, { id: 5, name: "Fr. Juan dela Cruz", isAssistant: false });
  });

  await t.test("validateRequestedPriestEligibility: rejects non-existent, inactive, non-priest, or wrong parish with 400 INVALID_REQUESTED_PRIEST", async () => {
    const mockClient = {
      user: {
        findUnique: async ({ where }) => {
          if (where.id === 10) return null; // non-existent
          if (where.id === 11) return { id: 11, status: "INACTIVE", parishId: 1, role: { roleName: "PRIEST" } };
          if (where.id === 12) return { id: 12, status: "ACTIVE", parishId: 1, role: { roleName: "PARISHIONER" } };
          if (where.id === 13) return { id: 13, status: "ACTIVE", parishId: 2, role: { roleName: "PRIEST" } }; // wrong parish
          return null;
        },
      },
    };

    for (const testId of [10, 11, 12, 13]) {
      await assert.rejects(
        async () => validateRequestedPriestEligibility(testId, 1, mockClient),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, "INVALID_REQUESTED_PRIEST");
          return true;
        }
      );
    }
  });

  // 5. Eligible Priests Listing
  await t.test("getEligiblePriestsForParish: returns safe public fields ordered by assistant then name", async () => {
    let capturedArgs = null;
    const mockClient = {
      parish: {
        findUnique: async () => ({ id: 1, isActive: true }),
      },
      user: {
        findMany: async (args) => {
          capturedArgs = args;
          return [
            { id: 1, fullName: "Fr. Alpha Pastor", isAssistant: false },
            { id: 2, fullName: "Fr. Beta Assistant", isAssistant: true },
          ];
        },
      },
    };

    const priests = await getEligiblePriestsForParish(1, null, mockClient);
    assert.equal(priests.length, 2);
    assert.deepEqual(priests[0], { id: 1, name: "Fr. Alpha Pastor", isAssistant: false });
    assert.deepEqual(priests[1], { id: 2, name: "Fr. Beta Assistant", isAssistant: true });
    // Verify query shape: select and orderBy must not reference User.name
    assert.ok(capturedArgs, "user.findMany must be called");
    assert.equal(capturedArgs.select?.name, undefined, "user.findMany must not select name");
    assert.equal(capturedArgs.select?.fullName, true, "user.findMany must select fullName");
    assert.deepEqual(
      capturedArgs.orderBy,
      [{ isAssistant: "asc" }, { fullName: "asc" }],
      "user.findMany must order by isAssistant and fullName"
    );
    // Verify no private fields leaked
    assert.equal(priests[0].fullName, undefined);
    assert.equal(priests[0].email, undefined);
    assert.equal(priests[0].phone, undefined);
  });

  await t.test("getEligiblePriestsForParish: rejects inactive parish with 400 PARISH_INACTIVE", async () => {
    const mockClient = {
      parish: {
        findUnique: async () => ({ id: 1, isActive: false }),
      },
    };
    await assert.rejects(
      async () => getEligiblePriestsForParish(1, null, mockClient),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "PARISH_INACTIVE");
        return true;
      }
    );
  });

  // 6. Bounded Snapshot Loading Query Counts
  await t.test("loadParishAvailabilitySnapshot and loadPriestConflictSnapshot execute bounded queries", async () => {
    let parishQueryCount = 0;
    let priestQueryCount = 0;

    const mockParishClient = {
      parish: {
        findUnique: async () => {
          parishQueryCount++;
          return {
            id: 1,
            isActive: true,
            eventSettings: {
              availableEvents: ["WEDDING"],
              timeSlots: ["10:00 AM", "02:00 PM"],
              capacitySettings: { dailyLimit: 5, slotCapacity: 2 },
            },
            availabilities: [],
            weekdayRules: [],
            serviceWeekdayRules: [],
            scheduleDateRules: [],
          };
        },
      },
      schedule: {
        findMany: async () => {
          parishQueryCount++;
          return [];
        },
      },
    };

    const mockPriestClient = {
      parishAvailability: { findMany: async () => { priestQueryCount++; return []; } },
      schedule: { findMany: async () => { priestQueryCount++; return []; } },
      parishEvent: { findMany: async () => { priestQueryCount++; return []; } },
      massScheduleTemplate: { findMany: async () => { priestQueryCount++; return []; } },
      priestPersonalSchedule: { findMany: async () => { priestQueryCount++; return []; } },
    };

    await loadParishAvailabilitySnapshot(1, "2026-09-10", "2026-10-10", "WEDDING", mockParishClient);
    assert.equal(parishQueryCount, 2, "Parish snapshot must execute exactly 2 DB queries for any bounded window");

    await loadPriestConflictSnapshot(5, "2026-09-10", "2026-10-10", mockPriestClient);
    assert.equal(priestQueryCount, 5, "Priest snapshot must execute exactly 5 bounded queries across the 5 conflict sources");
  });

  // 7. evaluateCandidateSlot domain rules & capacity
  await t.test("evaluateCandidateSlot: filters out closed parish, blocked availability, daily/slot full, expired slots", () => {
    const baseSnapshot = {
      parish: {
        id: 1,
        isActive: true,
        officeHours: {
          sunday: { isClosed: true },
          monday: { isClosed: false, open: "08:00 AM", close: "05:00 PM" },
        },
      },
      schedulingConfig: {
        dailyCapacity: 2,
        slotCapacity: 1,
        timeSlots: ["10:00 AM", "02:00 PM"],
      },
      availabilities: [
        {
          type: "FULLY_BOOKED",
          startDate: new Date("2026-09-22T00:00:00+08:00"),
          endDate: new Date("2026-09-22T23:59:59+08:00"),
        },
      ],
      weekdayRules: [
        { weekday: "SUNDAY", isAvailable: true },
        { weekday: "MONDAY", isAvailable: true },
        { weekday: "TUESDAY", isAvailable: true },
        { weekday: "WEDNESDAY", isAvailable: true },
        { weekday: "THURSDAY", isAvailable: true },
        { weekday: "FRIDAY", isAvailable: true },
        { weekday: "SATURDAY", isAvailable: true },
      ],
      serviceWeekdayRules: [],
      scheduleDateRules: [],
      schedulesByDate: new Map([
        // Date with daily capacity reached
        [
          "2026-09-23",
          [
            { remarks: "Time Slot: 10:00 AM", status: "CONFIRMED" },
            { remarks: "Time Slot: 02:00 PM", status: "CONFIRMED" },
          ],
        ],
        // Date with slot capacity reached for 10:00 AM
        [
          "2026-09-24",
          [
            { remarks: "Time Slot: 10:00 AM", status: "CONFIRMED" },
          ],
        ],
      ]),
    };

    const now = new Date("2026-09-20T08:00:00+08:00");

    // 2026-09-20 is Sunday -> office closed
    assert.equal(evaluateCandidateSlot(baseSnapshot, "2026-09-20", "10:00 AM", "WEDDING", now), false);

    // 2026-09-22 -> parish availability FULLY_BOOKED
    assert.equal(evaluateCandidateSlot(baseSnapshot, "2026-09-22", "10:00 AM", "WEDDING", now), false);

    // 2026-09-23 -> daily capacity (2) reached
    assert.equal(evaluateCandidateSlot(baseSnapshot, "2026-09-23", "10:00 AM", "WEDDING", now), false);

    // 2026-09-24 -> 10:00 AM slot capacity (1) reached, but 02:00 PM is open
    assert.equal(evaluateCandidateSlot(baseSnapshot, "2026-09-24", "10:00 AM", "WEDDING", now), false);
    assert.equal(evaluateCandidateSlot(baseSnapshot, "2026-09-24", "02:00 PM", "WEDDING", now), true);
  });

  // 8. Prisma Select Guard (no fantasy timeSlot on Schedule)
  await t.test("Prisma select guard: schedule findMany selects only actual Prisma schema fields (no fantasy timeSlot)", async () => {
    let parishScheduleSelect = null;
    let priestScheduleSelect = null;

    const mockParishClient = {
      parish: {
        findUnique: async () => ({
          id: 1,
          isActive: true,
          eventSettings: {
            availableEvents: ["WEDDING"],
            timeSlots: ["10:00 AM"],
            capacitySettings: { dailyLimit: 5, slotCapacity: 2 },
          },
          availabilities: [],
          weekdayRules: [],
          serviceWeekdayRules: [],
          scheduleDateRules: [],
        }),
      },
      schedule: {
        findMany: async ({ select }) => {
          parishScheduleSelect = select;
          return [];
        },
      },
    };

    const mockPriestClient = {
      parishAvailability: { findMany: async () => [] },
      schedule: {
        findMany: async ({ select }) => {
          priestScheduleSelect = select;
          return [];
        },
      },
      parishEvent: { findMany: async () => [] },
      massScheduleTemplate: { findMany: async () => [] },
      priestPersonalSchedule: { findMany: async () => [] },
    };

    await loadParishAvailabilitySnapshot(1, "2026-09-20", "2026-09-25", "WEDDING", mockParishClient);
    assert.ok(parishScheduleSelect, "Parish schedule findMany must execute");
    assert.equal(parishScheduleSelect.timeSlot, undefined, "Parish schedule findMany must NOT select fantasy timeSlot");
    assert.equal(parishScheduleSelect.remarks, true, "Parish schedule findMany must select remarks");

    await loadPriestConflictSnapshot(5, "2026-09-20", "2026-09-25", mockPriestClient);
    assert.ok(priestScheduleSelect, "Priest schedule findMany must execute");
    assert.equal(priestScheduleSelect.timeSlot, undefined, "Priest schedule findMany must NOT select fantasy timeSlot");
    assert.equal(priestScheduleSelect.remarks, true, "Priest schedule findMany must select remarks");
  });

  // 9. Capacity Parity: validateSlotAndCapacity vs evaluateCandidateSlot
  await t.test("Capacity parity: validateSlotAndCapacity and evaluateCandidateSlot produce identical counts for remarks-only schedules", () => {
    const schedules = [
      { remarks: "Time Slot: 10:00 AM", status: "CONFIRMED" },
      { remarks: "Time Slot: 10:00 AM [notes]", status: "PENDING" },
      { remarks: "Time Slot: 02:00 PM", status: "CONFIRMED" },
      { remarks: "Cancelled slot", status: "CANCELLED" },
    ];

    // validateSlotAndCapacity with dailyLimit: 5, slotLimit: 2
    // 10:00 AM has 2 active bookings -> at slot limit -> throws FULLY_BOOKED
    assert.throws(
      () => validateSlotAndCapacity(["10:00 AM", "02:00 PM"], schedules, "10:00 AM", 5, 2),
      (err) => err.code === "FULLY_BOOKED"
    );

    // 02:00 PM has 1 active booking -> slotLimit 2 -> passes
    assert.equal(validateSlotAndCapacity(["10:00 AM", "02:00 PM"], schedules, "02:00 PM", 5, 2), true);

    // evaluateCandidateSlot with same rules
    const mockSnapshot = {
      parish: {
        id: 1,
        isActive: true,
        officeHours: { monday: { isClosed: false, open: "08:00 AM", close: "05:00 PM" } },
      },
      schedulingConfig: { dailyCapacity: 5, slotCapacity: 2, timeSlots: ["10:00 AM", "02:00 PM"] },
      availabilities: [],
      weekdayRules: [{ weekday: "MONDAY", isAvailable: true }],
      serviceWeekdayRules: [],
      scheduleDateRules: [],
      schedulesByDate: new Map([["2026-09-21", schedules]]),
    };
    // 2026-09-21 is Monday
    const now = new Date("2026-09-20T08:00:00+08:00");
    assert.equal(evaluateCandidateSlot(mockSnapshot, "2026-09-21", "10:00 AM", "WEDDING", now), false);
    assert.equal(evaluateCandidateSlot(mockSnapshot, "2026-09-21", "02:00 PM", "WEDDING", now), true);
  });

  // 10. Cross-Boundary Commitments
  await t.test("Boundary: Commitment A — Sep 19 23:30 Manila -> Sep 20 01:00 Manila conflicts with Sep 20 00:30 candidate", () => {
    const snapshot = {
      leaves: [],
      schedules: [],
      events: [],
      massTemplates: [],
      personalSchedules: [
        {
          id: 501,
          startAt: new Date("2026-09-19T23:30:00+08:00"),
          endAt: new Date("2026-09-20T01:00:00+08:00"),
          title: "Late Night Pastoral Duty",
        },
      ],
    };
    const candidateStart = new Date("2026-09-20T00:30:00+08:00");
    const candidateEnd = new Date("2026-09-20T01:30:00+08:00");
    const result = evaluatePriestConflictFromSnapshot(snapshot, candidateStart, candidateEnd);
    assert.equal(result.available, false);
    assert.equal(result.reason, "OVERLAP_PERSONAL_SCHEDULE");
  });

  await t.test("Boundary: Commitment B — Schedule interval begins previous day and crosses into first recommendation day", () => {
    const snapshot = {
      leaves: [],
      schedules: [
        {
          id: 502,
          status: "CONFIRMED",
          startDatetime: new Date("2026-09-19T23:00:00+08:00"),
          endDatetime: new Date("2026-09-20T01:00:00+08:00"),
        },
      ],
      events: [],
      massTemplates: [],
      personalSchedules: [],
    };
    const candidateStart = new Date("2026-09-20T00:00:00+08:00");
    const candidateEnd = new Date("2026-09-20T01:00:00+08:00");
    const result = evaluatePriestConflictFromSnapshot(snapshot, candidateStart, candidateEnd);
    assert.equal(result.available, false);
    assert.equal(result.reason, "OVERLAP_SCHEDULE");
  });

  await t.test("Boundary: Commitment C — Start-only Schedule whose operational fallback overlaps first search day", () => {
    const snapshot = {
      leaves: [],
      schedules: [
        {
          id: 503,
          status: "CONFIRMED",
          startDatetime: new Date("2026-09-19T23:30:00+08:00"),
          endDatetime: null, // 60-min fallback ends Sep 20 00:30:00+08:00
        },
      ],
      events: [],
      massTemplates: [],
      personalSchedules: [],
    };
    const candidateStart = new Date("2026-09-20T00:00:00+08:00");
    const candidateEnd = new Date("2026-09-20T01:00:00+08:00");
    const result = evaluatePriestConflictFromSnapshot(snapshot, candidateStart, candidateEnd);
    assert.equal(result.available, false);
    assert.equal(result.reason, "OVERLAP_SCHEDULE");
  });

  await t.test("Boundary: Commitment D — Final-day candidate whose operational interval crosses next midnight", () => {
    const snapshot = {
      leaves: [],
      schedules: [],
      events: [],
      massTemplates: [],
      personalSchedules: [
        {
          id: 504,
          startAt: new Date("2026-09-21T00:15:00+08:00"),
          endAt: new Date("2026-09-21T01:00:00+08:00"),
          title: "Early Morning Vigil",
        },
      ],
    };
    // Final day candidate starts 11:30 PM (23:30) on Sep 20, ends 00:30 on Sep 21
    const candidateStart = new Date("2026-09-20T23:30:00+08:00");
    const candidateEnd = new Date("2026-09-21T00:30:00+08:00");
    const result = evaluatePriestConflictFromSnapshot(snapshot, candidateStart, candidateEnd);
    assert.equal(result.available, false);
    assert.equal(result.reason, "OVERLAP_PERSONAL_SCHEDULE");
  });

  // 11. Malformed Snapshot Data Handling
  await t.test("evaluatePriestConflictFromSnapshot: malformed ParishEvent time fails closed with PRIEST_AVAILABILITY_UNDETERMINED", () => {
    const snapshot = {
      leaves: [],
      schedules: [],
      events: [
        {
          id: 601,
          isActive: true,
          eventDate: new Date("2026-09-20T00:00:00+08:00"),
          startTime: "INVALID_FORMAT",
        },
      ],
      massTemplates: [],
      personalSchedules: [],
    };
    const start = new Date("2026-09-20T10:00:00+08:00");
    const end = computeOperationalEndDatetime(start);
    const result = evaluatePriestConflictFromSnapshot(snapshot, start, end);
    assert.equal(result.available, false);
    assert.equal(result.reason, "PRIEST_AVAILABILITY_UNDETERMINED");
  });

  await t.test("evaluatePriestConflictFromSnapshot: malformed MassScheduleTemplate time fails closed with PRIEST_AVAILABILITY_UNDETERMINED", () => {
    const snapshot = {
      leaves: [],
      schedules: [],
      events: [],
      massTemplates: [
        {
          id: 602,
          isActive: true,
          dayType: "SUNDAY",
          timeSlot: "NOT_A_VALID_TIME",
        },
      ],
      personalSchedules: [],
    };
    // 2026-09-20 is Sunday
    const start = new Date("2026-09-20T10:00:00+08:00");
    const end = computeOperationalEndDatetime(start);
    const result = evaluatePriestConflictFromSnapshot(snapshot, start, end);
    assert.equal(result.available, false);
    assert.equal(result.reason, "PRIEST_AVAILABILITY_UNDETERMINED");
  });

  await t.test("evaluatePriestConflictFromSnapshot: non-applicable MassScheduleTemplate day skips normally", () => {
    const snapshot = {
      leaves: [],
      schedules: [],
      events: [],
      massTemplates: [
        {
          id: 603,
          isActive: true,
          dayType: "WEEKDAY", // 2026-09-20 is Sunday, does not apply
          timeSlot: "10:00 AM",
        },
      ],
      personalSchedules: [],
    };
    const start = new Date("2026-09-20T10:00:00+08:00");
    const end = computeOperationalEndDatetime(start);
    const result = evaluatePriestConflictFromSnapshot(snapshot, start, end);
    assert.equal(result.available, true);
  });
});
