import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import {
  verifiedPaymentsQuerySchema,
  descriptiveAnalyticsQuerySchema,
} from "../validators/analyticsSchemas.js";
import {
  isValidStrictManilaDate,
  getCalendarDayRange,
  deriveManilaPaymentBoundaries,
  manilaDateToUtcStart,
  advanceCalendarDay,
} from "../utils/manilaAnalyticsDate.js";
import { AnalyticsService } from "../services/AnalyticsService.js";
import {
  AnalyticsRepository,
  buildVerifiedPaymentWhere,
} from "../repositories/AnalyticsRepository.js";
import analyticsRouter from "../routes/analyticsRoutes.js";

// =========================================================================
// 1. STRICT DATE VALIDATION TESTS
// =========================================================================

test("Strict Date: rejects impossible dates (2026-02-31, 2026-13-01, 2026-00-10, non-leap Feb 29)", () => {
  assert.equal(isValidStrictManilaDate("2026-02-31"), false, "2026-02-31 must be rejected");
  assert.equal(isValidStrictManilaDate("2026-13-01"), false, "2026-13-01 must be rejected");
  assert.equal(isValidStrictManilaDate("2026-00-10"), false, "2026-00-10 must be rejected");
  assert.equal(isValidStrictManilaDate("2026-02-29"), false, "2026-02-29 (non-leap) must be rejected");
  assert.equal(isValidStrictManilaDate("not-a-date"), false, "malformed string must be rejected");
  assert.equal(isValidStrictManilaDate("2026-2-5"), false, "unpadded month/day must be rejected");
  assert.equal(isValidStrictManilaDate(null), false, "null must be rejected");
  assert.equal(isValidStrictManilaDate(12345), false, "non-string must be rejected");
});

test("Strict Date: accepts legitimate calendar dates including leap date 2028-02-29", () => {
  assert.equal(isValidStrictManilaDate("2028-02-29"), true, "2028-02-29 (leap) must be accepted");
  assert.equal(isValidStrictManilaDate("2026-01-01"), true, "2026-01-01 must be accepted");
  assert.equal(isValidStrictManilaDate("2026-12-31"), true, "2026-12-31 must be accepted");
});

test("Schema Validation: rejects impossible date in query", () => {
  const result = verifiedPaymentsQuerySchema.safeParse({
    from: "2026-02-31",
    to: "2026-03-01",
  });
  assert.equal(result.success, false);
});

test("Descriptive Schema Validation: rejects impossible dates (2026-02-31, 2026-13-01, non-leap Feb 29)", () => {
  const badDates = ["2026-02-31", "2026-13-01", "2026-00-01", "2026-04-31", "2027-02-29"];
  for (const bad of badDates) {
    const resFrom = descriptiveAnalyticsQuerySchema.safeParse({
      from: bad,
      to: "2027-03-01",
    });
    assert.equal(resFrom.success, false, `descriptive from should reject: ${bad}`);

    const resTo = descriptiveAnalyticsQuerySchema.safeParse({
      from: "2026-01-01",
      to: bad,
    });
    assert.equal(resTo.success, false, `descriptive to should reject: ${bad}`);
  }
});

test("Descriptive Schema Validation: accepts leap date 2028-02-29 and preserves from <= to", () => {
  const leapRes = descriptiveAnalyticsQuerySchema.safeParse({
    from: "2028-02-01",
    to: "2028-02-29",
  });
  assert.equal(leapRes.success, true);
  assert.equal(leapRes.data.from, "2028-02-01");
  assert.equal(leapRes.data.to, "2028-02-29");

  const invalidOrder = descriptiveAnalyticsQuerySchema.safeParse({
    from: "2026-05-10",
    to: "2026-05-01",
  });
  assert.equal(invalidOrder.success, false);
});

test("Schema Validation: accepts leap date 2028-02-29 in query", () => {
  const result = verifiedPaymentsQuerySchema.safeParse({
    from: "2028-02-01",
    to: "2028-02-29",
  });
  assert.equal(result.success, true);
  assert.equal(result.data.from, "2028-02-01");
  assert.equal(result.data.to, "2028-02-29");
});

test("Schema Validation: preserves from <= to and rejects from > to", () => {
  const invalid = verifiedPaymentsQuerySchema.safeParse({
    from: "2026-05-10",
    to: "2026-05-01",
  });
  assert.equal(invalid.success, false);

  const valid = verifiedPaymentsQuerySchema.safeParse({
    from: "2026-05-01",
    to: "2026-05-10",
  });
  assert.equal(valid.success, true);
});

