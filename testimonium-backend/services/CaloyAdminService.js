import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { defaultCaloyRuntimeConfig } from "./CaloyRuntimeConfigService.js";
import { caloyTelemetryPurgeService } from "./CaloyTelemetryPurgeService.js";
import {
  getManilaTodayDateString,
  manilaDateToUtcStart,
  advanceCalendarDay,
} from "../utils/manilaAnalyticsDate.js";

export class CaloyAdminService {
  constructor({
    prismaClient = prisma,
    configService = defaultCaloyRuntimeConfig,
    purgeService = caloyTelemetryPurgeService,
  } = {}) {
    this.prisma = prismaClient;
    this.configService = configService;
    this.purgeService = purgeService;
  }

  /**
   * Builds the Manila today UTC boundary.
   */
  _getTodayBoundary() {
    const todayManila = getManilaTodayDateString();
    const tomorrowManila = advanceCalendarDay(todayManila, 1);
    const startUtc = manilaDateToUtcStart(todayManila);
    const endUtc = manilaDateToUtcStart(tomorrowManila);
    return { todayManila, startUtc, endUtc };
  }

  /**
   * Resolves date filter into UTC start and end Date objects.
   */
  _resolveDateRange({ from, to, preset = "30d" }) {
    const todayManila = getManilaTodayDateString();

    let fromStr = from;
    let toStr = to || todayManila;

    if (preset === "today") {
      fromStr = todayManila;
      toStr = todayManila;
    } else if (preset === "7d") {
      fromStr = advanceCalendarDay(todayManila, -6);
      toStr = todayManila;
    } else if (preset === "30d") {
      fromStr = advanceCalendarDay(todayManila, -29);
      toStr = todayManila;
    } else if (preset === "90d") {
      fromStr = advanceCalendarDay(todayManila, -89);
      toStr = todayManila;
    } else if (!fromStr) {
      fromStr = advanceCalendarDay(todayManila, -29);
    }

    const startUtc = manilaDateToUtcStart(fromStr);
    const nextDay = advanceCalendarDay(toStr, 1);
    const endUtc = manilaDateToUtcStart(nextDay);

    return { fromStr, toStr, startUtc, endUtc };
  }

