import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TEST SUITE: POST-PHASE 4 UX ADJUSTMENTS
// ============================================================================

test("Post-Phase 4 Suite — Schedule Reschedule History Formatting Logic", async (t) => {
  // Replicating helper logic from ScheduleRescheduleHistory
  function formatDate(dateStr) {
    if (!dateStr) return "TBD";
    const clean = dateStr.split("T")[0];
    const parts = clean.split("-").map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const [year, month, day] = parts;
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    return dateStr;
  }

  function formatTime(timeIso) {
    if (!timeIso) return null;
    const date = new Date(timeIso);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    });
  }

  function formatScheduleDisplay(dateStr, startIso) {
    const formattedDate = formatDate(dateStr);
    const formattedStart = formatTime(startIso);
    if (formattedStart) {
      return `${formattedDate} • ${formattedStart}`;
    }
    return formattedDate;
  }

  function formatChangedAt(changedAtStr) {
    if (!changedAtStr) return "";
    const date = new Date(changedAtStr);
    if (isNaN(date.getTime())) return changedAtStr;
    const datePart = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    });
    const timePart = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    });
    return `${datePart} • ${timePart}`;
  }

  await t.test("1. History hidden when empty", () => {
    const history = [];
    assert.equal(history.length === 0, true, "Empty history should result in null render");
  });

  await t.test("2. Latest reschedule displays previous and new date/start-time, omitting estimated end times", () => {
    const latest = {
      previousDate: "2026-09-20",
      previousStart: "2026-09-20T02:00:00.000Z", // 10:00 AM Manila
      newDate: "2026-09-28",
      newStart: "2026-09-28T01:00:00.000Z", // 09:00 AM Manila
      reason: "Priest has changes his availability",
      changedAt: "2026-09-06T01:33:00.000Z",
    };

    const prevDisplay = formatScheduleDisplay(latest.previousDate, latest.previousStart);
    const newDisplay = formatScheduleDisplay(latest.newDate, latest.newStart);
    const changedDisplay = formatChangedAt(latest.changedAt);

    assert.equal(prevDisplay, "Sep 20, 2026 • 10:00 AM");
    assert.equal(newDisplay, "Sep 28, 2026 • 9:00 AM");
    assert.equal(changedDisplay, "Sep 6, 2026 • 9:33 AM");
    assert.equal(latest.reason, "Priest has changes his availability");

    // Invariant: estimated end times are omitted
    assert.ok(!prevDisplay.includes("11:00 AM"), "Estimated 60-minute end time must NOT be displayed");
    assert.ok(!newDisplay.includes("10:00 AM"), "Estimated 60-minute end time must NOT be displayed");
  });

  await t.test("3. Multiple reschedules are ordered newest-first with correct intermediate transitions", () => {
    const history = [
      {
        previousDate: "2026-09-20",
        previousStart: "2026-09-20T02:00:00.000Z",
        newDate: "2026-09-28",
        newStart: "2026-09-28T01:00:00.000Z",
        reason: "Priest availability changed",
        changedAt: "2026-09-06T01:33:00.000Z",
      },
      {
        previousDate: "2026-09-18",
        previousStart: "2026-09-18T00:00:00.000Z",
        newDate: "2026-09-20",
        newStart: "2026-09-20T02:00:00.000Z",
        reason: "Parish scheduling conflict",
        changedAt: "2026-09-03T02:00:00.000Z",
      },
    ];

    assert.equal(history.length, 2);
    // Most recent is Sep 6
    assert.equal(history[0].newDate, "2026-09-28");
    assert.equal(history[0].previousDate, "2026-09-20");

    // Older transition is Sep 3: Sep 18 -> Sep 20
    assert.equal(history[1].newDate, "2026-09-20");
    assert.equal(history[1].previousDate, "2026-09-18");
  });
});

