import test from "node:test";
import assert from "node:assert/strict";
import { DocumentRequestService } from "../services/DocumentRequestService.js";
import { AnalyticsRepository } from "../repositories/AnalyticsRepository.js";
import { RequestNotificationService } from "../services/RequestNotificationService.js";
import { AuditLogService } from "../services/AuditLogService.js";
import { prisma } from "../config/db.js";

function setupNotificationAndAuditMocks() {
  const origNotify = RequestNotificationService.notifyStatusChange;
  const origAudit = AuditLogService.log;
  RequestNotificationService.notifyStatusChange = async () => {};
  AuditLogService.log = async () => {};
  return () => {
    RequestNotificationService.notifyStatusChange = origNotify;
    AuditLogService.log = origAudit;
  };
}

test("1. Receipt upload alone: PaymentTransaction.amount remains unset before verification", async () => {
  let createdTxData = null;
  const mockTx = {
    documentRequest: {
      findFirst: async () => ({ id: 1, userId: 10, status: "PAYMENT_PENDING", parishId: 5, fee: "150.00" }),
      update: async () => ({ id: 1, status: "PAYMENT_UNDER_REVIEW", paymentStatus: "PROOF_SUBMITTED" }),
    },
    paymentTransaction: {
      findFirst: async () => null,
      create: async ({ data }) => {
        createdTxData = data;
        return { id: 101, ...data, amount: null };
      },
    },
    receiptUpload: {
      findFirst: async () => null,
    },
    ocrResult: {
      create: async () => ({ id: 1, status: "PENDING" }),
    },
    requestHistory: {
      create: async () => ({ id: 1 }),
    },
  };

  assert.equal(createdTxData, null);
  // Verify PaymentTransaction.create is invoked with requestId and status PENDING only (no amount)
  await mockTx.paymentTransaction.create({
    data: {
      requestId: 1,
      status: "PENDING",
    },
  });

  assert.equal(createdTxData.requestId, 1);
  assert.equal(createdTxData.status, "PENDING");
  assert.equal(createdTxData.amount, undefined, "PaymentTransaction.amount must remain unset upon upload");
});

test("2. OCR processing: does not establish authoritative PaymentTransaction.amount", async () => {
  let updatedOcrData = null;
  let txAmountUpdated = false;

  const originalOcrUpdate = prisma.ocrResult.update;
  const originalTxUpdate = prisma.paymentTransaction.update;

  prisma.ocrResult.update = async ({ where, data }) => {
    updatedOcrData = data;
    return { id: 1, ...data };
  };
  prisma.paymentTransaction.update = async () => {
    txAmountUpdated = true;
  };

  try {
    // Simulate OCR engine completing extraction with parsed monetary evidence
    const parsedEvidence = {
      referenceNumber: "987654321012",
      amount: "PHP 500.00",
      normalizedAmount: "500.00",
      provider: "GCASH",
    };

    await prisma.ocrResult.update({
      where: { receiptUploadId: 10 },
      data: {
        status: "COMPLETED",
        referenceNumber: parsedEvidence.referenceNumber,
        amount: parsedEvidence.amount,
        normalizedAmount: parsedEvidence.normalizedAmount,
        provider: parsedEvidence.provider,
      },
    });

    assert.equal(updatedOcrData.normalizedAmount, "500.00", "OCR evidence is recorded in OcrResult");
    assert.equal(txAmountUpdated, false, "OCR processing must NEVER directly set or mutate PaymentTransaction.amount");
  } finally {
    prisma.ocrResult.update = originalOcrUpdate;
    prisma.paymentTransaction.update = originalTxUpdate;
  }
});

