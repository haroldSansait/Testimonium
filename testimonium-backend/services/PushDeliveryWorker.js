import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getMessaging } from "firebase-admin/messaging";
import { getFirebaseApp } from "../config/firebase.js";
import { prisma } from "../config/db.js";
import { logger } from "../config/logger.js";
import { ANDROID_PUSH_EVENTS, isAndroidPushEligible } from "./PushEligibility.js";

const invalidTokenCodes = new Set([
  "messaging/registration-token-not-registered", "messaging/invalid-registration-token",
]);

export function buildAndroidPush(notification, token) {
  return {
    token,
    notification: { title: notification.title, body: "Open TESTIMONIUM to view this update." },
    data: {
      notificationId: String(notification.id),
      referenceType: notification.referenceType || "GENERAL",
      referenceId: String(notification.referenceId || ""),
      // Expo also reads data.tag when presenting a foreground remote notification.
      tag: `testimonium-${notification.id}`,
    },
    android: {
      priority: "high", ttl: 60 * 60 * 1000,
      notification: {
        channelId: "testimonium-important", sound: "default",
        tag: `testimonium-${notification.id}`, visibility: "private",
      },
    },
  };
}

export class PushDeliveryWorker {
  constructor({ db = prisma, send = payload => getMessaging(getFirebaseApp()).send(payload) } = {}) {
    this.db = db;
    this.send = send;
    this.timer = null;
    this.active = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.drain(), 5000);
    this.timer.unref();
    void this.drain();
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.active) await this.active;
  }

  // Only committed notification rows are visible here. Registration records a
  // high-water mark; registering a device never queues existing notification IDs.
  // No FCM call or new outbox write participates in a business transaction.
  async enqueue() {
    return this.db.$executeRaw`
      INSERT INTO push_deliveries (notification_id, device_id)
      SELECT n.notification_id, d.id
      FROM notifications n
      JOIN push_devices d ON d.user_id = n.user_id AND n.notification_id > d.after_notification_id
      WHERE n.type = 'IN_APP' AND n.push_event IN (${Prisma.join(ANDROID_PUSH_EVENTS)})
        AND ((n.push_event LIKE 'DOCUMENT:%' OR n.push_event LIKE 'PAYMENT:%') AND n.reference_type = 'DOCUMENT_REQUEST'
          OR (n.push_event LIKE 'SCHEDULE:%' OR n.push_event LIKE 'ALTERNATIVE:%') AND n.reference_type = 'SCHEDULE_REQUEST')
        AND NOT EXISTS (SELECT 1 FROM push_deliveries p WHERE p.notification_id = n.notification_id AND p.device_id = d.id)
      ORDER BY n.notification_id, d.id LIMIT 250
      ON CONFLICT DO NOTHING
    `;
  }

  async claimOne() {
    const claim = randomUUID();
    const rows = await this.db.$queryRaw`
      WITH candidate AS (
        SELECT notification_id, device_id FROM push_deliveries
        WHERE (status IN ('QUEUED', 'RETRY') AND next_attempt_at <= CURRENT_TIMESTAMP)
          OR (status = 'PROCESSING' AND lease_until < CURRENT_TIMESTAMP)
        ORDER BY next_attempt_at, notification_id
        FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE push_deliveries p SET status = 'PROCESSING', attempts = attempts + 1,
        claim_token = ${claim}, lease_until = CURRENT_TIMESTAMP + INTERVAL '10 minutes'
      FROM candidate c WHERE p.notification_id = c.notification_id AND p.device_id = c.device_id
      RETURNING p.*
    `;
    return rows[0];
  }

  async process(job) {
    const where = { notificationId: job.notification_id, deviceId: job.device_id, claimToken: job.claim_token, status: "PROCESSING" };
    const finish = data => this.db.pushDelivery.updateMany({ where, data: { ...data, claimToken: null, leaseUntil: null } });
    try {
      const current = await this.db.pushDelivery.findFirst({ where, include: {
        notification: true, device: { include: { user: { include: { role: true } } } },
      } });
      if (!current) return;
      const { notification, device } = current;
      if (job.attempts > 8) { await finish({ status: "FAILED" }); return; }
      if (!isAndroidPushEligible(notification) || notification.userId !== device.userId ||
          notification.id <= device.afterNotificationId || device.user.status !== "ACTIVE" ||
          device.user.role.roleName !== "PARISHIONER" || !device.user.isVerified) {
        await finish({ status: "SKIPPED" });
        return;
      }
      await this.send(buildAndroidPush(notification, device.token));
      await finish({ status: "SENT", sentAt: new Date(), lastErrorCode: null });
    } catch (error) {
      const code = typeof error?.code === "string" ? error.code.slice(0, 100) : "PUSH_DELIVERY_FAILED";
      if (invalidTokenCodes.has(code)) {
        // The device ID identifies this ownership epoch, never a replacement token.
        await this.db.pushDevice.deleteMany({ where: { id: job.device_id } });
        return;
      }
      const permanent = ["messaging/invalid-argument", "messaging/mismatched-credential"].includes(code);
      await finish({
        status: permanent || job.attempts >= 8 ? "FAILED" : "RETRY",
        nextAttemptAt: new Date(Date.now() + Math.min(3600, 15 * 2 ** job.attempts) * 1000),
        lastErrorCode: code,
      });
    }
  }

  drain() {
    if (this.active) return this.active;
    this.active = (async () => {
      await this.enqueue();
      for (let i = 0; i < 25; i++) {
        const job = await this.claimOne();
        if (!job) break;
        await this.process(job);
      }
    })().catch(() => {
      // Never log provider errors/payloads, which can contain registration tokens.
      logger.warn("[AndroidPush] Delivery cycle failed; pending jobs remain durable.");
    }).finally(() => { this.active = null; });
    return this.active;
  }
}

export const pushDeliveryWorker = new PushDeliveryWorker();