  /**
   * GET /chatbot/admin/overview
   */
  async getOverview() {
    const { startUtc, endUtc } = this._getTodayBoundary();
    const effectiveConfig = await this.configService.getEffectiveConfigSnapshot();

    const status = effectiveConfig.configurationStatus || "CONFIGURATION_ERROR";
    const statusMessage = status === "ACTIVE"
      ? "Caloy is operational."
      : status === "DISABLED_BY_DEPLOYMENT"
        ? "Caloy is disabled by server environment configuration."
        : status === "DISABLED_BY_COORDINATOR"
          ? "Caloy has been disabled by a diocese coordinator."
          : status === "CONFIGURATION_WARNING"
            ? "The configured runtime model is invalid; a known-compatible deployment fallback is active."
            : status === "CONFIGURATION_DEGRADED"
              ? "Runtime configuration is temporarily unavailable; the last-known-good state is active."
              : "Caloy provider configuration is incomplete or invalid.";

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    // Run independent metric queries in parallel
    const [
      queriesToday,
      fallbacksToday,
      generationRequestsToday,
      embeddingRequestsToday,
      rpmCount,
      latencyAgg,
      failedUsageEventsToday,
      errorChatbotLogsToday,
      kbActiveSources,
      kbDraftSources,
      kbRetiredSources,
      chunkStatusCounts,
      recentErrors,
    ] = await Promise.all([
      this.prisma.chatbotLog.count({
        where: { createdAt: { gte: startUtc, lt: endUtc } },
      }),
      this.prisma.chatbotLog.count({
        where: { createdAt: { gte: startUtc, lt: endUtc }, fallback: true },
      }),
      this.prisma.aiUsageEvent.count({
        where: {
          operation: "GENERATE_CONTENT",
          createdAt: { gte: startUtc, lt: endUtc },
        },
      }),
      this.prisma.aiUsageEvent.count({
        where: {
          operation: "EMBED_CONTENT",
          createdAt: { gte: startUtc, lt: endUtc },
        },
      }),
      this.prisma.aiUsageEvent.count({
        where: { createdAt: { gte: oneMinuteAgo } },
      }),
      this.prisma.chatbotLog.aggregate({
        _avg: { latencyMs: true },
        where: {
          createdAt: { gte: startUtc, lt: endUtc },
          latencyMs: { not: null },
        },
      }),
      this.prisma.aiUsageEvent.count({
        where: {
          success: false,
          createdAt: { gte: startUtc, lt: endUtc },
        },
      }),
      this.prisma.chatbotLog.count({
        where: {
          createdAt: { gte: startUtc, lt: endUtc },
          fallback: true,
          errorCategory: { not: null },
        },
      }),
      this.prisma.knowledgeSource.count({
        where: { status: "ACTIVE" },
      }),
      this.prisma.knowledgeSource.count({
        where: { status: "DRAFT" },
      }),
      this.prisma.knowledgeSource.count({
        where: { status: "RETIRED" },
      }),
      this.prisma.knowledgeChunk.groupBy({
        by: ["embeddingStatus"],
        _count: { _all: true },
      }),
      // Recent errors: safe columns only!
      this.prisma.chatbotLog.findMany({
        where: {
          fallback: true,
          errorCategory: { not: null },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          createdAt: true,
          responseType: true,
          generationModel: true,
          category: true,
          fallbackReason: true,
          errorCategory: true,
          latencyMs: true,
        },
      }),
    ]);

    const fallbackRate =
      queriesToday > 0 ? Number(((fallbacksToday / queriesToday) * 100).toFixed(1)) : 0;
    const avgLatencyMs = latencyAgg._avg?.latencyMs ? Math.round(latencyAgg._avg.latencyMs) : null;

    const chunkStatusMap = {
      PENDING: 0,
      PROCESSING: 0,
      READY: 0,
      FAILED: 0,
    };
    for (const c of chunkStatusCounts) {
      chunkStatusMap[c.embeddingStatus] = c._count?._all ?? c._count?.id ?? 0;
    }

    return {
      status,
      statusReason: statusMessage,
      deploymentEnabled: effectiveConfig.deploymentEnabled,
      runtimeEnabled: effectiveConfig.runtimeEnabled ?? true,
      effectiveEnabled: effectiveConfig.effectiveEnabled,
      runtimeConfigDatabaseAvailable: effectiveConfig.runtimeConfigDatabaseAvailable,
      configurationDegraded: effectiveConfig.configurationDegraded,
      responseGenerationModel: effectiveConfig.effectiveGenerationModel,
      configuredGenerationModel: effectiveConfig.configuredGenerationModel,
      runtimeModelValid: effectiveConfig.runtimeModelValid !== false,
      credentialsConfigured: effectiveConfig.credentialsConfigured,
      semanticRouterModel: env.chatbot?.semanticRouterModel || "gemini-3.5-flash-lite",
      embeddingModel: env.chatbot?.embeddingModel || "gemini-embedding-2",
      embeddingDimensions: env.chatbot?.embeddingDimensions || 768,
      metrics: {
        queriesToday,
        generationRequestsToday,
        embeddingRequestsToday,
        measuredRpm: rpmCount,
        fallbackRate,
        averageResponseTimeMs: avgLatencyMs || 0,
        failedInteractionsToday: errorChatbotLogsToday,
        failedProviderAttemptsToday: failedUsageEventsToday,
      },
      knowledgeHealth: {
        totalSources: kbActiveSources + kbDraftSources + kbRetiredSources,
        activeSources: kbActiveSources,
        draftSources: kbDraftSources,
        retiredSources: kbRetiredSources,
        totalChunks:
          chunkStatusMap.PENDING +
          chunkStatusMap.PROCESSING +
          chunkStatusMap.READY +
          chunkStatusMap.FAILED,
        readyChunks: chunkStatusMap.READY,
        pendingChunks: chunkStatusMap.PENDING + chunkStatusMap.PROCESSING,
        failedChunks: chunkStatusMap.FAILED,
      },
      recentErrors: recentErrors.map((e) => ({
        id: e.id,
        timestamp: e.createdAt.toISOString(),
        responseType: e.responseType || "UNKNOWN / LEGACY",
        model: e.generationModel || "gemini-3.5-flash-lite",
        category: e.category,
        fallbackReason: e.fallbackReason,
        errorCategory: e.errorCategory,
        latencyMs: e.latencyMs,
      })),
    };
  }