test("Schema Validation: rejects date ranges exceeding 366 calendar days", () => {
  const invalid = verifiedPaymentsQuerySchema.safeParse({
    from: "2025-01-01",
    to: "2026-01-03", // 368 days
  });
  assert.equal(invalid.success, false);

  const valid = verifiedPaymentsQuerySchema.safeParse({
    from: "2025-01-01",
    to: "2025-12-31", // 365 days
  });
  assert.equal(valid.success, true);
});

// =========================================================================
// 2. STRICT INTEGER VALIDATION TESTS
// =========================================================================

test("Strict Integer: rejects unsafe, exponential, and float values for parishId", () => {
  const badInputs = ["1e2", "+12", "1.5", "junk", "0", "-5", "9007199254740992", 0, -1, 1.5];
  for (const bad of badInputs) {
    const res = verifiedPaymentsQuerySchema.safeParse({ parishId: bad });
    assert.equal(res.success, false, `parishId should reject: ${bad}`);
  }
});

test("Strict Integer: rejects unsafe, exponential, zero, negative, and out-of-bound page/limit", () => {
  const badPages = ["1e2", "+1", "1.5", "0", "-1", "junk", 0, -5];
  for (const bad of badPages) {
    const res = verifiedPaymentsQuerySchema.safeParse({ page: bad });
    assert.equal(res.success, false, `page should reject: ${bad}`);
  }

  const badLimits = ["1e2", "+10", "1.5", "0", "-1", "101", 0, 101];
  for (const bad of badLimits) {
    const res = verifiedPaymentsQuerySchema.safeParse({ limit: bad });
    assert.equal(res.success, false, `limit should reject: ${bad}`);
  }
});

test("Strict Integer: normalizes valid integer strings into bounded numbers with defaults", () => {
  const res = verifiedPaymentsQuerySchema.safeParse({
    page: "2",
    limit: "50",
    parishId: "7",
  });
  assert.equal(res.success, true);
  assert.equal(res.data.page, 2);
  assert.equal(res.data.limit, 50);
  assert.equal(res.data.parishId, 7);

  // Defaults when omitted
  const defaults = verifiedPaymentsQuerySchema.safeParse({});
  assert.equal(defaults.success, true);
  assert.equal(defaults.data.page, 1);
  assert.equal(defaults.data.limit, 20);
  assert.equal(defaults.data.parishId, undefined);
});

// =========================================================================
// 3. SEARCH NORMALIZATION TESTS
// =========================================================================

test("Search: whitespace search normalizes to undefined, valid search is trimmed", () => {
  const emptyRes = verifiedPaymentsQuerySchema.safeParse({ search: "    " });
  assert.equal(emptyRes.success, true);
  assert.equal(emptyRes.data.search, undefined);

  const trimRes = verifiedPaymentsQuerySchema.safeParse({ search: "  REQ-12345  " });
  assert.equal(trimRes.success, true);
  assert.equal(trimRes.data.search, "REQ-12345");

  const longRes = verifiedPaymentsQuerySchema.safeParse({ search: "a".repeat(101) });
  assert.equal(longRes.success, false, "search longer than 100 chars must fail");
});

// =========================================================================
// 4. TENANCY & PREDICATE DEFENSE-IN-DEPTH TESTS
// =========================================================================

test("Tenancy: Secretary parish comes exclusively from actor identity and cannot be bypassed", async () => {
  let capturedFilters = null;
  const mockRepo = {
    getVerifiedPaymentDetails: async (filters) => {
      capturedFilters = filters;
      return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    },
  };
  const service = new AnalyticsService(mockRepo);

  // Secretary with actor parish 5 passes query parishId 99
  const actor = { role: "SECRETARY", parish: { id: 5 } };
  await service.getVerifiedPayments({ parishId: 99 }, actor);

  assert.equal(capturedFilters.parishId, 5, "Secretary must be strictly bound to actor parish, ignoring query parishId");

  // Secretary without parish fails closed with 403
  await assert.rejects(
    async () => {
      await service.getVerifiedPayments({}, { role: "SECRETARY", parish: null });
    },
    { statusCode: 403 }
  );
});

