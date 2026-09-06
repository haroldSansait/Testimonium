import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalizePriestId,
  lockPriestForScheduling,
  lockPriestsForScheduling,
} from "../services/SchedulingAvailability.js";
import {
  ConflictHelper,
  resolveScheduleConflictInterval,
} from "../services/ConflictHelper.js";
import { CalendarService } from "../services/CalendarService.js";
import {
  validateDisposableDatabaseUrl,
  isDisposableDatabaseConfigured,
} from "../test-utils/disposableDbGuard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Phase 4 Blocker Correction Suite — Strict Priest ID & Locking", async (t) => {
  await t.test("1. Strict valid priest ID: accepts positive safe integer and strict digit string", () => {
    assert.equal(normalizePriestId(123), 123);
    assert.equal(normalizePriestId("123"), 123);
    assert.equal(normalizePriestId(1), 1);
    assert.equal(normalizePriestId("999999"), 999999);
  });

  await t.test("2. Malformed priest ID rejected: null, undefined, negatives, strings with letters", () => {
    const invalidInputs = [null, undefined, -1, -100, "abc", "", "   ", NaN, Infinity, -Infinity, {}, [], true, false];
    for (const input of invalidInputs) {
      assert.throws(
        () => normalizePriestId(input),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, "INVALID_PRIEST_ID");
          return true;
        },
        `Expected ${JSON.stringify(input)} to be rejected with INVALID_PRIEST_ID`
      );
    }
  });

  await t.test("3. '123junk' and ' 123junk' rejected: parseInt vulnerabilities closed", () => {
    const junkInputs = ["123junk", " 123junk", "123 ", " 123", "junk123", "123_456", "123e4"];
    for (const input of junkInputs) {
      assert.throws(
        () => normalizePriestId(input),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, "INVALID_PRIEST_ID");
          return true;
        },
        `Expected ${JSON.stringify(input)} to be rejected`
      );
    }
  });

  await t.test("4. Decimal rejected: 1.5 and '1.5' strictly forbidden", () => {
    assert.throws(
      () => normalizePriestId(1.5),
      (err) => err.code === "INVALID_PRIEST_ID"
    );
    assert.throws(
      () => normalizePriestId("1.5"),
      (err) => err.code === "INVALID_PRIEST_ID"
    );
    assert.throws(
      () => normalizePriestId(0.1),
      (err) => err.code === "INVALID_PRIEST_ID"
    );
  });

  await t.test("5. Zero rejected: 0 and '0' rejected", () => {
    assert.throws(
      () => normalizePriestId(0),
      (err) => err.code === "INVALID_PRIEST_ID"
    );
    assert.throws(
      () => normalizePriestId("0"),
      (err) => err.code === "INVALID_PRIEST_ID"
    );
  });

  await t.test("6. Missing priest row fails closed: throws 404 PRIEST_NOT_FOUND", async () => {
    const mockTxEmpty = {
      $queryRaw: async () => [],
    };
    await assert.rejects(
      async () => {
        await lockPriestForScheduling(mockTxEmpty, 42);
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "PRIEST_NOT_FOUND");
        return true;
      }
    );

    const mockTxFound = {
      $queryRaw: async () => [{ user_id: 42 }],
    };
    const lockedId = await lockPriestForScheduling(mockTxFound, 42);
    assert.equal(lockedId, 42);
  });

  await t.test("7. Multi-lock rejects invalid member completely: does NOT lock valid members", async () => {
    const mockTx = {
      calls: [],
      $queryRaw: async (query, ...params) => {
        mockTx.calls.push(params);
        return [{ user_id: params[0] }];
      },
    };

    await assert.rejects(
      async () => {
        await lockPriestsForScheduling(mockTx, [4, "7junk", 2]);
      },
      (err) => {
        assert.equal(err.code, "INVALID_PRIEST_ID");
        return true;
      }
    );

    assert.equal(mockTx.calls.length, 0, "No lock queries should be executed if any member is invalid");
  });

  await t.test("8. Deterministic sorted lock order: de-duplicates and locks ascending numerically", async () => {
    const lockedIds = [];
    const mockTx = {
      $queryRaw: async (_query, id) => {
        lockedIds.push(id);
        return [{ user_id: id }];
      },
    };

    const result = await lockPriestsForScheduling(mockTx, [7, "2", 4, 2, "7"]);
    assert.deepEqual(result, [2, 4, 7]);
    assert.deepEqual(lockedIds, [2, 4, 7]);
  });
});

