import api from "@/api/api";
import type { ApiResponseEnvelope } from "@/types/api";

export interface CaloyOverviewResponse {
  status: "ACTIVE" | "DISABLED_BY_COORDINATOR" | "DISABLED_BY_DEPLOYMENT" | "CONFIGURATION_WARNING" | "CONFIGURATION_ERROR" | "CONFIGURATION_DEGRADED";
  statusReason?: string | null;
  effectiveEnabled: boolean;
  deploymentEnabled: boolean;
  runtimeEnabled: boolean;
  runtimeConfigDatabaseAvailable: boolean;
  configurationDegraded: boolean;
  responseGenerationModel: string | null;
  configuredGenerationModel: string | null;
  runtimeModelValid: boolean;
  semanticRouterModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
  credentialsConfigured: boolean;
  metrics: {
    queriesToday: number;
    generationRequestsToday: number;
    embeddingRequestsToday: number;
    measuredRpm: number;
    fallbackRate: number;
    averageResponseTimeMs: number;
    failedInteractionsToday: number;
    failedProviderAttemptsToday: number;
  };
  recentErrors: Array<{
    id: string | number;
    timestamp: string;
    responseType: string;
    model: string;
    category: string | null;
    errorCategory: string | null;
    fallbackReason: string | null;
    latencyMs: number | null;
  }>;
  knowledgeHealth: {
    totalSources: number;
    activeSources: number;
    draftSources: number;
    retiredSources: number;
    totalChunks: number;
    readyChunks: number;
    pendingChunks: number;
    failedChunks: number;
  };
}

export interface CaloyAnalyticsResponse {
  timeRange: {
    preset: string;
    from: string;
    to: string;
    timezone: string;
  };
  providerMetricsScope: 'GLOBAL_DATE_AND_MODEL_FILTERED';
  summary: {
    userQueries: number;
    providerRequests: number;
    generationRequests: number;
    embeddingRequests: number;
    fallbackRate: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    failedInteractions: number;
    failedProviderAttempts: number;
    providerRateLimits: number;
    tokens: { input: number; output: number; total: number };
  };
  timeSeries: Array<{
    bucket: string;
    queries: number;
    generationRequests: number;
    embeddingRequests: number;
  }>;
  routeDistribution: Array<{
    responseType: string;
    count: number;
    percentage: number;
  }>;
  topCategories: Array<{
    category: string;
    count: number;
  }>;
  parishContext: Array<{
    parishId: number | null;
    parishName: string;
    queryCount: number;
  }>;
  modelUsage: Array<{
    model: string;
    count: number;
    successRate: number;
    avgLatencyMs: number;
  }>;
  providerErrors: Array<{
    errorCategory: string;
    count: number;
  }>;
  fallbackReasons: Array<{
    reason: string;
    count: number;
  }>;
}

export interface CaloySettingsResponse {
  runtimeOverridePresent: boolean;
  runtimeStateKnown: boolean;
  runtimeConfigSource: string;
  runtimeConfigDatabaseAvailable: boolean;
  configurationDegraded: boolean;
  configurationStatus: string;
  version: number;
  effectiveValues: {
    enabled: boolean;
    generationProvider: string;
    generationModel: string;
    runtimeModelValid: boolean | null;
    aiTenMinuteMax: number;
    aiDailyMax: number;
    chatbotRequestDeadlineMs: number;
    automaticRetentionEnabled: boolean;
    logRetentionDays: number;
  };
  configuredValues: {
    enabled: boolean | null;
    generationProvider: string | null;
    generationModel: string | null;
    aiTenMinuteMax: number | null;
    aiDailyMax: number | null;
    chatbotRequestDeadlineMs: number | null;
    automaticRetentionEnabled: boolean | null;
    logRetentionDays: number | null;
  };
  masterDeploymentGate: {
    deploymentEnabled: boolean;
    envGenerationModel: string;
    credentialsConfigured: boolean;
    envGenerationModelValid: boolean;
  };
  approvedModels: Array<{
    id: string;
    displayName: string;
    description: string;
  }>;
  readOnlyComponents: {
    semanticRouter: {
      provider: string;
      model: string;
      readOnly: true;
    };
    embedding: {
      provider: string;
      model: string;
      dimensions: number;
      readOnly: true;
    };
  };
  constraints: {
    minTenMinute: number;
    maxTenMinute: number;
    minDaily: number;
    maxDaily: number;
    minDeadlineMs: number;
    maxDeadlineMs: number;
    minRetentionDays: number;
    maxRetentionDays: number;
  };
  updatedById: number | null;
  updatedAt: string | null;
}

