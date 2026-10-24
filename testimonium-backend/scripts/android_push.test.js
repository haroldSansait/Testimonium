import test from "node:test";
import assert from "node:assert/strict";
import { NotificationDispatcher } from "../services/NotificationDispatcher.js";
import { EmailOutboxService } from "../services/EmailOutboxService.js";
import { RecipientResolver } from "../services/RecipientResolver.js";
import { PushDeviceService } from "../services/PushDeviceService.js";
import { PushDeliveryWorker, buildAndroidPush } from "../services/PushDeliveryWorker.js";
import { isAndroidPushEligible } from "../services/PushEligibility.js";
import { registerDevice, unregisterDevice } from "../controllers/PushDeviceController.js";

const documentEvent = status => ({ userId: 10, id: 101, title: "Unrelated translated copy", message: "Routine text",
  type: "IN_APP", referenceType: "DOCUMENT_REQUEST", referenceId: 33, pushEvent: `DOCUMENT:${status}` });

test("document allowlist uses authoritative statuses, including cash/digital PAYMENT_VERIFIED", () => {
  for (const status of ["PAYMENT_PENDING", "PAYMENT_VERIFIED", "NEEDS_CORRECTION", "PAYMENT_NEEDS_CORRECTION", "READY_FOR_PICKUP", "COMPLETED", "CANCELLED", "REJECTED"]) {
    assert.equal(isAndroidPushEligible(documentEvent(status)), true, status);
  }
  for (const status of ["DRAFT", "PENDING", "UNDER_REVIEW", "PAYMENT_UNDER_REVIEW", "PROCESSING", "READY_FOR_SIGNING", "RETURNED", "FUTURE_STATUS"]) {
    assert.equal(isAndroidPushEligible({ ...documentEvent(status), title: "Payment Required", message: "Document Ready for Pickup" }), false, status);
  }
  for (const change of [{ pushEvent: null }, { pushEvent: undefined }, { referenceType: "GENERAL" }, { type: "EMAIL" }, { type: "PUSH" }]) {
    assert.equal(isAndroidPushEligible({ ...documentEvent("PAYMENT_VERIFIED"), ...change }), false);
  }
});

test("schedule allowlist excludes routine updates, staff work, and unknown proposal events", () => {
  const notification = { type: "IN_APP", referenceType: "SCHEDULE_REQUEST" };
  for (const event of ["SCHEDULE:CONFIRMED", "SCHEDULE:DECLINED", "SCHEDULE:REJECTED", "SCHEDULE:CANCELLED", "SCHEDULE:PROPOSED_RESCHEDULE", "SCHEDULE:WAITING_PARISHIONER_RESPONSE", "SCHEDULE:EMERGENCY_RESCHEDULE", "ALTERNATIVE:APPLIED", "ALTERNATIVE:DECLINED"]) {
    assert.equal(isAndroidPushEligible({ ...notification, pushEvent: event }), true, event);
  }
  for (const event of [undefined, "SCHEDULE:PENDING", "SCHEDULE:REQUESTED", "SCHEDULE:UNDER_REVIEW", "SCHEDULE:COMPLETED", "ALTERNATIVE:SUBMITTED", "ALTERNATIVE:PRIEST_PENDING", "ALTERNATIVE:PRIEST_REJECTED", "ALTERNATIVE:NOMINATION_REVOKED", "ALTERNATIVE:WITHDRAWN", "ALTERNATIVE:SUPERSEDED", "GENERAL:ANNOUNCEMENT", "RECEIPT:UPLOADED"]) {
    assert.equal(isAndroidPushEligible({ ...notification, pushEvent: event, title: "Appointment Confirmed" }), false, event);
  }
});