test("Phase 4 Blocker Correction Suite — Lock Ordering & Atomicity Invariants", async (t) => {
  await t.test("9. Canonical lock order: ParishService source proves parish locked before priest", () => {
    const parishServiceSource = fs.readFileSync(
      path.resolve(__dirname, "../services/ParishService.js"),
      "utf-8"
    );

    const parishLockIdx = parishServiceSource.indexOf("lockParishSchedulingConfiguration(tx");
    const priestLockIdx = parishServiceSource.indexOf("lockPriestsForScheduling(tx");
    assert.ok(parishLockIdx > -1, "Must call lockParishSchedulingConfiguration");
    assert.ok(priestLockIdx > -1, "Must call lockPriestsForScheduling");
    assert.ok(
      parishLockIdx < priestLockIdx,
      "Parish lock must occur BEFORE priest lock in ParishService"
    );
  });

  await t.test("10. MassScheduleService proves parish locked before priest", () => {
    const massServiceSource = fs.readFileSync(
      path.resolve(__dirname, "../services/MassScheduleService.js"),
      "utf-8"
    );

    const parishLockIdx = massServiceSource.indexOf("lockParishSchedulingConfiguration(tx");
    const priestLockIdx = massServiceSource.indexOf("lockPriestsForScheduling(tx");
    assert.ok(parishLockIdx > -1);
    assert.ok(priestLockIdx > -1);
    assert.ok(
      parishLockIdx < priestLockIdx,
      "Parish lock must occur BEFORE priest lock in MassScheduleService"
    );
  });

  await t.test("11. Emergency Reschedule proves parish locked before priest", () => {
    const scheduleServiceSource = fs.readFileSync(
      path.resolve(__dirname, "../services/ScheduleService.js"),
      "utf-8"
    );

    const emergencyRescheduleFn = scheduleServiceSource.slice(
      scheduleServiceSource.indexOf("async emergencyReschedule(")
    );
    const parishLockIdx = emergencyRescheduleFn.indexOf("lockParishSchedulingConfiguration(tx");
    const priestLockIdx = emergencyRescheduleFn.indexOf("lockPriestsForScheduling(tx");
    assert.ok(parishLockIdx > -1);
    assert.ok(priestLockIdx > -1);
    assert.ok(
      parishLockIdx < priestLockIdx,
      "Parish lock must occur BEFORE priest lock in emergencyReschedule"
    );
  });

  await t.test("12. Transfer and Disable cleanup in UserService is atomic with DB update before Firebase", () => {
    const userServiceSource = fs.readFileSync(
      path.resolve(__dirname, "../services/UserService.js"),
      "utf-8"
    );

    // Verify disableUser has transaction containing lock, cleanup, updateStatus before firebaseAdminService call
    const disableUserFn = userServiceSource.slice(
      userServiceSource.indexOf("async disableUser(")
    );
    const txStart = disableUserFn.indexOf("await prisma.$transaction(");
    const cleanupCall = disableUserFn.indexOf("cleanupPriestAssignmentsFromParish(");
    const updateStatusCall = disableUserFn.indexOf("update({");
    const firebaseCall = disableUserFn.indexOf("this.firebaseAdminService.updateUser(");

    assert.ok(txStart > -1, "disableUser must run inside prisma.$transaction");
    assert.ok(cleanupCall > txStart, "cleanup must occur inside transaction");
    assert.ok(updateStatusCall > cleanupCall, "status update must occur after cleanup inside transaction");
    assert.ok(firebaseCall > updateStatusCall, "Firebase update must occur AFTER database transaction");
  });
});

