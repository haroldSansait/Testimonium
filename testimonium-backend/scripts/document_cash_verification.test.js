import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import { DocumentRequestService } from "../services/DocumentRequestService.js";
import { verifyCash as controller } from "../controllers/DocumentRequestController.js";
import { AnalyticsRepository } from "../repositories/AnalyticsRepository.js";
import { canTransition } from "../services/RequestStateMachine.js";
import { OcrProcessingService } from "../services/OcrProcessingService.js";

const service = new DocumentRequestService();
const originalTransaction = prisma.$transaction;
afterEach(() => { prisma.$transaction = originalTransaction; });
const oldDate = new Date("2026-09-20T02:00:00Z");
const digital = () => ({
  id: 10, requestId: 1, status: "PENDING", provider: "GCASH", amount: "999.00",
  createdAt: oldDate, referenceNumber: "DIGITAL-REFERENCE", verifiedAt: null,
  receipts: [{ id: 20, r2ObjectKey: "fixture-private-proof", isSuperseded: false,
    ocrResult: { status: "COMPLETED", confidenceScore: 0.2, isDuplicate: true } }],
});

// In-memory transaction/row-lock simulation. All domain logic, audit and
// notification dispatch below are real; no external services or live DB writes.
function fixture(t, { request = {}, payments = [], failure, expectLock = true, claimLost = false } = {}) {
  let state = {
    request: { id: 1, trackingNumber: "SR-CASH-1", userId: 200, parishId: 5,
      documentType: "BAPTISMAL_CERTIFICATE", status: "PAYMENT_PENDING", paymentStatus: "UNPAID",
      fee: "175.35", createdAt: oldDate, updatedAt: oldDate, ...request },
    payments, history: [], audit: [], notifications: [],
  };
  const copy = () => ({ ...structuredClone({ ...state, request: null, payments: [] }),
    request: state.request ? { ...state.request } : null,
    payments: state.payments.map(p => ({ ...p, receipts: structuredClone(p.receipts || []) })),
  });
  let lockTail = Promise.resolve(), lockCount = 0;
  prisma.$transaction = async callback => {
    let work, release;
    const view = () => {
      if (expectLock) assert.ok(release, "request lock must precede every read/write");
      return work ||= copy();
    };
    const tx = {
      $queryRaw: async (parts, id) => {
        assert.match(parts.join("?"), /SELECT "request_id"[\s\S]*FROM "document_requests"[\s\S]*FOR UPDATE/);
        assert.equal(id, 1);
        const previous = lockTail;
        lockTail = new Promise(resolve => { release = resolve; });
        await previous;
        lockCount++;
        work = copy();
        return [{ request_id: 1 }];
      },
      documentRequest: {
        findUnique: async ({ include }) => {
          const s = view();
          if (!s.request) return null;
          return { ...s.request, ...(include ? { paymentTransactions: s.payments, requestHistory: s.history } : {}) };
        },
        updateMany: async ({ where, data }) => {
          const s = view();
          if (claimLost || s.request.status !== where.status) return { count: 0 };
          Object.assign(s.request, data);
          return { count: 1 };
        },
      },
      paymentTransaction: {
        findFirst: async ({ where }) => view().payments.find(p => p.requestId === where.requestId && p.status === where.status) || null,
        updateMany: async ({ where, data }) => {
          let count = 0;
          for (const p of view().payments) if (p.requestId === where.requestId && p.status === where.status) {
            Object.assign(p, data); count++;
          }
          return { count };
        },
        create: async ({ data }) => {
          if (failure === "payment") throw new Error("payment failure");
          const p = { id: 100, receipts: [], ...data };
          view().payments.push(p);
          return p;
        },
        update: async () => { throw new Error("cash must never relabel an existing receipt transaction"); },
      },
      receiptUpload: { updateMany: async ({ where, data }) => {
        let count = 0;
        for (const p of view().payments) if (p.requestId === where.transaction.requestId) {
          for (const r of p.receipts) if (r.isSuperseded === where.isSuperseded) {
            Object.assign(r, data); count++;
          }
        }
        return { count };
      } },
      requestHistory: { create: async ({ data }) => {
        if (failure === "history") throw new Error("history failure");
        const h = { id: 30, ...data }; view().history.push(h); return h;
      } },
      activityLog: { create: async ({ data }) => {
        if (failure === "audit") throw new Error("audit failure");
        view().audit.push(data); return data;
      } },
      notification: { createMany: async ({ data }) => {
        if (failure === "notification") throw new Error("notification failure");
        view().notifications.push(...data); return { count: data.length };
      } },
    };
    try {
      const result = await callback(tx);
      if (work) state = work;
      return result;
    } finally { release?.(); }
  };
  return { state: () => state, locks: () => lockCount,
    verify: () => service.verifyCash(1, 901, "SECRETARY", 5) };
}