test("real dispatcher preserves all in-app rows and limits metadata to the parishioner", async t => {
  t.mock.method(EmailOutboxService, "enqueueDocumentTransition", async () => {});
  t.mock.method(EmailOutboxService, "enqueueScheduleTransition", async () => {});
  t.mock.method(RecipientResolver, "getAdminRecipients", async () => [20]);
  const saved = [];
  const tx = { notification: { createMany: async ({ data }) => saved.push(...data) } };
  const event = { parishionerId: 10, parishId: 1, requestId: 33, trackingNumber: "FIXTURE", oldStatus: "PAYMENT_PENDING", notifyAdmins: true };
  for (const newStatus of ["PENDING", "UNDER_REVIEW", "PROCESSING", "PAYMENT_PENDING", "PAYMENT_VERIFIED", "NEEDS_CORRECTION", "READY_FOR_PICKUP", "COMPLETED"]) {
    saved.length = 0;
    await NotificationDispatcher.notifyDocumentStatusChange({ ...event, newStatus }, tx);
    assert.equal(saved.length, 2, "excluded events still persist normally");
    assert.equal(saved[0].pushEvent, `DOCUMENT:${newStatus}`);
    assert.equal(isAndroidPushEligible(saved[0]), !["PENDING", "UNDER_REVIEW", "PROCESSING"].includes(newStatus));
    assert.equal(isAndroidPushEligible(saved[1]), false, "admin recipient never gains eligibility");
  }
  for (const method of ["notifyReceiptUploaded", "notifyReceiptResubmitted", "notifyReceiptQualityFailed"]) {
    saved.length = 0;
    await NotificationDispatcher[method](event, tx);
    assert.equal(saved.length, method === "notifyReceiptQualityFailed" ? 1 : 2);
    assert.equal(isAndroidPushEligible(saved[0]), method === "notifyReceiptQualityFailed");
  }
  for (const newStatus of ["REQUESTED", "CONFIRMED", "WAITING_PARISHIONER_RESPONSE", "CANCELLED"]) {
    saved.length = 0;
    await NotificationDispatcher.notifyScheduleChange({ ...event, scheduleId: 7, displayTitle: "Fixture", newStatus }, tx);
    assert.equal(saved.length, 2);
    assert.equal(isAndroidPushEligible(saved[0]), newStatus !== "REQUESTED");
    assert.equal(isAndroidPushEligible(saved[1]), false);
  }
  for (const eventName of ["PRIEST_PENDING", "DECLINED", "APPLIED", "PRIEST_REJECTED"]) {
    saved.length = 0;
    await NotificationDispatcher.notifyAlternativeProposal({ ...event, scheduleId: 7, event: eventName }, tx);
    assert.equal(isAndroidPushEligible(saved.find(row => row.userId === 10)), ["DECLINED", "APPLIED"].includes(eventName));
    assert.ok(saved.filter(row => row.userId !== 10).every(row => !isAndroidPushEligible(row)));
  }
  saved.length = 0;
  await NotificationDispatcher.notifyEmergencyReschedule({ ...event, scheduleId: 7, priestId: 20, displayTitle: "Fixture" }, tx);
  assert.equal(saved.length, 2);
  assert.equal(isAndroidPushEligible(saved[0]), true);
  assert.equal(isAndroidPushEligible(saved[1]), false, "retained priest notification remains in-app only");
});

function deviceFixture() {
  const devices = [];
  let sequence = 0;
  const tx = {
    notification: { aggregate: async () => ({ _max: { id: 100 } }) },
    pushDevice: {
      findUnique: async ({ where }) => devices.find(row => row.token === where.token),
      create: async ({ data }) => { const row = { ...data, id: `epoch-${++sequence}` }; devices.push(row); return row; },
      delete: async ({ where }) => { devices.splice(devices.findIndex(row => row.id === where.id), 1); },
      deleteMany: async ({ where }) => {
        for (let i = devices.length - 1; i >= 0; i--) if (devices[i].token === where.token && devices[i].userId === where.userId) devices.splice(i, 1);
      },
    },
  };
  const db = { ...tx, $transaction: async (callback, options) => { assert.equal(options.isolationLevel, "Serializable"); return callback(tx); } };
  return { service: new PushDeviceService(db), devices, db };
}
const activeUser = { id: 10, role: "PARISHIONER", status: "ACTIVE", isVerified: true };
const tokenA = "fixture-fcm-registration-token-a";
const tokenB = "fixture-fcm-registration-token-b";