test("Phase 4 Blocker Correction Suite — Nullable Schedule Interval & Fail-Closed Conflict Engine", async (t) => {
  await t.test("13. Nullable interval Priority A: Explicit authoritative start+end", () => {
    const schedule = {
      startDatetime: new Date("2026-10-15T10:00:00.000+08:00"),
      endDatetime: new Date("2026-10-15T11:00:00.000+08:00"),
    };
    const resolved = resolveScheduleConflictInterval(schedule);
    assert.equal(resolved.source, "AUTHORITATIVE");
    assert.equal(resolved.isEstimated, false);
    assert.equal(resolved.isOngoingEligible, true);
    assert.equal(resolved.unresolved, false);
    assert.equal(resolved.end.getTime() - resolved.start.getTime(), 3600000);
  });

  await t.test("14. Nullable interval Priority B: startDatetime exists, end missing -> operational fallback (1 hr), not ongoing eligible", () => {
    const schedule = {
      startDatetime: new Date("2026-10-15T10:00:00.000+08:00"),
      endDatetime: null,
    };
    const resolved = resolveScheduleConflictInterval(schedule);
    assert.equal(resolved.source, "FALLBACK_DURATION");
    assert.equal(resolved.isEstimated, true);
    assert.equal(resolved.isOngoingEligible, false, "Estimated fallback MUST NOT be ongoing eligible");
    assert.equal(resolved.unresolved, false);
    assert.equal(resolved.end.getTime() - resolved.start.getTime(), 3600000);
  });

  await t.test("15. Nullable interval Priority C: Recoverable legacy schedule without explicit start -> derived from remarks", () => {
    const schedule = {
      requestedDate: new Date("2026-10-15T00:00:00.000Z"),
      startDatetime: null,
      endDatetime: null,
      remarks: "Time Slot: 09:00 AM. [Estimated End Time] Notes: please bring copies",
    };
    const resolved = resolveScheduleConflictInterval(schedule);
    assert.equal(resolved.source, "RECOVERED_SLOT");
    assert.equal(resolved.isEstimated, true);
    assert.equal(resolved.isOngoingEligible, false);
    assert.equal(resolved.unresolved, false);
    assert.match(resolved.start.toISOString(), /2026-10-15/);
    assert.equal(resolved.end.getTime() - resolved.start.getTime(), 3600000);
  });

  await t.test("16. Nullable interval Priority D: Truly unresolvable legacy schedule fails closed", () => {
    const schedule = {
      requestedDate: new Date("2026-10-15T00:00:00.000Z"),
      startDatetime: null,
      endDatetime: null,
      remarks: "Unstructured legacy comment with no slot",
    };

    // When allowUnresolved = false, throws PRIEST_AVAILABILITY_UNDETERMINED
    assert.throws(
      () => resolveScheduleConflictInterval(schedule, { allowUnresolved: false }),
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "PRIEST_AVAILABILITY_UNDETERMINED");
        return true;
      }
    );

    // When allowUnresolved = true, returns unresolved indicator
    const result = resolveScheduleConflictInterval(schedule, { allowUnresolved: true });
    assert.equal(result.unresolved, true);
    assert.equal(result.start, null);
    assert.equal(result.end, null);
  });

  await t.test("17. ConflictHelper: Overlapping Schedule detected for assigned priest (Priority A)", async () => {
    const mockTx = {
      parishAvailability: { findFirst: async () => null },
      schedule: {
        findMany: async () => [
          {
            id: 101,
            displayTitle: "Existing Confirmed Mass",
            eventType: "MASS",
            startDatetime: new Date("2026-10-15T10:00:00.000+08:00"),
            endDatetime: new Date("2026-10-15T11:00:00.000+08:00"),
            status: "CONFIRMED",
          },
        ],
      },
      parishEvent: { findMany: async () => [] },
      priestPersonalSchedule: { findFirst: async () => null },
      massScheduleTemplate: { findMany: async () => [] },
    };

    await assert.rejects(
      async () => {
        await ConflictHelper.checkPriestConflict(
          10,
          "2026-10-15",
          new Date("2026-10-15T10:30:00.000+08:00"),
          new Date("2026-10-15T11:30:00.000+08:00"),
          { tx: mockTx }
        );
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "PRIEST_CONFLICT");
        return true;
      }
    );
  });

  await t.test("18. ConflictHelper: Operational fallback Schedule blocks overlap (Priority B)", async () => {
    const mockTx = {
      parishAvailability: { findFirst: async () => null },
      schedule: {
        findMany: async () => [
          {
            id: 102,
            displayTitle: "Appointment with Fallback Duration",
            eventType: "BAPTISM",
            startDatetime: new Date("2026-10-15T14:00:00.000+08:00"),
            endDatetime: null, // missing endDatetime!
            status: "PENDING",
          },
        ],
      },
      parishEvent: { findMany: async () => [] },
      priestPersonalSchedule: { findFirst: async () => null },
      massScheduleTemplate: { findMany: async () => [] },
    };

    await assert.rejects(
      async () => {
        await ConflictHelper.checkPriestConflict(
          10,
          "2026-10-15",
          new Date("2026-10-15T14:30:00.000+08:00"),
          new Date("2026-10-15T15:30:00.000+08:00"),
          { tx: mockTx }
        );
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "PRIEST_CONFLICT");
        return true;
      }
    );
  });

  await t.test("19. ConflictHelper: Recovered slot legacy schedule blocks overlap (Priority C)", async () => {
    const mockTx = {
      parishAvailability: { findFirst: async () => null },
      schedule: {
        findMany: async () => [
          {
            id: 103,
            displayTitle: "Legacy Appointment",
            eventType: "BLESSING",
            requestedDate: new Date("2026-10-15T00:00:00.000Z"),
            startDatetime: null,
            endDatetime: null,
            remarks: "Time Slot: 02:00 PM. [Estimated End Time]",
            status: "REQUESTED",
          },
        ],
      },
      parishEvent: { findMany: async () => [] },
      priestPersonalSchedule: { findFirst: async () => null },
      massScheduleTemplate: { findMany: async () => [] },
    };

    await assert.rejects(
      async () => {
        await ConflictHelper.checkPriestConflict(
          10,
          "2026-10-15",
          new Date("2026-10-15T14:15:00.000+08:00"),
          new Date("2026-10-15T15:00:00.000+08:00"),
          { tx: mockTx }
        );
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "PRIEST_CONFLICT");
        return true;
      }
    );
  });

  await t.test("20. ConflictHelper: Truly unresolvable assigned schedule fails closed (Priority D)", async () => {
    const mockTx = {
      parishAvailability: { findFirst: async () => null },
      schedule: {
        findMany: async () => [
          {
            id: 104,
            displayTitle: "Unresolvable Legacy Appointment",
            eventType: "BLESSING",
            requestedDate: new Date("2026-10-15T00:00:00.000Z"),
            startDatetime: null,
            endDatetime: null,
            remarks: "No slot information available",
            status: "REQUESTED",
          },
        ],
      },
      parishEvent: { findMany: async () => [] },
      priestPersonalSchedule: { findFirst: async () => null },
      massScheduleTemplate: { findMany: async () => [] },
    };

    await assert.rejects(
      async () => {
        await ConflictHelper.checkPriestConflict(
          10,
          "2026-10-15",
          new Date("2026-10-15T14:00:00.000+08:00"),
          new Date("2026-10-15T15:00:00.000+08:00"),
          { tx: mockTx }
        );
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "PRIEST_AVAILABILITY_UNDETERMINED");
        return true;
      }
    );
  });

  await t.test("21. CalendarService evaluateOngoing: Estimated interval MUST NOT be ongoing or ongoing eligible", () => {
    const start = new Date(Date.now() - 10000);
    const end = new Date(Date.now() + 10000);

    // Normal authoritative: ongoing is true
    const normal = CalendarService.evaluateOngoing({
      start,
      end,
      status: "CONFIRMED",
      hasEstimatedEnd: false,
    });
    assert.equal(normal.isOngoing, true);
    assert.equal(normal.isOngoingEligible, true);

    // Estimated interval: ongoing MUST BE FALSE
    const estimated = CalendarService.evaluateOngoing({
      start,
      end,
      status: "CONFIRMED",
      hasEstimatedEnd: true,
    });
    assert.equal(estimated.isOngoing, false);
    assert.equal(estimated.isOngoingEligible, false);
  });
});

