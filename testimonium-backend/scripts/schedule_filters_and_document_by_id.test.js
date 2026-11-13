import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../config/db.js";
import { ScheduleService } from "../services/ScheduleService.js";
import { DocumentRequestService } from "../services/DocumentRequestService.js";

test("DocumentRequestService.getById enforces draft, 404, and parish scoping", async () => {
  const originalFindUnique = prisma.documentRequest.findUnique;
  const service = new DocumentRequestService();

  try {
    prisma.documentRequest.findUnique = async ({ where }) => {
      if (where.id === 454) {
        return { id: 454, parishId: 7, isDraft: false, trackingNumber: "SR-2026-000454" };
      }
      if (where.id === 455) {
        return { id: 455, parishId: 7, isDraft: true, trackingNumber: "SR-2026-000455" };
      }
      return null;
    };

    const allowed = await service.getById(454, "SECRETARY", 7);
    assert.equal(allowed.id, 454);
    assert.equal(allowed.trackingNumber, "SR-2026-000454");

    const coordinatorAllowed = await service.getById(454, "DIOCESE_COORDINATOR", undefined);
    assert.equal(coordinatorAllowed.id, 454);

    await assert.rejects(() => service.getById(454, "SECRETARY", 9), (err) => err.statusCode === 403);
    await assert.rejects(() => service.getById(455, "SECRETARY", 7), (err) => err.statusCode === 404);
    await assert.rejects(() => service.getById(999, "SECRETARY", 7), (err) => err.statusCode === 404);
  } finally {
    prisma.documentRequest.findUnique = originalFindUnique;
  }
});

test("ScheduleService.list combines search (including REQ-YYYY-XXXX), eventType, and status filters", async () => {
  const originalFindMany = prisma.schedule.findMany;
  const originalCount = prisma.schedule.count;
  const originalQueryRaw = prisma.$queryRaw;
  const capturedWhere = [];
  const capturedRawQueries = [];

  const service = new ScheduleService();

  try {
    prisma.$queryRaw = async (strings, ...values) => {
      capturedRawQueries.push({ sql: strings.join("?"), values });
      return [{ id: 53 }];
    };
    prisma.schedule.findMany = async ({ where }) => {
      capturedWhere.push(where);
      return [];
    };
    prisma.schedule.count = async () => 0;

    await service.list({
      page: 1,
      limit: 5,
      search: "REQ-2026-0053",
      eventType: "MARRIAGE_SPECIAL",
      status: "CANCELLED,REJECTED",
      parishId: 3,
    });

    assert.equal(capturedRawQueries.length, 1);
    assert.deepEqual(capturedRawQueries[0].values, ["%REQ-2026-0053%"]);

    const where = capturedWhere[0];
    assert.equal(where.parishId, 3);
    assert.deepEqual(where.status, { in: ["CANCELLED", "REJECTED"] });
    assert.ok(Array.isArray(where.AND));
    assert.ok(where.AND.some((clause) => clause.eventType === "MARRIAGE_SPECIAL"));

    const searchClause = where.AND.find((clause) => Array.isArray(clause.OR));
    assert.ok(searchClause, "Expected compound search OR filter");
    assert.ok(
      searchClause.OR.some((item) => item.id && Array.isArray(item.id.in) && item.id.in.includes(53)),
      "Expected matching REQ-YYYY-XXXX id inside search OR filter"
    );

    // OTHER eventType category filter
    capturedWhere.length = 0;
    await service.list({
      page: 1,
      limit: 5,
      eventType: "OTHER",
    });
    const otherWhere = capturedWhere[0];
    const otherFilter = otherWhere.AND.find((clause) => Array.isArray(clause.OR));
    assert.ok(otherFilter);
    assert.ok(
      otherFilter.OR.some(
        (item) => item.eventType && Array.isArray(item.eventType.in) && item.eventType.in.includes("DELIVERANCE")
      ),
      "Expected OTHER filter to include Other-category event enums"
    );
  } finally {
    prisma.schedule.findMany = originalFindMany;
    prisma.schedule.count = originalCount;
    prisma.$queryRaw = originalQueryRaw;
  }
});