test("idempotent registration, multiple phones, rotation, account transfer, and owned deletion", async () => {
  const { service, devices } = deviceFixture();
  await service.register(activeUser, tokenA);
  const first = { ...devices[0] };
  await service.register(activeUser, tokenA);
  assert.deepEqual(devices, [first]);
  assert.equal(first.afterNotificationId, 100, "historical notifications cannot be replayed");
  await service.register(activeUser, tokenB);
  assert.equal(devices.length, 2);
  await service.unregister(11, tokenA);
  assert.equal(devices.length, 2, "another account cannot unregister this phone");
  await service.register({ ...activeUser, id: 11 }, tokenA);
  assert.equal(devices.find(row => row.token === tokenA).userId, 11);
  assert.notEqual(devices.find(row => row.token === tokenA).id, first.id, "transfer starts a new epoch");
  await service.register(activeUser, "fixture-fcm-registration-token-c", tokenB);
  assert.equal(devices.length, 2);
  assert.ok(devices.every(row => row.token !== tokenB));
});

test("device registration rejects staff, inactive/unverified accounts and invalid tokens", async () => {
  const { service, devices } = deviceFixture();
  for (const user of [{ ...activeUser, role: "SECRETARY" }, { ...activeUser, status: "INACTIVE" }, { ...activeUser, isVerified: false }]) {
    await assert.rejects(service.register(user, tokenA), { statusCode: 403 });
  }
  for (const token of [undefined, "tiny", "token with whitespace", "x".repeat(2049)]) await assert.rejects(service.register(activeUser, token), { statusCode: 400 });
  assert.equal(devices.length, 0);
});

test("controllers use authenticated identity and never expose provider/token errors", async t => {
  const calls = [];
  t.mock.method(PushDeviceService.prototype, "register", async (...args) => calls.push(args));
  t.mock.method(PushDeviceService.prototype, "unregister", async (...args) => calls.push(args));
  const req = { user: activeUser, body: { platform: "android", token: tokenA, userId: 999 } };
  const res = { status(code) { assert.equal(code, 204); return this; }, end() {} };
  await registerDevice(req, res, error => { throw error; });
  await unregisterDevice(req, res, error => { throw error; });
  assert.equal(calls[0][0], activeUser);
  assert.equal(calls[1][0], activeUser.id);
  t.mock.method(PushDeviceService.prototype, "register", async () => { throw new Error(tokenA); });
  await registerDevice(req, res, error => { assert.equal(error.statusCode, 503); assert.ok(!error.message.includes(tokenA)); });
});

function workerFixture(overrides = {}) {
  const notification = documentEvent("PAYMENT_VERIFIED");
  const device = { id: "device-a", token: tokenA, userId: 10, afterNotificationId: 100,
    user: { status: "ACTIVE", isVerified: true, role: { roleName: "PARISHIONER" } } };
  const row = { notification, device, status: "PROCESSING", claimToken: "claim-a", ...overrides };
  const sent = [], deleted = [], updates = [];
  const db = {
    pushDelivery: {
      findFirst: async ({ where }) => row.status === where.status && row.claimToken === where.claimToken ? row : null,
      updateMany: async ({ data }) => { updates.push(data); Object.assign(row, data); return { count: 1 }; },
    },
    pushDevice: { deleteMany: async args => deleted.push(args) },
  };
  const worker = new PushDeliveryWorker({ db, send: async payload => sent.push(payload) });
  const job = { notification_id: 101, device_id: "device-a", claim_token: "claim-a", attempts: 1 };
  return { worker, job, row, sent, deleted, updates, db };
}