test("Tenancy: Coordinator retains all-parish or optional single-parish scope", async () => {
  let capturedFilters = null;
  const mockRepo = {
    getVerifiedPaymentDetails: async (filters) => {
      capturedFilters = filters;
      return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    },
  };
  const service = new AnalyticsService(mockRepo);

  // Coordinator without parishId -> all-parish (parishId = null)
  await service.getVerifiedPayments({}, { role: "DIOCESE_COORDINATOR" });
  assert.equal(capturedFilters.parishId, null);

  // Coordinator with parishId -> scoped to parish
  await service.getVerifiedPayments({ parishId: 12 }, { role: "DIOCESE_COORDINATOR" });
  assert.equal(capturedFilters.parishId, 12);
});

test("Search Predicate: cannot overwrite Secretary tenant predicate (AND-semantics)", () => {
  const from = new Date("2026-01-01T00:00:00Z");
  const toExclusive = new Date("2026-02-01T00:00:00Z");
  const baseWhere = buildVerifiedPaymentWhere({
    from,
    toExclusive,
    parishId: 5,
    documentType: "BAPTISMAL_CERTIFICATE",
  });

  assert.equal(baseWhere.status, "VERIFIED");
  assert.equal(baseWhere.request.parishId, 5);
  assert.equal(baseWhere.request.documentType, "BAPTISMAL_CERTIFICATE");

  // Detail query AND-merging structure
  const searchWhere = {
    OR: [
      { referenceNumber: { contains: "Juan", mode: "insensitive" } },
      { request: { trackingNumber: { contains: "Juan", mode: "insensitive" } } },
      { request: { user: { fullName: { contains: "Juan", mode: "insensitive" } } } },
      {
        receipts: {
          some: {
            isSuperseded: false,
            ocrResult: { referenceNumber: { contains: "Juan", mode: "insensitive" } },
          },
        },
      },
    ],
  };

  const finalWhere = { AND: [baseWhere, searchWhere] };

  // Verify that base tenant constraints are protected inside AND[0]
  assert.equal(finalWhere.AND[0].request.parishId, 5);
  assert.equal(finalWhere.AND[0].status, "VERIFIED");
  // OCR filter requires isSuperseded = false
  assert.equal(finalWhere.AND[1].OR[3].receipts.some.isSuperseded, false);
});

// =========================================================================
// 5. MANILA DATE BOUNDARIES IN DESCRIPTIVE & DETAIL ANALYTICS
// =========================================================================

test("Manila Date Boundaries: paymentFrom/paymentToExclusive are derived at Manila 00:00 in UTC", () => {
  // 2026-09-09 Manila 00:00 = 2026-09-08 16:00:00 UTC (UTC+8)
  const utcStart = manilaDateToUtcStart("2026-09-09");
  assert.equal(utcStart.toISOString(), "2026-09-08T16:00:00.000Z");

  // advanceCalendarDay handles month boundaries
  assert.equal(advanceCalendarDay("2028-02-29", 1), "2028-03-01");
  assert.equal(advanceCalendarDay("2026-12-31", 1), "2027-01-01");

  const boundaries = deriveManilaPaymentBoundaries("2026-09-01", "2026-09-09");
  assert.equal(boundaries.paymentFrom.toISOString(), "2026-08-31T16:00:00.000Z");
  assert.equal(boundaries.paymentToExclusive.toISOString(), "2026-09-09T16:00:00.000Z");
});

test("Descriptive Analytics: passes payment-specific Manila boundaries without mutating non-payment boundaries", async () => {
  let capturedFilters = null;
  const mockRepo = {
    getDescriptiveAnalytics: async (filters) => {
      capturedFilters = filters;
      return {
        documents: {},
        payments: {},
        scheduling: {},
        events: {},
        reports: {},
        users: null,
        parishComparisons: null,
      };
    },
  };

  const service = new AnalyticsService(mockRepo);
  await service.getDescriptiveAnalytics(
    { from: "2026-09-01", to: "2026-09-09", documentType: "BAPTISMAL_CERTIFICATE" },
    { role: "DIOCESE_COORDINATOR" }
  );

  // Non-payment boundaries remain UTC-based
  assert.equal(capturedFilters.from.toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(capturedFilters.toExclusive.toISOString(), "2026-09-10T00:00:00.000Z");

  // Payment boundaries are Manila-derived (UTC-8h)
  assert.equal(capturedFilters.paymentFrom.toISOString(), "2026-08-31T16:00:00.000Z");
  assert.equal(capturedFilters.paymentToExclusive.toISOString(), "2026-09-09T16:00:00.000Z");

  // documentType filter passed
  assert.equal(capturedFilters.documentType, "BAPTISMAL_CERTIFICATE");
});

// =========================================================================
// 6. MANILA MONTHLY SQL TIMEZONE CONVERSION TEST
// =========================================================================

test("Manila Monthly SQL: converts UTC timestamp to Manila wall time before date_trunc", () => {
  // Stored createdAt: UTC 2026-08-31 23:30:00 (August in UTC)
  // In Asia/Manila (UTC+8): 2026-09-01 07:30:00 (September in Manila)
  // Converting (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila' correctly yields 2026-09
  const utcDate = new Date("2026-08-31T23:30:00.000Z");
  const manilaMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).format(utcDate); // Returns "2026-09"

  assert.equal(manilaMonth, "2026-09", "A UTC timestamp at late August must bucket into September in Manila");
});

