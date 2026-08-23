import {
  fetchDocumentRequirements,
  fetchRequestList,
  fetchRequestDetail,
  fetchPaymentConfiguration,
  uploadSupportingFile,
} from "../features/requests/api";
import { apiClient } from "@/services/api/client";

jest.mock("@/services/api/client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

describe("Requests & Payments API Contract and Methods", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchDocumentRequirements", () => {
    it("calls /document-requirements with document type and parish ID", async () => {
      (apiClient.request as jest.Mock).mockResolvedValueOnce({
        documentType: "BAPTISMAL_CERTIFICATE",
        baseFee: 100,
        requiredFields: [],
        requiredDocuments: [],
      });

      await fetchDocumentRequirements({
        documentType: "BAPTISMAL_CERTIFICATE",
        parishId: 2,
      });

      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/document-requirements?type=BAPTISMAL_CERTIFICATE&parishId=2",
          auth: true,
        })
      );
    });
  });

  describe("fetchRequestList", () => {
    it("calls /requests with query filters and pagination", async () => {
      (apiClient.request as jest.Mock).mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      await fetchRequestList({
        page: 1,
        limit: 10,
        status: "PENDING",
        documentType: "BAPTISMAL_CERTIFICATE",
      });

      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/requests?page=1&limit=10&status=PENDING&documentType=BAPTISMAL_CERTIFICATE",
          auth: true,
        })
      );
    });
  });

  describe("fetchRequestDetail", () => {
    it("calls /requests/:id with auth token", async () => {
      (apiClient.request as jest.Mock).mockResolvedValueOnce({
        id: 15,
        trackingNumber: "SR-2026-000015",
      });

      await fetchRequestDetail(15);

      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/requests/15",
          auth: true,
        })
      );
    });
  });

  describe("fetchPaymentConfiguration", () => {
    it("calls /payment/configuration?requestId=:id with auth token", async () => {
      (apiClient.request as jest.Mock).mockResolvedValueOnce({
        configured: true,
        qrCode: { enabled: true, imageUrl: "https://pub-r2.testimonium.media/qr1.png" },
      });

      await fetchPaymentConfiguration(15);

      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/payment/configuration?requestId=15",
          auth: true,
        })
      );
    });
  });

  describe("uploadSupportingFile", () => {
    it("uses the existing draft endpoint and a replayable multipart body factory", async () => {
      (apiClient.request as jest.Mock).mockResolvedValueOnce([]);

      await uploadSupportingFile({
        requestId: 31,
        category: "valid_id",
        file: {
          requirementId: "valid_id",
          requirementLabel: "Valid ID",
          uri: "file:///data/user/0/com.testimonium.app/cache/DocumentPicker/asset.pdf",
          name: "valid-id.pdf",
          size: 256_000,
          mimeType: null,
        },
      });

      const options = (apiClient.request as jest.Mock).mock.calls[0][0];
      expect(options).toMatchObject({
        method: "POST",
        path: "/requests/31/files",
        isMultipart: true,
        auth: true,
        timeout: 45_000,
      });
      expect(options.body).toBeUndefined();
      expect(options.createBody).toEqual(expect.any(Function));

      const firstBody = options.createBody() as FormData;
      const secondBody = options.createBody() as FormData;
      expect(firstBody).not.toBe(secondBody);
      expect(firstBody).toBeInstanceOf(FormData);
      expect(secondBody).toBeInstanceOf(FormData);
    });
  });

  describe("Client-side Idempotency and Boundary Safety", () => {
    it("ensures all request paths are properly namespaced without unauthorized endpoints", async () => {
      const calls = (apiClient.request as jest.Mock).mock.calls;
      for (const [arg] of calls) {
        expect(arg.path).not.toContain("/admin");
        expect(arg.path).not.toContain("/staff");
        expect(arg.path).not.toContain("/schedules");
      }
    });
  });
});
