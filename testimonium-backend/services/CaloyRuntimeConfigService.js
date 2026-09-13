import { prisma as defaultPrisma } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { isApprovedGenerationModel, getApprovedGenerationModels } from "../config/caloyModelCatalog.js";
import { AuditLogService } from "./AuditLogService.js";

const CACHE_TTL_MS = 5000; // 5-second short TTL for prompt cross-instance propagation

export class CaloyRuntimeConfigService {
  constructor(prismaClientOrOptions = defaultPrisma) {
    if (prismaClientOrOptions && prismaClientOrOptions.prismaClient) {
      this.prisma = prismaClientOrOptions.prismaClient;
      this.cacheTtlMs = prismaClientOrOptions.cacheTtlMs ?? CACHE_TTL_MS;
    } else {
      this.prisma = prismaClientOrOptions || defaultPrisma;
      this.cacheTtlMs = CACHE_TTL_MS;
    }
    this.cachedConfig = null;
    this.cacheExpiry = 0;
    this.lastKnownGoodRuntimeConfig = null;
  }

  /**
   * Clears the in-memory cache immediately.
   */
  invalidateCache() {
    this.cachedConfig = null;
    this.cacheExpiry = 0;
  }

  /**
   * Alias for getRuntimeConfig returning the immutable effective snapshot.
   */
  async getEffectiveConfigSnapshot() {
    return this.getRuntimeConfig();
  }

  /**
   * Returns frontend settings DTO separating configured vs effective values.
   */
  async getEffectiveSettingsDto() {
    const snapshot = await this.getRuntimeConfig();
    return {
      runtimeOverridePresent: snapshot.runtimeOverridePresent,
      runtimeStateKnown: snapshot.runtimeStateKnown,
      runtimeConfigSource: snapshot.runtimeConfigSource,
      runtimeConfigDatabaseAvailable: snapshot.runtimeConfigDatabaseAvailable,
      configurationDegraded: snapshot.configurationDegraded,
      configurationStatus: snapshot.configurationStatus,
      version: snapshot.version,
      configuredValues: {
        enabled: snapshot.runtimeOverridePresent ? snapshot.runtimeEnabled : null,
        generationProvider: snapshot.runtimeOverridePresent ? snapshot.generationProvider : null,
        generationModel: snapshot.runtimeOverridePresent ? snapshot.configuredGenerationModel : null,
        aiTenMinuteMax: snapshot.runtimeOverridePresent ? snapshot.aiTenMinuteMax : null,
        aiDailyMax: snapshot.runtimeOverridePresent ? snapshot.aiDailyMax : null,
        chatbotRequestDeadlineMs: snapshot.runtimeOverridePresent ? snapshot.chatbotRequestDeadlineMs : null,
        automaticRetentionEnabled: snapshot.runtimeOverridePresent ? snapshot.automaticRetentionEnabled : null,
        logRetentionDays: snapshot.runtimeOverridePresent ? snapshot.logRetentionDays : null,
      },
      effectiveValues: {
        enabled: snapshot.effectiveEnabled,
        generationProvider: snapshot.generationProvider,
        generationModel: snapshot.effectiveGenerationModel || "",
        runtimeModelValid: snapshot.runtimeModelValid,
        aiTenMinuteMax: snapshot.aiTenMinuteMax,
        aiDailyMax: snapshot.aiDailyMax,
        chatbotRequestDeadlineMs: snapshot.chatbotRequestDeadlineMs,
        automaticRetentionEnabled: snapshot.automaticRetentionEnabled,
        logRetentionDays: snapshot.logRetentionDays,
      },
      approvedModels: getApprovedGenerationModels().map((model) => ({
        id: model.id,
        displayName: model.name,
        description: model.description,
      })),
      masterDeploymentGate: {
        deploymentEnabled: snapshot.deploymentEnabled,
        envGenerationModel: snapshot.deploymentConfiguredModel,
        envGenerationModelValid: snapshot.deploymentModelValid,
        credentialsConfigured: snapshot.credentialsConfigured,
      },
      readOnlyComponents: {
        semanticRouter: {
          provider: "gemini",
          model: env.chatbot?.semanticRouterModel || "gemini-3.5-flash-lite",
          readOnly: true,
        },
        embedding: {
          provider: env.chatbot?.embeddingProvider || "gemini",
          model: env.chatbot?.embeddingModel || "gemini-embedding-2",
          dimensions: env.chatbot?.embeddingDimensions || 768,
          readOnly: true,
        },
      },
      constraints: {
        minTenMinute: 5,
        maxTenMinute: 100,
        minDaily: 10,
        maxDaily: 500,
        minDeadlineMs: 5000,
        maxDeadlineMs: 28000,
        minRetentionDays: 14,
        maxRetentionDays: 365,
      },
      updatedById: snapshot.updatedById,
      updatedAt: snapshot.updatedAt,
    };
  }

