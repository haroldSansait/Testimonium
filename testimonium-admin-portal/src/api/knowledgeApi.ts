import api from "@/api/api";
import type { ApiResponseEnvelope } from "@/types/api";

export type KnowledgeScope = "DIOCESE" | "PARISH";
export type KnowledgeAuthority = "CONFIRMED" | "PROVISIONAL";
export type KnowledgeSourceStatus = "DRAFT" | "ACTIVE" | "RETIRED";
export type KnowledgeSourceType =
  | "SYSTEM_GUIDE"
  | "PARISH_PROCEDURE"
  | "DIOCESE_PROCEDURE"
  | "CLERGY_INTERVIEW"
  | "OFFICIAL_SOURCE"
  | "LEGACY_FAQ"
  | "ADMIN_ENTRY";
export type EmbeddingStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED" | "STALE";

export interface KnowledgeChunk {
  id: number;
  sourceId: number;
  content: string;
  chunkOrder: number;
  sourceVersion: number;
  embeddingStatus: EmbeddingStatus;
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  embeddedAt?: string | null;
  embeddingErrorCode?: string | null;
}

export interface KnowledgeSource {
  id: number;
  title: string;
  sourceText: string;
  category?: string | null;
  sourceType: KnowledgeSourceType;
  sourceReference?: string | null;
  scope: KnowledgeScope;
  parishId?: number | null;
  authority: KnowledgeAuthority;
  status: KnowledgeSourceStatus;
  version: number;
  approvedById?: number | null;
  approvedAt?: string | null;
  effectiveFrom?: string | null;
  retiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
  parish?: { id: number; parishName: string } | null;
  approvedBy?: { id: number; fullName: string; email?: string } | null;
  updatedBy?: { id: number; fullName: string; email?: string } | null;
  chunks?: KnowledgeChunk[];
}

export interface CreateKnowledgePayload {
  title: string;
  sourceText: string;
  category?: string | null;
  sourceType: KnowledgeSourceType;
  sourceReference?: string | null;
  scope: KnowledgeScope;
  parishId?: number | null;
  chunks: Array<{ content: string; chunkOrder?: number }>;
}

export interface UpdateKnowledgePayload {
  expectedVersion: number;
  title?: string;
  sourceText?: string;
  category?: string | null;
  sourceType?: KnowledgeSourceType;
  sourceReference?: string | null;
  scope?: KnowledgeScope;
  parishId?: number | null;
  chunks?: Array<{ content: string; chunkOrder?: number }>;
}

export interface KnowledgeListParams {
  page?: number;
  limit?: number;
  status?: KnowledgeSourceStatus;
  authority?: KnowledgeAuthority;
  scope?: KnowledgeScope;
  parishId?: number;
  category?: string;
  search?: string;
}

export interface KnowledgeListResult {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data: KnowledgeSource[];
}

export const knowledgeApi = {
  async list(params?: KnowledgeListParams) {
    const response = await api.get<ApiResponseEnvelope<KnowledgeListResult>>("/chatbot/knowledge", { params });
    return response.data.data;
  },

  async getById(id: number) {
    const response = await api.get<ApiResponseEnvelope<KnowledgeSource>>(`/chatbot/knowledge/${id}`);
    return response.data.data;
  },

  async create(payload: CreateKnowledgePayload) {
    const response = await api.post<ApiResponseEnvelope<KnowledgeSource>>("/chatbot/knowledge", payload);
    return response.data.data;
  },

  async update(id: number, payload: UpdateKnowledgePayload) {
    const response = await api.patch<ApiResponseEnvelope<KnowledgeSource>>(`/chatbot/knowledge/${id}`, payload);
    return response.data.data;
  },

  async confirm(id: number, expectedVersion: number) {
    const response = await api.post<ApiResponseEnvelope<KnowledgeSource>>(`/chatbot/knowledge/${id}/confirm`, {
      expectedVersion,
    });
    return response.data.data;
  },

  async publish(id: number, expectedVersion: number) {
    const response = await api.post<ApiResponseEnvelope<KnowledgeSource>>(`/chatbot/knowledge/${id}/publish`, {
      expectedVersion,
    });
    return response.data.data;
  },

  async retire(id: number, expectedVersion: number) {
    const response = await api.post<ApiResponseEnvelope<KnowledgeSource>>(`/chatbot/knowledge/${id}/retire`, {
      expectedVersion,
    });
    return response.data.data;
  },

  async retryEmbedding(id: number, expectedVersion: number) {
    const response = await api.post<ApiResponseEnvelope<{ sourceId: number; retriedCount: number }>>(
      `/chatbot/knowledge/${id}/retry-embedding`,
      { expectedVersion }
    );
    return response.data.data;
  },
};