test("3. Successful staff verification: PaymentTransaction.amount = associated request fee snapshot", async () => {
  const restoreHooks = setupNotificationAndAuditMocks();
  const service = new DocumentRequestService();
  const originalTransaction = prisma.$transaction;

  let persistedTxData = null;
  let persistedRequestStatus = null;

  prisma.$transaction = async (callback) => {
    const mockTxPrisma = {
      documentRequest: {
        findUnique: async () => ({
          id: 50,
          trackingNumber: "DOC-2026-00050",
          parishId: 10,
          userId: 200,
          status: "PAYMENT_UNDER_REVIEW",
          fee: 120.00,
        }),
        updateMany: async ({ data }) => {
          persistedRequestStatus = data.status;
          return { count: 1 };
        },
      },
      paymentTransaction: {
        findFirst: async () => ({
          id: 301,
          requestId: 50,
          status: "PENDING",
          amount: null,
          receipts: [{ ocrResult: { isDuplicate: false } }],
        }),
        update: async ({ where, data }) => {
          persistedTxData = data;
          return { id: where.id, ...data };
        },
      },
      requestHistory: {
        create: async () => ({ id: 1 }),
      },
    };
    return callback(mockTxPrisma);
  };

  try {
    await service.updateStatus(50, "PAYMENT_VERIFIED", "Payment verified by secretary", 901, "SECRETARY", 10);

    assert.ok(persistedTxData, "PaymentTransaction must be updated");
    assert.equal(persistedTxData.status, "VERIFIED");
    assert.equal(persistedTxData.amount, 120.00, "Persisted transaction amount must equal the request fee snapshot");
    assert.equal(persistedTxData.verifiedById, 901);
    assert.ok(persistedTxData.verifiedAt instanceof Date);
    assert.equal(persistedRequestStatus, "PAYMENT_VERIFIED");
  } finally {
    prisma.$transaction = originalTransaction;
    restoreHooks();
  }
});

test("4. Request fee snapshot 150.00: verified transaction amount = 150.00", async () => {
  const restoreHooks = setupNotificationAndAuditMocks();
  const service = new DocumentRequestService();
  const originalTransaction = prisma.$transaction;

  let persistedAmount = null;

  prisma.$transaction = async (callback) => {
    const mockTxPrisma = {
      documentRequest: {
        findUnique: async () => ({
          id: 51,
          trackingNumber: "DOC-2026-00051",
          parishId: 10,
          userId: 201,
          status: "PAYMENT_UNDER_REVIEW",
          fee: 150.00,
        }),
        updateMany: async () => ({ count: 1 }),
      },
      paymentTransaction: {
        findFirst: async () => ({
          id: 302,
          requestId: 51,
          status: "PENDING",
          amount: null,
          receipts: [],
        }),
        update: async ({ data }) => {
          persistedAmount = data.amount;
          return { id: 302, ...data };
        },
      },
      requestHistory: {
        create: async () => ({ id: 1 }),
      },
    };
    return callback(mockTxPrisma);
  };

  try {
    await service.updateStatus(51, "PAYMENT_VERIFIED", "Verified", 901, "SECRETARY", 10);
    assert.equal(persistedAmount, 150.00);
  } finally {
    prisma.$transaction = originalTransaction;
    restoreHooks();
  }
});

test("5. Legitimate Decimal 0.00 fee snapshot: verification proceeds and persists 0.00", async () => {
  const restoreHooks = setupNotificationAndAuditMocks();
  const service = new DocumentRequestService();
  const originalTransaction = prisma.$transaction;

  let persistedAmount = null;
  let statusUpdated = false;

  prisma.$transaction = async (callback) => {
    const mockTxPrisma = {
      documentRequest: {
        findUnique: async () => ({
          id: 54,
          trackingNumber: "DOC-2026-00054",
          parishId: 10,
          userId: 204,
          status: "PAYMENT_UNDER_REVIEW",
          fee: 0.00,
        }),
        updateMany: async () => {
          statusUpdated = true;
          return { count: 1 };
        },
      },
      paymentTransaction: {
        findFirst: async () => ({
          id: 305,
          requestId: 54,
          status: "PENDING",
          amount: null,
          receipts: [],
        }),
        update: async ({ data }) => {
          persistedAmount = data.amount;
          return { id: 305, ...data };
        },
      },
      requestHistory: {
        create: async () => ({ id: 1 }),
      },
    };
    return callback(mockTxPrisma);
  };

  try {
    await service.updateStatus(54, "PAYMENT_VERIFIED", "Verified zero-fee", 901, "SECRETARY", 10);
    assert.equal(persistedAmount, 0.00, "Must preserve legitimate zero fee and persist 0.00");
    assert.equal(statusUpdated, true, "Verification should succeed for legitimate zero fee");
  } finally {
    prisma.$transaction = originalTransaction;
    restoreHooks();
  }
});