test("worker sends each device independently and suppresses repeated processing after success", async () => {
  for (const token of [tokenA, tokenB]) {
    const f = workerFixture();
    f.row.device.token = token;
    await f.worker.process(f.job);
    await f.worker.process(f.job);
    assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0].token, token);
    assert.equal(f.row.status, "SENT");
    assert.equal(f.row.notification.isRead, undefined, "delivery never changes in-app read state");
  }
});

test("worker rechecks eligibility/ownership/account status and rejects pre-registration IDs", async () => {
  for (const scenario of ["routine", "unknown", "wrongOwner", "inactive", "staff", "unverified", "historical", "lostClaim"]) {
    const f = workerFixture();
    if (scenario === "routine") f.row.notification.pushEvent = "DOCUMENT:PROCESSING";
    if (scenario === "unknown") f.row.notification.pushEvent = null;
    if (scenario === "wrongOwner") f.row.device.userId = 11;
    if (scenario === "inactive") f.row.device.user.status = "INACTIVE";
    if (scenario === "staff") f.row.device.user.role.roleName = "SECRETARY";
    if (scenario === "unverified") f.row.device.user.isVerified = false;
    if (scenario === "historical") f.row.device.afterNotificationId = 101;
    if (scenario === "lostClaim") f.row.claimToken = "other-worker";
    await f.worker.process(f.job);
    assert.equal(f.sent.length, 0, scenario);
  }
});

test("FCM failures retain the original notification; retry, retire invalid token, and bound attempts", async () => {
  for (const code of ["messaging/server-unavailable", "messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/mismatched-credential"]) {
    const f = workerFixture();
    const before = structuredClone(f.row.notification);
    f.worker.send = async () => { throw Object.assign(new Error("private provider message"), { code }); };
    await f.worker.process(f.job);
    assert.deepEqual(f.row.notification, before);
    if (code.includes("registration-token")) assert.deepEqual(f.deleted, [{ where: { id: "device-a" } }]);
    else assert.equal(f.row.status, code.includes("mismatched") ? "FAILED" : "RETRY");
    assert.ok(!JSON.stringify(f.updates).includes("private provider message"));
  }
  const f = workerFixture();
  f.job.attempts = 9;
  await f.worker.process(f.job);
  assert.equal(f.sent.length, 0);
  assert.equal(f.row.status, "FAILED");
});

test("outbox SQL bounds enqueueing, excludes historic IDs, and atomically claims with SKIP LOCKED", async () => {
  const db = {
    $executeRaw: async query => {
      const sql = query.join("?");
      assert.match(sql, /n.notification_id > d.after_notification_id/);
      assert.match(sql, /push_event IN/);
      assert.match(sql, /LIMIT 250/);
      assert.match(sql, /ON CONFLICT DO NOTHING/);
    },
    $queryRaw: async (parts, claim) => {
      assert.match(parts.join("?"), /FOR UPDATE SKIP LOCKED LIMIT 1/);
      assert.ok(claim);
      return [];
    },
  };
  const worker = new PushDeliveryWorker({ db });
  await worker.enqueue();
  assert.equal(await worker.claimOne(), undefined);
});

test("push payload contains minimal identifiers, safe copy, channel and stable Android tag", () => {
  const payload = buildAndroidPush({ ...documentEvent("NEEDS_CORRECTION"), message: "private evidence notes and document URLs" }, tokenA);
  assert.equal(payload.notification.title, "Unrelated translated copy");
  assert.ok(!JSON.stringify(payload).includes("private evidence"));
  assert.deepEqual(Object.keys(payload.data).sort(), ["notificationId", "referenceId", "referenceType", "tag"]);
  assert.equal(payload.data.tag, payload.android.notification.tag);
  assert.equal(payload.android.notification.tag, "testimonium-101");
});