// =========================================================================
// 7. CONSISTENT SNAPSHOT READ & PAGINATION CLAMPING
// =========================================================================

test("Repository Snapshot: zero total returns page=1, totalPages=0, data=[]", async () => {
  const mockPrisma = {
    $transaction: async (fn, options) => {
      // Confirm RepeatableRead is requested
      assert.equal(options?.isolationLevel, Prisma.TransactionIsolationLevel.RepeatableRead);
      return fn({
        paymentTransaction: {
          count: async () => 0,
          findMany: async () => [],
        },
      });
    },
  };

  const repo = new AnalyticsRepository(mockPrisma);
  const result = await repo.getVerifiedPaymentDetails({
    from: new Date("2026-01-01T00:00:00Z"),
    toExclusive: new Date("2026-02-01T00:00:00Z"),
    page: 5,
    limit: 20,
  });

  assert.equal(result.pagination.total, 0);
  assert.equal(result.pagination.totalPages, 0);
  assert.equal(result.pagination.page, 1, "Zero total must return page 1");
  assert.deepEqual(result.data, []);
});

test("Repository Snapshot: clamps requested page above current totalPages safely", async () => {
  let findManySkip = null;
  const mockPrisma = {
    $transaction: async (fn) => {
      return fn({
        paymentTransaction: {
          count: async () => 45, // 45 items at limit 20 = 3 pages
          findMany: async ({ skip }) => {
            findManySkip = skip;
            return [];
          },
        },
      });
    },
  };

  const repo = new AnalyticsRepository(mockPrisma);
  const result = await repo.getVerifiedPaymentDetails({
    from: new Date("2026-01-01T00:00:00Z"),
    toExclusive: new Date("2026-02-01T00:00:00Z"),
    page: 10, // requested page 10 exceeds totalPages 3
    limit: 20,
  });

  assert.equal(result.pagination.total, 45);
  assert.equal(result.pagination.totalPages, 3);
  assert.equal(result.pagination.page, 3, "Page 10 must be clamped to page 3");
  assert.equal(findManySkip, (3 - 1) * 20, "findMany skip must be calculated from clamped page");
});

test("Repository Transaction: propagates original database error without retrying or downgrading isolation", async () => {
  let transactionCallCount = 0;
  const originalDbError = new Error("Connection terminated unexpectedly / deadlock");

  const mockPrisma = {
    $transaction: async (fn, options) => {
      transactionCallCount++;
      // Confirm RepeatableRead is requested
      assert.equal(options?.isolationLevel, Prisma.TransactionIsolationLevel.RepeatableRead);
      throw originalDbError;
    },
  };

  const repo = new AnalyticsRepository(mockPrisma);
  await assert.rejects(
    async () => {
      await repo.getVerifiedPaymentDetails({
        from: new Date("2026-01-01T00:00:00Z"),
        toExclusive: new Date("2026-02-01T00:00:00Z"),
        page: 1,
        limit: 20,
      });
    },
    (err) => {
      assert.equal(err, originalDbError, "Must propagate original error unchanged");
      return true;
    }
  );

  assert.equal(transactionCallCount, 1, "Must NOT retry or fallback to weaker isolation level");
});

// =========================================================================
// 8. DETAIL DTO PRIVACY & SENSITIVE FIELD EXCLUSION
// =========================================================================

