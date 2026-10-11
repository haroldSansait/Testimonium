import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api/client";
import { devDiagnostic } from "@/services/devDiagnostics";
import { paymentKeys, requestKeys } from "./queryKeys";
import {
  buildSupportingFileFormData,
  normalizeSupportingFile,
  supportingUploadError,
} from "./supportingUpload";
import type {
  CreateDraftRequestPayload,
  DocumentRequestDetail,
  DocumentReturn,
  DocumentRequestListFilters,
  DocumentRequestListResponse,
  DocumentRequirement,
  LocalSelectedFile,
  LocalSelectedReceipt,
  LocalRegistrantIdImage,
  PaymentConfiguration,
  ReceiptUploadResponse,
  RequestAttachment,
} from "./types";

/**
 * Fetch document requirements metadata from backend
 */
export const fetchDocumentRequirements = async (params: {
  documentType?: string;
  parishId?: number | string;
  relationship?: string;
  signal?: AbortSignal;
}): Promise<DocumentRequirement> => {
  const queryParams = new URLSearchParams();
  if (params.documentType) queryParams.set("type", params.documentType);
  if (params.parishId) queryParams.set("parishId", String(params.parishId));
  if (params.relationship) queryParams.set("relationship", params.relationship);

  const queryString = queryParams.toString();
  const path = `/document-requirements${queryString ? `?${queryString}` : ""}`;

  return apiClient.request<DocumentRequirement>({
    path,
    signal: params.signal,
    auth: true,
  });
};

/**
 * Hook to query document requirements for wizard/corrections
 */
export const useDocumentRequirements = (
  params?: {
    documentType?: string | null;
    parishId?: number | string | null;
    relationship?: string | null;
  },
  options?: Partial<UseQueryOptions<DocumentRequirement>>
) => {
  const { user } = useAuth();
  const docType = params?.documentType ?? "";
  const parishId = params?.parishId ?? "";
  const relationship = params?.relationship ?? "";

  return useQuery({
    queryKey: requestKeys.requirements(user?.uid, {
      documentType: docType,
      parishId,
      relationship,
    }),
    queryFn: ({ signal }) =>
      fetchDocumentRequirements({
        documentType: docType,
        parishId,
        relationship,
        signal,
      }),
    enabled: Boolean(docType),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

/**
 * Fetch paginated document requests for authenticated user
 */
export const fetchRequestList = async (
  filters: DocumentRequestListFilters = {},
  signal?: AbortSignal
): Promise<DocumentRequestListResponse> => {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.documentType) params.set("documentType", filters.documentType);

  const qs = params.toString();
  const path = `/requests${qs ? `?${qs}` : ""}`;

  return apiClient.request<DocumentRequestListResponse>({
    path,
    signal,
    auth: true,
  });
};

/**
 * Hook for Request list
 */
export const useRequestList = (
  filters: DocumentRequestListFilters = {},
  options?: Partial<UseQueryOptions<DocumentRequestListResponse>>
) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: requestKeys.list(user?.uid, filters),
    queryFn: ({ signal }) => fetchRequestList(filters, signal),
    enabled: Boolean(user?.uid),
    staleTime: 30 * 1000,
    ...options,
  });
};

/**
 * Fetch single document request by numeric ID
 */
export const fetchRequestDetail = async (
  requestId: number | string,
  signal?: AbortSignal
): Promise<DocumentRequestDetail> => {
  return apiClient.request<DocumentRequestDetail>({
    path: `/requests/${requestId}`,
    signal,
    auth: true,
  });
};

/**
 * Hook for single request detail
 */
export const useRequestDetail = (
  requestId?: number | string | null,
  options?: Partial<UseQueryOptions<DocumentRequestDetail>>
) => {
  const { user } = useAuth();
  const isValidId = Boolean(requestId && /^[1-9]\d*$/.test(String(requestId).trim()));

  return useQuery({
    queryKey: requestKeys.detail(user?.uid, requestId),
    queryFn: ({ signal }) => fetchRequestDetail(requestId!, signal),
    enabled: Boolean(user?.uid && isValidId),
    staleTime: 15 * 1000,
    ...options,
  });
};

export const uploadRegistrantId = async ({
  requestId,
  front,
  back,
}: {
  requestId: number | string;
  front?: LocalRegistrantIdImage;
  back?: LocalRegistrantIdImage;
}): Promise<any> => {
  const createBody = () => {
    const formData = new FormData();
    if (front) formData.append("front", { uri: front.uri, name: front.name, type: front.mimeType } as unknown as Blob);
    if (back) formData.append("back", { uri: back.uri, name: back.name, type: back.mimeType } as unknown as Blob);
    return formData;
  };
  return apiClient.request<any>({
    method: "POST",
    path: `/requests/${requestId}/registrant-id`,
    createBody,
    isMultipart: true,
    auth: true,
    timeout: 45_000,
  });
};

export const useUploadRegistrantId = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: uploadRegistrantId,
    retry: false,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: requestKeys.detail(user?.uid, variables.requestId) });
    },
  });
};

