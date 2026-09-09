import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateRequestedPriestEligibility,
  getEligiblePriestsForParish,
  GENERIC_INVALID_REQUESTED_PRIEST_MESSAGE,
} from "../services/ScheduleAvailabilityDomainService.js";
import {
  IdempotencyService,
  computeSchedulePayloadHash,
} from "../services/IdempotencyService.js";
import { sanitizeSchedulePriest, ScheduleService } from "../services/ScheduleService.js";
import { prisma } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Phase 5 Requested Priest Preference & Contracts Suite", async (t) => {
  // 1. Schema & Migration Contracts
  await t.test("Prisma schema contract: Schedule has requestedPriestId, User has requestedSchedules, ScheduleHistory UNCHANGED", () => {
    const schemaSource = fs.readFileSync(path.join(__dirname, "../prisma/schema.prisma"), "utf8");

    // Schedule model
    assert.match(schemaSource, /requestedPriestId\s+Int\?\s+@map\("requested_priest_id"\)/, "Schedule must have requestedPriestId");
    assert.match(schemaSource, /requestedPriest\s+User\?\s+@relation\("ScheduleRequestedPriest"/, "Schedule must have named relation ScheduleRequestedPriest");
    assert.match(schemaSource, /@@index\(\[requestedPriestId\]\)/, "Schedule must have index on requestedPriestId");

    // User back-relation
    assert.match(schemaSource, /requestedSchedules\s+Schedule\[\]\s+@relation\("ScheduleRequestedPriest"\)/, "User must have requestedSchedules back-relation");

    // ScheduleHistory MUST NOT have requestedPriestId (Section 26)
    const historySectionMatch = schemaSource.match(/model ScheduleHistory \{([^}]+)\}/);
    assert.ok(historySectionMatch, "ScheduleHistory model must exist");
    assert.doesNotMatch(historySectionMatch[1], /requestedPriestId/, "ScheduleHistory MUST NOT contain requestedPriestId");
    assert.doesNotMatch(historySectionMatch[1], /requested_priest_id/, "ScheduleHistory MUST NOT contain requested_priest_id");
  });

  await t.test("Migration SQL contract: alters schedules table only, NO ScheduleHistory change, NO enum changes, UNAPPLIED", () => {
    const migrationDir = path.join(__dirname, "../prisma/migrations");
    const entries = fs.readdirSync(migrationDir);
    const phase5Dirs = entries.filter((e) => e.includes("requested_priest_id"));

    assert.equal(phase5Dirs.length, 1, "Exactly one Phase 5 migration directory must exist");
    const migrationSql = fs.readFileSync(path.join(migrationDir, phase5Dirs[0], "migration.sql"), "utf8");

    // Must alter schedules table only
    assert.match(migrationSql, /ALTER TABLE "schedules" ADD COLUMN "requested_priest_id" INTEGER;/);
    assert.match(migrationSql, /CREATE INDEX "schedules_requested_priest_id_idx" ON "schedules"\("requested_priest_id"\);/);
    assert.match(migrationSql, /FOREIGN KEY \("requested_priest_id"\) REFERENCES "users"\("user_id"\) ON DELETE SET NULL/);

    // Forbidden additions
    assert.doesNotMatch(migrationSql, /schedule_history/i, "Migration SQL MUST NOT alter schedule_history");
    assert.doesNotMatch(migrationSql, /CREATE TYPE/i, "Migration SQL MUST NOT alter or create enums");
    assert.doesNotMatch(migrationSql, /^\s*UPDATE\s+/im, "Migration SQL MUST NOT execute backfills");
  });

  // 2. Eligibility helper
  await t.test("eligibility helper: allows null/undefined preference without error", async () => {
    // null preference is accepted in create payload
    assert.equal(computeSchedulePayloadHash({ parishId: 1, requestedPriestId: null }).length, 64);
    assert.equal(computeSchedulePayloadHash({ parishId: 1 }).length, 64);
  });

  await t.test("eligibility helper: validates primary priest and assistant priest in same parish", async () => {
    const mockClient = {
      user: {
        findUnique: async ({ where }) => {
          if (where.id === 1) {
            return { id: 1, fullName: "Fr. Primary", role: { roleName: "PRIEST" }, status: "ACTIVE", parishId: 10, isAssistant: false };
          }
          if (where.id === 2) {
            return { id: 2, fullName: "Fr. Assistant", role: { roleName: "PRIEST" }, status: "ACTIVE", parishId: 10, isAssistant: true };
          }
          return null;
        },
      },
    };

    const primary = await validateRequestedPriestEligibility(1, 10, mockClient);
    assert.equal(primary.id, 1);
    assert.equal(primary.isAssistant, false);

    const assistant = await validateRequestedPriestEligibility(2, 10, mockClient);
    assert.equal(assistant.id, 2);
    assert.equal(assistant.isAssistant, true);
  });

  await t.test("eligibility helper: rejects inactive, non-priest, wrong parish, not found with exact generic code and message", async () => {
    const mockClient = {
      user: {
        findUnique: async ({ where }) => {
          if (where.id === 3) return { id: 3, role: { roleName: "PRIEST" }, status: "INACTIVE", parishId: 10 };
          if (where.id === 4) return { id: 4, role: { roleName: "PARISHIONER" }, status: "ACTIVE", parishId: 10 };
          if (where.id === 5) return { id: 5, role: { roleName: "PRIEST" }, status: "ACTIVE", parishId: 99 }; // different parish
          return null;
        },
      },
    };

    const expectedMessage = "The selected preferred priest is not available for this request.";

    for (const testId of [3, 4, 5, 999]) {
      await assert.rejects(
        async () => validateRequestedPriestEligibility(testId, 10, mockClient),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, "INVALID_REQUESTED_PRIEST");
          assert.equal(err.message, expectedMessage);
          return true;
        }
      );
    }
  });

  await t.test("eligibility helper: rejects malformed IDs (fail closed, no parseInt coercion)", async () => {
    for (const badId of ["123junk", "1.5", -5, 0, "abc", {}, []]) {
      await assert.rejects(
        async () => validateRequestedPriestEligibility(badId, 10, {}),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, "INVALID_REQUESTED_PRIEST");
          return true;
        }
      );
    }
  });

  // 3. Idempotency Identity Contract
  await t.test("idempotency: same key + same payload replays; different requestedPriestId produces different hash", () => {
    const base = {
      parishId: 1,
      eventType: "WEDDING",
      date: "2026-09-20",
      timeSlot: "10:30 AM",
      remarks: "Test booking",
    };

    const hashNull = computeSchedulePayloadHash({ ...base, requestedPriestId: null });
    const hashPriest1 = computeSchedulePayloadHash({ ...base, requestedPriestId: 1 });
    const hashPriest2 = computeSchedulePayloadHash({ ...base, requestedPriestId: 2 });

    assert.notEqual(hashNull, hashPriest1, "Payload hash must differ when requestedPriestId is added");
    assert.notEqual(hashPriest1, hashPriest2, "Payload hash must differ when requestedPriestId changes");

    // Idempotent repetition produces identical hash
    assert.equal(hashPriest1, computeSchedulePayloadHash({ ...base, requestedPriestId: 1 }));
  });

  // 4. Safe Read DTO
  await t.test("sanitizeSchedulePriest: maps safe fields { id, name } and prevents raw User leakage", () => {
    const rawSched = {
      id: 101,
      requestedPriestId: 5,
      requestedPriest: {
        id: 5,
        fullName: "Fr. Juan dela Cruz",
        email: "private@parish.org",
        contactNumber: "+639123456789",
        address: "Private Rectory Address",
      },
    };

    const sanitized = sanitizeSchedulePriest(rawSched);
    assert.equal(sanitized.requestedPriestId, 5);
    assert.deepEqual(sanitized.requestedPriest, {
      id: 5,
      name: "Fr. Juan dela Cruz",
    });
    assert.equal(sanitized.requestedPriest.email, undefined);
    assert.equal(sanitized.requestedPriest.contactNumber, undefined);
    assert.equal(sanitized.requestedPriest.address, undefined);
  });

  // 5. Eligible Priests Endpoint Privacy
  await t.test("getEligiblePriestsForParish: exposes only id, name, isAssistant and queries only valid User fields", async () => {
    let capturedFindManyArgs = null;
    const mockClient = {
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      user: {
        findMany: async (args) => {
          capturedFindManyArgs = args;
          return [
            { id: 1, fullName: "Fr. Pedro Calungsod", isAssistant: false },
          ];
        },
      },
    };

    const list = await getEligiblePriestsForParish(1, null, mockClient);
    assert.equal(list.length, 1);
    assert.deepEqual(list[0], { id: 1, name: "Fr. Pedro Calungsod", isAssistant: false });
    assert.equal(list[0].fullName, undefined);
    assert.equal(list[0].email, undefined);

    // Regression guard: User select and orderBy must not reference User.name
    assert.ok(capturedFindManyArgs, "client.user.findMany must be invoked");
    assert.equal(capturedFindManyArgs.select?.name, undefined, "User select must NOT request name");
    assert.equal(capturedFindManyArgs.select?.fullName, true, "User select must request fullName");
    assert.deepEqual(
      capturedFindManyArgs.orderBy,
      [{ isAssistant: "asc" }, { fullName: "asc" }],
      "User orderBy must sort by isAssistant and fullName, not name"
    );
  });

  // 6. Idempotency Replay Order: replay survives subsequent priest invalidation
  await t.test("idempotency replay order: historical replay succeeds even if requested priest later invalid", async () => {
    const service = new ScheduleService();
    const payload = {
      userId: 1,
      parishId: 1,
      eventType: "WEDDING",
      requestedDate: "2026-09-20",
      timeSlot: "10:00 AM",
      remarks: "Wedding reservation",
      requestedPriestId: 88, // Priest who was valid in the past but later transferred/inactive
    };
    const key = "test-idem-key-replay-1";

    const canonicalPayload = {
      parishId: 1,
      eventType: "WEDDING",
      requestedDate: "2026-09-20",
      timeSlot: "10:00 AM",
      remarks: "Wedding reservation",
      requestedPriestId: 88,
    };
    const expectedHash = computeSchedulePayloadHash(canonicalPayload);

    // Save originals
    const origFindRecord = IdempotencyService.findRecord;
    const origScheduleFindUnique = prisma.schedule.findUnique;
    const origUserFindUnique = prisma.user.findUnique;

    try {
      // Mock idempotency record found with matching hash
      IdempotencyService.findRecord = async (userId, k, resType) => {
        if (userId === 1 && k === key && resType === "SCHEDULE_CREATE") {
          return { resourceId: 501, payloadHash: expectedHash };
        }
        return null;
      };

      // Mock schedule found
      prisma.schedule.findUnique = async ({ where }) => {
        if (where.id === 501) {
          return {
            id: 501,
            userId: 1,
            parishId: 1,
            eventType: "WEDDING",
            requestedDate: new Date("2026-09-20"),
            remarks: "Time Slot: 10:00 AM. Notes: Wedding reservation",
            status: "PENDING",
            requestedPriestId: 88,
            requestedPriest: { id: 88, fullName: "Fr. Transferred" },
            user: { id: 1, fullName: "Parishioner John" },
            parish: { id: 1, parishName: "St. Jude" },
          };
        }
        return null;
      };

      // Mock user.findUnique returning null (priest deleted/inactive)
      // If validateRequestedPriestEligibility were called, it would throw!
      prisma.user.findUnique = async () => null;

      const result = await service.create(payload, key);
      assert.equal(result.isReplay, true);
      assert.equal(result.schedule.id, 501);
      assert.equal(result.schedule.requestedPriestId, 88);
      assert.deepEqual(result.schedule.requestedPriest, { id: 88, name: "Fr. Transferred" });
      assert.equal(result.schedule.requestedPriest.fullName, undefined);
    } finally {
      IdempotencyService.findRecord = origFindRecord;
      prisma.schedule.findUnique = origScheduleFindUnique;
      prisma.user.findUnique = origUserFindUnique;
    }
  });

  // 7. Requested-Priest FK Delete Race (P2003)
  await t.test("requested-priest FK race: maps requested_priest_id P2003 to 400 INVALID_REQUESTED_PRIEST", async () => {
    const service = new ScheduleService();
    const payload = {
      userId: 1,
      parishId: 1,
      eventType: "WEDDING",
      requestedDate: "2026-09-20",
      timeSlot: "10:00 AM",
      remarks: "Wedding reservation",
      requestedPriestId: 99,
    };

    const origUserFindUnique = prisma.user.findUnique;
    const origTransaction = prisma.$transaction;
    const origFindRecord = IdempotencyService.findRecord;

    try {
      // Mock idempotency: no existing record
      IdempotencyService.findRecord = async () => null;

      // Mock priest initially eligible
      prisma.user.findUnique = async ({ where }) => {
        if (where.id === 99) {
          return { id: 99, fullName: "Fr. Racing", role: { roleName: "PRIEST" }, status: "ACTIVE", parishId: 1 };
        }
        return null;
      };

      // Mock transaction throwing P2003 on requested_priest_id
      prisma.$transaction = async () => {
        const p2003Err = new Error("Foreign key constraint failed on the field: `schedules_requested_priest_id_fkey (index)`");
        p2003Err.code = "P2003";
        p2003Err.meta = { field_name: "schedules_requested_priest_id_fkey" };
        throw p2003Err;
      };

      await assert.rejects(
        async () => service.create(payload, "key-race-p2003"),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, "INVALID_REQUESTED_PRIEST");
          assert.equal(err.message, "The selected preferred priest is not available for this request.");
          return true;
        }
      );

      // Unrelated P2003 (e.g. parish_id FK) must NOT be mapped to INVALID_REQUESTED_PRIEST
      prisma.$transaction = async () => {
        const p2003Parish = new Error("Foreign key constraint failed on the field: `schedules_parish_id_fkey`");
        p2003Parish.code = "P2003";
        p2003Parish.meta = { field_name: "schedules_parish_id_fkey" };
        throw p2003Parish;
      };

      await assert.rejects(
        async () => service.create(payload, "key-unrelated-p2003"),
        (err) => {
          assert.equal(err.code, "P2003");
          assert.notEqual(err.code, "INVALID_REQUESTED_PRIEST");
          return true;
        }
      );
    } finally {
      prisma.user.findUnique = origUserFindUnique;
      prisma.$transaction = origTransaction;
      IdempotencyService.findRecord = origFindRecord;
    }
  });

  // 8. Unique Race Winner Replay Sanitization
  await t.test("unique race winner replay: returns sanitized DTO { id, name } with no raw User leakage", async () => {
    const service = new ScheduleService();
    const payload = {
      userId: 1,
      parishId: 1,
      eventType: "WEDDING",
      requestedDate: "2026-09-20",
      timeSlot: "10:00 AM",
      remarks: "Wedding reservation",
      requestedPriestId: 15,
    };
    const key = "key-unique-race-1";

    const canonicalPayload = {
      parishId: 1,
      eventType: "WEDDING",
      requestedDate: "2026-09-20",
      timeSlot: "10:00 AM",
      remarks: "Wedding reservation",
      requestedPriestId: 15,
    };
    const expectedHash = computeSchedulePayloadHash(canonicalPayload);

    const origUserFindUnique = prisma.user.findUnique;
    const origTransaction = prisma.$transaction;
    const origFindRecord = IdempotencyService.findRecord;
    const origScheduleFindUnique = prisma.schedule.findUnique;

    try {
      // First lookup (pre-tx): null (simulates concurrent race)
      let lookupCount = 0;
      IdempotencyService.findRecord = async () => {
        lookupCount += 1;
        if (lookupCount > 1) {
          // Post-conflict lookup returns race winner record
          return { resourceId: 700, payloadHash: expectedHash };
        }
        return null;
      };

      // Mock priest eligible
      prisma.user.findUnique = async ({ where }) => {
        if (where.id === 15) {
          return { id: 15, fullName: "Fr. Concurrent", role: { roleName: "PRIEST" }, status: "ACTIVE", parishId: 1 };
        }
        return null;
      };

      // Mock transaction throwing unique constraint violation
      prisma.$transaction = async () => {
        const uniqueErr = new Error("Unique constraint failed on the fields: (`key`,`user_id`)");
        uniqueErr.code = "P2002";
        throw uniqueErr;
      };

      // Mock schedule findUnique for race winner
      prisma.schedule.findUnique = async ({ where }) => {
        if (where.id === 700) {
          return {
            id: 700,
            userId: 1,
            parishId: 1,
            eventType: "WEDDING",
            requestedPriestId: 15,
            requestedPriest: {
              id: 15,
              fullName: "Fr. Concurrent Winner",
              email: "confidential@parish.org",
              contactNumber: "+639999999999",
            },
            user: { id: 1, fullName: "John Doe" },
            parish: { id: 1, parishName: "St. Jude" },
          };
        }
        return null;
      };

      const result = await service.create(payload, key);
      assert.equal(result.isReplay, true);
      assert.equal(result.schedule.id, 700);
      assert.deepEqual(result.schedule.requestedPriest, {
        id: 15,
        name: "Fr. Concurrent Winner",
      });
      assert.equal(result.schedule.requestedPriest.fullName, undefined);
      assert.equal(result.schedule.requestedPriest.email, undefined);
      assert.equal(result.schedule.requestedPriest.contactNumber, undefined);
    } finally {
      prisma.user.findUnique = origUserFindUnique;
      prisma.$transaction = origTransaction;
      IdempotencyService.findRecord = origFindRecord;
      prisma.schedule.findUnique = origScheduleFindUnique;
    }
  });

  // 9. Remarks whitespace parity
  await t.test("remarks whitespace parity: internal whitespace preserved; outer whitespace trimmed", () => {
    const base = {
      parishId: 1,
      eventType: "WEDDING",
      requestedDate: "2026-09-20",
      timeSlot: "10:00 AM",
      requestedPriestId: null,
    };

    // Internal double space vs single space must be distinct
    const hashDoubleSpace = computeSchedulePayloadHash({ ...base, remarks: "Please  call me" });
    const hashSingleSpace = computeSchedulePayloadHash({ ...base, remarks: "Please call me" });
    assert.notEqual(hashDoubleSpace, hashSingleSpace, "Internal multiple spaces must NOT be collapsed");

    // Outer whitespace trimmed
    const hashPadded = computeSchedulePayloadHash({ ...base, remarks: "  Please call me  " });
    assert.equal(hashSingleSpace, hashPadded, "Outer whitespace must be trimmed");
  });

  // 10. Specific Regression Test (Section 9): Prisma Schedule row maps to public { id, name }
  await t.test("Prisma Schedule row mapping regression (Section 9): { id: 15, fullName } -> { id: 15, name } without fullName in public DTO and no dependency on User.name", () => {
    const prismaScheduleRow = {
      id: 999,
      requestedPriestId: 15,
      requestedPriest: {
        id: 15,
        fullName: "Fr. Miguel Santos",
      },
    };

    const sanitized = sanitizeSchedulePriest(prismaScheduleRow);
    assert.deepEqual(sanitized.requestedPriest, {
      id: 15,
      name: "Fr. Miguel Santos",
    });
    assert.equal(sanitized.requestedPriest.fullName, undefined, "Public DTO must not expose fullName");
    assert.equal(Object.prototype.hasOwnProperty.call(sanitized.requestedPriest, "fullName"), false);

    // Null case
    const nullRow = { id: 1000, requestedPriestId: null, requestedPriest: null };
    const sanitizedNull = sanitizeSchedulePriest(nullRow);
    assert.equal(sanitizedNull.requestedPriest, null);
  });

  // 11. Regression Guard (Section 8): requestedPriest User Prisma selects do NOT contain name: true, contain fullName: true
  await t.test("regression guard (Section 8): requestedPriest User Prisma selects do NOT contain name: true, contain fullName: true", () => {
    const scheduleServiceSource = fs.readFileSync(
      path.join(__dirname, "../services/ScheduleService.js"),
      "utf8"
    );
    const domainServiceSource = fs.readFileSync(
      path.join(__dirname, "../services/ScheduleAvailabilityDomainService.js"),
      "utf8"
    );

    // Check ScheduleService.js: all requestedPriest select clauses
    const requestedPriestSelectRegex = /requestedPriest:\s*\{\s*select:\s*\{([^}]+)\}\s*\}/g;
    let match;
    let count = 0;
    while ((match = requestedPriestSelectRegex.exec(scheduleServiceSource)) !== null) {
      count += 1;
      const selectBlock = match[1];
      assert.doesNotMatch(selectBlock, /\bname:\s*true\b/, `requestedPriest select block #${count} must NOT contain name: true`);
      assert.match(selectBlock, /\bfullName:\s*true\b/, `requestedPriest select block #${count} must contain fullName: true`);
    }
    assert.equal(count, 7, "ScheduleService.js must have exactly 7 requestedPriest select clauses");

    // Check ScheduleAvailabilityDomainService.js: client.user.findMany
    assert.doesNotMatch(domainServiceSource, /client\.user\.findMany\([\s\S]*?select:\s*\{[^}]*?\bname:\s*true/m);
    assert.doesNotMatch(domainServiceSource, /client\.user\.findMany\([\s\S]*?orderBy:\s*\[[^\]]*?\{\s*name:\s*"asc"\s*\}/m);
  });

  // 12. Response Paths Contract (Section 7): list, getById, tracking, create replay
  await t.test("response paths contract (Section 7): list, getById, and tracking reference return { id, name } with no User.name query", async () => {
    const service = new ScheduleService();
    const origFindMany = prisma.schedule.findMany;
    const origCount = prisma.schedule.count;
    const origFindUnique = prisma.schedule.findUnique;

    try {
      // Path A: ScheduleService.list()
      let capturedListSelect = null;
      prisma.schedule.findMany = async (args) => {
        capturedListSelect = args.include?.requestedPriest?.select;
        return [
          {
            id: 10,
            parishId: 1,
            userId: 1,
            requestedDate: new Date("2026-09-20"),
            remarks: "Time Slot: 10:00 AM",
            status: "PENDING",
            requestedPriestId: 15,
            requestedPriest: { id: 15, fullName: "Fr. Miguel Santos" },
            user: { id: 1, fullName: "Parishioner John" },
            parish: { id: 1, parishName: "St. Jude" },
          },
        ];
      };
      prisma.schedule.count = async () => 1;

      const listResult = await service.list({ parishId: 1 });
      assert.ok(capturedListSelect, "list() must include requestedPriest select");
      assert.equal(capturedListSelect.name, undefined, "list() must NOT select User.name");
      assert.equal(capturedListSelect.fullName, true, "list() must select User.fullName");
      assert.deepEqual(listResult.data[0].requestedPriest, { id: 15, name: "Fr. Miguel Santos" });
      assert.equal(listResult.data[0].requestedPriest.fullName, undefined);

      // Path B: ScheduleService.getById()
      let capturedGetByIdSelect = null;
      prisma.schedule.findUnique = async (args) => {
        capturedGetByIdSelect = args.include?.requestedPriest?.select;
        return {
          id: 10,
          parishId: 1,
          userId: 1,
          requestedDate: new Date("2026-09-20"),
          remarks: "Time Slot: 10:00 AM",
          status: "PENDING",
          requestedPriestId: 15,
          requestedPriest: { id: 15, fullName: "Fr. Miguel Santos" },
          user: { id: 1, fullName: "Parishioner John" },
          parish: { id: 1, parishName: "St. Jude" },
          history: [],
        };
      };

      const getByIdResult = await service.getById(10, 1, "PARISHIONER", 1);
      assert.ok(capturedGetByIdSelect, "getById() must include requestedPriest select");
      assert.equal(capturedGetByIdSelect.name, undefined, "getById() must NOT select User.name");
      assert.equal(capturedGetByIdSelect.fullName, true, "getById() must select User.fullName");
      assert.deepEqual(getByIdResult.requestedPriest, { id: 15, name: "Fr. Miguel Santos" });
      assert.equal(getByIdResult.requestedPriest.fullName, undefined);

      // Path F: ScheduleService.getByTrackingReference()
      let capturedTrackingSelect = null;
      prisma.schedule.findUnique = async (args) => {
        capturedTrackingSelect = args.include?.requestedPriest?.select;
        return {
          id: 10,
          parishId: 1,
          userId: 1,
          requestedDate: new Date("2026-09-20"),
          remarks: "Time Slot: 10:00 AM",
          status: "PENDING",
          requestedPriestId: 15,
          requestedPriest: { id: 15, fullName: "Fr. Miguel Santos" },
          user: { id: 1, fullName: "Parishioner John" },
          parish: { id: 1, parishName: "St. Jude" },
          history: [],
        };
      };

      const trackingResult = await service.getByTrackingReference("CONF-2026-0010", 1, "PARISHIONER", 1);
      assert.ok(capturedTrackingSelect, "getByTrackingReference() must include requestedPriest select");
      assert.equal(capturedTrackingSelect.name, undefined, "getByTrackingReference() must NOT select User.name");
      assert.equal(capturedTrackingSelect.fullName, true, "getByTrackingReference() must select User.fullName");
      assert.deepEqual(trackingResult.requestedPriest, { id: 15, name: "Fr. Miguel Santos" });
      assert.equal(trackingResult.requestedPriest.fullName, undefined);
    } finally {
      prisma.schedule.findMany = origFindMany;
      prisma.schedule.count = origCount;
      prisma.schedule.findUnique = origFindUnique;
    }
  });
});