  /**
   * Resolves the immutable effective configuration snapshot.
   * Nullish resolution: runtime overrides env when present; otherwise falls back to deployment env.
   */
  async getRuntimeConfig() {
    const now = Date.now();
    if (this.cachedConfig && now < this.cacheExpiry) {
      return this.cachedConfig;
    }

    const deploymentEnabled = Boolean(env.chatbot?.enabled);
    const envModel = (env.chatbot?.generationModel || "gemini-3.5-flash-lite").trim();
    const envTenMinute = env.chatbot?.rateLimits?.aiTenMinuteMax ?? 20;
    const envDaily = env.chatbot?.rateLimits?.aiDailyMax ?? 50;
    const envDeadline = 25000;
    const envRetention = 90;

    let dbRow = null;
    let dbReadError = null;
    try {
      dbRow = await this.prisma.caloyRuntimeConfig.findUnique({
        where: { id: 1 },
      });
    } catch (err) {
      dbReadError = err;
      logger.warn({ err }, "[CaloyRuntimeConfigService] Failed to read caloy_runtime_config from DB; using fail-closed state.");
    }

    let snapshot;
    if (dbReadError) {
      if (this.lastKnownGoodRuntimeConfig) {
        snapshot = Object.freeze({
          ...this.lastKnownGoodRuntimeConfig,
          runtimeConfigSource: "STALE_LAST_KNOWN_GOOD",
          runtimeConfigDatabaseAvailable: false,
          runtimeStateKnown: true,
          configurationDegraded: true,
          configurationStatus: "CONFIGURATION_DEGRADED",
        });
      } else {
        const deploymentModelValid = isApprovedGenerationModel(envModel);
        snapshot = Object.freeze({
          runtimeOverridePresent: false,
          version: 0,
          effectiveEnabled: false,
          deploymentEnabled,
          runtimeEnabled: false,
          runtimeConfigSource: "UNAVAILABLE_FAIL_CLOSED",
          runtimeConfigDatabaseAvailable: false,
          runtimeStateKnown: false,
          configurationDegraded: true,
          configurationStatus: "CONFIGURATION_ERROR",
          generationProvider: "gemini",
          generationModel: deploymentModelValid ? envModel : null,
          configuredGenerationModel: null,
          deploymentConfiguredModel: envModel,
          effectiveGenerationModel: deploymentModelValid ? envModel : null,
          runtimeModelValid: null,
          deploymentModelValid,
          credentialsConfigured: Boolean(env.chatbot?.geminiApiKey),
          aiTenMinuteMax: envTenMinute,
          aiDailyMax: envDaily,
          chatbotRequestDeadlineMs: envDeadline,
          automaticRetentionEnabled: false,
          logRetentionDays: envRetention,
          updatedById: null,
          updatedAt: null,
        });
      }
    } else if (!dbRow) {
      // No runtime row exists yet
      const deploymentModelValid = isApprovedGenerationModel(envModel);
      const credentialsConfigured = Boolean(env.chatbot?.geminiApiKey);
      const effectiveEnabled = deploymentEnabled && deploymentModelValid && credentialsConfigured;
      snapshot = Object.freeze({
        runtimeOverridePresent: false,
        version: 0,
        effectiveEnabled,
        deploymentEnabled,
        runtimeEnabled: true,
        runtimeConfigSource: "DEPLOYMENT_ENV",
        runtimeConfigDatabaseAvailable: true,
        runtimeStateKnown: true,
        configurationDegraded: false,
        configurationStatus: !deploymentEnabled
          ? "DISABLED_BY_DEPLOYMENT"
          : !deploymentModelValid || !credentialsConfigured
            ? "CONFIGURATION_ERROR"
            : "ACTIVE",
        generationProvider: "gemini",
        generationModel: deploymentModelValid ? envModel : null,
        configuredGenerationModel: null,
        deploymentConfiguredModel: envModel,
        effectiveGenerationModel: deploymentModelValid ? envModel : null,
        runtimeModelValid: null,
        deploymentModelValid,
        credentialsConfigured,
        aiTenMinuteMax: envTenMinute,
        aiDailyMax: envDaily,
        chatbotRequestDeadlineMs: envDeadline,
        automaticRetentionEnabled: false,
        logRetentionDays: envRetention,
        updatedById: null,
        updatedAt: null,
      });
    } else {
      // Runtime row is present
      const runtimeEnabled = Boolean(dbRow.enabled);
      const effectiveEnabled = deploymentEnabled && runtimeEnabled;
      const configuredModel = dbRow.generationModel?.trim() || envModel;
      const modelValid = isApprovedGenerationModel(configuredModel);
      const deploymentModelValid = isApprovedGenerationModel(envModel);
      const effectiveModel = modelValid ? configuredModel : deploymentModelValid ? envModel : null;
      const credentialsConfigured = Boolean(env.chatbot?.geminiApiKey);
      const providerReady = Boolean(effectiveModel) && credentialsConfigured;
      const resolvedEnabled = effectiveEnabled && providerReady;

      snapshot = Object.freeze({
        runtimeOverridePresent: true,
        version: dbRow.version,
        effectiveEnabled: resolvedEnabled,
        deploymentEnabled,
        runtimeEnabled,
        runtimeConfigSource: "DATABASE",
        runtimeConfigDatabaseAvailable: true,
        runtimeStateKnown: true,
        configurationDegraded: false,
        configurationStatus: !deploymentEnabled
          ? "DISABLED_BY_DEPLOYMENT"
          : !runtimeEnabled
            ? "DISABLED_BY_COORDINATOR"
            : !providerReady
              ? "CONFIGURATION_ERROR"
              : !modelValid
                ? "CONFIGURATION_WARNING"
                : "ACTIVE",
        generationProvider: "gemini",
        generationModel: effectiveModel,
        configuredGenerationModel: configuredModel,
        deploymentConfiguredModel: envModel,
        effectiveGenerationModel: effectiveModel,
        runtimeModelValid: modelValid,
        deploymentModelValid,
        credentialsConfigured,
        aiTenMinuteMax: dbRow.aiTenMinuteMax ?? envTenMinute,
        aiDailyMax: dbRow.aiDailyMax ?? envDaily,
        chatbotRequestDeadlineMs: dbRow.chatbotRequestDeadlineMs ?? envDeadline,
        automaticRetentionEnabled: Boolean(dbRow.automaticRetentionEnabled),
        logRetentionDays: dbRow.logRetentionDays ?? envRetention,
        updatedById: dbRow.updatedById,
        updatedAt: dbRow.updatedAt ? dbRow.updatedAt.toISOString() : null,
      });
    }

    this.cachedConfig = snapshot;
    if (!dbReadError) {
      this.lastKnownGoodRuntimeConfig = snapshot;
    }
    this.cacheExpiry = now + this.cacheTtlMs;
    return snapshot;
  }

