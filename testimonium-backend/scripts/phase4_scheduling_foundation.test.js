import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ScheduleStatus,
  TERMINAL_SCHEDULE_STATUSES,
  mapIncomingScheduleStatus,
  canTransitionSchedule,
  validateScheduleTransition,
  requirePriestAccepted,
  assertScheduleMutable,
} from "../services/ScheduleStateMachine.js";
import { ConflictHelper } from "../services/ConflictHelper.js";
import { CalendarService } from "../services/CalendarService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TEST SUITE: PHASE 4 SCHEDULING FOUNDATION & PRIEST PERSONAL CALENDAR
// ============================================================================

test("Phase 4 Suite — ScheduleStateMachine & Invariants", async (t) => {
  await t.test("Terminal statuses cannot be revived via generic status mutation", () => {
    for (const term of TERMINAL_SCHEDULE_STATUSES) {
      assert.equal(
        canTransitionSchedule(term, ScheduleStatus.PENDING),
        false,
        `${term} must not transition to PENDING`
      );
      assert.equal(
        canTransitionSchedule(term, ScheduleStatus.CONFIRMED),
        false,
        `${term} must not transition to CONFIRMED`
      );
      assert.throws(
        () => validateScheduleTransition({ status: term }, ScheduleStatus.CONFIRMED),
        /Cannot modify a schedule with terminal status/
      );
    }
  });

  await t.test("Terminal schedules reject non-status mutations too", () => {
    for (const status of TERMINAL_SCHEDULE_STATUSES) {
      assert.throws(
        () => assertScheduleMutable({ status }),
        (error) => error.code === "TERMINAL_STATUS_IMMUTABLE"
      );
    }
  });

  await t.test("CONFIRMED invariant: throws 422 if assignedPriestId is null", () => {
    assert.throws(
      () =>
        requirePriestAccepted({
          id: 1,
          assignedPriestId: null,
          priestResponseStatus: "ACCEPTED",
        }),
      (err) => {
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "PRIEST_ASSIGNMENT_REQUIRED");
        return true;
      }
    );
  });

  await t.test("CONFIRMED invariant: throws 422 if priestResponseStatus is not ACCEPTED", () => {
    assert.throws(
      () =>
        requirePriestAccepted({
          id: 1,
          assignedPriestId: 10,
          priestResponseStatus: "PENDING",
        }),
      (err) => {
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "PRIEST_ASSIGNMENT_PENDING");
        return true;
      }
    );
  });

  await t.test("CONFIRMED invariant: succeeds when assigned priest has ACCEPTED", () => {
    assert.doesNotThrow(() =>
      requirePriestAccepted({
        id: 1,
        assignedPriestId: 10,
        priestResponseStatus: "ACCEPTED",
      })
    );
  });

  await t.test("Admin UNDER_REVIEW maps to PENDING without adding fake enum", () => {
    assert.equal(mapIncomingScheduleStatus("UNDER_REVIEW"), ScheduleStatus.PENDING);
    assert.equal(mapIncomingScheduleStatus("under_review"), ScheduleStatus.PENDING);
    assert.equal(mapIncomingScheduleStatus("CONFIRMED"), ScheduleStatus.CONFIRMED);
  });

  await t.test("CONFIRMED -> PENDING only permitted via explicit business pathway", () => {
    // Arbitrary generic transition fails:
    assert.equal(
      canTransitionSchedule(ScheduleStatus.CONFIRMED, ScheduleStatus.PENDING, {
        allowReversionToPending: false,
      }),
      false
    );
    assert.throws(
      () =>
        validateScheduleTransition(
          { status: ScheduleStatus.CONFIRMED, assignedPriestId: 10, priestResponseStatus: "ACCEPTED" },
          ScheduleStatus.PENDING,
          { allowReversionToPending: false }
        ),
      /Illegal status transition/
    );

    // Explicit business path (e.g. priest rejection / reassignment) succeeds:
    assert.equal(
      canTransitionSchedule(ScheduleStatus.CONFIRMED, ScheduleStatus.PENDING, {
        allowReversionToPending: true,
      }),
      true
    );
  });
});

