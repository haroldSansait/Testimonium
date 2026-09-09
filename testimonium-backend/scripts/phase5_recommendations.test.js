import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getScheduleRecommendations,
  MAX_RECOMMENDATIONS,
} from "../services/ScheduleAvailabilityDomainService.js";
import { scheduleRecommendationsSchema } from "../validators/recommendationSchemas.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Phase 5 Schedule Recommendation Engine Suite", async (t) => {
  const fixedNow = new Date("2026-09-08T09:00:00+08:00"); // Tuesday

  function createMockParish(overrides = {}) {
    return {
      id: 1,
      isActive: true,
      officeHours: {
        monday: { isClosed: false, open: "08:00 AM", close: "05:00 PM" },
        tuesday: { isClosed: false, open: "08:00 AM", close: "05:00 PM" },
        wednesday: { isClosed: false, open: "08:00 AM", close: "05:00 PM" },
        thursday: { isClosed: false, open: "08:00 AM", close: "05:00 PM" },
        friday: { isClosed: false, open: "08:00 AM", close: "05:00 PM" },
        saturday: { isClosed: false, open: "08:00 AM", close: "05:00 PM" },
        sunday: { isClosed: false, open: "08:00 AM", close: "05:00 PM" },
      },
      eventSettings: {
        availableEvents: ["WEDDING", "BAPTISM"],
        timeSlots: ["09:00 AM", "10:30 AM", "02:00 PM", "03:30 PM"],
        capacitySettings: { dailyLimit: 4, slotCapacity: 2 },
      },
      availabilities: [],
      weekdayRules: [
        { weekday: "MONDAY", isAvailable: true },
        { weekday: "TUESDAY", isAvailable: true },
        { weekday: "WEDNESDAY", isAvailable: true },
        { weekday: "THURSDAY", isAvailable: true },
        { weekday: "FRIDAY", isAvailable: true },
        { weekday: "SATURDAY", isAvailable: true },
        { weekday: "SUNDAY", isAvailable: true },
      ],
      serviceWeekdayRules: [],
      scheduleDateRules: [],
      ...overrides,
    };
  }

  function createMockPrisma({ parish = createMockParish(), schedules = [], priest = null, priestConflicts = {} } = {}) {
    return {
      parish: {
        findUnique: async () => parish,
      },
      schedule: {
        findMany: async () => schedules,
      },
      user: {
        findUnique: async ({ where }) => {
          if (priest && where.id === priest.id) return priest;
          return null;
        },
      },
      parishAvailability: {
        findMany: async () => priestConflicts.leaves || [],
      },
      parishEvent: {
        findMany: async () => priestConflicts.events || [],
      },
      massScheduleTemplate: {
        findMany: async () => priestConflicts.massTemplates || [],
      },
      priestPersonalSchedule: {
        findMany: async () => priestConflicts.personalSchedules || [],
      },
    };
  }

  // 1. Preferred date available
  await t.test("preferred date available: candidates on preferredDate are ranked first with PREFERRED_DATE reason", async () => {
    const client = createMockPrisma();
    const result = await getScheduleRecommendations(
      {
        parishId: 1,
        eventType: "WEDDING",
        preferredDate: "2026-09-15",
        dateFrom: "2026-09-10",
        dateTo: "2026-09-20",
      },
      null,
      client,
      fixedNow
    );

    assert.equal(result.success, true);
    assert.equal(result.recommendations.length, MAX_RECOMMENDATIONS);
    assert.equal(result.recommendations[0].date, "2026-09-15");
    assert.ok(result.recommendations[0].reasons.includes("PREFERRED_DATE"));
  });

  // 2. Preferred date unavailable returns alternatives
  await t.test("preferred date unavailable: generates nearest alternatives before and after", async () => {
    const parish = createMockParish({
      availabilities: [
        {
          type: "PARISH_CLOSED",
          startDate: new Date("2026-09-15T00:00:00+08:00"),
          endDate: new Date("2026-09-15T23:59:59+08:00"),
          title: "Parish Holiday",
        },
      ],
    });
    const client = createMockPrisma({ parish });
    const result = await getScheduleRecommendations(
      {
        parishId: 1,
        eventType: "WEDDING",
        preferredDate: "2026-09-15",
        dateFrom: "2026-09-10",
        dateTo: "2026-09-20",
      },
      null,
      client,
      fixedNow
    );

    assert.equal(result.success, true);
    assert.ok(result.recommendations.length > 0);
    // None of the recommendations should be on the closed preferredDate
    assert.ok(result.recommendations.every((r) => r.date !== "2026-09-15"));
    // Nearest alternatives should be 2026-09-14 or 2026-09-16 (day distance 1)
    assert.ok(["2026-09-14", "2026-09-16"].includes(result.recommendations[0].date));
  });

  // 3. Range semantics: BOTH OR NEITHER
  await t.test("range semantics: rejects if only dateFrom or only dateTo is provided", async () => {
    const client = createMockPrisma();

    await assert.rejects(
      async () => getScheduleRecommendations(
        { parishId: 1, eventType: "WEDDING", preferredDate: "2026-09-15", dateFrom: "2026-09-10" },
        null, client, fixedNow
      ),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "INVALID_SEARCH_WINDOW");
        return true;
      }
    );

    await assert.rejects(
      async () => getScheduleRecommendations(
        { parishId: 1, eventType: "WEDDING", preferredDate: "2026-09-15", dateTo: "2026-09-20" },
        null, client, fixedNow
      ),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "INVALID_SEARCH_WINDOW");
        return true;
      }
    );
  });

  await t.test("range semantics: when neither provided, uses full authoritative 90-day horizon", async () => {
    const client = createMockPrisma();
    const result = await getScheduleRecommendations(
      {
        parishId: 1,
        eventType: "WEDDING",
        preferredDate: "2026-09-15",
      },
      null,
      client,
      fixedNow
    );

    assert.equal(result.window.from, "2026-09-08");
    assert.equal(result.window.to, "2026-12-07"); // 90 days from Sep 8
  });

  // 4. preferredDate must be inside horizon
  await t.test("preferredDate outside horizon is rejected with 400", async () => {
    const client = createMockPrisma();

    // Past date
    await assert.rejects(
      async () => getScheduleRecommendations(
        { parishId: 1, eventType: "WEDDING", preferredDate: "2026-09-01" },
        null, client, fixedNow
      ),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "PREFERRED_DATE_OUT_OF_HORIZON");
        return true;
      }
    );

    // Far future date (> 90 days)
    await assert.rejects(
      async () => getScheduleRecommendations(
        { parishId: 1, eventType: "WEDDING", preferredDate: "2027-01-01" },
        null, client, fixedNow
      ),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "PREFERRED_DATE_OUT_OF_HORIZON");
        return true;
      }
    );
  });

  // 5. preferredTimeSlot validation
  await t.test("preferredTimeSlot must be configured in parish config.timeSlots or throws 400", async () => {
    const client = createMockPrisma();

    await assert.rejects(
      async () => getScheduleRecommendations(
        {
          parishId: 1,
          eventType: "WEDDING",
          preferredDate: "2026-09-15",
          preferredTimeSlot: "11:00 AM", // Not in ["09:00 AM", "10:30 AM", "02:00 PM", "03:30 PM"]
        },
        null, client, fixedNow
      ),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "INVALID_PREFERRED_TIME_SLOT");
        return true;
      }
    );
  });

  // 6. Deterministic ranking: date distance, priest availability, preferred slot, time, tie-breaker
  await t.test("deterministic ranking: preferredTimeSlot matches are ranked higher within same date distance", async () => {
    const client = createMockPrisma();
    const result = await getScheduleRecommendations(
      {
        parishId: 1,
        eventType: "WEDDING",
        preferredDate: "2026-09-15",
        dateFrom: "2026-09-15",
        dateTo: "2026-09-15",
        preferredTimeSlot: "02:00 PM",
      },
      null,
      client,
      fixedNow
    );

    assert.equal(result.recommendations[0].timeSlot, "02:00 PM");
    assert.ok(result.recommendations[0].reasons.includes("PREFERRED_TIME"));
  });

  // 7. Max 6 recommendations
  await t.test("caps output at MAX_RECOMMENDATIONS (6)", async () => {
    const client = createMockPrisma();
    const result = await getScheduleRecommendations(
      {
        parishId: 1,
        eventType: "WEDDING",
        preferredDate: "2026-09-15",
      },
      null,
      client,
      fixedNow
    );

    assert.equal(result.recommendations.length, 6);
  });

  // 8. Requested priest soft preference
  await t.test("requested priest: candidate retained even if priest is unavailable, with PREFERRED_PRIEST_UNAVAILABLE", async () => {
    const priest = {
      id: 7,
      name: "Fr. Santos",
      fullName: "Fr. Miguel Santos",
      isAssistant: false,
      status: "ACTIVE",
      parishId: 1,
      role: { roleName: "PRIEST" },
    };
    // Priest is on leave on 2026-09-15
    const priestConflicts = {
      leaves: [
        {
          id: 99,
          startDate: new Date("2026-09-15T00:00:00+08:00"),
          endDate: new Date("2026-09-15T23:59:59+08:00"),
        },
      ],
    };
    const client = createMockPrisma({ priest, priestConflicts });

    const result = await getScheduleRecommendations(
      {
        parishId: 1,
        eventType: "WEDDING",
        preferredDate: "2026-09-15",
        dateFrom: "2026-09-15",
        dateTo: "2026-09-16",
        requestedPriestId: 7,
      },
      null,
      client,
      fixedNow
    );

    // Candidates on Sep 15 should have preferredPriestAvailable: false and PREFERRED_PRIEST_UNAVAILABLE
    const sep15 = result.recommendations.find((r) => r.date === "2026-09-15");
    assert.ok(sep15);
    assert.equal(sep15.preferredPriestAvailable, false);
    assert.ok(sep15.reasons.includes("PREFERRED_PRIEST_UNAVAILABLE"));

    // Sep 16 candidates where priest is available should rank higher than Sep 15 candidates where priest is unavailable
    const availableCandidate = result.recommendations.find((r) => r.date === "2026-09-16");
    assert.ok(availableCandidate);
    assert.equal(availableCandidate.preferredPriestAvailable, true);
    assert.ok(availableCandidate.reasons.includes("PREFERRED_PRIEST_AVAILABLE"));
  });

  // 9. Privacy: safe DTO fields only
  await t.test("DTO privacy: omits endAt, capacity, confidential booking or conflict details", async () => {
    const client = createMockPrisma();
    const result = await getScheduleRecommendations(
      {
        parishId: 1,
        eventType: "WEDDING",
        preferredDate: "2026-09-15",
      },
      null,
      client,
      fixedNow
    );

    for (const r of result.recommendations) {
      assert.equal(r.endAt, undefined);
      assert.equal(r.remainingCapacity, undefined);
      assert.equal(r.score, undefined);
      assert.equal(r.conflicts, undefined);
      assert.ok(["date", "timeSlot", "startAt", "reasons"].every((k) => k in r));
    }
  });

  // 10. Empty result returns HTTP 200 shape with NO_SCHEDULE_RECOMMENDATIONS
  await t.test("empty recommendations returns code NO_SCHEDULE_RECOMMENDATIONS and empty array", async () => {
    const parish = createMockParish({
      availabilities: [
        {
          type: "PARISH_CLOSED",
          startDate: new Date("2026-09-01T00:00:00+08:00"),
          endDate: new Date("2026-12-31T23:59:59+08:00"), // closed entire horizon
        },
      ],
    });
    const client = createMockPrisma({ parish });
    const result = await getScheduleRecommendations(
      {
        parishId: 1,
        eventType: "WEDDING",
        preferredDate: "2026-09-15",
        dateFrom: "2026-09-10",
        dateTo: "2026-09-20",
      },
      null,
      client,
      fixedNow
    );

    assert.equal(result.success, true);
    assert.equal(result.code, "NO_SCHEDULE_RECOMMENDATIONS");
    assert.deepEqual(result.recommendations, []);
  });

  // 11. Route ordering verification
  await t.test("route ordering: /eligible-priests and /recommendations are registered before /:id", () => {
    const routeSource = fs.readFileSync(path.join(__dirname, "../routes/scheduleRoutes.js"), "utf8");
    const eligibleIdx = routeSource.indexOf('"/eligible-priests"');
    const recsIdx = routeSource.indexOf('"/recommendations"');
    const idIdx = routeSource.indexOf('"/:id"');

    assert.ok(eligibleIdx !== -1, "/eligible-priests must be in routeSource");
    assert.ok(recsIdx !== -1, "/recommendations must be in routeSource");
    assert.ok(idIdx !== -1, "/:id must be in routeSource");

    assert.ok(eligibleIdx < idIdx, "/eligible-priests must precede /:id");
    assert.ok(recsIdx < idIdx, "/recommendations must precede /:id");
  });

  // 12. Schema validation
  await t.test("scheduleRecommendationsSchema accepts valid payload and rejects invalid types", () => {
    const valid = {
      parishId: 1,
      eventType: "WEDDING",
      preferredDate: "2026-09-20",
    };
    assert.equal(scheduleRecommendationsSchema.safeParse(valid).success, true);

    const invalidDate = {
      parishId: 1,
      eventType: "WEDDING",
      preferredDate: "2026/09/20", // bad format
    };
    assert.equal(scheduleRecommendationsSchema.safeParse(invalidDate).success, false);
  });

  // 13. Strict Manila Calendar Dates
  await t.test("strict Manila dates: rejects invalid calendar dates and leap year violations", () => {
    const invalidDates = [
      "2026-02-31", // February 31st never exists
      "2026-02-29", // 2026 is not a leap year
      "2026-13-01", // Month 13
      "2026-00-10", // Month 0
      "2026-04-31", // April has 30 days
    ];

    for (const d of invalidDates) {
      const payload = {
        parishId: 1,
        eventType: "WEDDING",
        preferredDate: d,
      };
      const parseResult = scheduleRecommendationsSchema.safeParse(payload);
      assert.equal(parseResult.success, false, `Expected ${d} to be rejected by schema`);
    }

    // 2028 is a leap year -> 2028-02-29 must be accepted
    const leapDate = {
      parishId: 1,
      eventType: "WEDDING",
      preferredDate: "2028-02-29",
    };
    assert.equal(scheduleRecommendationsSchema.safeParse(leapDate).success, true, "2028-02-29 must be accepted");
  });

  // 14. Strict Positive ID Validation in Schema
  await t.test("strict ID validation: rejects '1e2', '+12', '1.5', '12abc', '', 0, -1, unsafe integers", () => {
    const rejectedIds = ["1e2", "+12", "1.5", "12abc", "", " 12 ", 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 10];

    for (const badId of rejectedIds) {
      const payload = {
        parishId: badId,
        eventType: "WEDDING",
        preferredDate: "2026-09-20",
      };
      assert.equal(scheduleRecommendationsSchema.safeParse(payload).success, false, `Expected parishId ${badId} to be rejected`);

      const reqPayload = {
        parishId: 1,
        requestedPriestId: badId,
        eventType: "WEDDING",
        preferredDate: "2026-09-20",
      };
      assert.equal(scheduleRecommendationsSchema.safeParse(reqPayload).success, false, `Expected requestedPriestId ${badId} to be rejected`);
    }

    // Accepts positive safe integer and digits-only string
    assert.equal(scheduleRecommendationsSchema.safeParse({ parishId: 1, eventType: "WEDDING", preferredDate: "2026-09-20" }).success, true);
    assert.equal(scheduleRecommendationsSchema.safeParse({ parishId: "1", eventType: "WEDDING", preferredDate: "2026-09-20" }).success, true);
    assert.equal(scheduleRecommendationsSchema.safeParse({ parishId: 12, requestedPriestId: 5, eventType: "WEDDING", preferredDate: "2026-09-20" }).success, true);
    assert.equal(scheduleRecommendationsSchema.safeParse({ parishId: 12, requestedPriestId: "5", eventType: "WEDDING", preferredDate: "2026-09-20" }).success, true);
  });

  // 15. Staff Tenancy Fail-Closed
  await t.test("staff tenancy: parish-scoped staff fails closed if parishId mismatch or missing staff parish", async () => {
    const client = createMockPrisma();

    // Matching staff parish -> passes
    const staffMatch = { role: "SECRETARY", parishId: 1 };
    const resPass = await getScheduleRecommendations(
      { parishId: 1, eventType: "WEDDING", preferredDate: "2026-09-15" },
      staffMatch,
      client,
      fixedNow
    );
    assert.equal(resPass.success, true);

    // Mismatched staff parish -> 403
    const staffMismatch = { role: "SECRETARY", parishId: 2 };
    await assert.rejects(
      async () => getScheduleRecommendations(
        { parishId: 1, eventType: "WEDDING", preferredDate: "2026-09-15" },
        staffMismatch,
        client,
        fixedNow
      ),
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "FORBIDDEN_PARISH_ACCESS");
        return true;
      }
    );

    // Missing staff parish -> 403
    const staffMissing = { role: "SECRETARY", parishId: null };
    await assert.rejects(
      async () => getScheduleRecommendations(
        { parishId: 1, eventType: "WEDDING", preferredDate: "2026-09-15" },
        staffMissing,
        client,
        fixedNow
      ),
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "FORBIDDEN_PARISH_ACCESS");
        return true;
      }
    );

    // Priest role with mismatched parish -> 403
    const priestMismatch = { role: "PRIEST", parishId: 99 };
    await assert.rejects(
      async () => getScheduleRecommendations(
        { parishId: 1, eventType: "WEDDING", preferredDate: "2026-09-15" },
        priestMismatch,
        client,
        fixedNow
      ),
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "FORBIDDEN_PARISH_ACCESS");
        return true;
      }
    );

    // Parishioner can select active parish
    const parishionerUser = { role: "PARISHIONER", parishId: 99 };
    const resParishioner = await getScheduleRecommendations(
      { parishId: 1, eventType: "WEDDING", preferredDate: "2026-09-15" },
      parishionerUser,
      client,
      fixedNow
    );
    assert.equal(resParishioner.success, true);
  });
});