for (const status of ["PAYMENT_PENDING", "PAYMENT_NEEDS_CORRECTION"]) {
  test(`${status}: real cash service verifies exact fee without a receipt, with history, audit and notification`, async t => {
    const fee = new Prisma.Decimal("175.35");
    const h = fixture(t, { request: { status, fee } });
    const before = Date.now();
    const dto = await h.verify();
    assert.equal(dto.status, "PAYMENT_VERIFIED");
    assert.equal(dto.paymentStatus, "CONFIRMED");
    const p = dto.paymentTransactions[0];
    assert.equal(p.amount, fee, "pass the authoritative Decimal directly without float conversion");
    assert.equal(p.provider, "CASH");
    assert.equal(p.status, "VERIFIED");
    assert.equal(p.verifiedById, 901);
    assert.ok(p.verifiedAt.getTime() >= before && p.verifiedAt.getTime() <= Date.now());
    assert.equal(p.createdAt.getTime(), p.verifiedAt.getTime());
    assert.deepEqual(p.receipts, []);
    assert.equal(dto.requestHistory.length, 1);
    assert.equal(dto.requestHistory[0].oldStatus, status);
    assert.equal(dto.requestHistory[0].actorId, 901);
    assert.match(dto.requestHistory[0].remarks, /verified as CASH/);
    const s = h.state();
    assert.equal(s.audit.length, 1);
    assert.equal(s.audit[0].userId, 901);
    assert.equal(s.audit[0].affectedRecordId, 1);
    assert.deepEqual(JSON.parse(s.audit[0].metadata), {
      trackingNumber: "SR-CASH-1", paymentTransactionId: 100, amount: "175.35", method: "CASH", resolvedPendingPayments: 0,
    });
    assert.equal(s.notifications.length, 1);
    assert.equal(s.notifications[0].userId, 200);
    assert.equal(s.notifications[0].referenceId, 1);
    assert.equal(s.notifications[0].title, "Payment Proof Verified");
    assert.equal(h.locks(), 1);
  });
}

test("all pending attempts are resolved while digital receipts, OCR, references and historical dates remain intact", async t => {
  const old = digital();
  const rejected = { ...digital(), id: 12, status: "REJECTED" };
  rejected.receipts[0].isSuperseded = true;
  const h = fixture(t, { payments: [old, { id: 11, requestId: 1, status: "PENDING", createdAt: oldDate, receipts: [] }, rejected],
    request: { paymentProofObjectKey: old.receipts[0].r2ObjectKey } });
  const dto = await h.verify();
  const s = h.state();
  assert.deepEqual(s.payments[0], { ...old, status: "REJECTED", receipts: old.receipts.map(r => ({ ...r, isSuperseded: true })) });
  assert.equal(s.payments[1].status, "REJECTED");
  assert.deepEqual(s.payments[2], rejected);
  assert.equal(s.payments.filter(p => p.status === "PENDING").length, 0);
  assert.equal(s.payments.filter(p => p.status === "VERIFIED").length, 1);
  assert.equal(dto.paymentProofObjectKey, old.receipts[0].r2ObjectKey);
  assert.equal(JSON.parse(s.audit[0].metadata).resolvedPendingPayments, 2);
  const lateReceipt = { ...s.payments[0].receipts[0], transaction: { ...s.payments[0], request: s.request } };
  assert.equal(OcrProcessingService.isAttemptAuthoritative(lateReceipt), false,
    "all existing OCR success, failure and exception paths must discard late status changes after cash verification");
});

