import { randomUUID } from "node:crypto";
import { prisma as defaultPrisma } from "../config/db.js";
import { logger } from "../config/logger.js";
import { defaultCaloyTelemetryPurgeService } from "./CaloyTelemetryPurgeService.js";
import { defaultSystemLeaseService } from "./SystemLeaseService.js";
import { defaultCaloyRuntimeConfig } from "./CaloyRuntimeConfigService.js";

const CHECK_INTERVAL_MS = 60 * 1000;
const RETENTION_DAILY_LEASE_PREFIX = "CALOY_TELEMETRY_RETENTION";
const RETENTION_DAILY_LEASE_DURATION_SECONDS = 26 * 60 * 60;

function getManilaClockParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
  };
}

export class CaloyTelemetryRetentionWorker {
  constructor({
    prismaClient = defaultPrisma,
    purgeService = defaultCaloyTelemetryPurgeService,
    leaseService = defaultSystemLeaseService,
    configService = defaultCaloyRuntimeConfig,
    now = () => new Date(),
  } = {}) {
    this.prisma = prismaClient;
    this.purgeService = purgeService;
    this.leaseService = leaseService;
    this.configService = configService;
    this.now = now;
    this.timer = null;
    this.activeRun = null;
    this.isStopping = false;
  }

  async runScheduledCheck() {
    return this.runCycle();
  }

  start() {
    if (this.timer) return;

    this.timer = setInterval(() => void this.runCycle(), CHECK_INTERVAL_MS);
    this.timer.unref();
    void this.runCycle();
    logger.info("[CaloyTelemetryRetentionWorker] Retention worker initialized and scheduled.");
  }

  async stop() {
    this.isStopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.activeRun) {
      await this.activeRun;
    }
    logger.info("[CaloyTelemetryRetentionWorker] Retention worker stopped.");
  }

  runCycle() {
    if (this.activeRun || this.isStopping) {
      return this.activeRun;
    }

    this.activeRun = (async () => {
      // 1. Check runtime configuration
      const config = await this.configService.getEffectiveConfigSnapshot();

      if (!config.runtimeConfigDatabaseAvailable || !config.runtimeStateKnown) {
        logger.warn("[CaloyTelemetryRetentionWorker] Runtime retention state is unavailable; destructive retention skipped.");
        return;
      }

      if (!config?.automaticRetentionEnabled) {
        return; // Retention disabled
      }

      const manilaClock = getManilaClockParts(this.now());
      if (manilaClock.hour !== 3) {
        return;
      }

      // Claim a day-specific marker. It is retained after success so another
      // instance cannot repeat the same Manila calendar day's purge.
      const token = randomUUID();
      const dailyLeaseKey = `${RETENTION_DAILY_LEASE_PREFIX}:${manilaClock.date}`;
      const acquired = await this.leaseService.acquireLease(
        dailyLeaseKey,
        token,
        RETENTION_DAILY_LEASE_DURATION_SECONDS
      );

      if (!acquired) {
        logger.info(
          `[CaloyTelemetryRetentionWorker] Daily marker "${dailyLeaseKey}" already claimed. Skipping cycle.`
        );
        return;
      }

      const retentionDays = Number(config.logRetentionDays) || 90;
      let completed = false;

      try {
        const result = await this.purgeService.purgeTelemetry({
          daysOlderThan: retentionDays,
          isManual: false,
        });
        completed = true;
        const totalDeleted = (result.chatbotLogsDeleted || 0) + (result.aiUsageEventsDeleted || 0);

        if (totalDeleted > 0) {
          logger.info(
            { ...result },
            `[CaloyTelemetryRetentionWorker] Auto-purge executed: ${totalDeleted} records removed.`
          );

        }
      } finally {
        if (!completed) {
          await this.leaseService.releaseLease(dailyLeaseKey, token);
        }
      }
    })()
      .catch((err) => {
        logger.error({ err }, "[CaloyTelemetryRetentionWorker] Retention cycle encountered error.");
      })
      .finally(() => {
        this.activeRun = null;
      });

    return this.activeRun;
  }
}

export const caloyTelemetryRetentionWorker = new CaloyTelemetryRetentionWorker();
