import test from "node:test";
import assert from "node:assert/strict";
import { proposeRescheduleSchema } from "../validators/scheduleSchemas.js";

test("Phase 5 Prerequisite — Admin Reschedule Timestamp Offset Contract", async (t) => {
  await t.test("accepts ISO-8601 with explicit +08:00 offset (Asia/Manila)", () => {
    const payload = {
      proposedDate: "2026-09-20",
      proposedStartDatetime: "2026-09-20T10:00:00+08:00",
      reason: "Pastor requested reschedule",
      expectedVersion: 1,
    };
    const result = proposeRescheduleSchema.safeParse(payload);
    assert.equal(result.success, true);
    assert.equal(result.data.proposedStartDatetime, "2026-09-20T10:00:00+08:00");
  });

  await t.test("rejects ISO-8601 timestamp without explicit offset", () => {
    const payload = {
      proposedDate: "2026-09-20",
      proposedStartDatetime: "2026-09-20T10:00:00",
      reason: "Pastor requested reschedule",
      expectedVersion: 1,
    };
    const result = proposeRescheduleSchema.safeParse(payload);
    assert.equal(result.success, false);
    const issue = result.error.issues.find((i) => i.path.includes("proposedStartDatetime"));
    assert.ok(issue, "Expected validation failure on proposedStartDatetime");
    assert.match(issue.message, /ISO-8601.*explicit UTC offset/i);
  });

  await t.test("accepts ISO-8601 timestamp with explicit Z (UTC)", () => {
    const payload = {
      proposedDate: "2026-09-20",
      proposedStartDatetime: "2026-09-20T02:00:00Z",
      reason: "Pastor requested reschedule",
      expectedVersion: 1,
    };
    const result = proposeRescheduleSchema.safeParse(payload);
    assert.equal(result.success, true);
    assert.equal(result.data.proposedStartDatetime, "2026-09-20T02:00:00Z");
  });

  await t.test("accepts nullable / optional timestamps when omitted", () => {
    const payload = {
      proposedDate: "2026-09-20",
      reason: "Date only change",
      expectedVersion: 2,
    };
    const result = proposeRescheduleSchema.safeParse(payload);
    assert.equal(result.success, true);
  });
});
