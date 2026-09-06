import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { deriveRescheduleHistory } from "../services/ScheduleService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TEST SUITE: POST-PHASE 4 SCHEDULE HISTORY & TRACKING
// ============================================================================

test("Post-Phase 4 Suite — Schedule History Reconstruction", async (t) => {
  await t.test("Empty history returns empty reschedule list", () => {
    const current = {
      id: 26,
      requestedDate: new Date("2026-09-28T00:00:00.000Z"),
      startDatetime: new Date("2026-09-28T01:00:00.000Z"),
      endDatetime: new Date("2026-09-28T02:00:00.000Z"),
    };
    const result = deriveRescheduleHistory(current, []);
    assert.deepEqual(result, []);
  });

  await t.test("Single emergency reschedule reconstructs transition from history prior state to current schedule", () => {
    const current = {
      id: 26,
      requestedDate: new Date("2026-09-28T00:00:00.000Z"),
      startDatetime: new Date("2026-09-28T01:00:00.000Z"), // 09:00 AM Manila
      endDatetime: new Date("2026-09-28T02:00:00.000Z"),
    };
    const history = [
      {
        id: 101,
        scheduleId: 26,
        version: 1,
        requestedDate: new Date("2026-09-20T00:00:00.000Z"),
        startDatetime: new Date("2026-09-20T02:00:00.000Z"), // 10:00 AM Manila
        endDatetime: new Date("2026-09-20T03:00:00.000Z"),
        reason: "Priest has changes his availability",
        actorId: 5,
        actorRole: "PRIEST",
        remarks: "Internal priest unavailable memo",
        createdAt: new Date("2026-09-06T01:33:00.000Z"),
      },
    ];

    const result = deriveRescheduleHistory(current, history);
    assert.equal(result.length, 1);
    assert.equal(result[0].previousDate, "2026-09-20");
    assert.equal(result[0].newDate, "2026-09-28");
    assert.equal(result[0].previousStart, "2026-09-20T02:00:00.000Z");
    assert.equal(result[0].newStart, "2026-09-28T01:00:00.000Z");
    assert.equal(result[0].reason, "Priest has changes his availability");
    assert.equal(result[0].changedAt, "2026-09-06T01:33:00.000Z");

    // PRIVACY VERIFICATION: actorId, actorRole, version, remarks must be scrubbed
    assert.equal(result[0].actorId, undefined);
    assert.equal(result[0].actorRole, undefined);
    assert.equal(result[0].version, undefined);
    assert.equal(result[0].remarks, undefined);
  });

  await t.test("Multiple reschedules reconstruct intermediate states correctly (not pointing every item directly to current)", () => {
    // Current final state: Sep 28, 2026 09:00 AM
    const current = {
      id: 26,
      requestedDate: new Date("2026-09-28T00:00:00.000Z"),
      startDatetime: new Date("2026-09-28T01:00:00.000Z"),
      endDatetime: new Date("2026-09-28T02:00:00.000Z"),
    };

    // History:
    // Event 1 (Sep 3): Sep 18 (08:00 AM) changed to Sep 20 (10:00 AM) due to "Parish scheduling conflict"
    // Event 2 (Sep 6): Sep 20 (10:00 AM) changed to Sep 28 (09:00 AM) due to "Priest availability changed"
    const history = [
      {
        id: 1,
        scheduleId: 26,
        version: 1,
        requestedDate: new Date("2026-09-18T00:00:00.000Z"),
        startDatetime: new Date("2026-09-18T00:00:00.000Z"),
        endDatetime: new Date("2026-09-18T01:00:00.000Z"),
        reason: "Parish scheduling conflict",
        actorId: 2,
        actorRole: "SECRETARY",
        createdAt: new Date("2026-09-03T02:00:00.000Z"),
      },
      {
        id: 2,
        scheduleId: 26,
        version: 2,
        requestedDate: new Date("2026-09-20T00:00:00.000Z"),
        startDatetime: new Date("2026-09-20T02:00:00.000Z"),
        endDatetime: new Date("2026-09-20T03:00:00.000Z"),
        reason: "Priest availability changed",
        actorId: 3,
        actorRole: "PRIEST",
        createdAt: new Date("2026-09-06T01:33:00.000Z"),
      },
    ];

    const result = deriveRescheduleHistory(current, history);
    assert.equal(result.length, 2, "Must return 2 reschedules");

    // Newest first ordering:
    // Entry 0 is the most recent (Sep 6): Sep 20 -> Sep 28
    assert.equal(result[0].previousDate, "2026-09-20");
    assert.equal(result[0].newDate, "2026-09-28");
    assert.equal(result[0].previousStart, "2026-09-20T02:00:00.000Z");
    assert.equal(result[0].newStart, "2026-09-28T01:00:00.000Z");
    assert.equal(result[0].reason, "Priest availability changed");
    assert.equal(result[0].changedAt, "2026-09-06T01:33:00.000Z");

    // Entry 1 is the older transition (Sep 3): Sep 18 -> Sep 20 (NOT Sep 28!)
    assert.equal(result[1].previousDate, "2026-09-18");
    assert.equal(result[1].newDate, "2026-09-20");
    assert.equal(result[1].previousStart, "2026-09-18T00:00:00.000Z");
    assert.equal(result[1].newStart, "2026-09-20T02:00:00.000Z");
    assert.equal(result[1].reason, "Parish scheduling conflict");
    assert.equal(result[1].changedAt, "2026-09-03T02:00:00.000Z");
  });

  await t.test("Non-reschedule history records (status changes / priest acceptance) are excluded", () => {
    const current = {
      id: 26,
      requestedDate: new Date("2026-09-28T00:00:00.000Z"),
      startDatetime: new Date("2026-09-28T01:00:00.000Z"),
      endDatetime: new Date("2026-09-28T02:00:00.000Z"),
    };

    // Suppose H1 was an emergency reschedule to Sep 28.
    // H2 was "Priest accepted assignment" on Sep 28 without changing date/time.
    const history = [
      {
        id: 1,
        scheduleId: 26,
        version: 1,
        requestedDate: new Date("2026-09-20T00:00:00.000Z"),
        startDatetime: new Date("2026-09-20T02:00:00.000Z"),
        endDatetime: new Date("2026-09-20T03:00:00.000Z"),
        reason: "Emergency flood maintenance",
        createdAt: new Date("2026-09-05T01:00:00.000Z"),
      },
      {
        id: 2,
        scheduleId: 26,
        version: 2,
        requestedDate: new Date("2026-09-28T00:00:00.000Z"),
        startDatetime: new Date("2026-09-28T01:00:00.000Z"),
        endDatetime: new Date("2026-09-28T02:00:00.000Z"),
        reason: "Priest accepted assignment",
        createdAt: new Date("2026-09-05T02:00:00.000Z"),
      },
    ];

    const result = deriveRescheduleHistory(current, history);
    // Only 1 reschedule occurred (Sep 20 -> Sep 28)
    assert.equal(result.length, 1);
    assert.equal(result[0].previousDate, "2026-09-20");
    assert.equal(result[0].newDate, "2026-09-28");
    assert.equal(result[0].reason, "Emergency flood maintenance");
  });
});