/** Looks up an owned request by its tracking number through the existing API route. */
export const fetchRequestByTrackingNumber = async (
  trackingNumber: string,
  signal?: AbortSignal
): Promise<DocumentRequestDetail> => {
  const normalized = trackingNumber.trim();
  if (!normalized) throw new Error("Enter a request tracking number.");
  return apiClient.request<DocumentRequestDetail>({
    path: `/requests/tracking/${encodeURIComponent(normalized)}`,
    signal,
    auth: true,
  });
};

export const useRequestTrackingLookup = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (trackingNumber: string) => fetchRequestByTrackingNumber(trackingNumber),
    onSuccess: (request, trackingNumber) => {
      queryClient.setQueryData(requestKeys.tracking(user?.uid, trackingNumber.trim()), request);
      queryClient.setQueryData(requestKeys.detail(user?.uid, request.id), request);
    },
  });
};

/**
 * Mutation: Create request draft with user-scoped Idempotency-Key
 */
export const useCreateRequestDraft = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      payload,
      idempotencyKey,
    }: {
      payload: CreateDraftRequestPayload;
      idempotencyKey: string;
    }): Promise<DocumentRequestDetail> => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers["Idempotency-Key"] = idempotencyKey;
      }

      return apiClient.request<DocumentRequestDetail>({
        method: "POST",
        path: "/requests",
        body: payload,
        headers,
        auth: true,
      });
    },
    retry: false,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: requestKeys.lists(user?.uid),
      });
      if (data?.id) {
        queryClient.setQueryData(requestKeys.detail(user?.uid, data.id), data);
      }
    },
  });
};

export const uploadSupportingFile = async ({
  requestId,
  file,
  category,
}: {
  requestId: number | string;
  file: LocalSelectedFile;
  category: string;
}): Promise<RequestAttachment[]> => {
  const normalized = normalizeSupportingFile(file);
  const normalizedCategory = category.trim();

  devDiagnostic("Upload", "Supporting file prepared", {
    requestId: String(requestId),
    category: normalizedCategory,
    uriScheme: normalized.uri.split(":", 1)[0].toLowerCase(),
    fileName: normalized.name,
    mimeType: normalized.mimeType,
    size: normalized.size,
  });

  try {
    return await apiClient.request<RequestAttachment[]>({
      method: "POST",
      path: `/requests/${requestId}/files`,
      createBody: () => buildSupportingFileFormData(normalized, normalizedCategory),
      isMultipart: true,
      auth: true,
      timeout: 45_000,
    });
  } catch (error) {
    throw supportingUploadError(error);
  }
};

/**
 * Mutation: Upload supporting attachment for a specific requirement category
 */
export const useUploadSupportingFile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      requestId,
      file,
      category,
    }: {
      requestId: number | string;
      file: LocalSelectedFile;
      category: string;
    }): Promise<RequestAttachment[]> => {
      return uploadSupportingFile({ requestId, file, category });
    },
    retry: false,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: requestKeys.detail(user?.uid, variables.requestId),
      });
    },
    onError: (_error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: requestKeys.lists(user?.uid),
      });
      void queryClient.invalidateQueries({
        queryKey: requestKeys.detail(user?.uid, variables.requestId),
      });
    },
  });
};

/**
 * Mutation: Submit finalized draft
 */
export const useSubmitRequestDraft = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (requestId: number | string): Promise<DocumentRequestDetail> => {
      return apiClient.request<DocumentRequestDetail>({
        method: "POST",
        path: `/requests/${requestId}/submit`,
        auth: true,
      });
    },
    retry: false,
    onSuccess: (data, requestId) => {
      void queryClient.invalidateQueries({
        queryKey: requestKeys.lists(user?.uid),
      });
      void queryClient.invalidateQueries({
        queryKey: requestKeys.detail(user?.uid, requestId),
      });
      if (data?.id) {
        queryClient.setQueryData(requestKeys.detail(user?.uid, data.id), data);
      }
    },
  });
};

/**
 * Mutation: Cancel document request
 */
export const useCancelRequest = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      requestId,
      remarks,
    }: {
      requestId: number | string;
      remarks?: string;
    }): Promise<DocumentRequestDetail> => {
      return apiClient.request<DocumentRequestDetail>({
        method: "POST",
        path: `/requests/${requestId}/cancel`,
        body: { remarks: remarks || "Cancelled by requester" },
        auth: true,
      });
    },
    retry: false,
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: requestKeys.lists(user?.uid),
      });
      void queryClient.invalidateQueries({
        queryKey: requestKeys.detail(user?.uid, variables.requestId),
      });
      if (data?.id) {
        queryClient.setQueryData(requestKeys.detail(user?.uid, data.id), data);
      }
    },
  });
};

/**
 * Mutation: Resubmit document corrections
 */
