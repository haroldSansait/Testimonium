import {
  fetchParishes,
  fetchParishById,
  parishKeys,
} from "@/features/parishes/api";
import {
  buildEmailUrl,
  buildMapUrl,
  buildPhoneUrl,
  formatOfficeHours,
  isValidCoordinate,
} from "@/features/parishes/utils";
import {
  PARISH_TYPE_FILTERS,
  PARISH_TYPE_LABELS,
  type OfficeHoursRecord,
} from "@/features/parishes/types";
import { apiClient } from "@/services/api/client";

jest.mock("@/services/api/client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

describe("Parish Feature & Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("parishKeys", () => {
    it("generates structured query keys", () => {
      expect(parishKeys.all).toEqual(["parishes"]);
      expect(parishKeys.lists()).toEqual(["parishes", "list"]);
      expect(
        parishKeys.list({ search: "San Carlos", type: "Parish", page: 1, limit: 25 })
      ).toEqual([
        "parishes",
        "list",
        { search: "San Carlos", type: "Parish", page: 1, limit: 25 },
      ]);
      expect(parishKeys.details()).toEqual(["parishes", "detail"]);
      expect(parishKeys.detail(12)).toEqual(["parishes", "detail", "12"]);
      expect(parishKeys.detail("45")).toEqual(["parishes", "detail", "45"]);
    });
  });

  describe("fetchParishes", () => {
    it("calls /parishes with correct query parameters", async () => {
      (apiClient.request as jest.Mock).mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 0,
      });

      await fetchParishes({
        search: "Saint Charles",
        type: "Parish",
        page: 2,
        limit: 10,
      });

      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/parishes?search=Saint+Charles&type=Parish&page=2&limit=10",
        })
      );
    });

    it("omits 'all' type and empty search from query params", async () => {
      (apiClient.request as jest.Mock).mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 0,
      });

      await fetchParishes({
        search: "   ",
        type: "all",
      });

      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/parishes",
        })
      );
    });

  });

  describe("fetchParishById", () => {
    it("calls /parishes/:id with correct path", async () => {
      (apiClient.request as jest.Mock).mockResolvedValueOnce({
        id: "5",
        name: "San Carlos Borromeo Cathedral",
      });

      await fetchParishById(5);

      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/parishes/5",
        })
      );
    });
  });

  describe("buildPhoneUrl", () => {
    it("builds valid tel: URLs for valid numbers", () => {
      expect(buildPhoneUrl("+63 917 123 4567")).toBe("tel:+639171234567");
      expect(buildPhoneUrl("0918-555-1234")).toBe("tel:09185551234");
    });

    it("returns null for empty or invalid phone numbers", () => {
      expect(buildPhoneUrl(null)).toBeNull();
      expect(buildPhoneUrl(undefined)).toBeNull();
      expect(buildPhoneUrl("")).toBeNull();
      expect(buildPhoneUrl("123")).toBeNull();
    });
  });

  describe("buildEmailUrl", () => {
    it("builds valid mailto: URLs", () => {
      expect(buildEmailUrl("cathedral@testimonium.ph")).toBe(
        "mailto:cathedral%40testimonium.ph"
      );
    });

    it("returns null for empty or invalid emails", () => {
      expect(buildEmailUrl(null)).toBeNull();
      expect(buildEmailUrl(undefined)).toBeNull();
      expect(buildEmailUrl("")).toBeNull();
      expect(buildEmailUrl("invalid-email")).toBeNull();
    });
  });

  describe("isValidCoordinate", () => {
    it("validates realistic geographical coordinates", () => {
      expect(isValidCoordinate(10.485, 123.415)).toBe(true);
      expect(isValidCoordinate(0, 0)).toBe(true);
      expect(isValidCoordinate(-90, -180)).toBe(true);
      expect(isValidCoordinate(90, 180)).toBe(true);
    });

    it("rejects out-of-range, NaN, Infinity, and null coordinates", () => {
      expect(isValidCoordinate(91, 120)).toBe(false);
      expect(isValidCoordinate(-91, 120)).toBe(false);
      expect(isValidCoordinate(10, 181)).toBe(false);
      expect(isValidCoordinate(10, -181)).toBe(false);
      expect(isValidCoordinate(NaN, 120)).toBe(false);
      expect(isValidCoordinate(10, NaN)).toBe(false);
      expect(isValidCoordinate(Infinity, 120)).toBe(false);
      expect(isValidCoordinate(null, 120)).toBe(false);
      expect(isValidCoordinate(undefined, undefined)).toBe(false);
    });
  });

  describe("buildMapUrl", () => {
    it("builds coordinate-based map URL when valid lat/lng are provided", () => {
      const url = buildMapUrl({
        latitude: 10.485,
        longitude: 123.415,
        name: "Cathedral",
      });
      expect(url).toBeTruthy();
      expect(url).toContain("10.485");
      expect(url).toContain("123.415");
    });

    it("falls back to address query when coordinates are invalid", () => {
      const url = buildMapUrl({
        latitude: 999,
        longitude: 999,
        address: "San Carlos City, Negros Occidental",
      });
      expect(url).toBeTruthy();
      expect(url).toContain("San%20Carlos%20City");
    });

    it("builds query-based map URL when only address is provided", () => {
      const url = buildMapUrl({
        address: "San Carlos City, Negros Occidental",
      });
      expect(url).toBeTruthy();
      expect(url).toContain("San%20Carlos%20City");
    });

    it("returns null when no valid coordinates or address are provided", () => {
      expect(buildMapUrl({})).toBeNull();
      expect(buildMapUrl({ name: "Parish Name" })).toBeNull();
      expect(buildMapUrl({ latitude: NaN, longitude: NaN })).toBeNull();
    });
  });

  describe("formatOfficeHours (Backend Structure & Legacy Support)", () => {
    it("formats backend structured office hours (openTime, closeTime, isClosed)", () => {
      const backendOfficeHours: OfficeHoursRecord = {
        Monday: { openTime: "08:00 AM", closeTime: "05:00 PM", isClosed: false },
        Tuesday: { openTime: "08:00 AM", closeTime: "05:00 PM", isClosed: false },
        Wednesday: { isClosed: true },
        Thursday: { openTime: "09:00 AM", closeTime: "04:00 PM", isClosed: false },
        Friday: { openTime: "08:00 AM", closeTime: "12:00 PM", isClosed: false },
        Saturday: { isClosed: true },
        Sunday: { isClosed: true },
      };

      const result = formatOfficeHours(backendOfficeHours);
      expect(result).toEqual([
        { day: "Monday", hours: "08:00 AM - 05:00 PM" },
        { day: "Tuesday", hours: "08:00 AM - 05:00 PM" },
        { day: "Wednesday", hours: "Closed" },
        { day: "Thursday", hours: "09:00 AM - 04:00 PM" },
        { day: "Friday", hours: "08:00 AM - 12:00 PM" },
        { day: "Saturday", hours: "Closed" },
        { day: "Sunday", hours: "Closed" },
      ]);
    });

    it("formats lowercase day keys and legacy fields (open, close, closed)", () => {
      const legacyHours: OfficeHoursRecord = {
        monday: { open: "08:00 AM", close: "05:00 PM" },
        wednesday: { closed: true },
        friday: "09:00 AM - 04:00 PM",
      };

      const result = formatOfficeHours(legacyHours);
      expect(result).toEqual([
        { day: "Monday", hours: "08:00 AM - 05:00 PM" },
        { day: "Wednesday", hours: "Closed" },
        { day: "Friday", hours: "09:00 AM - 04:00 PM" },
      ]);
    });

    it("handles partial times without rendering undefined or null", () => {
      const partialHours: OfficeHoursRecord = {
        monday: { openTime: "08:00 AM" },
        friday: { closeTime: "05:00 PM" },
      };

      const result = formatOfficeHours(partialHours);
      expect(result).toEqual([
        { day: "Monday", hours: "From 08:00 AM" },
        { day: "Friday", hours: "Until 05:00 PM" },
      ]);
    });

    it("returns empty array for null/undefined/empty/malformed office hours", () => {
      expect(formatOfficeHours(null)).toEqual([]);
      expect(formatOfficeHours(undefined)).toEqual([]);
      expect(formatOfficeHours({})).toEqual([]);
      expect(formatOfficeHours([] as any)).toEqual([]);
      expect(formatOfficeHours("malformed string" as any)).toEqual([]);
    });
  });

  describe("Type Filter Definitions", () => {
    it("maps all supported parish types accurately", () => {
      expect(PARISH_TYPE_LABELS["Parish"]).toBe("Parish");
      expect(PARISH_TYPE_LABELS["Quasi-Parish"]).toBe("Quasi-Parish");
      expect(PARISH_TYPE_LABELS["Mission Station"]).toBe("Mission Station");
      expect(PARISH_TYPE_FILTERS).toHaveLength(4);
    });
  });
});