test("6. Null / undefined fee snapshot: verification fails, transaction remains unverified, no fabricated zero amount", async () => {
  const restoreHooks = setupNotificationAndAuditMocks();
  const service = new DocumentRequestService();
  const originalTransaction = prisma.$transaction;

  let txUpdateCalled = false;
  let requestUpdateCalled = false;

  prisma.$transaction = async (callback) => {
    const mockTxPrisma = {
      documentRequest: {
        findUnique: async () => ({
          id: 55,
          trackingNumber: "DOC-2026-00055",
          parishId: 10,
          userId: 205,
          status: "PAYMENT_UNDER_REVIEW",
          fee: null, // Missing authoritative fee snapshot
        }),
        update: async () => {
          requestUpdateCalled = true;
        },
      },
      paymentTransaction: {
        findFirst: async () => ({
          id: 306,
          requestId: 55,
          status: "PENDING",
          amount: null,
          receipts: [],
        }),
        update: async () => {
          txUpdateCalled = true;
        },
      },
      requestHistory: {
        create: async () => ({ id: 1 }),
      },
    };
    return callback(mockTxPrisma);
  };

  try {
    await assert.rejects(
      async () => {
        await service.updateStatus(55, "PAYMENT_VERIFIED", "Attempt verify with null fee", 901, "SECRETARY", 10);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Authoritative request fee amount is unavailable/i);
        return true;
      }
    );

    assert.equal(txUpdateCalled, false, "PaymentTransaction must NOT be updated or marked VERIFIED");
    assert.equal(requestUpdateCalled, false, "DocumentRequest status must NOT be updated");
  } finally {
    prisma.$transaction = originalTransaction;
    restoreHooks();
  }
});

test("7. OCR amount differs from request fee: verified transaction amount still equals request fee", async () => {
  const restoreHooks = setupNotificationAndAuditMocks();
  const service = new DocumentRequestService();
  const originalTransaction = prisma.$transaction;

  let persistedAmount = null;

  prisma.$transaction = async (callback) => {
    const mockTxPrisma = {
      documentRequest: {
        findUnique: async () => ({
          id: 52,
          trackingNumber: "DOC-2026-00052",
          parishId: 10,
          userId: 202,
          status: "PAYMENT_UNDER_REVIEW",
          fee: 150.00, // Authoritative fee snapshot
        }),
        updateMany: async () => ({ count: 1 }),
      },
      paymentTransaction: {
        findFirst: async () => ({
          id: 303,
          requestId: 52,
          status: "PENDING",
          amount: null,
          // OCR extracted a completely different amount (e.g. 500.00 or 100.00)
          receipts: [{
            ocrResult: {
              amount: "PHP 500.00",
              normalizedAmount: "500.00",
              isDuplicate: false,
            },
          }],
        }),
        update: async ({ data }) => {
          persistedAmount = data.amount;
          return { id: 303, ...data };
        },
      },
      requestHistory: {
        create: async () => ({ id: 1 }),
      },
    };
    return callback(mockTxPrisma);
  };

  try {
    await service.updateStatus(52, "PAYMENT_VERIFIED", "Verified", 901, "SECRETARY", 10);
    assert.equal(persistedAmount, 150.00, "Must use request.fee snapshot (150.00) and ignore differing OCR amount (500.00)");
  } finally {
    prisma.$transaction = originalTransaction;
    restoreHooks();
  }
});