export const useResubmitCorrections = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (requestId: number | string): Promise<DocumentRequestDetail> => {
      return apiClient.request<DocumentRequestDetail>({
        method: "POST",
        path: `/requests/${requestId}/resubmit-corrections`,
        auth: true,
      });
    },
    retry: false,
    onSuccess: (data, requestId) => {
      void queryClient.invalidateQueries({
        queryKey: requestKeys.lists(user?.uid),
      });
      void queryClient.invalidateQueries({
        queryKey: requestKeys.detail(user?.uid, requestId),
      });
      if (data?.id) {
        queryClient.setQueryData(requestKeys.detail(user?.uid, data.id), data);
      }
    },
  });
};

/**
 * Fetch payment configuration for an owned request
 */
export const fetchPaymentConfiguration = async (
  requestId: number | string,
  signal?: AbortSignal
): Promise<PaymentConfiguration> => {
  return apiClient.request<PaymentConfiguration>({
    path: `/payment/configuration?requestId=${requestId}`,
    signal,
    auth: true,
  });
};

/**
 * Hook for payment configuration
 */
export const usePaymentConfiguration = (
  requestId?: number | string | null,
  options?: Partial<UseQueryOptions<PaymentConfiguration>>
) => {
  const { user } = useAuth();
  const isValidId = Boolean(requestId && /^[1-9]\d*$/.test(String(requestId).trim()));

  return useQuery({
    queryKey: paymentKeys.configuration(user?.uid, requestId),
    queryFn: ({ signal }) => fetchPaymentConfiguration(requestId!, signal),
    enabled: Boolean(user?.uid && isValidId),
    staleTime: 60 * 1000,
    ...options,
  });
};

/**
 * Mutation: Upload payment receipt
 */
export const useUploadPaymentReceipt = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      requestId,
      receipt,
    }: {
      requestId: number | string;
      receipt: LocalSelectedReceipt;
    }): Promise<ReceiptUploadResponse> => {
      const createBody = () => {
        const formData = new FormData();
        formData.append("receipt", {
          uri: receipt.uri,
          name: receipt.name,
          type: receipt.mimeType,
        } as unknown as Blob);
        return formData;
      };

      return apiClient.request<ReceiptUploadResponse>({
        method: "POST",
        path: `/requests/${requestId}/receipt`,
        createBody,
        isMultipart: true,
        auth: true,
        timeout: 45_000,
      });
    },
    retry: false,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: requestKeys.lists(user?.uid),
      });
      void queryClient.invalidateQueries({
        queryKey: requestKeys.detail(user?.uid, variables.requestId),
      });
    },
  });
};

export type ReturnDocumentFile = Pick<LocalSelectedFile, "uri" | "name" | "size" | "mimeType">;

export interface ReturnDocumentPayload {
  requestId: number | string;
  reasonCode: string;
  notes?: string;
  file: ReturnDocumentFile;
}

/**
 * Mutation: Return completed document for free correction
 */
export const returnDocument = async ({
  requestId,
  reasonCode,
  notes,
  file,
}: ReturnDocumentPayload): Promise<DocumentReturn> => {
  const normalizedFile = normalizeSupportingFile({
    ...file,
    requirementId: "document_return",
    requirementLabel: "Defective issued document",
  });
  const createBody = () => {
    const formData = new FormData();
    formData.append("reasonCode", reasonCode);
    if (notes && notes.trim()) {
      formData.append("notes", notes.trim());
    }
    formData.append("file", {
      uri: normalizedFile.uri,
      name: normalizedFile.name,
      type: normalizedFile.mimeType,
    } as unknown as Blob);
    return formData;
  };

  return apiClient.request<DocumentReturn>({
    method: "POST",
    path: `/requests/${requestId}/return-document`,
    createBody,
    isMultipart: true,
    auth: true,
    timeout: 45_000,
  });
};

export const useReturnDocument = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: returnDocument,
    retry: false,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: requestKeys.lists(user?.uid),
      });
      void queryClient.invalidateQueries({
        queryKey: requestKeys.detail(user?.uid, variables.requestId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["requests", user?.uid, "returns", variables.requestId],
      });
    },
  });
};

/**
 * Fetch return history for an owned request
 */
export const fetchReturnHistory = async (
  requestId: number | string,
  signal?: AbortSignal
): Promise<DocumentReturn[]> => {
  return apiClient.request<DocumentReturn[]>({
    path: `/requests/${requestId}/returns`,
    signal,
    auth: true,
  });
};

export const useReturnHistory = (
  requestId?: number | string | null,
  options?: Partial<UseQueryOptions<DocumentReturn[]>>
) => {
  const { user } = useAuth();
  const isValidId = Boolean(requestId && /^[1-9]\d*$/.test(String(requestId).trim()));

  return useQuery({
    queryKey: ["requests", user?.uid, "returns", requestId],
    queryFn: ({ signal }) => fetchReturnHistory(requestId!, signal),
    enabled: Boolean(user?.uid && isValidId),
    staleTime: 30 * 1000,
    ...options,
  });
};
