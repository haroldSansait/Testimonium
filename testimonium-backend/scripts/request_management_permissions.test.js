// Run with: node --experimental-test-module-mocks --test --test-isolation=none scripts/request_management_permissions.test.js
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Exercise the real routers, role middleware and validators without Firebase,
// uploads, database access, or controller side effects.
for (const controller of ["DocumentRequestController", "ScheduleController", "ScheduleAlternativeProposalController"]) {
  const url = new URL(`../controllers/${controller}.js`, import.meta.url);
  const names = [...readFileSync(url, "utf8").matchAll(/export const (\w+)\s*=/g)].map((match) => match[1]);
  mock.module(url.href, {
    namedExports: Object.fromEntries(names.map((name) => [name, (req, res) =>
      res.status(200).json({ handler: name, body: req.body, uploadReached: req.uploadReached === true })])),
  });
}
mock.module(new URL("../middlewares/authMiddleware.js", import.meta.url).href, {
  namedExports: { authenticateFirebaseToken: (_req, _res, next) => next() },
});
mock.module(new URL("../middlewares/uploadMiddleware.js", import.meta.url).href, {
  namedExports: { uploadCorrectedDocumentFile: (req, _res, next) => { req.uploadReached = true; next(); } },
});

const { default: documents } = await import("../routes/documentRequestRoutes.js");
const { default: schedules } = await import("../routes/scheduleRoutes.js");

function dispatch(router, method, url, role, body = {}) {
  return new Promise((resolve, reject) => {
    const req = { method, url, headers: {}, body, user: role ? { id: 21, role, parishId: 10 } : undefined };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, payload, uploadReached: req.uploadReached === true }); },
    };
    router.handle(req, res, (error) => error ? reject(error) : reject(new Error(`Unhandled ${method} ${url}`)));
  });
}

const scheduleBody = {
  status: "CONFIRMED", expectedVersion: 1, expectedRevision: 0, priestId: 21,
  proposedDate: "2099-10-20", targetDate: "2099-10-20", timeSlot: "09:00 AM", reason: "Pastoral scheduling conflict",
};
const mutations = [
  [documents, "POST", "/1/verify-cash", {}, "verifyCash"],
  [documents, "PATCH", "/1/status", { status: "UNDER_REVIEW" }, "updateStatus"],
  [documents, "POST", "/1/corrected-document", {}, "uploadCorrectedDocument"],
  [schedules, "PATCH", "/1/status", scheduleBody, "updateStatus"],
  [schedules, "POST", "/1/propose-reschedule", scheduleBody, "proposeReschedule"],
  [schedules, "POST", "/1/assign-priest", scheduleBody, "assignPriest"],
  [schedules, "POST", "/1/assign-lay-minister", scheduleBody, "assignLayMinister"],
  [schedules, "POST", "/1/alternative-proposals/2/decline", scheduleBody, "declineAlternativeProposal"],
  [schedules, "POST", "/1/alternative-proposals/2/approve", scheduleBody, "nominateAlternativeProposalPriest"],
  [schedules, "POST", "/1/alternative-proposals/2/revoke", scheduleBody, "revokeAlternativeProposalNomination"],
  [schedules, "POST", "/1/emergency-reschedule", scheduleBody, "emergencyReschedule"],
];

for (const role of ["PRIEST", "DIOCESE_COORDINATOR", "PARISHIONER"]) {
  test(`${role} receives 403 for every request-management mutation before validation or uploads`, async () => {
    for (const [router, method, url] of mutations) {
      const result = await dispatch(router, method, url, role); // deliberately invalid body
      assert.equal(result.status, 403, `${method} ${url}`);
      assert.equal(result.payload.handler, undefined);
      assert.equal(result.uploadReached, false);
    }
  });
}

test("Secretary retains every request-management mutation", async () => {
  for (const [router, method, url, body, handler] of mutations) {
    const result = await dispatch(router, method, url, "SECRETARY", body);
    assert.equal(result.status, 200, `${method} ${url}: ${JSON.stringify(result.payload)}`);
    assert.equal(result.payload.handler, handler);
    if (handler === "uploadCorrectedDocument") assert.equal(result.uploadReached, true);
  }
});

for (const role of ["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"]) {
  test(`${role} retains request browsing and permitted detail routes`, async () => {
    for (const [router, urls] of [
      [documents, ["/", "/1/attachments/2/download", "/1/receipts/2/download", "/1/registrant-id", "/1/registrant-id/front", "/1/returns", "/1/returns/2/file/corrected"]],
      [schedules, ["/", "/1", "/tracking/REF-1", "/1/priest-availability", "/1/alternative-proposals"]],
    ]) {
      for (const url of urls) assert.equal((await dispatch(router, "GET", url, role)).status, 200, url);
    }
  });
}

test("dedicated priest assignment and alternative-date responses still accept both responses", async () => {
  for (const [url, handler] of [["/1/priest-respond", "respondPriestAssignment"], ["/1/alternative-proposals/2/priest-respond", "respondAlternativeProposalNomination"]]) {
    for (const status of ["ACCEPTED", "REJECTED"]) {
      const result = await dispatch(schedules, "POST", url, "PRIEST", { ...scheduleBody, status });
      assert.equal(result.status, 200);
      assert.equal(result.payload.handler, handler);
      assert.equal(result.payload.body.status, status);
    }
    for (const role of ["SECRETARY", "DIOCESE_COORDINATOR", "PARISHIONER"]) {
      assert.equal((await dispatch(schedules, "POST", url, role, { ...scheduleBody, status: "ACCEPTED" })).status, 403);
    }
  }
});

test("parishioner creation, reschedule response and alternative-date interactions retain access", async () => {
  for (const [url, body, handler] of [
    ["/", { parishId: 10, eventType: "FUNERAL", date: "2099-10-20", timeSlot: "09:00 AM" }, "create"],
    ["/1/respond-reschedule", { accept: true, expectedVersion: 1 }, "respondReschedule"],
    ["/1/alternative-proposals", scheduleBody, "submitAlternativeProposal"],
    ["/1/alternative-proposals/2/withdraw", scheduleBody, "withdrawAlternativeProposal"],
  ]) {
    const result = await dispatch(schedules, "POST", url, "PARISHIONER", body);
    assert.equal(result.status, 200);
    assert.equal(result.payload.handler, handler);
  }
});
