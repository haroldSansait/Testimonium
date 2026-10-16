import { randomUUID } from "node:crypto";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { EmailService } from "./EmailService.js";
import { renderEmail } from "./email/EmailTemplates.js";

const emailService = new EmailService();
let timer = null;
let activeDrain = null;

function isPermanent(error) {
  if (error?.code === "GMAIL_API_DELIVERY_ERROR") return error.permanent === true;
  if (error?.permanent === true) return true;
  if (Number(error?.responseCode) >= 500) return true;
  return ["EENVELOPE", "EMESSAGE"].includes(error?.code);
}

function safeError(error) {
  return String(error?.message || "Email provider error").slice(0, 1000);
}

export class EmailOutboxWorker {
  static start() {
    if (timer || !emailService.isConfigured()) {
      if (!emailService.isConfigured()) {
        logger.warn("[EmailOutbox] Email delivery transport is not configured; queued email will remain durable until configuration is supplied.");
      }
      return;
    }
    timer = setInterval(() => void this.drain(), env.smtp.workerPollMs);
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
      for (let i = 0; i < env.smtp.workerBatchSize; i += 1) {
        const job = await this.claimOne();
        if (!job) break;
        await this.process(job);
      }
    })().catch((error) => {
      logger.error({ err: error }, "[EmailOutbox] Worker cycle failed");
    }).finally(() => { activeDrain = null; });
    return activeDrain;
  }

  static async claimOne() {
    const token = randomUUID();
    // Keep a claim beyond every bounded delivery phase so a second
    // process cannot reclaim a message while the first send is still active.
    const deliveryTimeoutSeconds = Math.ceil(emailService.getDeliveryTimeoutMs() / 1000) + 30;
    const leaseSeconds = Math.max(env.smtp.workerLeaseSeconds, deliveryTimeoutSeconds);
    const rows = await prisma.$queryRaw`
      WITH candidate AS (
        SELECT "email_outbox_id"
        FROM "email_outbox"
        WHERE (
          ("status" IN ('QUEUED', 'RETRY') AND "next_attempt_at" <= CURRENT_TIMESTAMP)
          OR ("status" = 'PROCESSING' AND "lease_expires_at" < CURRENT_TIMESTAMP)
        )
        ORDER BY "next_attempt_at" ASC, "email_outbox_id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE "email_outbox" AS outbox
      SET "status" = 'PROCESSING',
          "processing_token" = ${token},
          "processing_at" = CURRENT_TIMESTAMP,
          "lease_expires_at" = CURRENT_TIMESTAMP + (${leaseSeconds} * INTERVAL '1 second'),
          "attempt_count" = "attempt_count" + 1,
          "updated_at" = CURRENT_TIMESTAMP
      FROM candidate
      WHERE outbox."email_outbox_id" = candidate."email_outbox_id"
      RETURNING outbox.*
    `;
    return rows[0] || null;
  }

  static async process(job) {
    try {
      const rendered = renderEmail(job.email_type, job.payload);
      const result = await emailService.send({
        to: job.recipient_email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      await prisma.emailOutbox.updateMany({
        where: { id: job.email_outbox_id, status: "PROCESSING", processingToken: job.processing_token },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: result.messageId || null,
          processingToken: null,
          processingAt: null,
          leaseExpiresAt: null,
          lastError: null,
        },
      });
    } catch (error) {
      const permanent = isPermanent(error);
      const exhausted = job.attempt_count >= env.smtp.maxAttempts;
      const delayMinutes = Math.min(60, 2 ** Math.max(0, job.attempt_count - 1));
      await prisma.emailOutbox.updateMany({
        where: { id: job.email_outbox_id, status: "PROCESSING", processingToken: job.processing_token },
        data: {
          status: permanent || exhausted ? "FAILED" : "RETRY",
          nextAttemptAt: permanent || exhausted ? new Date() : new Date(Date.now() + delayMinutes * 60_000),
          lastError: safeError(error),
          processingToken: null,
          processingAt: null,
          leaseExpiresAt: null,
        },
      });
      logger.warn({ outboxId: job.email_outbox_id, permanent, exhausted }, "[EmailOutbox] Delivery attempt failed");
    }
  }
}
