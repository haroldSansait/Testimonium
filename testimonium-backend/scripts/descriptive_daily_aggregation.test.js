import test from "node:test";
import assert from "node:assert/strict";
import {
  AnalyticsRepository,
  deriveMonthlyFromDaily,
} from "../repositories/AnalyticsRepository.js";

// =========================================================================
// 1. ISOLATED UNIT TESTS: deriveMonthlyFromDaily HELPER
// =========================================================================

test("deriveMonthlyFromDaily: groups daily counts into accurate YYYY-MM monthly buckets", () => {
  const dailyData = [
    { date: "2026-08-30", count: 2 },
    { date: "2026-08-31", count: 3 },
    { date: "2026-09-01", count: 4 },
    { date: "2026-09-02", count: 1 },
    { date: "2026-09-15", count: 5 },
  ];

  const monthly = deriveMonthlyFromDaily(dailyData);
  assert.equal(monthly.length, 2);

  assert.deepEqual(monthly[0], {
    month: "2026-08",
    count: 5,
  });

  assert.deepEqual(monthly[1], {
    month: "2026-09",
    count: 10,
  });
});

test("deriveMonthlyFromDaily: groups daily amounts with decimal precision for payments", () => {
  const dailyPayments = [
    { date: "2026-09-01", count: 2, amount: "300.00" },
    { date: "2026-09-05", count: 1, amount: "150.50" },
    { date: "2026-10-01", count: 1, amount: "75.25" },
  ];

  const monthly = deriveMonthlyFromDaily(dailyPayments);
  assert.equal(monthly.length, 2);

  assert.deepEqual(monthly[0], {
    month: "2026-09",
    count: 3,
    amount: "450.50",
  });

  assert.deepEqual(monthly[1], {
    month: "2026-10",
    count: 1,
    amount: "75.25",
  });
});

test("deriveMonthlyFromDaily: handles empty and malformed input gracefully", () => {
  assert.deepEqual(deriveMonthlyFromDaily([]), []);
  assert.deepEqual(deriveMonthlyFromDaily(null), []);
  assert.deepEqual(deriveMonthlyFromDaily(undefined), []);
  assert.deepEqual(deriveMonthlyFromDaily([{ notADate: "x" }]), []);
});

// =========================================================================
// 2. ISOLATED REPOSITORY MOCK TESTS: getDescriptiveAnalytics SHAPE
// =========================================================================

test("AnalyticsRepository (Isolated): returns both daily and derived monthly contracts", async () => {
  const mockDailyRequests = [
    { date: "2026-09-01", count: 3 },
    { date: "2026-09-02", count: 2 },
  ];

  const mockDailyPayments = [
    { date: "2026-09-01", count: 1, amount: "150.00" },
  ];

  const capturedSqlStrings = [];

  const mockPrisma = {
    documentRequest: {
      count: async () => 5,
      groupBy: async () => [{ documentType: "BAPTISMAL_CERTIFICATE", _count: 5 }],
    },
    paymentTransaction: {
      count: async () => 1,
      groupBy: async () => [{ status: "VERIFIED", _count: 1 }],
      aggregate: async () => ({ _sum: { amount: { toFixed: () => "150.00" } } }),
    },
    receiptUpload: {
      count: async () => 1,
    },
    requestHistory: {
      count: async () => 0,
    },
    schedule: {
      count: async () => 2,
      groupBy: async () => [],
    },
    parishEvent: {
      count: async () => 1,
      groupBy: async () => [],
    },
    dailyReport: {
      count: async () => 1,
      groupBy: async () => [],
    },
    user: {
      groupBy: async () => [],
    },
    role: {
      findMany: async () => [],
    },
    $queryRaw: async (strings, ...values) => {
      const rawSql = Array.isArray(strings)
        ? strings.join("?")
        : (strings?.strings ? strings.strings.join("?") : String(strings?.text || strings?.sql || strings));
      capturedSqlStrings.push(rawSql);

      if (rawSql.includes("hours") || rawSql.includes("AVG(")) {
        return [{ hours: 2.5 }];
      }
      if (rawSql.includes("payment_transactions")) {
        return mockDailyPayments;
      }
      if (rawSql.includes("document_requests")) {
        return mockDailyRequests;
      }
      if (rawSql.includes("parish_events")) {
        return [{ date: "2026-09-05", count: 1 }];
      }
      if (rawSql.includes("daily_reports")) {
        return [{ date: "2026-09-06", count: 1 }];
      }
      return [];
    },
  };

  const repo = new AnalyticsRepository(mockPrisma);
  const result = await repo.getDescriptiveAnalytics({
    from: new Date("2026-09-01T00:00:00.000Z"),
    toExclusive: new Date("2026-09-30T23:59:59.999Z"),
    includeUsers: false,
  });

  // Verify documents contracts
  assert.ok(Array.isArray(result.documents.daily), "documents.daily must be an array");
  assert.equal(result.documents.daily.length, 2);
  assert.equal(result.documents.daily[0].date, "2026-09-01");
  assert.equal(result.documents.daily[0].count, 3);

  assert.ok(Array.isArray(result.documents.monthly), "documents.monthly must be an array");
  assert.equal(result.documents.monthly.length, 1);
  assert.equal(result.documents.monthly[0].month, "2026-09");
  assert.equal(result.documents.monthly[0].count, 5);

  // Verify payments contracts
  assert.ok(Array.isArray(result.payments.daily), "payments.daily must be an array");
  assert.equal(result.payments.daily[0].date, "2026-09-01");
  assert.equal(result.payments.daily[0].amount, "150.00");

  assert.ok(Array.isArray(result.payments.monthly), "payments.monthly must be an array");
  assert.equal(result.payments.monthly[0].month, "2026-09");
  assert.equal(result.payments.monthly[0].amount, "150.00");

  // Verify events daily and monthly
  assert.ok(Array.isArray(result.events.dailyByEventDate));
  assert.equal(result.events.dailyByEventDate[0].date, "2026-09-05");
  assert.ok(Array.isArray(result.events.monthlyByEventDate));
  assert.equal(result.events.monthlyByEventDate[0].month, "2026-09");

  // Verify reports daily and monthly
  assert.ok(Array.isArray(result.reports.dailyByReportDate));
  assert.equal(result.reports.dailyByReportDate[0].date, "2026-09-06");
  assert.ok(Array.isArray(result.reports.monthlyByReportDate));
  assert.equal(result.reports.monthlyByReportDate[0].month, "2026-09");

  // Verify SQL inspection: pe.event_date and r.report_date use to_char directly without timezone shift
  const eventSql = capturedSqlStrings.find((s) => s.includes("parish_events"));
  assert.ok(eventSql, "parish_events query must be captured");
  assert.ok(
    eventSql.includes('to_char(pe."event_date"') || eventSql.includes('to_char(pe."event_date", \'YYYY-MM-DD\')'),
    "pe.event_date must be formatted directly as YYYY-MM-DD without timezone conversion"
  );
  assert.ok(
    !eventSql.includes("pe.\"event_date\" AT TIME ZONE"),
    "pe.event_date must NOT have AT TIME ZONE applied"
  );

  const reportSql = capturedSqlStrings.find((s) => s.includes("daily_reports"));
  assert.ok(reportSql, "daily_reports query must be captured");
  assert.ok(
    !reportSql.includes("r.\"report_date\" AT TIME ZONE"),
    "r.report_date must NOT have AT TIME ZONE applied"
  );
});
