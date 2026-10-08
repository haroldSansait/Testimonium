import { randomUUID } from "node:crypto";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { RegistrantIdStorageService } from "./RegistrantIdStorageService.js";

let timer = null;
let activeDrain = null;

export class PrivateObjectCleanupWorker {
  static start() {
    if (timer) return;
    timer = setInterval(() => void this.drain(), env.registrantId.workerPollMs);
    timer.unref();
    void this.drain();
  }

  static async stop() {
    if (timer) clearInterval(timer);
    timer = null;
    if (activeDrain) await activeDrain;
  }

  static drain() {
    if (activeDrain) return activeDrain;
    activeDrain = (async () => {
      for (let i = 0; i < env.registrantId.workerBatchSize; i += 1) {
        const job = await this.claimOne();
        if (!job) break;
        await this.process(job);
      }
    })().catch((error) => logger.error({ err: error }, "[PrivateObjectCleanup] Worker cycle failed"))
      .finally(() => { activeDrain = null; });
    return activeDrain;
  }

  static async claimOne() {
    const token = randomUUID();
    const rows = await prisma.$queryRaw`
      WITH candidate AS (
        SELECT "cleanup_job_id"
        FROM "private_object_cleanup_jobs"
        WHERE "attempt_count" < ${env.registrantId.cleanupMaxAttempts}
          AND (
            ("status" = 'PENDING' AND "next_attempt_at" <= CURRENT_TIMESTAMP)
            OR ("status" = 'PROCESSING' AND "lease_expires_at" < CURRENT_TIMESTAMP)
          )
        ORDER BY "next_attempt_at", "cleanup_job_id"
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE "private_object_cleanup_jobs" AS jobs
      SET "status" = 'PROCESSING',
          "processing_token" = ${token}::uuid,
          "processing_at" = CURRENT_TIMESTAMP,
          "lease_expires_at" = CURRENT_TIMESTAMP + (${env.registrantId.workerLeaseSeconds} * INTERVAL '1 second'),
          "attempt_count" = "attempt_count" + 1,
          "updated_at" = CURRENT_TIMESTAMP
      FROM candidate
      WHERE jobs."cleanup_job_id" = candidate."cleanup_job_id"
      RETURNING jobs.*
    `;
    return rows[0] || null;
  }

  static async process(job) {
    const where = { id: job.cleanup_job_id, status: "PROCESSING", processingToken: job.processing_token };
    const referenced = await prisma.registrantIdEvidence.findFirst({
      where: { OR: [{ frontObjectKey: job.object_key }, { backObjectKey: job.object_key }] },
      select: { id: true },
    });
    if (referenced) {
      await prisma.privateObjectCleanupJob.updateMany({ where, data: { status: "CANCELLED", processingToken: null, processingAt: null, leaseExpiresAt: null, completedAt: new Date() } });
      return;
    }
    try {
      await RegistrantIdStorageService.delete(job.object_key);
      await prisma.privateObjectCleanupJob.updateMany({ where, data: { status: "COMPLETED", processingToken: null, processingAt: null, leaseExpiresAt: null, completedAt: new Date(), lastErrorCode: null } });
    } catch (error) {
      const exhausted = job.attempt_count >= env.registrantId.cleanupMaxAttempts;
      const delayMinutes = Math.min(360, 2 ** Math.max(0, job.attempt_count - 1));
      await prisma.privateObjectCleanupJob.updateMany({
        where,
        data: {
          status: exhausted ? "FAILED" : "PENDING",
          nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
          processingToken: null,
          processingAt: null,
          leaseExpiresAt: null,
          lastErrorCode: error?.code === "REGISTRANT_ID_STORAGE_UNAVAILABLE" ? "STORAGE_UNAVAILABLE" : "DELETE_FAILED",
        },
      });
      logger.warn({ cleanupJobId: job.cleanup_job_id, exhausted }, "[PrivateObjectCleanup] Private object cleanup failed");
    }
  }
}