export interface PatchCaloySettingsPayload {
  expectedVersion: number;
  enabled?: boolean;
  generationModel?: string;
  aiTenMinuteMax?: number;
  aiDailyMax?: number;
  chatbotRequestDeadlineMs?: number;
  automaticRetentionEnabled?: boolean;
  logRetentionDays?: number;
}

export interface CaloyLogItem {
  id: number;
  timestamp: string;
  responseType: string;
  category: string;
  generationProvider: string;
  generationModel: string;
  selectedParishId: number | null;
  parishName: string | null;
  latencyMs: number;
  fallback: boolean;
  fallbackReason: string | null;
  errorCategory: string | null;
}

export interface CaloyLogsResponse {
  items: CaloyLogItem[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  period: {
    from: string;
    to: string;
  };
}

export interface CaloyLogsQueryParams {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  responseType?: string;
  model?: string;
  outcome?: "all" | "success" | "fallback";
  category?: string;
  parishId?: number;
}

export interface PurgePreviewResponse {
  daysOlderThan: number;
  cutoff: string;
  chatbotLogsMatched: number;
  aiUsageEventsMatched: number;
}

export interface PurgeExecuteResponse {
  operationId: string;
  daysOlderThan: number;
  cutoff: string;
  chatbotLogsDeleted: number;
  aiUsageEventsDeleted: number;
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  auditFinalizationWarning?: boolean;
}

export interface CaloyKnowledgeStatsResponse {
  sourceCounts: {
    total: number;
    active: number;
    draft: number;
    retired: number;
  };
  chunkCounts: {
    total: number;
    ready: number;
    pending: number;
    failed: number;
    stale: number;
  };
  ragQueryCount: number;
  insufficientEvidenceCount: number;
  averageRetrievalScore: number | null;
  retrievalScoreSampleCount: number;
  embeddingConfig: {
    provider: string;
    model: string;
    dimensions: number;
    readOnly: true;
  };
}

export const caloyAdminApi = {
  async getOverview(signal?: AbortSignal): Promise<CaloyOverviewResponse> {
    const res = await api.get<ApiResponseEnvelope<CaloyOverviewResponse>>("/chatbot/admin/overview", { signal });
    return res.data.data;
  },

  async getAnalytics(params: Record<string, any>, signal?: AbortSignal): Promise<CaloyAnalyticsResponse> {
    const res = await api.get<ApiResponseEnvelope<CaloyAnalyticsResponse>>("/chatbot/admin/analytics", {
      params,
      signal,
    });
    return res.data.data;
  },

  async getSettings(signal?: AbortSignal): Promise<CaloySettingsResponse> {
    const res = await api.get<ApiResponseEnvelope<CaloySettingsResponse>>("/chatbot/admin/settings", { signal });
    return res.data.data;
  },

  async updateSettings(payload: PatchCaloySettingsPayload): Promise<CaloySettingsResponse> {
    const res = await api.patch<ApiResponseEnvelope<CaloySettingsResponse>>("/chatbot/admin/settings", payload);
    return res.data.data;
  },

  async getLogs(params: CaloyLogsQueryParams, signal?: AbortSignal): Promise<CaloyLogsResponse> {
    const res = await api.get<ApiResponseEnvelope<CaloyLogsResponse>>("/chatbot/admin/logs", {
      params,
      signal,
    });
    return res.data.data;
  },

  async getPurgePreview(daysOlderThan: number, signal?: AbortSignal): Promise<PurgePreviewResponse> {
    const res = await api.get<ApiResponseEnvelope<PurgePreviewResponse>>("/chatbot/admin/logs/purge-preview", {
      params: { daysOlderThan },
      signal,
    });
    return res.data.data;
  },

  async executePurge(daysOlderThan: number): Promise<PurgeExecuteResponse> {
    const res = await api.post<ApiResponseEnvelope<PurgeExecuteResponse>>("/chatbot/admin/logs/purge", {
      daysOlderThan,
    });
    return res.data.data;
  },

  async getKnowledgeStats(signal?: AbortSignal): Promise<CaloyKnowledgeStatsResponse> {
    const res = await api.get<ApiResponseEnvelope<CaloyKnowledgeStatsResponse>>("/chatbot/admin/knowledge-stats", {
      signal,
    });
    return res.data.data;
  },
};
