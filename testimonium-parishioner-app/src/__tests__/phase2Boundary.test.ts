import { fetchParishes, fetchParishById, parishKeys } from "@/features/parishes/api";
import { fetchPublicEvents } from "@/features/events/api";
import { normalizeParishId } from "../../app/(app)/parishes/[parishId]";
import { navigateBackOrReplace } from "@/services/navigation/back";
import { getProtectedRouteGuards } from "@/services/auth/guards";
import { queryClient } from "@/services/queryClient";
import { apiClient } from "@/services/api/client";

jest.mock("@/services/api/client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

describe("Phase 2 Boundaries, Cache Safety, and Route Guards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("API Endpoint Boundaries", () => {
    it("parish discovery uses only GET /parishes and GET /parishes/:id", async () => {
      (apiClient.request as jest.Mock).mockResolvedValue({ items: [] });
      await fetchParishes();
      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/parishes" })
      );

      await fetchParishById(10);
      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/parishes/10" })
      );

      // Verify no staff mutation or admin endpoints are configured in client
      const calls = (apiClient.request as jest.Mock).mock.calls;
      for (const [callArg] of calls) {
        expect(callArg.method ?? "GET").toBe("GET");
        expect(callArg.path).not.toContain("/admin");
        expect(callArg.path).not.toContain("/staff");
        expect(callArg.path).not.toContain("/document-requests");
        expect(callArg.path).not.toContain("/schedules");
        expect(callArg.path).not.toContain("/payments");
      }
    });

    it("public event discovery uses only GET /parish-events/all", async () => {
      (apiClient.request as jest.Mock).mockResolvedValue([]);
      await fetchPublicEvents({ year: 2026, month: 8 });

      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/parish-events/all?year=2026&month=8",
        })
      );

      // Verify it does NOT use the staff-scoped /parish-events/:parishId endpoint
      const lastCall = (apiClient.request as jest.Mock).mock.calls.slice(-1)[0][0];
      expect(lastCall.path).toContain("/parish-events/all");
      expect(lastCall.path).not.toMatch(/\/parish-events\/\d+$/);
    });
  });

  describe("H-3 Parish Route Parameter Validation (normalizeParishId)", () => {
    it("accepts valid positive integer strings", () => {
      expect(normalizeParishId("1")).toBe("1");
      expect(normalizeParishId("42")).toBe("42");
      expect(normalizeParishId("  10  ")).toBe("10");
    });

    it("rejects malformed route parameters, suffixes, decimals, negatives, and non-numeric strings", () => {
      expect(normalizeParishId("1junk")).toBeNull();
      expect(normalizeParishId("junk1")).toBeNull();
      expect(normalizeParishId("1.5")).toBeNull();
      expect(normalizeParishId("-1")).toBeNull();
      expect(normalizeParishId("0")).toBeNull();
      expect(normalizeParishId("")).toBeNull();
      expect(normalizeParishId("   ")).toBeNull();
      expect(normalizeParishId(undefined)).toBeNull();
    });

    it("handles array params by taking the first element and validating it", () => {
      expect(normalizeParishId(["5"])).toBe("5");
      expect(normalizeParishId(["5junk"])).toBeNull();
      expect(normalizeParishId([])).toBeNull();
    });
  });

  describe("H-1 Infinite Pagination & Query Key Identity", () => {
    it("produces distinct query keys when search or type filter changes", () => {
      const keyDefault = parishKeys.list({ limit: 25 });
      const keySearchA = parishKeys.list({ search: "Cathedral", limit: 25 });
      const keySearchB = parishKeys.list({ search: "Francis", limit: 25 });
      const keyTypeParish = parishKeys.list({ type: "Parish", limit: 25 });

      expect(keyDefault).not.toEqual(keySearchA);
      expect(keySearchA).not.toEqual(keySearchB);
      expect(keySearchA).not.toEqual(keyTypeParish);
    });

    it("flattens multi-page data accumulation accurately without duplication", () => {
      const page1 = {
        items: [{ id: "1", name: "Parish 1" }, { id: "2", name: "Parish 2" }],
        page: 1,
        total: 4,
        totalPages: 2,
        limit: 2,
      };
      const page2 = {
        items: [{ id: "3", name: "Parish 3" }, { id: "4", name: "Parish 4" }],
        page: 2,
        total: 4,
        totalPages: 2,
        limit: 2,
      };

      const data = { pages: [page1, page2], pageParams: [1, 2] };
      const flat = data.pages.flatMap((p) => p.items);

      expect(flat).toHaveLength(4);
      expect(flat.map((p) => p.id)).toEqual(["1", "2", "3", "4"]);
    });
  });

  describe("Navigation Back & Fallback Safety", () => {
    it("calls goBack when router can go back", () => {
      const canGoBack = jest.fn().mockReturnValue(true);
      const goBack = jest.fn();
      const replaceFallback = jest.fn();

      navigateBackOrReplace(canGoBack, goBack, replaceFallback);

      expect(goBack).toHaveBeenCalledTimes(1);
      expect(replaceFallback).not.toHaveBeenCalled();
    });

    it("calls replaceFallback when router cannot go back", () => {
      const canGoBack = jest.fn().mockReturnValue(false);
      const goBack = jest.fn();
      const replaceFallback = jest.fn();

      navigateBackOrReplace(canGoBack, goBack, replaceFallback);

      expect(goBack).not.toHaveBeenCalled();
      expect(replaceFallback).toHaveBeenCalledTimes(1);
    });
  });

  describe("Route Guards for Authenticated App Shell", () => {
    it("allows (app) route access only when AUTHENTICATED_READY", () => {
      const readyGuards = getProtectedRouteGuards("AUTHENTICATED_READY");
      expect(readyGuards.app).toBe(true);
      expect(readyGuards.auth).toBe(false);
      expect(readyGuards.onboarding).toBe(false);

      const unauthedGuards = getProtectedRouteGuards("NO_FIREBASE_USER");
      expect(unauthedGuards.app).toBe(false);
      expect(unauthedGuards.auth).toBe(true);

      const bootingGuards = getProtectedRouteGuards("BOOTING");
      expect(bootingGuards.app).toBe(false);

      const emailPendingGuards = getProtectedRouteGuards(
        "EMAIL_VERIFICATION_REQUIRED"
      );
      expect(emailPendingGuards.app).toBe(false);

      const legalPendingGuards = getProtectedRouteGuards(
        "LEGAL_REQUIRED"
      );
      expect(legalPendingGuards.app).toBe(false);

      const profilePendingGuards = getProtectedRouteGuards(
        "PROFILE_COMPLETION_REQUIRED"
      );
      expect(profilePendingGuards.app).toBe(false);
    });
  });

  describe("TanStack Query Cache Safety", () => {
    it("clears all cached data safely on logout without throwing", async () => {
      queryClient.setQueryData(["parishes", "list"], { items: [{ id: "1" }] });
      queryClient.setQueryData(["events", "month"], [{ id: "e1" }]);

      expect(queryClient.getQueryData(["parishes", "list"])).toBeTruthy();
      expect(queryClient.getQueryData(["events", "month"])).toBeTruthy();

      await queryClient.cancelQueries();
      queryClient.clear();

      expect(queryClient.getQueryData(["parishes", "list"])).toBeUndefined();
      expect(queryClient.getQueryData(["events", "month"])).toBeUndefined();
    });
  });
});