  /**
   * GET /chatbot/admin/analytics
   */
  async getAnalytics(filters = {}) {
    const { fromStr, toStr, startUtc, endUtc } = this._resolveDateRange(filters);

    const logWhere = {
      createdAt: { gte: startUtc, lt: endUtc },
    };
    if (filters.parishId) {
      logWhere.selectedParishId = filters.parishId;
    }
    if (filters.model) {
      logWhere.generationModel = filters.model;
    }
    if (filters.responseType) {
      if (filters.responseType === "UNKNOWN / LEGACY") {
        logWhere.responseType = null;
      } else {
        logWhere.responseType = filters.responseType;
      }
    }
    if (filters.category) {
      logWhere.category = filters.category;
    }

    const usageWhere = {
      createdAt: { gte: startUtc, lt: endUtc },
    };
    if (filters.model) {
      usageWhere.model = filters.model;
    }

    // Parallel aggregate executions
    const [
      totalQueries,
      fallbackCount,
      latencyData,
      responseTypeGroups,
      categoryGroups,
      parishGroups,
      modelUsageRows,
      genAttempts,
      embedAttempts,
      tokenAgg,
      providerErrors,
      failedInteractions,
      providerRateLimits,
      chatbotErrors,
      dailyLogs,
      dailyUsage,
    ] = await Promise.all([
      this.prisma.chatbotLog.count({ where: logWhere }),
      this.prisma.chatbotLog.count({ where: { ...logWhere, fallback: true } }),
      this.prisma.chatbotLog.findMany({
        where: { ...logWhere, latencyMs: { not: null } },
        select: { latencyMs: true },
        orderBy: { latencyMs: "asc" },
      }),
      this.prisma.chatbotLog.groupBy({
        by: ["responseType"],
        where: logWhere,
        _count: { id: true },
      }),
      this.prisma.chatbotLog.groupBy({
        by: ["category"],
        where: logWhere,
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      this.prisma.chatbotLog.groupBy({
        by: ["selectedParishId"],
        where: logWhere,
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      this.prisma.aiUsageEvent.findMany({
        where: { ...usageWhere, operation: "GENERATE_CONTENT" },
        select: { model: true, success: true, latencyMs: true },
      }),
      this.prisma.aiUsageEvent.count({
        where: { ...usageWhere, operation: "GENERATE_CONTENT" },
      }),
      this.prisma.aiUsageEvent.count({
        where: { ...usageWhere, operation: "EMBED_CONTENT" },
      }),
      this.prisma.aiUsageEvent.aggregate({
        where: usageWhere,
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
        },
      }),
      this.prisma.aiUsageEvent.groupBy({
        by: ["errorCategory"],
        where: { ...usageWhere, success: false },
        _count: { id: true },
      }),
      this.prisma.chatbotLog.count({
        where: { ...logWhere, fallback: true, errorCategory: { not: null } },
      }),
      this.prisma.aiUsageEvent.count({
        where: { ...usageWhere, success: false, statusCode: 429 },
      }),
      this.prisma.chatbotLog.groupBy({
        by: ["fallbackReason"],
        where: { ...logWhere, fallback: true },
        _count: { id: true },
      }),
      this.prisma.chatbotLog.findMany({
        where: logWhere,
        select: { createdAt: true, fallback: true },
      }),
      this.prisma.aiUsageEvent.findMany({
        where: usageWhere,
        select: { createdAt: true, operation: true, success: true },
      }),
    ]);

    // Compute latency stats (avg and p95)
    let avgLatency = 0;
    let p95Latency = 0;
    if (latencyData.length > 0) {
      const sum = latencyData.reduce((acc, row) => acc + (row.latencyMs || 0), 0);
      avgLatency = Math.round(sum / latencyData.length);
      const p95Idx = Math.floor(latencyData.length * 0.95);
      p95Latency = latencyData[p95Idx]?.latencyMs || avgLatency;
    }

    // Resolve parish names for context display
    const parishIds = parishGroups
      .map((p) => p.selectedParishId)
      .filter((id) => id !== null && id !== undefined);

    const parishes =
      parishIds.length > 0
        ? await this.prisma.parish.findMany({
            where: { id: { in: parishIds } },
            select: { id: true, parishName: true },
          })
        : [];
    const parishMap = new Map(parishes.map((p) => [p.id, p.parishName]));

    const queriesByParishContext = parishGroups.map((p) => ({
      parishId: p.selectedParishId,
      parishName: p.selectedParishId
        ? parishMap.get(p.selectedParishId) || `Parish #${p.selectedParishId}`
        : "No Parish Selected (Diocese / General)",
      count: p._count.id,
    }));

    // Route distribution with UNKNOWN / LEGACY mapping for nulls
    const routeDistribution = responseTypeGroups.map((r) => ({
      responseType: r.responseType || "UNKNOWN / LEGACY",
      count: r._count.id,
      percentage:
        totalQueries > 0 ? Number(((r._count.id / totalQueries) * 100).toFixed(1)) : 0,
    }));

    // Fallback reasons
    const fallbackReasons = chatbotErrors.map((f) => ({
      reason: f.fallbackReason || "UNKNOWN_FALLBACK",
      count: f._count.id,
    }));

    // Build time-series buckets from the same filtered rows used by summaries.
    const manilaDayFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const timeMap = new Map();
    for (const row of dailyLogs) {
      const day = manilaDayFormatter.format(row.createdAt);
      const entry = timeMap.get(day) || {
        bucket: day,
        queries: 0,
        generationRequests: 0,
        embeddingRequests: 0,
      };
      entry.queries += 1;
      timeMap.set(day, entry);
    }
    for (const row of dailyUsage) {
      const day = manilaDayFormatter.format(row.createdAt);
      const entry = timeMap.get(day) || {
        bucket: day,
        queries: 0,
        generationRequests: 0,
        embeddingRequests: 0,
      };
      if (row.operation === "GENERATE_CONTENT") entry.generationRequests += 1;
      if (row.operation === "EMBED_CONTENT") entry.embeddingRequests += 1;
      timeMap.set(day, entry);
    }

    const timeSeries = Array.from(timeMap.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));

    const modelUsageMap = new Map();
    for (const row of modelUsageRows) {
      const key = row.model || "UNKNOWN";
      const entry = modelUsageMap.get(key) || { model: key, count: 0, successes: 0, totalLatencyMs: 0 };
      entry.count += 1;
      if (row.success) entry.successes += 1;
      entry.totalLatencyMs += row.latencyMs || 0;
      modelUsageMap.set(key, entry);
    }
    const modelUsage = Array.from(modelUsageMap.values()).map((entry) => ({
      model: entry.model,
      count: entry.count,
      successRate: entry.count > 0 ? Number(((entry.successes / entry.count) * 100).toFixed(1)) : 0,
      avgLatencyMs: entry.count > 0 ? Math.round(entry.totalLatencyMs / entry.count) : 0,
    }));

    const failedProviderAttempts = providerErrors.reduce((sum, entry) => sum + entry._count.id, 0);

    return {
      timeRange: {
        preset: filters.preset || "30d",
        from: fromStr,
        to: toStr,
        timezone: "Asia/Manila",
      },
      providerMetricsScope: "GLOBAL_DATE_AND_MODEL_FILTERED",
      summary: {
        userQueries: totalQueries,
        providerRequests: genAttempts + embedAttempts,
        generationRequests: genAttempts,
        embeddingRequests: embedAttempts,
        fallbackRate:
          totalQueries > 0 ? Number(((fallbackCount / totalQueries) * 100).toFixed(1)) : 0,
        averageLatencyMs: avgLatency,
        p95LatencyMs: p95Latency,
        failedInteractions,
        failedProviderAttempts,
        providerRateLimits,
        tokens: {
          input: tokenAgg._sum?.inputTokens || 0,
          output: tokenAgg._sum?.outputTokens || 0,
          total: tokenAgg._sum?.totalTokens || 0,
        },
      },
      routeDistribution,
      topCategories: categoryGroups.map((c) => ({
        category: c.category || "UNCATEGORIZED",
        count: c._count.id,
      })),
      parishContext: queriesByParishContext.map((entry) => ({
        parishId: entry.parishId,
        parishName: entry.parishName,
        queryCount: entry.count,
      })),
      modelUsage,
      providerErrors: providerErrors.map((e) => ({
        errorCategory: e.errorCategory || "UNKNOWN_PROVIDER_ERROR",
        count: e._count.id,
      })),
      fallbackReasons,
      timeSeries,
    };
  }

  /**
   * GET /chatbot/admin/logs (Metadata only, privacy-safe, select safe columns ONLY)
   */
  async getLogs(filters = {}) {
    const { fromStr, toStr, startUtc, endUtc } = this._resolveDateRange(filters);
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 25));
    const skip = (page - 1) * pageSize;

    const where = {
      createdAt: { gte: startUtc, lt: endUtc },
    };

    if (filters.parishId) {
      where.selectedParishId = filters.parishId;
    }
    if (filters.responseType) {
      if (filters.responseType === "UNKNOWN / LEGACY") {
        where.responseType = null;
      } else {
        where.responseType = filters.responseType;
      }
    }
    if (filters.model) {
      where.generationModel = filters.model;
    }
    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.outcome === "success") {
      where.fallback = false;
    } else if (filters.outcome === "fallback") {
      where.fallback = true;
    }