test("Phase 4 Blocker Correction Suite — Test Safety & Disposable Guard", async (t) => {
  await t.test("22. Default npm test script in package.json excludes DB concurrency suites", () => {
    const packageJsonPath = path.resolve(__dirname, "../package.json");
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    const defaultTestScript = pkg.scripts.test;
    assert.ok(
      !defaultTestScript.includes("phase3_phase4_concurrency.test.js"),
      "Default npm test must NOT include phase3_phase4_concurrency.test.js"
    );
    assert.ok(
      !defaultTestScript.includes("phase4_db_concurrency.test.js"),
      "Default npm test must NOT include phase4_db_concurrency.test.js"
    );
    assert.ok(pkg.scripts["test:phase4:db"], "package.json must provide dedicated test:phase4:db script");
    assert.ok(pkg.scripts["test:phase3:db"], "package.json must provide dedicated test:phase3:db script");
  });

  await t.test("23. Disposable DB guard rejects empty, missing, and shared database URLs", () => {
    assert.throws(
      () => validateDisposableDatabaseUrl(""),
      /REFUSING TO RUN DB INTEGRATION TEST WITHOUT DISPOSABLE DATABASE/
    );
    assert.throws(
      () => validateDisposableDatabaseUrl(null),
      /REFUSING TO RUN DB INTEGRATION TEST WITHOUT DISPOSABLE DATABASE/
    );
    assert.throws(
      () => validateDisposableDatabaseUrl("not-a-url"),
      /REFUSING TO RUN DB INTEGRATION TEST WITHOUT DISPOSABLE DATABASE/
    );

    // Shared host rejection
    const supabaseUrls = [
      "postgresql://postgres:pass@db.projectref.supabase.co:5432/postgres",
      "postgresql://postgres:pass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
      "postgres://user:pass@test.supabase.com:5432/db",
    ];
    for (const url of supabaseUrls) {
      assert.throws(
        () => validateDisposableDatabaseUrl(url),
        /REFUSING TO RUN DB INTEGRATION TEST WITHOUT DISPOSABLE DATABASE/
      );
    }

    // Valid disposable local test URL succeeds
    const validTestUrl = "postgresql://postgres:postgres@localhost:5432/testimonium_disposable_test";
    const accepted = validateDisposableDatabaseUrl(validTestUrl);
    assert.equal(accepted, validTestUrl);
  });
});