for (const fee of [0, "0.00"]) {
  test(`legitimate zero fee ${JSON.stringify(fee)} is recorded unchanged`, async t => {
    const h = fixture(t, { request: { fee } });
    const dto = await h.verify();
    assert.equal(dto.paymentTransactions[0].amount, fee);
    assert.equal(dto.paymentStatus, "CONFIRMED");
  });
}
for (const fee of [null, undefined]) {
  test(`missing ${fee} fee fails without fabricating revenue`, async t => {
    const h = fixture(t, { request: { fee } });
    await assert.rejects(h.verify(), { statusCode: 400, message: /Authoritative request fee/ });
    assert.equal(h.state().payments.length, 0);
    assert.equal(h.state().request.status, "PAYMENT_PENDING");
  });
}

for (const role of ["PRIEST", "DIOCESE_COORDINATOR", "PARISHIONER", undefined]) {
  test(`cash verification rejects role ${role}`, async t => {
    const h = fixture(t);
    await assert.rejects(service.verifyCash(1, 901, role, 5), { statusCode: 403 });
    assert.equal(h.locks(), 0);
    assert.equal(h.state().payments.length, 0);
  });
}
test("Secretary from another parish or without a parish is rejected", async t => {
  const h = fixture(t);
  for (const parish of [6, null, undefined]) {
    await assert.rejects(service.verifyCash(1, 901, "SECRETARY", parish), { statusCode: 403 });
  }
  assert.equal(h.state().payments.length, 0);
});
test("missing request returns 404", async t => {
  const h = fixture(t); h.state().request = null;
  await assert.rejects(h.verify(), { statusCode: 404 });
});
for (const status of ["DRAFT", "PENDING", "UNDER_REVIEW", "PAYMENT_UNDER_REVIEW", "PROCESSING", "COMPLETED", "CANCELLED"]) {
  test(`cash verification rejects ${status}`, async t => {
    const h = fixture(t, { request: { status } });
    await assert.rejects(h.verify(), { statusCode: 400 });
    assert.equal(h.state().payments.length, 0);
  });
}
test("existing verified revenue or confirmed request is rejected even with a stale pending request status", async t => {
  for (const options of [
    { payments: [{ ...digital(), status: "VERIFIED" }] },
    { request: { paymentStatus: "CONFIRMED" } },
  ]) {
    const h = fixture(t, options);
    await assert.rejects(h.verify(), { statusCode: 409 });
    assert.equal(h.state().audit.length, 0);
  }
});
test("lost conditional status claim creates no cash or side effects", async t => {
  const h = fixture(t, { claimLost: true });
  await assert.rejects(h.verify(), { statusCode: 409, code: "DOCUMENT_REQUEST_CONCURRENCY_CONFLICT" });
  assert.equal(h.state().payments.length, 0);
  assert.equal(h.state().notifications.length, 0);
});
test("concurrent clicks and a later retry produce only one verified payment and one set of side effects", async t => {
  const h = fixture(t, { payments: [digital()] });
  const results = await Promise.allSettled([h.verify(), h.verify()]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.find(r => r.status === "rejected").reason.statusCode, 409);
  await assert.rejects(h.verify(), { statusCode: 409 });
  assert.equal(h.state().payments.filter(p => p.status === "VERIFIED").length, 1);
  for (const key of ["history", "audit", "notifications"]) assert.equal(h.state()[key].length, 1);
  assert.equal(h.locks(), 3);
});
for (const failure of ["payment", "history", "audit", "notification"]) {
  test(`${failure} failure rolls back request, pending resolution, cash payment and all side effects`, async t => {
    const h = fixture(t, { payments: [digital()], failure });
    const before = structuredClone(h.state());
    await assert.rejects(h.verify(), new RegExp(`${failure} failure`));
    assert.deepEqual(h.state(), before);
  });
}

