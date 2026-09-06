import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Priest Assignment Availability — Backend Contracts & Safety", async (t) => {
  await t.test("Route registration contract: /:id/priest-availability is protected by staff roles", () => {
    const routeSource = fs.readFileSync(path.join(__dirname, "../routes/scheduleRoutes.js"), "utf8");
    assert.match(
      routeSource,
      /router\.get\(\s*"\/:id\/priest-availability",\s*checkRole\(\["SECRETARY",\s*"PRIEST",\s*"DIOCESE_COORDINATOR"\]\),\s*getPriestAvailability\s*\);/,
      "Route must require SECRETARY, PRIEST, or DIOCESE_COORDINATOR role"
    );
  });

  await t.test("Privacy invariant: getPriestAvailability returns strictly sanitized fields", async () => {
    const serviceSource = fs.readFileSync(path.join(__dirname, "../services/ScheduleService.js"), "utf8");
    assert.match(serviceSource, /async getPriestAvailability/, "ScheduleService must export getPriestAvailability");
    // Ensure no private commitment title, personal notes, or reason strings are leaked into results
    assert.doesNotMatch(serviceSource, /results\.push\(\{\s*priestId:[^}]+title:/, "Must not leak title in availability results");
    assert.doesNotMatch(serviceSource, /results\.push\(\{\s*priestId:[^}]+notes:/, "Must not leak notes in availability results");
    assert.match(
      serviceSource,
      /reasonCode:\s*"PRIEST_UNAVAILABLE"/,
      "Must use sanitized constant PRIEST_UNAVAILABLE when priest is in conflict"
    );
  });

  await t.test("Backend authority invariant: ConflictHelper and priest locking remain active in assignPriest", () => {
    const serviceSource = fs.readFileSync(path.join(__dirname, "../services/ScheduleService.js"), "utf8");
    assert.match(
      serviceSource,
      /await ConflictHelper\.checkPriestConflict\(\s*parsedPriestId,\s*current\.requestedDate,\s*current\.startDatetime,\s*current\.endDatetime/s,
      "assignPriest must authoritatively invoke ConflictHelper.checkPriestConflict"
    );
    assert.match(
      serviceSource,
      /await lockPriestsForScheduling\(tx,\s*priestsToLock\);/,
      "assignPriest must retain row-level lock serialization"
    );
  });
});