    // Explicit projection: NEVER select question, response, userId, sessionId, traceId
    const [totalCount, rows] = await Promise.all([
      this.prisma.chatbotLog.count({ where }),
      this.prisma.chatbotLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          responseType: true,
          category: true,
          generationProvider: true,
          generationModel: true,
          selectedParishId: true,
          latencyMs: true,
          fallback: true,
          fallbackReason: true,
          errorCategory: true,
        },
      }),
    ]);

    const parishIds = [...new Set(rows.map((row) => row.selectedParishId).filter(Boolean))];
    const parishes = parishIds.length > 0
      ? await this.prisma.parish.findMany({
          where: { id: { in: parishIds } },
          select: { id: true, parishName: true },
        })
      : [];
    const parishNameById = new Map(parishes.map((parish) => [parish.id, parish.parishName]));

    const items = rows.map((r) => ({
      id: r.id,
      timestamp: r.createdAt.toISOString(),
      responseType: r.responseType || "UNKNOWN / LEGACY",
      category: r.category || "GENERAL",
      generationProvider: r.generationProvider || "gemini",
      generationModel: r.generationModel || "gemini-3.5-flash-lite",
      selectedParishId: r.selectedParishId,
      parishName: r.selectedParishId ? parishNameById.get(r.selectedParishId) || `Parish #${r.selectedParishId}` : null,
      latencyMs: r.latencyMs || 0,
      fallback: r.fallback,
      fallbackReason: r.fallbackReason,
      errorCategory: r.errorCategory,
    }));

    return {
      items,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize) || 1,
      },
      period: {
        from: fromStr,
        to: toStr,
      },
    };
  }

  /**
   * GET /chatbot/admin/logs/purge-preview
   */
  async getPurgePreview({ daysOlderThan }) {
    return this.purgeService.previewPurge({ daysOlderThan });
  }

  /**
   * POST /chatbot/admin/logs/purge
   */
  async executePurge({ daysOlderThan }, actorId) {
    return this.purgeService.purgeTelemetry({
      daysOlderThan,
      isManual: true,
      actorId,
    });
  }

  /**
   * GET /chatbot/admin/knowledge-stats
   */
  async getKnowledgeStats() {
    const [
      activeSources,
      draftSources,
      retiredSources,
      totalSources,
      chunkCounts,
      ragQueryCount,
      insufficientEvidenceCount,
      recentScoresRaw,
    ] = await Promise.all([
      this.prisma.knowledgeSource.count({ where: { status: "ACTIVE" } }),
      this.prisma.knowledgeSource.count({ where: { status: "DRAFT" } }),
      this.prisma.knowledgeSource.count({ where: { status: "RETIRED" } }),
      this.prisma.knowledgeSource.count(),
      this.prisma.knowledgeChunk.groupBy({
        by: ["embeddingStatus"],
        _count: { _all: true },
      }),
      this.prisma.chatbotLog.count({
        where: {
          OR: [{ responseType: "RAG" }, { category: "RAG" }],
        },
      }),
      this.prisma.chatbotLog.count({
        where: {
          fallback: true,
          fallbackReason: "INSUFFICIENT_EVIDENCE",
        },
      }),
      // Sample recent retrieval scores defensively
      this.prisma.chatbotLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          retrievalScores: true,
        },
      }),
    ]);

    const chunkMap = { PENDING: 0, PROCESSING: 0, READY: 0, FAILED: 0 };
    for (const c of chunkCounts) {
      chunkMap[c.embeddingStatus] = c._count?._all ?? c._count?.id ?? 0;
    }

    // Defensive calculation of average top score
    let totalScore = 0;
    let scoreSamples = 0;
    for (const row of recentScoresRaw) {
      const arr = row.retrievalScores;
      if (Array.isArray(arr) && arr.length > 0) {
        const top = Number(arr[0]);
        if (Number.isFinite(top) && top > 0) {
          totalScore += top;
          scoreSamples++;
        }
      }
    }
    const averageTopScore =
      scoreSamples > 0 ? Number((totalScore / scoreSamples).toFixed(3)) : null;

    return {
      sourceCounts: {
        total: totalSources,
        active: activeSources,
        draft: draftSources,
        retired: retiredSources,
      },
      chunkCounts: {
        total: chunkMap.PENDING + chunkMap.PROCESSING + chunkMap.READY + chunkMap.FAILED,
        ready: chunkMap.READY,
        pending: chunkMap.PENDING + chunkMap.PROCESSING,
        failed: chunkMap.FAILED,
        stale: 0,
      },
      ragQueryCount,
      insufficientEvidenceCount,
      averageRetrievalScore: averageTopScore,
      retrievalScoreSampleCount: scoreSamples,
      embeddingConfig: {
        provider: env.chatbot?.embeddingProvider || "gemini",
        model: env.chatbot?.embeddingModel || "gemini-embedding-2",
        dimensions: env.chatbot?.embeddingDimensions || 768,
        readOnly: true,
      },
    };
  }
}

export const caloyAdminService = new CaloyAdminService();
