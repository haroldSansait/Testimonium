import { randomUUID } from "node:crypto";
import { prisma as defaultPrisma } from "../config/db.js";
import { logger } from "../config/logger.js";
import { AuditLogService } from "./AuditLogService.js";
import { SystemLeaseService } from "./SystemLeaseService.js";

const BATCH_SIZE = 5000;
export const CALOY_TELEMETRY_PURGE_LEASE_KEY = "CALOY_TELEMETRY_PURGE";
export const CALOY_TELEMETRY_PURGE_LEASE_TTL_SECONDS = 300;

/**
 * Unified service for operational telemetry deletion (both manual purge and automatic retention).
 * Uses batched findMany + deleteMany to avoid memory explosion or massive table locks.
 */
export class CaloyTelemetryPurgeService {
  constructor(prismaClientOrOptions = defaultPrisma) {
    const options = prismaClientOrOptions?.prismaClient ? prismaClientOrOptions : null;
    this.prisma = options?.prismaClient || prismaClientOrOptions || defaultPrisma;
    this.leaseService = options?.leaseService || new SystemLeaseService(this.prisma);
    this.auditLogService = options?.auditLogService || AuditLogService;
    this.now = options?.now || (() => Date.now());
    this.createOperationId = options?.createOperationId || randomUUID;
  }

