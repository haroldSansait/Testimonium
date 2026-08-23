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
  DocumentRequestListFilters,
  DocumentRequestListResponse,
  DocumentRequirement,
  LocalSelectedFile,
  LocalSelectedReceipt,
  PaymentConfiguration,
  RequestAttachment,
} from "./types";

/**
 * Fetch document requirements metadata from backend
 */
export const fetchDocumentRequirements = async (params: {
  documentType?: string;
  parishId?: number | string;
  signal?: AbortSignal;
}): Promise<DocumentRequirement> => {
  const queryParams = new URLSearchParams();
  if (params.documentType) queryParams.set("type", params.documentType);
  if (params.parishId) queryParams.set("parishId", String(params.parishId));

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
  },
  options?: Partial<UseQueryOptions<DocumentRequirement>>
) => {
  const { user } = useAuth();
  const docType = params?.documentType ?? "";
  const parishId = params?.parishId ?? "";

  return useQuery({
    queryKey: requestKeys.requirements(user?.uid, {
      documentType: docType,
      parishId,
    }),
    queryFn: ({ signal }) =>
      fetchDocumentRequirements({
        documentType: docType,
        parishId,
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
    }): Promise<{
      success: boolean;
      receiptId?: number;
      ocrStatus?: string;
      message?: string;
    }> => {
      const createBody = () => {
        const formData = new FormData();
        formData.append("receipt", {
          uri: receipt.uri,
          name: receipt.name,
          type: receipt.mimeType,
        } as unknown as Blob);
        return formData;
      };

      return apiClient.request<{
        success: boolean;
        receiptId?: number;
        ocrStatus?: string;
        message?: string;
      }>({
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
