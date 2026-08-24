import {
  CANONICAL_DOCUMENT_TYPES,
  DocumentRequestDetail,
  DocumentRequestStatus,
} from "../features/requests/types";
import {
  formatDate,
  formatDateTime,
  formatDocumentType,
  formatFee,
  formatStatus,
  getEffectiveOfferedDocuments,
  isCancelEligible,
  isDocumentCorrectionEligible,
  isPaymentEligible,
  isZeroFee,
  STATUS_PRESENTATION,
} from "../features/requests/presentation";

describe("Requests Presentation & Helpers", () => {
  describe("Canonical Document Types & Offered Semantics", () => {
    it("recognizes all 7 canonical document types", () => {
      expect(CANONICAL_DOCUMENT_TYPES).toEqual([
        "BAPTISMAL_CERTIFICATE",
        "CONFIRMATION_CERTIFICATE",
        "MARRIAGE_CERTIFICATE",
        "FIRST_COMMUNION_CERTIFICATE",
        "MARRIAGE_BANNS",
        "PERMIT_TO_MARRY",
        "STATUS_OF_LIBERTY",
      ]);
    });

    it("formats all 7 canonical document types into human-readable labels", () => {
      expect(formatDocumentType("BAPTISMAL_CERTIFICATE")).toBe("Baptismal Certificate");
      expect(formatDocumentType("CONFIRMATION_CERTIFICATE")).toBe("Confirmation Certificate");
      expect(formatDocumentType("MARRIAGE_CERTIFICATE")).toBe("Marriage Certificate");
      expect(formatDocumentType("FIRST_COMMUNION_CERTIFICATE")).toBe("First Communion Certificate");
      expect(formatDocumentType("MARRIAGE_BANNS")).toBe("Marriage Banns");
      expect(formatDocumentType("PERMIT_TO_MARRY")).toBe("Permit to Marry");
      expect(formatDocumentType("STATUS_OF_LIBERTY")).toBe("Status of Liberty");
      expect(formatDocumentType(null)).toBe("Sacramental Certificate");
    });

    it("resolves getEffectiveOfferedDocuments correctly", () => {
      // null / undefined -> all 7 canonical types
      expect(getEffectiveOfferedDocuments(null)).toHaveLength(7);
      expect(getEffectiveOfferedDocuments(undefined)).toHaveLength(7);

      // explicit empty array -> empty (no documents offered)
      expect(getEffectiveOfferedDocuments([])).toEqual([]);

      // subset
      expect(
        getEffectiveOfferedDocuments(["BAPTISMAL_CERTIFICATE", "MARRIAGE_CERTIFICATE"])
      ).toEqual(["BAPTISMAL_CERTIFICATE", "MARRIAGE_CERTIFICATE"]);
    });
  });

  describe("Status Presentation & Badges", () => {
    const allStatuses: DocumentRequestStatus[] = [
      "PENDING",
      "UNDER_REVIEW",
      "NEEDS_CORRECTION",
      "PAYMENT_PENDING",
      "PAYMENT_UNDER_REVIEW",
      "PAYMENT_NEEDS_CORRECTION",
      "PAYMENT_VERIFIED",
      "PROCESSING",
      "READY_FOR_PICKUP",
      "COMPLETED",
      "REJECTED",
      "CANCELLED",
    ];

    it("has valid presentation definitions for all 12 statuses", () => {
      for (const status of allStatuses) {
        const presentation = STATUS_PRESENTATION[status];
        expect(presentation).toBeDefined();
        expect(presentation.label).toBeTruthy();
        expect(presentation.variant).toBeTruthy();
        expect(presentation.description).toBeTruthy();
      }
    });

    it("formats draft status specifically when isDraft is true", () => {
      const draftStatus = formatStatus("PENDING", true);
      expect(draftStatus.label).toBe("Draft");
      expect(draftStatus.variant).toBe("neutral");
    });
  });

  describe("Action Eligibility Helpers", () => {
    const baseRequest: DocumentRequestDetail = {
      id: 1,
      userId: 10,
      parishId: 2,
      trackingNumber: "SR-2026-000001",
      applicantName: "Juan Dela Cruz",
      documentType: "BAPTISMAL_CERTIFICATE",
      status: "PENDING",
      paymentStatus: "UNPAID",
      isDraft: false,
      fee: 100.0,
      dateRequested: "2026-08-23T10:00:00.000Z",
      createdAt: "2026-08-23T10:00:00.000Z",
      updatedAt: "2026-08-23T10:00:00.000Z",
    };

    it("evaluates isCancelEligible correctly", () => {
      expect(isCancelEligible({ ...baseRequest, status: "PENDING" })).toBe(true);
      expect(isCancelEligible({ ...baseRequest, status: "PAYMENT_PENDING" })).toBe(true);
      expect(isCancelEligible({ ...baseRequest, status: "NEEDS_CORRECTION" })).toBe(true);
      expect(isCancelEligible({ ...baseRequest, status: "PAYMENT_NEEDS_CORRECTION" })).toBe(true);

      expect(isCancelEligible({ ...baseRequest, status: "UNDER_REVIEW" })).toBe(false);
      expect(isCancelEligible({ ...baseRequest, status: "PROCESSING" })).toBe(false);
      expect(isCancelEligible({ ...baseRequest, status: "READY_FOR_PICKUP" })).toBe(false);
      expect(isCancelEligible({ ...baseRequest, status: "COMPLETED" })).toBe(false);
      expect(isCancelEligible({ ...baseRequest, isDraft: true })).toBe(false);
    });

    it("evaluates isPaymentEligible correctly with fee guards", () => {
      expect(isPaymentEligible({ ...baseRequest, status: "PAYMENT_PENDING", fee: 100 })).toBe(true);
      expect(isPaymentEligible({ ...baseRequest, status: "PAYMENT_NEEDS_CORRECTION", fee: "150.00" })).toBe(true);

      // Zero-fee or missing fee must NOT be payment eligible
      expect(isPaymentEligible({ ...baseRequest, status: "PAYMENT_PENDING", fee: 0 })).toBe(false);
      expect(isPaymentEligible({ ...baseRequest, status: "PAYMENT_PENDING", fee: null })).toBe(false);

      // Other statuses not eligible
      expect(isPaymentEligible({ ...baseRequest, status: "PENDING", fee: 100 })).toBe(false);
      expect(isPaymentEligible({ ...baseRequest, status: "PAYMENT_VERIFIED", fee: 100 })).toBe(false);
      expect(isPaymentEligible({ ...baseRequest, isDraft: true, status: "PAYMENT_PENDING" })).toBe(false);
    });

    it("evaluates isDocumentCorrectionEligible correctly", () => {
      expect(isDocumentCorrectionEligible({ ...baseRequest, status: "NEEDS_CORRECTION" })).toBe(true);
      expect(isDocumentCorrectionEligible({ ...baseRequest, status: "PENDING" })).toBe(false);
      expect(isDocumentCorrectionEligible({ ...baseRequest, isDraft: true, status: "NEEDS_CORRECTION" })).toBe(false);
    });

    it("evaluates isZeroFee correctly", () => {
      expect(isZeroFee(0)).toBe(true);
      expect(isZeroFee("0")).toBe(true);
      expect(isZeroFee("0.00")).toBe(true);
      expect(isZeroFee(100)).toBe(false);
      expect(isZeroFee("150.00")).toBe(false);
      expect(isZeroFee(null)).toBe(false);
    });
  });

  describe("Formatting Utilities", () => {
    it("formats fee correctly", () => {
      expect(formatFee(100)).toBe("\u20B1100.00");
      expect(formatFee("150.5")).toBe("\u20B1150.50");
      expect(formatFee(0)).toBe("\u20B10.00");
      expect(formatFee(null)).toBe("Fee unavailable");
      expect(formatFee("invalid")).toBe("Fee unavailable");
    });

    it("formats dates safely", () => {
      expect(formatDate(null)).toBe("—");
      expect(formatDate("2026-08-23T10:00:00.000Z")).toContain("2026");
      expect(formatDateTime(null)).toBe("—");
      expect(formatDateTime("2026-08-23T10:00:00.000Z")).toContain("2026");
    });
  });
});