  _resolvePurgeWindow({ daysOlderThan = 90 } = {}) {
    const days = Number(daysOlderThan);
    if (!Number.isInteger(days) || days < 14 || days > 365) {
      const err = new Error("daysOlderThan must be an integer between 14 and 365");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    return {
      daysOlderThan: days,
      cutoffDate: new Date(this.now() - days * 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Generates informational count of records matching the cutoff criteria.
   */
  async previewPurge(args = {}) {
    return this.getPurgePreview(args);
  }

  async getPurgePreview(args = {}) {
    const { daysOlderThan, cutoffDate } = this._resolvePurgeWindow(args);

    const chatbotLogsCount = await this.prisma.chatbotLog.count({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    const aiUsageEventsCount = await this.prisma.aiUsageEvent.count({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return {
      daysOlderThan,
      cutoff: cutoffDate.toISOString(),
      chatbotLogsMatched: chatbotLogsCount,
      aiUsageEventsMatched: aiUsageEventsCount,
    };
  }

  /**
   * Executes batched deletion of operational logs and AI usage events older than cutoffDate.
   */
  async purgeTelemetry(args = {}) {
    const { daysOlderThan, cutoffDate } = this._resolvePurgeWindow(args);
    const { isManual = false, actorId = null } = args;
    const operationId = args.operationId || this.createOperationId();
    const ownerToken = args.ownerToken || this.createOperationId();

    if (isManual && !actorId) {
      const err = new Error("Manual Caloy telemetry purge requires an authenticated audit actor");
      err.statusCode = 401;
      err.code = "AUDIT_ACTOR_REQUIRED";
      throw err;
    }

    const acquired = await this.leaseService.acquireLease(
      CALOY_TELEMETRY_PURGE_LEASE_KEY,
      ownerToken,
      CALOY_TELEMETRY_PURGE_LEASE_TTL_SECONDS
    );
    if (!acquired) {
      const err = new Error("A Caloy telemetry purge is already in progress");
      err.statusCode = 409;
      err.code = "CALOY_PURGE_IN_PROGRESS";
      throw err;
    }

    logger.info(
      `[CaloyTelemetryPurgeService] Starting telemetry purge for records older than ${cutoffDate.toISOString()}`
    );

    let chatbotLogsDeleted = 0;
    let aiUsageEventsDeleted = 0;
    let auditStarted = false;

    try {
    await this.auditLogService.logOrThrow(actorId, "CALOY_LOG_PURGE_STARTED", null, !isManual, {
      affectedTable: "chatbot_logs",
      metadata: {
        operationId,
        daysOlderThan,
        cutoff: cutoffDate.toISOString(),
        automatic: !isManual,
        status: "STARTED",
      },
    });
    auditStarted = true;

    while (true) {
      const candidates = await this.prisma.chatbotLog.findMany({
        where: { createdAt: { lt: cutoffDate } },
        select: { id: true },
        take: BATCH_SIZE,
      });

      if (candidates.length === 0) break;

      const leaseRenewed = await this.leaseService.renewLease(
        CALOY_TELEMETRY_PURGE_LEASE_KEY,
        ownerToken,
        CALOY_TELEMETRY_PURGE_LEASE_TTL_SECONDS
      );
      if (!leaseRenewed) {
        const err = new Error("Caloy telemetry purge stopped after lease ownership was lost");
        err.code = "CALOY_PURGE_LEASE_LOST";
        err.statusCode = 409;
        throw err;
      }

      const ids = candidates.map((c) => c.id);
      const res = await this.prisma.chatbotLog.deleteMany({
        where: { id: { in: ids } },
      });

      chatbotLogsDeleted += res.count;
      if (candidates.length < BATCH_SIZE) break;
    }

    while (true) {
      const candidates = await this.prisma.aiUsageEvent.findMany({
        where: { createdAt: { lt: cutoffDate } },
        select: { id: true },
        take: BATCH_SIZE,
      });

      if (candidates.length === 0) break;

      const leaseRenewed = await this.leaseService.renewLease(
        CALOY_TELEMETRY_PURGE_LEASE_KEY,
        ownerToken,
        CALOY_TELEMETRY_PURGE_LEASE_TTL_SECONDS
      );
      if (!leaseRenewed) {
        const err = new Error("Caloy telemetry purge stopped after lease ownership was lost");
        err.code = "CALOY_PURGE_LEASE_LOST";
        err.statusCode = 409;
        throw err;
      }

      const ids = candidates.map((c) => c.id);
      const res = await this.prisma.aiUsageEvent.deleteMany({
        where: { id: { in: ids } },
      });

      aiUsageEventsDeleted += res.count;
      if (candidates.length < BATCH_SIZE) break;
    }

    logger.info(
      `[CaloyTelemetryPurgeService] Purge completed: ${chatbotLogsDeleted} chatbot logs, ${aiUsageEventsDeleted} AI usage events deleted.`
    );

    let auditFinalizationWarning = false;
    try {
      await this.auditLogService.logOrThrow(actorId, "CALOY_LOGS_PURGED", null, !isManual, {
        affectedTable: "chatbot_logs",
        metadata: {
          operationId,
          daysOlderThan,
          cutoff: cutoffDate.toISOString(),
          chatbotLogsDeleted,
          aiUsageEventsDeleted,
          automatic: !isManual,
          status: "COMPLETED",
        },
      });
    } catch (auditError) {
      auditFinalizationWarning = true;
      logger.error({ err: auditError, operationId }, "[CaloyTelemetryPurgeService] Purge succeeded but final audit could not be written.");
    }

    return {
      operationId,
      daysOlderThan,
      cutoff: cutoffDate.toISOString(),
      chatbotLogsDeleted,
      aiUsageEventsDeleted,
      status: "COMPLETED",
      auditFinalizationWarning,
    };
    } catch (err) {
      if (auditStarted) {
        const status = chatbotLogsDeleted + aiUsageEventsDeleted > 0 ? "PARTIAL" : "FAILED";
        try {
          await this.auditLogService.logOrThrow(actorId, "CALOY_LOG_PURGE_FAILED", null, !isManual, {
            affectedTable: "chatbot_logs",
            metadata: {
              operationId,
              daysOlderThan,
              cutoff: cutoffDate.toISOString(),
              chatbotLogsDeleted,
              aiUsageEventsDeleted,
              automatic: !isManual,
              status,
              errorCategory: err.code || "PURGE_FAILED",
            },
          });
        } catch (auditError) {
          logger.error({ err: auditError, operationId }, "[CaloyTelemetryPurgeService] Failed to finalize failed purge audit.");
        }
        err.purgeResult = {
          operationId,
          daysOlderThan,
          cutoff: cutoffDate.toISOString(),
          chatbotLogsDeleted,
          aiUsageEventsDeleted,
          status,
        };
      }
      throw err;
    } finally {
      await this.leaseService.releaseLease(CALOY_TELEMETRY_PURGE_LEASE_KEY, ownerToken);
    }
  }
}

export const defaultCaloyTelemetryPurgeService = new CaloyTelemetryPurgeService();
export const caloyTelemetryPurgeService = defaultCaloyTelemetryPurgeService;
