import test from "node:test";
import assert from "node:assert/strict";
import { AnalyticsService } from "../services/AnalyticsService.js";

test("1. Coordinator + All Parishes: includeUsers is true and user metrics are returned", async () => {
  let passedFilters = null;
  const mockRepo = {
    getDescriptiveAnalytics: async (filters) => {
      passedFilters = filters;
      return {
        documents: { total: 10 },
        payments: { totalTransactions: 5 },
        users: filters.includeUsers ? { byRole: [{ role: "PARISHIONER", count: 20 }], monthlyGrowth: [] } : null,
      };
    },
  };

  const service = new AnalyticsService(mockRepo);
  const result = await service.getDescriptiveAnalytics(
    { from: "2026-01-01", to: "2026-09-01" },
    { role: "DIOCESE_COORDINATOR", id: 1 }
  );

  assert.equal(passedFilters.includeUsers, true);
  assert.equal(passedFilters.parishId, null);
  assert.ok(result.users, "Users analytics must be available when Coordinator views All Parishes");
});

test("2. Coordinator + Specific Parish: includeUsers is false and user metrics are null", async () => {
  let passedFilters = null;
  const mockRepo = {
    getDescriptiveAnalytics: async (filters) => {
      passedFilters = filters;
      return {
        documents: { total: 2 },
        payments: { totalTransactions: 1 },
        users: filters.includeUsers ? { byRole: [{ role: "PARISHIONER", count: 20 }], monthlyGrowth: [] } : null,
      };
    },
  };

  const service = new AnalyticsService(mockRepo);
  const result = await service.getDescriptiveAnalytics(
    { from: "2026-01-01", to: "2026-09-01", parishId: "2" },
    { role: "DIOCESE_COORDINATOR", id: 1 }
  );

  assert.equal(passedFilters.includeUsers, false);
  assert.equal(passedFilters.parishId, 2);
  assert.equal(result.users, null, "Users analytics must be null when a specific parish is filtered");
  assert.equal(result.documents.total, 2, "Parish-scoped operational analytics must remain intact");
});

test("3. Secretary: includeUsers is false and Users analytics is always unavailable", async () => {
  let passedFilters = null;
  const mockRepo = {
    getDescriptiveAnalytics: async (filters) => {
      passedFilters = filters;
      return {
        documents: { total: 2 },
        payments: { totalTransactions: 1 },
        users: filters.includeUsers ? { byRole: [{ role: "PARISHIONER", count: 20 }], monthlyGrowth: [] } : null,
      };
    },
  };

  const service = new AnalyticsService(mockRepo);
  const result = await service.getDescriptiveAnalytics(
    { from: "2026-01-01", to: "2026-09-01" },
    { role: "SECRETARY", id: 2, parishId: 2 }
  );

  assert.equal(passedFilters.includeUsers, false);
  assert.equal(passedFilters.parishId, 2);
  assert.equal(result.users, null, "Secretary must never receive diocese-wide user metrics");
  assert.equal(result.documents.total, 2, "Secretary receives parish-scoped operational metrics");
});