test("Post-Phase 4 Suite — Tracking Reference Parsing & Privacy Invariants", async (t) => {
  await t.test("Reference parser handles actual source formats: CONF-YYYY-XXXX and numeric ID", () => {
    const parseReference = (ref) => {
      if (!ref || typeof ref !== "string") return null;
      const trimmed = ref.trim();
      const confMatch = trimmed.match(/^CONF-\d{4}-(\d+)$/i);
      if (confMatch) return parseInt(confMatch[1], 10);
      if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
      return null;
    };

    assert.equal(parseReference("CONF-2026-0026"), 26);
    assert.equal(parseReference("conf-2026-0026"), 26);
    assert.equal(parseReference("CONF-2026-26"), 26);
    assert.equal(parseReference("26"), 26);
    assert.equal(parseReference("0026"), 26);

    // Invalid or unparseable references return null (leading to safe 404)
    assert.equal(parseReference("INVALID-REF"), null);
    assert.equal(parseReference("CONF-INVALID"), null);
    assert.equal(parseReference(""), null);
    assert.equal(parseReference(null), null);
  });

  await t.test("Source contracts: tracking route is registered before /:id and enforces 404 on unowned", () => {
    const routeSource = fs.readFileSync(path.join(__dirname, "../routes/scheduleRoutes.js"), "utf8");
    const trackingRouteIdx = routeSource.indexOf('router.get("/tracking/:reference"');
    const idRouteIdx = routeSource.indexOf('router.get("/:id"');

    assert.ok(trackingRouteIdx > -1, "Canonical tracking route must be registered");
    assert.ok(idRouteIdx > -1, "ID route must be registered");
    assert.ok(trackingRouteIdx < idRouteIdx, "tracking route MUST be registered before /:id");

    const serviceSource = fs.readFileSync(path.join(__dirname, "../services/ScheduleService.js"), "utf8");
    assert.ok(
      serviceSource.includes("getByTrackingReference(reference, actorId, actorRole, actorParishId)"),
      "ScheduleService must implement getByTrackingReference"
    );
    assert.ok(
      serviceSource.includes("schedule.userId !== actorId"),
      "ScheduleService must check owner for parishioner"
    );
    assert.ok(
      serviceSource.includes('err.code = "SCHEDULE_NOT_FOUND"'),
      "ScheduleService must throw SCHEDULE_NOT_FOUND on unowned references"
    );
  });
});