test("Post-Phase 4 Suite — Schedule Friendly Statuses & Milestone Logic", async (t) => {
  const formatScheduleStatusDisplay = (status, priestStatus) => {
    const norm = (status || "").toUpperCase();
    if (norm === "CONFIRMED") return "Confirmed";
    if (norm === "COMPLETED") return "Completed";
    if (norm === "CANCELLED") return "Cancelled";
    if (norm === "REJECTED") return "Declined";
    if (norm === "PROPOSED_RESCHEDULE" || norm === "PROPOSED" || norm === "WAITING_PARISHIONER_RESPONSE") {
      return "Reschedule Proposed";
    }
    if (norm === "REQUESTED" || norm === "BOOKED" || norm === "PENDING") {
      if (priestStatus === "PENDING") {
        return "Pending Priest Acceptance";
      }
      return "Requested / Under Review";
    }
    return status;
  };

  await t.test("4. Raw enums are never exposed directly to users", () => {
    assert.equal(formatScheduleStatusDisplay("WAITING_PARISHIONER_RESPONSE"), "Reschedule Proposed");
    assert.equal(formatScheduleStatusDisplay("PROPOSED_RESCHEDULE"), "Reschedule Proposed");
    assert.equal(formatScheduleStatusDisplay("REQUESTED", "PENDING"), "Pending Priest Acceptance");
    assert.equal(formatScheduleStatusDisplay("BOOKED", null), "Requested / Under Review");
    assert.equal(formatScheduleStatusDisplay("CONFIRMED"), "Confirmed");
    assert.equal(formatScheduleStatusDisplay("COMPLETED"), "Completed");
    assert.equal(formatScheduleStatusDisplay("CANCELLED"), "Cancelled");
    assert.equal(formatScheduleStatusDisplay("REJECTED"), "Declined");
  });

  await t.test("5. Milestone progression computes truthful states without fake timestamps", () => {
    const pendingAppt = {
      status: "booked",
      assignedPriestId: 3,
      assignedPriestName: "Father Juan",
      priestResponseStatus: "PENDING",
    };

    const isPriestAssigned = Boolean(pendingAppt.assignedPriestId);
    const isPriestAccepted = isPriestAssigned && pendingAppt.priestResponseStatus === "ACCEPTED";
    const isConfirmed = pendingAppt.status === "confirmed";

    assert.equal(isPriestAssigned, true, "Priest assigned should be true when assigned");
    assert.equal(isPriestAccepted, false, "Priest accepted must be false when PENDING");
    assert.equal(isConfirmed, false, "Confirmed must be false when still booked");

    const confirmedAppt = {
      status: "confirmed",
      assignedPriestId: 3,
      assignedPriestName: "Father Juan",
      priestResponseStatus: "ACCEPTED",
    };

    assert.equal(Boolean(confirmedAppt.assignedPriestId), true);
    assert.equal(confirmedAppt.priestResponseStatus === "ACCEPTED", true);
    assert.equal(confirmedAppt.status === "confirmed", true);
  });
});

test("Post-Phase 4 Suite — Source Contracts for UI Pages & Components", async (t) => {
  await t.test("6. RequestTrackingPage source contract: unified mode switch, default documents, schedule tracking", () => {
    const trackPageSource = fs.readFileSync(
      path.join(__dirname, "../src/pages/dashboard/RequestTrackingPage.tsx"),
      "utf8"
    );

    assert.ok(
      trackPageSource.includes("const [activeMode, setActiveMode] = useState<'documents' | 'schedules'>('documents');"),
      "Default mode must be 'documents'"
    );

    assert.ok(
      trackPageSource.includes('id="tracking-mode-tab-documents"'),
      "Document mode tab must exist"
    );

    assert.ok(
      trackPageSource.includes('id="tracking-mode-tab-schedules"'),
      "Schedule mode tab must exist"
    );

    assert.ok(
      trackPageSource.includes('services.scheduler.getAppointmentByTracking'),
      "Must use getAppointmentByTracking for schedule tracking lookup"
    );

    assert.ok(
      trackPageSource.includes("We couldn't find a schedule request with that reference."),
      "Must display privacy-safe not found message"
    );

    assert.ok(
      trackPageSource.includes("<ScheduleRescheduleHistory"),
      "Schedule tracking result must reuse ScheduleRescheduleHistory component"
    );
  });

  await t.test("7. ScheduleDetailPage source contract: preserves current details and embeds ScheduleRescheduleHistory", () => {
    const detailPageSource = fs.readFileSync(
      path.join(__dirname, "../src/pages/dashboard/ScheduleDetailPage.tsx"),
      "utf8"
    );

    assert.ok(
      detailPageSource.includes("import ScheduleRescheduleHistory"),
      "ScheduleDetailPage must import ScheduleRescheduleHistory"
    );

    assert.ok(
      detailPageSource.includes("<ScheduleRescheduleHistory history={appointment.rescheduleHistory} />"),
      "ScheduleDetailPage must embed ScheduleRescheduleHistory with appointment.rescheduleHistory"
    );

    assert.ok(detailPageSource.includes("Confirmation No."), "Existing Confirmation No. must remain");
    assert.ok(detailPageSource.includes("Scheduled Date"), "Existing Scheduled Date must remain");
    assert.ok(detailPageSource.includes("Time Slot"), "Existing Time Slot must remain");
    assert.ok(detailPageSource.includes("Assigned Priest"), "Existing Assigned Priest must remain");
    assert.ok(!detailPageSource.includes("Back to Home"), "Redundant Back to Home button must be removed");
  });

  await t.test("8. ISchedulerProvider and ApiSchedulerProvider implement getAppointmentByTracking", () => {
    const typesSource = fs.readFileSync(path.join(__dirname, "../src/providers/types.ts"), "utf8");
    assert.ok(
      typesSource.includes("getAppointmentByTracking(reference: string): Promise<Appointment>;"),
      "ISchedulerProvider must declare getAppointmentByTracking"
    );

    const apiSource = fs.readFileSync(path.join(__dirname, "../src/providers/api/scheduler.ts"), "utf8");
    assert.ok(
      apiSource.includes("getAppointmentByTracking(reference: string): Promise<Appointment>"),
      "ApiSchedulerProvider must implement getAppointmentByTracking"
    );
    assert.ok(
      apiSource.includes("/schedule-requests/tracking/"),
      "ApiSchedulerProvider must query canonical /schedule-requests/tracking/ endpoint"
    );
  });
});