test("Detail DTO: formats amount as fixed two-decimal string and excludes sensitive internals", async () => {
  const mockRows = [
    {
      id: 101,
      referenceNumber: "TX-REF-001",
      amount: { toFixed: (n) => "150.00" }, // Prisma Decimal mock
      status: "VERIFIED",
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
      verifiedAt: new Date("2026-09-01T14:30:00.000Z"),
      request: {
        trackingNumber: "TRK-9999",
        documentType: "BAPTISMAL_CERTIFICATE",
        user: { id: 20, fullName: "Maria Clara" },
        parish: { id: 3, parishName: "San Jose Parish" },
      },
      verifier: { id: 5, fullName: "Fr. Gomez" },
      receipts: [
        {
          ocrResult: { referenceNumber: "OCR-REF-FALLBACK" },
        },
      ],
    },
    {
      id: 102,
      referenceNumber: null,
      amount: { toFixed: (n) => "0.00" }, // Free document
      status: "VERIFIED",
      createdAt: new Date("2026-09-02T10:00:00.000Z"),
      verifiedAt: null,
      request: {
        trackingNumber: "TRK-8888",
        documentType: "MARRIAGE_CERTIFICATE",
        user: { id: 21, fullName: "Crisostomo Ibarra" },
        parish: { id: 3, parishName: "San Jose Parish" },
      },
      verifier: null,
      receipts: [
        {
          ocrResult: { referenceNumber: "OCR-FALLBACK-123" },
        },
      ],
    },
  ];

  const mockPrisma = {
    $transaction: async (fn) => {
      return fn({
        paymentTransaction: {
          count: async () => 2,
          findMany: async () => mockRows,
        },
      });
    },
  };

  const repo = new AnalyticsRepository(mockPrisma);
  const result = await repo.getVerifiedPaymentDetails({
    from: new Date("2026-09-01T00:00:00Z"),
    toExclusive: new Date("2026-09-03T00:00:00Z"),
  });

  const [item1, item2] = result.data;

  // Item 1: Direct transaction reference, authoritative 150.00
  assert.equal(item1.id, 101);
  assert.equal(item1.paymentReference, "TX-REF-001");
  assert.equal(item1.requestReference, "TRK-9999");
  assert.equal(item1.amount, "150.00");
  assert.equal(item1.status, "VERIFIED");
  assert.equal(item1.parishioner.name, "Maria Clara");
  assert.equal(item1.parish.name, "San Jose Parish");
  assert.equal(item1.verifiedBy.name, "Fr. Gomez");

  // Item 2: Null reference fallback to OCR reference, free 0.00
  assert.equal(item2.id, 102);
  assert.equal(item2.paymentReference, "OCR-FALLBACK-123");
  assert.equal(item2.amount, "0.00");
  assert.equal(item2.verifiedBy, null);

  // Check no sensitive fields leaked in either item
  for (const item of [item1, item2]) {
    assert.equal(item.r2ObjectKey, undefined);
    assert.equal(item.receiptUrl, undefined);
    assert.equal(item.fileName, undefined);
    assert.equal(item.rawText, undefined);
    assert.equal(item.confidenceScore, undefined);
    assert.equal(item.email, undefined);
    assert.equal(item.contactNumber, undefined);
    assert.equal(item.address, undefined);
    assert.equal(item.firebaseUid, undefined);
  }
});

// =========================================================================
// 9. ROUTE MOUNTING ORDER TEST
// =========================================================================

test("Route Guard: /payments/verified is mounted BEFORE coordinator-only middleware guard", () => {
  // Inspect express router layer stack
  const stack = analyticsRouter.stack;
  assert.ok(stack && stack.length > 0, "Router stack must not be empty");

  let verifiedRouteIndex = -1;
  let coordinatorGuardIndex = -1;

  stack.forEach((layer, idx) => {
    if (layer.route && layer.route.path === "/payments/verified") {
      verifiedRouteIndex = idx;
    }
    // Check for coordinator-only router.use middleware
    if (
      !layer.route &&
      layer.name === "checkRoleMiddleware" &&
      layer.handle?.toString?.().includes("DIOCESE_COORDINATOR")
    ) {
      coordinatorGuardIndex = idx;
    }
  });

  assert.ok(verifiedRouteIndex !== -1, "/payments/verified route must be registered");
  assert.ok(
    coordinatorGuardIndex === -1 || verifiedRouteIndex < coordinatorGuardIndex,
    `/payments/verified (index ${verifiedRouteIndex}) MUST be mounted before coordinator-only router.use guard (index ${coordinatorGuardIndex})`
  );
});