test("ordinary endpoint cannot cash-verify either supported cash state; subsequent processing workflow remains unchanged", async t => {
  for (const status of ["PAYMENT_PENDING", "PAYMENT_NEEDS_CORRECTION"]) {
    assert.equal(canTransition(status, "PAYMENT_VERIFIED"), false);
    fixture(t, { request: { status }, expectLock: false });
    await assert.rejects(service.updateStatus(1, "PAYMENT_VERIFIED", "", 901, "SECRETARY", 5), /Cannot transition/);
  }
  for (const [from, to] of [["PAYMENT_VERIFIED", "PROCESSING"], ["PROCESSING", "READY_FOR_SIGNING"],
    ["READY_FOR_SIGNING", "READY_FOR_PICKUP"], ["READY_FOR_PICKUP", "COMPLETED"]]) {
    assert.equal(canTransition(from, to), true);
  }
});
for (const [name, receipt, proof, message] of [
  ["readability", { ocrResult: { status: "COMPLETED", confidenceScore: 0.2 } }, null, /quality threshold/],
  ["OCR still running", { ocrResult: { status: "PENDING" } }, null, /still in progress/],
  ["canonical proof", { r2ObjectKey: "other-proof" }, "canonical-proof", /Canonical payment proof/],
  ["duplicate warning", { ocrResult: { status: "COMPLETED", confidenceScore: 0.9, isDuplicate: true } }, null, /Only Diocese Coordinators/],
]) {
  test(`ordinary receipt verification retains ${name} safeguard`, async t => {
    const p = { ...digital(), receipts: [{ isSuperseded: false, ...receipt }] };
    const h = fixture(t, { request: { status: "PAYMENT_UNDER_REVIEW", paymentProofObjectKey: proof }, payments: [p], expectLock: false });
    await assert.rejects(service.updateStatus(1, "PAYMENT_VERIFIED", "", 901, "SECRETARY", 5), message);
    assert.equal(h.state().payments[0].status, "PENDING");
  });
}

test("controller validates IDs, uses authenticated actor/parish and ignores client amount/provider/date", async t => {
  const h = fixture(t);
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const req = { params: { id: "1" }, user: { id: 901, role: "SECRETARY", parish: { id: 5 } },
    body: { amount: "99999", provider: "GCASH", createdAt: oldDate.toISOString() } };
  await controller(req, res, err => { throw err; });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.paymentTransactions[0].amount, "175.35");
  assert.equal(res.body.data.paymentTransactions[0].provider, "CASH");
  assert.notEqual(res.body.data.paymentTransactions[0].createdAt.getTime(), oldDate.getTime());
  await controller(req, res, err => { throw err; });
  assert.equal(res.statusCode, 409);
  for (const id of ["0", "-1", "1junk", "1.1", "9007199254740992"]) {
    await controller({ ...req, params: { id } }, res, err => { throw err; });
    assert.equal(res.statusCode, 400);
  }
  assert.equal(h.state().payments.length, 1);
});