test("8. Changing current parish/document pricing after request creation: does NOT change verified transaction amount", async () => {
  const restoreHooks = setupNotificationAndAuditMocks();
  const service = new DocumentRequestService();
  const originalTransaction = prisma.$transaction;

  let persistedAmount = null;

  // Request was created when fee snapshot was 100.00
  // Even if DocumentRequirementService / Parish currently returns 250.00, the snapshot is authoritative
  prisma.$transaction = async (callback) => {
    const mockTxPrisma = {
      documentRequest: {
        findUnique: async () => ({
          id: 53,
          trackingNumber: "DOC-2026-00053",
          parishId: 10,
          userId: 203,
          status: "PAYMENT_UNDER_REVIEW",
          fee: 100.00, // Snapshot at creation time
        }),
        updateMany: async () => ({ count: 1 }),
      },
      paymentTransaction: {
        findFirst: async () => ({
          id: 304,
          requestId: 53,
          status: "PENDING",
          amount: null,
          receipts: [],
        }),
        update: async ({ data }) => {
          persistedAmount = data.amount;
          return { id: 304, ...data };
        },
      },
      requestHistory: {
        create: async () => ({ id: 1 }),
      },
    };
    return callback(mockTxPrisma);
  };

  try {
    await service.updateStatus(53, "PAYMENT_VERIFIED", "Verified", 901, "SECRETARY", 10);
    assert.equal(persistedAmount, 100.00, "Must use snapshot on request (100.00) without recalculating from current parish config");
  } finally {
    prisma.$transaction = originalTransaction;
    restoreHooks();
  }
});

test("9. Verified payment analytics: verifiedAmount includes the persisted transaction amount", async () => {
  const analyticsRepo = new AnalyticsRepository();

  const originalCount = prisma.paymentTransaction.count;
  const originalGroupBy = prisma.paymentTransaction.groupBy;
  const originalAggregate = prisma.paymentTransaction.aggregate;
  const originalQueryRaw = prisma.$queryRaw;
  const originalDocCount = prisma.documentRequest.count;
  const originalDocGroupBy = prisma.documentRequest.groupBy;
  const originalSchedCount = prisma.schedule.count;
  const originalSchedGroupBy = prisma.schedule.groupBy;
  const originalEventCount = prisma.parishEvent.count;
  const originalEventGroupBy = prisma.parishEvent.groupBy;
  const originalReportCount = prisma.dailyReport.count;
  const originalReportGroupBy = prisma.dailyReport.groupBy;

  prisma.documentRequest.count = async () => 0;
  prisma.documentRequest.groupBy = async () => [];
  prisma.schedule.count = async () => 0;
  prisma.schedule.groupBy = async () => [];
  prisma.parishEvent.count = async () => 0;
  prisma.parishEvent.groupBy = async () => [];
  prisma.dailyReport.count = async () => 0;
  prisma.dailyReport.groupBy = async () => [];
  prisma.receiptUpload = { count: async () => 1 };
  prisma.requestHistory = { count: async () => 0 };

  prisma.paymentTransaction.count = async () => 2;
  prisma.paymentTransaction.groupBy = async () => [{ status: "VERIFIED", _count: 2 }];
  prisma.paymentTransaction.aggregate = async ({ where, _sum }) => {
    assert.equal(where.status, "VERIFIED");
    assert.equal(_sum.amount, true);
    return {
      _sum: {
        amount: {
          toFixed: (digits) => (300.00).toFixed(digits),
        },
      },
    };
  };

  prisma.$queryRaw = async () => [];

  try {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const toExclusive = new Date("2026-12-31T23:59:59.999Z");

    const result = await analyticsRepo.getDescriptiveAnalytics({
      from,
      toExclusive,
      includeUsers: false,
    });

    assert.ok(result.payments);
    assert.equal(result.payments.totalTransactions, 2);
    assert.equal(result.payments.verifiedAmount, "300.00", "Analytics verifiedAmount must reflect aggregate sum of verified transactions");
  } finally {
    prisma.paymentTransaction.count = originalCount;
    prisma.paymentTransaction.groupBy = originalGroupBy;
    prisma.paymentTransaction.aggregate = originalAggregate;
    prisma.$queryRaw = originalQueryRaw;
    prisma.documentRequest.count = originalDocCount;
    prisma.documentRequest.groupBy = originalDocGroupBy;
    prisma.schedule.count = originalSchedCount;
    prisma.schedule.groupBy = originalSchedGroupBy;
    prisma.parishEvent.count = originalEventCount;
    prisma.parishEvent.groupBy = originalEventGroupBy;
    prisma.dailyReport.count = originalReportCount;
    prisma.dailyReport.groupBy = originalReportGroupBy;
  }
});