  /**
   * Updates runtime configuration using atomic optimistic concurrency.
   *
   * @param {object} args
   * @param {number} args.expectedVersion
   * @param {object} args.patchData
   * @param {number} [args.userId]
   * @param {string} [args.ipAddress]
   * @param {string} [args.userAgent]
   */
  async updateRuntimeConfig(args = {}, actorId = null) {
    const expectedVersion = args.expectedVersion;
    const userId = actorId || args.userId || null;
    const ipAddress = args.ipAddress || null;
    const userAgent = args.userAgent || null;
    const patchData = args.patchData || args;

    if (expectedVersion === undefined || expectedVersion === null || !Number.isInteger(Number(expectedVersion))) {
      const err = new Error("expectedVersion must be an integer");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const expVer = Number(expectedVersion);

    // Validate inputs
    if (patchData.generationModel) {
      const trimmedModel = String(patchData.generationModel).trim();
      if (!isApprovedGenerationModel(trimmedModel)) {
        const err = new Error(`Generation model "${trimmedModel}" is not an approved catalog model`);
        err.statusCode = 400;
        err.code = "INVALID_MODEL";
        throw err;
      }
      patchData.generationModel = trimmedModel;
    }

    if (patchData.aiTenMinuteMax !== undefined) {
      const v = Number(patchData.aiTenMinuteMax);
      if (!Number.isInteger(v) || v < 5 || v > 100) {
        const err = new Error("aiTenMinuteMax must be between 5 and 100");
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }
    }

    if (patchData.aiDailyMax !== undefined) {
      const v = Number(patchData.aiDailyMax);
      if (!Number.isInteger(v) || v < 10 || v > 500) {
        const err = new Error("aiDailyMax must be between 10 and 500");
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }
    }

    if (patchData.aiTenMinuteMax !== undefined && patchData.aiDailyMax !== undefined) {
      if (Number(patchData.aiDailyMax) < Number(patchData.aiTenMinuteMax)) {
        const err = new Error("aiDailyMax must be greater than or equal to aiTenMinuteMax");
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }
    }

    if (patchData.chatbotRequestDeadlineMs !== undefined) {
      const v = Number(patchData.chatbotRequestDeadlineMs);
      if (!Number.isInteger(v) || v < 5000 || v > 28000) {
        const err = new Error("chatbotRequestDeadlineMs must be between 5000ms (5s) and 28000ms (28s)");
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }
    }

    if (patchData.logRetentionDays !== undefined) {
      const v = Number(patchData.logRetentionDays);
      if (!Number.isInteger(v) || v < 14 || v > 365) {
        const err = new Error("logRetentionDays must be between 14 and 365 days");
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }
    }

    const previousSnapshot = await this.getRuntimeConfig();
    if (!previousSnapshot.runtimeConfigDatabaseAvailable) {
      const err = new Error("Caloy runtime configuration cannot be updated while its database state is unavailable");
      err.statusCode = 503;
      err.code = "RUNTIME_CONFIG_UNAVAILABLE";
      throw err;
    }
    if (!userId) {
      const err = new Error("Caloy settings updates require an authenticated audit actor");
      err.statusCode = 401;
      err.code = "AUDIT_ACTOR_REQUIRED";
      throw err;
    }

    const mergedTenMinuteMax = patchData.aiTenMinuteMax !== undefined
      ? Number(patchData.aiTenMinuteMax)
      : previousSnapshot.aiTenMinuteMax;
    const mergedDailyMax = patchData.aiDailyMax !== undefined
      ? Number(patchData.aiDailyMax)
      : previousSnapshot.aiDailyMax;
    const mergedGenerationModel = patchData.generationModel
      || previousSnapshot.configuredGenerationModel
      || previousSnapshot.effectiveGenerationModel;
    if (!isApprovedGenerationModel(mergedGenerationModel)) {
      const err = new Error("A known-compatible generation model must be selected before saving Caloy settings");
      err.statusCode = 400;
      err.code = "INVALID_MODEL";
      throw err;
    }
    if (mergedDailyMax < mergedTenMinuteMax) {
      const err = new Error("aiDailyMax must be greater than or equal to aiTenMinuteMax");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    // Check if toggling enabled status for specialized audit action
    let auditAction = "CALOY_SETTINGS_UPDATED";
    if (patchData.enabled !== undefined && patchData.enabled !== previousSnapshot.runtimeEnabled) {
      auditAction = patchData.enabled ? "CALOY_ENABLED" : "CALOY_DISABLED";
    }

    await this.prisma.$transaction(async (tx) => {
    if (expVer === 0) {
      // First save when no row exists in DB: construct from previous effective snapshot + patch
      try {
        await tx.caloyRuntimeConfig.create({
          data: {
            id: 1,
            enabled: patchData.enabled !== undefined ? Boolean(patchData.enabled) : previousSnapshot.runtimeEnabled,
            generationProvider: "gemini",
            generationModel: mergedGenerationModel,
            aiTenMinuteMax: patchData.aiTenMinuteMax !== undefined ? Number(patchData.aiTenMinuteMax) : previousSnapshot.aiTenMinuteMax,
            aiDailyMax: patchData.aiDailyMax !== undefined ? Number(patchData.aiDailyMax) : previousSnapshot.aiDailyMax,
            chatbotRequestDeadlineMs: patchData.chatbotRequestDeadlineMs !== undefined ? Number(patchData.chatbotRequestDeadlineMs) : previousSnapshot.chatbotRequestDeadlineMs,
            automaticRetentionEnabled: patchData.automaticRetentionEnabled !== undefined ? Boolean(patchData.automaticRetentionEnabled) : previousSnapshot.automaticRetentionEnabled,
            logRetentionDays: patchData.logRetentionDays !== undefined ? Number(patchData.logRetentionDays) : previousSnapshot.logRetentionDays,
            version: 1,
            updatedById: userId ? Number(userId) : null,
          },
        });
      } catch (err) {
        if (err.code === "P2002" || String(err.message || "").includes("duplicate key")) {
          const conflictErr = new Error("Caloy configuration was already initialized by another administrator. Please reload.");
          conflictErr.statusCode = 409;
          conflictErr.code = "CONFIG_VERSION_CONFLICT";
          throw conflictErr;
        }
        throw err;
      }
    } else {
      // Versioned update: atomic conditional update
      const updateData = {
        version: { increment: 1 },
        updatedById: userId ? Number(userId) : null,
      };

      if (patchData.enabled !== undefined) updateData.enabled = Boolean(patchData.enabled);
      if (patchData.generationModel) updateData.generationModel = patchData.generationModel;
      if (patchData.aiTenMinuteMax !== undefined) updateData.aiTenMinuteMax = Number(patchData.aiTenMinuteMax);
      if (patchData.aiDailyMax !== undefined) updateData.aiDailyMax = Number(patchData.aiDailyMax);
      if (patchData.chatbotRequestDeadlineMs !== undefined) updateData.chatbotRequestDeadlineMs = Number(patchData.chatbotRequestDeadlineMs);
      if (patchData.automaticRetentionEnabled !== undefined) updateData.automaticRetentionEnabled = Boolean(patchData.automaticRetentionEnabled);
      if (patchData.logRetentionDays !== undefined) updateData.logRetentionDays = Number(patchData.logRetentionDays);

      const updateResult = await tx.caloyRuntimeConfig.updateMany({
        where: {
          id: 1,
          version: expVer,
        },
        data: updateData,
      });

      if (updateResult.count === 0) {
        const conflictErr = new Error("Caloy settings changed in another session. Please reload latest settings.");
        conflictErr.statusCode = 409;
        conflictErr.code = "CONFIG_VERSION_CONFLICT";
        throw conflictErr;
      }
    }

    await AuditLogService.logOrThrow(userId, auditAction, tx, false, {
      affectedTable: "caloy_runtime_config",
      affectedRecordId: 1,
      ipAddress,
      userAgent,
      previousValues: {
        enabled: previousSnapshot.runtimeEnabled,
        generationModel: previousSnapshot.configuredGenerationModel || previousSnapshot.generationModel,
        aiTenMinuteMax: previousSnapshot.aiTenMinuteMax,
        aiDailyMax: previousSnapshot.aiDailyMax,
        chatbotRequestDeadlineMs: previousSnapshot.chatbotRequestDeadlineMs,
        automaticRetentionEnabled: previousSnapshot.automaticRetentionEnabled,
        logRetentionDays: previousSnapshot.logRetentionDays,
        version: previousSnapshot.version,
      },
      newValues: {
        enabled: patchData.enabled !== undefined ? Boolean(patchData.enabled) : previousSnapshot.runtimeEnabled,
        generationModel: mergedGenerationModel,
        aiTenMinuteMax: mergedTenMinuteMax,
        aiDailyMax: mergedDailyMax,
        chatbotRequestDeadlineMs: patchData.chatbotRequestDeadlineMs !== undefined ? Number(patchData.chatbotRequestDeadlineMs) : previousSnapshot.chatbotRequestDeadlineMs,
        automaticRetentionEnabled: patchData.automaticRetentionEnabled !== undefined ? Boolean(patchData.automaticRetentionEnabled) : previousSnapshot.automaticRetentionEnabled,
        logRetentionDays: patchData.logRetentionDays !== undefined ? Number(patchData.logRetentionDays) : previousSnapshot.logRetentionDays,
        version: expVer === 0 ? 1 : expVer + 1,
      },
    });
    });

    // Invalidate local cache immediately
    this.invalidateCache();
    const updatedSnapshot = await this.getRuntimeConfig();

    return updatedSnapshot;
  }
}

export const defaultCaloyRuntimeConfigService = new CaloyRuntimeConfigService();
export const defaultCaloyRuntimeConfig = defaultCaloyRuntimeConfigService;
export const caloyRuntimeConfigService = defaultCaloyRuntimeConfigService;