// Exercise the unchanged analytics repository against transactions produced by
// the actual cash service. The fake DB honors its date/status/tenant predicates.
function analyticsFor(h) {
  const matches = (where, p) => (!where.status || where.status === p.status)
    && p.createdAt >= where.createdAt.gte && p.createdAt < where.createdAt.lt
    && (!where.request?.parishId || where.request.parishId === h.state().request.parishId)
    && (!where.request?.documentType || where.request.documentType === h.state().request.documentType);
  const rows = where => h.state().payments.filter(p => matches(where, p));
  const empty = { count: async () => 0, groupBy: async () => [] };
  return new AnalyticsRepository({
    documentRequest: empty, schedule: empty, parishEvent: empty, dailyReport: empty,
    receiptUpload: empty, requestHistory: empty,
    paymentTransaction: {
      count: async ({ where }) => rows(where).length,
      groupBy: async ({ where }) => [...new Set(rows(where).map(p => p.status))].map(status => ({
        status, _count: rows(where).filter(p => p.status === status).length,
      })),
      aggregate: async ({ where }) => ({ _sum: { amount: rows(where).reduce((sum, p) => sum.plus(p.amount || 0), new Prisma.Decimal(0)) } }),
      findMany: async ({ where, skip, take }) => rows(where).slice(skip, skip + take).map(p => ({
        ...p, amount: new Prisma.Decimal(p.amount), request: { ...h.state().request, user: { id: 200, fullName: "Fixture" } },
        verifier: { id: 901, fullName: "Secretary" },
      })),
    },
    $queryRaw: async (parts, ...values) => {
      const sql = parts.join("?");
      if (!sql.includes('FROM "payment_transactions"')) return [];
      assert.match(sql, /pt\."created_at"/);
      assert.match(sql, /pt\."status" = 'VERIFIED'/);
      assert.match(sql, /Asia\/Manila/);
      const eligible = rows({ status: "VERIFIED", createdAt: { gte: values[0], lt: values[1] } });
      const daily = new Map();
      for (const p of eligible) {
        const date = new Date(p.createdAt.getTime() + 8 * 3600000).toISOString().slice(0, 10);
        const row = daily.get(date) || { date, count: 0, amount: new Prisma.Decimal(0) };
        row.count++; row.amount = row.amount.plus(p.amount); daily.set(date, row);
      }
      return [...daily.values()].map(r => ({ ...r, amount: r.amount.toFixed(2) }));
    },
  });
}

for (const [time, fee, withReceipt] of [
  ["2026-10-23T16:01:00Z", "175.35", false], // Oct 24 Manila; yesterday in UTC
  ["2026-10-31T16:01:00Z", "80.10", true], // Nov 1 Manila; prior month in UTC
  ["2026-12-31T16:01:00Z", "0.00", true], // Jan 1 Manila; prior year in UTC
]) {
  test(`existing verified analytics count cash once on its verification date ${time}, amount ${fee}`, async t => {
    t.mock.timers.enable({ apis: ["Date"], now: new Date(time) });
    const pending = withReceipt ? digital() : { id: 10, requestId: 1, status: "PENDING", amount: null, createdAt: oldDate, receipts: [] };
    const h = fixture(t, { request: { fee }, payments: [pending] });
    await h.verify();
    await assert.rejects(h.verify(), { statusCode: 409 });
    const repo = analyticsFor(h);
    const localDate = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    const from = new Date(`${localDate}T00:00:00+08:00`);
    const toExclusive = new Date(from.getTime() + 24 * 3600000);
    const filters = { from, toExclusive, parishId: 5, documentType: "BAPTISMAL_CERTIFICATE", includeUsers: false };
    const details = await repo.getVerifiedPaymentDetails(filters);
    assert.equal(details.pagination.total, 1);
    assert.equal(details.data.length, 1);
    assert.equal(details.data[0].amount, fee);
    assert.equal(details.data[0].paymentSubmittedAt, new Date(time).toISOString());
    assert.equal(details.data[0].verifiedAt, new Date(time).toISOString());
    const summary = await repo.getDescriptiveAnalytics(filters);
    assert.equal(summary.payments.totalTransactions, 1);
    assert.equal(summary.payments.verifiedAmount, fee);
    assert.deepEqual(summary.payments.byStatus, [{ status: "VERIFIED", _count: 1 }]);
    assert.deepEqual(summary.payments.daily, [{ date: localDate, count: 1, amount: fee }]);
    assert.deepEqual(summary.payments.monthly, [{ month: localDate.slice(0, 7), count: 1, amount: fee }]);
    for (const [from, toExclusive] of [[oldDate, new Date("2026-09-21T00:00:00Z")],
      [new Date(filters.from.getTime() - 86400000), filters.from]]) {
      const prior = { ...filters, from, toExclusive };
      assert.equal((await repo.getVerifiedPaymentDetails(prior)).pagination.total, 0);
      const totals = await repo.getDescriptiveAnalytics(prior);
      assert.equal(totals.payments.verifiedAmount, "0.00");
      assert.deepEqual(totals.payments.daily, []);
    }
    assert.equal((await repo.getVerifiedPaymentDetails({ ...filters, parishId: 6 })).pagination.total, 0);
  });
}