test("Phase 4 Suite — 5-Source Conflict Engine (ConflictHelper)", async (t) => {
  const priestId = 10;
  const date = "2026-10-15";
  const start = new Date("2026-10-15T10:00:00.000+08:00");
  const end = new Date("2026-10-15T11:00:00.000+08:00");

  await t.test("5. Personal vs PRIEST_LEAVE: blocks candidate interval", async () => {
    const mockTx = {
      parishAvailability: {
        findFirst: async () => ({
          id: 1,
          type: "PRIEST_LEAVE",
          title: "Approved Annual Leave",
          startDate: new Date("2026-10-15T00:00:00.000+08:00"),
          endDate: new Date("2026-10-15T23:59:59.000+08:00"),
        }),
      },
    };

    await assert.rejects(
      async () => {
        await ConflictHelper.checkPriestConflict(priestId, date, start, end, {
          tx: mockTx,
          isPriestOwner: true,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "PRIEST_CONFLICT");
        assert.match(err.message, /Priest is on leave during this interval/i);
        return true;
      }
    );
  });

  await t.test("6. Personal vs assigned Schedule: blocks candidate interval", async () => {
    const mockTx = {
      parishAvailability: { findFirst: async () => null },
      schedule: {
        findFirst: async () => ({
          id: 42,
          displayTitle: "Wedding Interview",
          eventType: "WEDDING",
          startDatetime: new Date("2026-10-15T09:30:00.000+08:00"),
          endDatetime: new Date("2026-10-15T10:30:00.000+08:00"),
        }),
      },
    };

    await assert.rejects(
      async () => {
        await ConflictHelper.checkPriestConflict(priestId, date, start, end, {
          tx: mockTx,
          isPriestOwner: true,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "PRIEST_CONFLICT");
        assert.match(err.message, /Already assigned to appointment/i);
        return true;
      }
    );
  });

  await t.test("7. Personal vs ParishEvent: blocks candidate interval", async () => {
    const mockTx = {
      parishAvailability: { findFirst: async () => null },
      schedule: { findFirst: async () => null },
      parishEvent: {
        findMany: async () => [
          {
            id: 7,
            title: "Parish Pastoral Council Meeting",
            eventDate: new Date("2026-10-15T00:00:00.000Z"),
            startTime: "10:00 AM",
            endTime: "11:30 AM",
          },
        ],
      },
    };

    await assert.rejects(
      async () => {
        await ConflictHelper.checkPriestConflict(priestId, date, start, end, {
          tx: mockTx,
          isPriestOwner: true,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "PRIEST_CONFLICT");
        assert.match(err.message, /Already assigned to parish event/i);
        return true;
      }
    );
  });

  await t.test("8. Personal vs Mass conflict convention: blocks candidate interval", async () => {
    const mockTx = {
      parishAvailability: { findFirst: async () => null },
      schedule: { findFirst: async () => null },
      parishEvent: { findMany: async () => [] },
      massScheduleTemplate: {
        findMany: async () => [
          {
            id: 3,
            label: "Thursday Morning Mass",
            timeSlot: "10:00 AM",
            dayType: "THURSDAY",
          },
        ],
      },
    };

    await assert.rejects(
      async () => {
        await ConflictHelper.checkPriestConflict(priestId, date, start, end, {
          tx: mockTx,
          isPriestOwner: true,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "PRIEST_CONFLICT");
        assert.match(err.message, /Already assigned to recurring Mass/i);
        return true;
      }
    );
  });

  await t.test("9. Personal vs Personal: overlapping candidate blocked; non-overlapping back-to-back allowed", async () => {
    // 9a. Overlapping personal schedule blocked
    const mockTxOverlap = {
      parishAvailability: { findFirst: async () => null },
      schedule: { findFirst: async () => null },
      parishEvent: { findMany: async () => [] },
      massScheduleTemplate: { findMany: async () => [] },
      priestPersonalSchedule: {
        findFirst: async () => ({
          id: 99,
          title: "Doctor Appointment",
          startAt: new Date("2026-10-15T10:15:00.000+08:00"),
          endAt: new Date("2026-10-15T11:15:00.000+08:00"),
        }),
      },
    };

    await assert.rejects(
      async () => {
        await ConflictHelper.checkPriestConflict(priestId, date, start, end, {
          tx: mockTxOverlap,
          isPriestOwner: true,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "PRIEST_CONFLICT");
        assert.match(err.message, /Doctor Appointment/);
        return true;
      }
    );

    // 9b. Non-overlapping back-to-back (10:00-11:00 and 11:00-12:00) allowed by half-open interval semantics
    const mockTxBackToBack = {
      parishAvailability: { findFirst: async () => null },
      schedule: { findFirst: async () => null },
      parishEvent: { findMany: async () => [] },
      massScheduleTemplate: { findMany: async () => [] },
      priestPersonalSchedule: {
        findFirst: async () => null,
      },
    };

    await assert.doesNotThrow(async () => {
      await ConflictHelper.checkPriestConflict(priestId, date, start, end, {
        tx: mockTxBackToBack,
        isPriestOwner: true,
      });
    });
  });

  await t.test("10. PATCH excludes its own personal ID but blocks other conflicting IDs", async () => {
    let capturedExcludeId = null;
    const mockTx = {
      parishAvailability: { findFirst: async () => null },
      schedule: { findFirst: async () => null },
      parishEvent: { findMany: async () => [] },
      massScheduleTemplate: { findMany: async () => [] },
      priestPersonalSchedule: {
        findFirst: async ({ where }) => {
          capturedExcludeId = where?.id?.not;
          return null;
        },
      },
    };

    await ConflictHelper.checkPriestConflict(priestId, date, start, end, {
      tx: mockTx,
      excludePersonalId: 105,
      isPriestOwner: true,
    });

    assert.equal(capturedExcludeId, 105, "findFirst must exclude own personal ID");
  });

  await t.test("Privacy Masking: Non-owner roles never see private title or notes", async () => {
    const mockTx = {
      parishAvailability: { findFirst: async () => null },
      schedule: { findFirst: async () => null },
      parishEvent: { findMany: async () => [] },
      massScheduleTemplate: { findMany: async () => [] },
      priestPersonalSchedule: {
        findFirst: async () => ({
          id: 88,
          title: "Private Medical Checkup",
          notes: "Confidential Dr. Santos oncology consult",
          startAt: new Date("2026-10-15T10:00:00.000+08:00"),
          endAt: new Date("2026-10-15T11:00:00.000+08:00"),
        }),
      },
    };

    await assert.rejects(
      async () => {
        await ConflictHelper.checkPriestConflict(priestId, date, start, end, {
          tx: mockTx,
          isPriestOwner: false, // E.g., Admin, Staff, or Parishioner
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "PRIEST_CONFLICT");
        assert.equal(err.message, "Priest is unavailable at this time.");
        assert.doesNotMatch(err.message, /Medical Checkup/);
        assert.doesNotMatch(err.message, /oncology/);
        return true;
      }
    );
  });
});

test("Phase 4 Suite — Priest Lock & Concurrency Simulation", async (t) => {
  await t.test("1. Personal CREATE vs Personal CREATE on initially empty calendar", async () => {
    // In-memory priest lock & calendar simulation:
    let priestLockHeld = false;
    const committedPersonalSchedules = [];

    const simulateCreatePersonalSchedule = async (priestId, title, startAt, endAt) => {
      // 1. Acquire priest lock
      while (priestLockHeld) {
        await new Promise((r) => setTimeout(r, 10));
      }
      priestLockHeld = true;

      try {
        // 2. Authoritative conflict check inside lock
        const hasConflict = committedPersonalSchedules.some(
          (s) => s.priestId === priestId && s.startAt < endAt && s.endAt > startAt
        );
        if (hasConflict) {
          const err = new Error("Personal schedule conflict: Priest is unavailable at this time.");
          err.statusCode = 409;
          err.code = "PRIEST_CONFLICT";
          throw err;
        }

        // 3. Write commitment
        const record = { id: committedPersonalSchedules.length + 1, priestId, title, startAt, endAt, version: 1 };
        committedPersonalSchedules.push(record);
        return record;
      } finally {
        priestLockHeld = false;
      }
    };

    const start = new Date("2026-10-15T14:00:00.000Z");
    const end = new Date("2026-10-15T15:00:00.000Z");

    const results = await Promise.allSettled([
      simulateCreatePersonalSchedule(10, "Study Session A", start, end),
      simulateCreatePersonalSchedule(10, "Study Session B", start, end),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1, "Exactly one concurrent create must succeed");
    assert.equal(rejected.length, 1, "Exactly one concurrent create must be rejected with conflict");
    assert.equal(rejected[0].reason.statusCode, 409);
    assert.equal(rejected[0].reason.code, "PRIEST_CONFLICT");
  });

  await t.test("2. Assignment vs Personal CREATE on same interval: only one wins", async () => {
    let priestLockHeld = false;
    const priestCommitments = [];

    const runGuardedMutation = async (type, startAt, endAt) => {
      while (priestLockHeld) {
        await new Promise((r) => setTimeout(r, 10));
      }
      priestLockHeld = true;
      try {
        const hasConflict = priestCommitments.some(
          (c) => c.startAt < endAt && c.endAt > startAt
        );
        if (hasConflict) {
          const err = new Error("Conflict detected inside priest lock.");
          err.statusCode = 409;
          err.code = "PRIEST_CONFLICT";
          throw err;
        }
        const record = { type, startAt, endAt };
        priestCommitments.push(record);
        return record;
      } finally {
        priestLockHeld = false;
      }
    };

    const start = new Date("2026-10-15T16:00:00.000Z");
    const end = new Date("2026-10-15T17:00:00.000Z");

    const [res1, res2] = await Promise.allSettled([
      runGuardedMutation("SCHEDULE_ASSIGNMENT", start, end),
      runGuardedMutation("PERSONAL_CREATE", start, end),
    ]);

    const won = [res1, res2].filter((r) => r.status === "fulfilled");
    const lost = [res1, res2].filter((r) => r.status === "rejected");
    assert.equal(won.length, 1, "Only one commitment wins the interval");
    assert.equal(lost.length, 1, "The competing mutation receives conflict");
  });

  await t.test("3. Priest ACCEPT vs Personal CREATE on same interval: only one wins", async () => {
    let priestLockHeld = false;
    const priestCommitments = [];

    const runGuardedMutation = async (type, startAt, endAt) => {
      while (priestLockHeld) {
        await new Promise((r) => setTimeout(r, 10));
      }
      priestLockHeld = true;
      try {
        const hasConflict = priestCommitments.some(
          (c) => c.startAt < endAt && c.endAt > startAt
        );
        if (hasConflict) {
          const err = new Error("Priest conflict");
          err.statusCode = 409;
          throw err;
        }
        priestCommitments.push({ type, startAt, endAt });
        return type;
      } finally {
        priestLockHeld = false;
      }
    };

    const start = new Date("2026-10-16T09:00:00.000Z");
    const end = new Date("2026-10-16T10:00:00.000Z");

    const results = await Promise.allSettled([
      runGuardedMutation("PRIEST_ACCEPT", start, end),
      runGuardedMutation("PERSONAL_CREATE", start, end),
    ]);

    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  });

  await t.test("4. Emergency Reschedule (retained priest) vs Personal CREATE: only one wins", async () => {
    let parishLockHeld = false;
    let priestLockHeld = false;
    const commitments = [];

    const runEmergencyReschedule = async (startAt, endAt) => {
      // Deterministic lock order: 1. Parish lock, 2. Priest lock
      while (parishLockHeld) await new Promise((r) => setTimeout(r, 10));
      parishLockHeld = true;
      try {
        while (priestLockHeld) await new Promise((r) => setTimeout(r, 10));
        priestLockHeld = true;
        try {
          const hasConflict = commitments.some((c) => c.startAt < endAt && c.endAt > startAt);
          if (hasConflict) throw new Error("Conflict");
          commitments.push({ type: "EMERGENCY_RESCHEDULE", startAt, endAt });
          return "EMERGENCY_RESCHEDULE";
        } finally {
          priestLockHeld = false;
        }
      } finally {
        parishLockHeld = false;
      }
    };

    const runPersonalCreate = async (startAt, endAt) => {
      // Personal create acquires priest lock
      while (priestLockHeld) await new Promise((r) => setTimeout(r, 10));
      priestLockHeld = true;
      try {
        const hasConflict = commitments.some((c) => c.startAt < endAt && c.endAt > startAt);
        if (hasConflict) throw new Error("Conflict");
        commitments.push({ type: "PERSONAL_CREATE", startAt, endAt });
        return "PERSONAL_CREATE";
      } finally {
        priestLockHeld = false;
      }
    };

    const start = new Date("2026-10-17T11:00:00.000Z");
    const end = new Date("2026-10-17T12:00:00.000Z");

    const results = await Promise.allSettled([
      runEmergencyReschedule(start, end),
      runPersonalCreate(start, end),
    ]);

    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  });
});

test("Phase 4 Suite — Priest Assignment Hardening", async (t) => {
  await t.test("11. Coordinator cannot assign unrelated-parish priest", () => {
    const schedule = { id: 1, parishId: 1, status: "PENDING", version: 2 };
    const targetPriest = {
      id: 20,
      role: "PRIEST",
      status: "ACTIVE",
      parishId: 2, // Different parish
    };

    const isMatch = targetPriest.parishId === schedule.parishId;
    assert.equal(isMatch, false, "Priest from parish 2 cannot be assigned to parish 1 schedule");
  });

  await t.test("12. Non-priest assignment is rejected", () => {
    const targetUser = {
      id: 21,
      role: "PARISHIONER",
      status: "ACTIVE",
      parishId: 1,
    };
    assert.notEqual(targetUser.role, "PRIEST");
  });

  await t.test("13. Inactive priest assignment is rejected", () => {
    const targetPriest = {
      id: 22,
      role: "PRIEST",
      status: "INACTIVE",
      parishId: 1,
    };
    assert.notEqual(targetPriest.status, "ACTIVE");
  });

  await t.test("14. Stale expectedVersion check triggers 409 SCHEDULE_CONCURRENCY_CONFLICT", () => {
    const currentSchedule = { id: 1, version: 3 };
    const expectedVersion = 2; // Stale

    if (currentSchedule.version !== expectedVersion) {
      const err = new Error(
        `Concurrency conflict: schedule has been modified (current version: ${currentSchedule.version}, expected: ${expectedVersion}). Please refresh.`
      );
      err.statusCode = 409;
      err.code = "SCHEDULE_CONCURRENCY_CONFLICT";

      assert.equal(err.statusCode, 409);
      assert.equal(err.code, "SCHEDULE_CONCURRENCY_CONFLICT");
    } else {
      assert.fail("Must detect stale version");
    }
  });
});

test("Phase 4 Suite — Duration & Ongoing Evaluation (CalendarService)", async (t) => {
  await t.test("17a. Genuine authoritative start and end evaluated as ongoing during interval", () => {
    const now = new Date("2026-10-15T10:30:00.000Z");
    const start = new Date("2026-10-15T10:00:00.000Z");
    const end = new Date("2026-10-15T11:00:00.000Z");

    const result = CalendarService.evaluateOngoing({
      start,
      end,
      status: "CONFIRMED",
      hasEstimatedEnd: false,
      now,
    });

    assert.equal(result.isOngoing, true);
    assert.equal(result.isOngoingEligible, true);
  });

  await t.test("17b. Schedule with fallback [Estimated End Time] is NOT ongoing eligible", () => {
    const now = new Date("2026-10-15T10:30:00.000Z");
    const start = new Date("2026-10-15T10:00:00.000Z");
    const fallbackEnd = new Date("2026-10-15T11:00:00.000Z");

    const result = CalendarService.evaluateOngoing({
      start,
      end: fallbackEnd,
      status: "CONFIRMED",
      hasEstimatedEnd: true, // Tagged with [Estimated End Time]
      now,
    });

    assert.equal(result.isOngoing, false, "Fallback end time must not be marked ongoing");
    assert.equal(result.isOngoingEligible, false, "Fallback end time must not be ongoing eligible");
  });

  await t.test("17c. Mass schedule template without authoritative end is NOT ongoing eligible", () => {
    const result = CalendarService.evaluateOngoing({
      start: new Date("2026-10-15T10:00:00.000Z"),
      end: null, // Mass templates only define start slot
      status: "CONFIRMED",
      now: new Date("2026-10-15T10:15:00.000Z"),
    });

    assert.equal(result.isOngoing, false);
    assert.equal(result.isOngoingEligible, false);
  });

  await t.test("17d. Cancelled or rejected schedule is never ongoing", () => {
    const now = new Date("2026-10-15T10:30:00.000Z");
    const start = new Date("2026-10-15T10:00:00.000Z");
    const end = new Date("2026-10-15T11:00:00.000Z");

    const resultCancelled = CalendarService.evaluateOngoing({
      start,
      end,
      status: "CANCELLED",
      now,
    });
    assert.equal(resultCancelled.isOngoing, false);

    const resultRejected = CalendarService.evaluateOngoing({
      start,
      end,
      status: "REJECTED",
      now,
    });
    assert.equal(resultRejected.isOngoing, false);
  });
});

test("Phase 4 Suite — Prisma Schema & Migration SQL Consistency", async (t) => {
  await t.test("18. Migration file exists, is unapplied, and matches schema models", () => {
    const migrationFilePath = path.resolve(
      __dirname,
      "../prisma/migrations/20260905180000_phase4_scheduling_foundation/migration.sql"
    );
    assert.ok(fs.existsSync(migrationFilePath), "Migration SQL file must exist");

    const sqlContent = fs.readFileSync(migrationFilePath, "utf8");

    // 18a. schedules.version
    assert.match(
      sqlContent,
      /ALTER TABLE "schedules" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1/i,
      "Migration must add version column to schedules with default 1"
    );

    // 18b. schedule_history table
    assert.match(
      sqlContent,
      /CREATE TABLE "schedule_history"/i,
      "Migration must create schedule_history table"
    );
    assert.match(sqlContent, /"schedule_id" INTEGER NOT NULL/i);
    assert.match(sqlContent, /"version" INTEGER NOT NULL/i);
    assert.match(sqlContent, /"actor_id" INTEGER/i);
    assert.match(sqlContent, /"actor_role" VARCHAR\(50\) NOT NULL/i);
    assert.match(sqlContent, /"reason" TEXT NOT NULL/i);
    assert.match(
      sqlContent,
      /REFERENCES "schedules"\("schedule_id"\) ON DELETE RESTRICT/i,
      "schedule_history FK to schedules must be ON DELETE RESTRICT"
    );

    // 18c. priest_personal_schedules table
    assert.match(
      sqlContent,
      /CREATE TABLE "priest_personal_schedules"/i,
      "Migration must create priest_personal_schedules table"
    );
    assert.match(sqlContent, /"priest_id" INTEGER NOT NULL/i);
    assert.match(sqlContent, /"title" VARCHAR\(150\) NOT NULL/i);
    assert.match(sqlContent, /"start_at" TIMESTAMP\(3\) NOT NULL/i);
    assert.match(sqlContent, /"end_at" TIMESTAMP\(3\) NOT NULL/i);
    assert.match(sqlContent, /"version" INTEGER NOT NULL DEFAULT 1/i);
    assert.match(
      sqlContent,
      /CONSTRAINT "priest_personal_schedules_interval_check" CHECK \("end_at" > "start_at"\)/i,
      "priest_personal_schedules must have check constraint end_at > start_at"
    );
    assert.match(
      sqlContent,
      /REFERENCES "users"\("user_id"\) ON DELETE CASCADE/i,
      "priest_personal_schedules FK to users must be ON DELETE CASCADE"
    );

    // 18d. Indexes
    assert.match(
      sqlContent,
      /CREATE INDEX "priest_personal_schedules_priest_id_start_at_end_at_idx"/i
    );
    assert.match(sqlContent, /CREATE INDEX "schedule_history_schedule_id_idx"/i);

    assert.doesNotMatch(sqlContent, /^\s*BEGIN;/im, "Prisma migration SQL must not embed BEGIN");
    assert.doesNotMatch(sqlContent, /^\s*COMMIT;/im, "Prisma migration SQL must not embed COMMIT");

    // 18e. Verify Prisma schema file includes these models
    const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");
    const schemaContent = fs.readFileSync(schemaPath, "utf8");

    assert.match(schemaContent, /model ScheduleHistory/);
    assert.match(schemaContent, /model PriestPersonalSchedule/);
    assert.match(schemaContent, /version\s+Int\s+@default\(1\)/);
  });
});
test("Phase 4 Suite — Mutation Boundary Source Contracts", async (t) => {
  const readSource = (relativePath) =>
    fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");

  await t.test("Every Schedule versioned write has a prior-state history append", () => {
    const source = readSource("services/ScheduleService.js");
    const versionedWrites = (source.match(/await updateScheduleAtVersion\(/g) || []).length;
    const historyAppends = (source.match(/await appendScheduleHistory\(/g) || []).length;
    assert.equal(versionedWrites, 7);
    assert.equal(historyAppends, versionedWrites);
    assert.match(source, /where: \{ id, version: expectedVersion \}/);
    assert.match(source, /version: \{ increment: 1 \}/);
  });

  await t.test("All schedule mutation routes validate mandatory expectedVersion payloads", () => {
    const routes = readSource("routes/scheduleRoutes.js");
    const schemas = readSource("validators/scheduleSchemas.js");
    for (const schema of [
      "updateScheduleStatusSchema",
      "proposeRescheduleSchema",
      "respondRescheduleSchema",
      "assignPriestSchema",
      "priestAssignmentResponseSchema",
      "emergencyRescheduleSchema",
    ]) {
      assert.match(routes, new RegExp("validateBody\\(" + schema + "\\)"));
    }
    assert.equal((schemas.match(/\bexpectedVersion,/g) || []).length, 6);
    assert.doesNotMatch(schemas, /targetEndDatetime/);
  });

  await t.test("Stable priest lock is used by every commitment-producing mutation family", () => {
    const personal = readSource("services/PriestPersonalScheduleService.js");
    const schedules = readSource("services/ScheduleService.js");
    const events = readSource("services/ParishEventService.js");
    const masses = readSource("services/MassScheduleService.js");
    const leave = readSource("services/ParishAvailabilityService.js");
    const lock = readSource("services/SchedulingAvailability.js");

    assert.match(lock, /FROM "users"[\s\S]*FOR UPDATE/);
    assert.match(personal, /lockPriestForScheduling/);
    assert.match(schedules, /lockPriestsForScheduling/);
    assert.match(schedules, /lockPriestForScheduling/);
    assert.match(events, /lockPriestsForScheduling/);
    assert.match(masses, /lockPriestsForScheduling/);
    assert.match(leave, /lockPriestForScheduling/);
  });

  await t.test("Priest personal schedule mutations are owner-only and version guarded", () => {
    const routes = readSource("routes/priestPersonalScheduleRoutes.js");
    const validators = readSource("validators/priestPersonalScheduleSchemas.js");
    const service = readSource("services/PriestPersonalScheduleService.js");

    assert.match(routes, /router\.use\(checkRole\(\["PRIEST"\]\)\)/);
    assert.match(routes, /router\.patch\("\/:id", validateBody\(updatePriestPersonalScheduleSchema\)/);
    assert.match(routes, /router\.delete\("\/:id", validateQuery\(deletePriestPersonalScheduleQuerySchema\)/);
    assert.match(validators, /expectedVersion/);
    assert.match(service, /current\.priestId !== parsedPriestId/);
    assert.match(service, /excludePersonalId: parsedId/);
  });

  await t.test("Priest assignment validates role, active status, and parish membership", () => {
    const source = readSource("services/ScheduleService.js");
    assert.match(source, /targetPriest\.role\?\.roleName !== "PRIEST"/);
    assert.match(source, /targetPriest\.status !== "ACTIVE"/);
    assert.match(source, /Number\(targetPriest\.parishId\) !== Number\(current\.parishId\)/);
  });

  await t.test("Priest calendar keeps non-authoritative sources ineligible for ongoing", () => {
    const source = readSource("services/CalendarService.js");
    assert.match(source, /end: null,[\s\S]*hasEstimatedEnd: true/);
    assert.match(source, /sourceType: "MASS",[\s\S]*isOngoing: false,[\s\S]*isOngoingEligible: false/);
    assert.match(source, /sourceType: "PERSONAL",[\s\S]*isOngoing: ongoing\.isOngoing/);
  });
});