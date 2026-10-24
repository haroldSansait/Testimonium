-- Additive only: historical notifications have no push event and are never replayed.
ALTER TABLE "notifications" ADD COLUMN "push_event" VARCHAR(100);
CREATE INDEX "notifications_push_event_notification_id_idx" ON "notifications"("push_event", "notification_id");

CREATE TABLE "push_devices" (
  "id" TEXT NOT NULL,
  "token" VARCHAR(2048) NOT NULL,
  "user_id" INTEGER NOT NULL,
  "after_notification_id" INTEGER NOT NULL,
  "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "push_devices_token_key" ON "push_devices"("token");
CREATE INDEX "push_devices_user_id_idx" ON "push_devices"("user_id");

CREATE TABLE "push_deliveries" (
  "notification_id" INTEGER NOT NULL,
  "device_id" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_until" TIMESTAMP(3),
  "claim_token" TEXT,
  "sent_at" TIMESTAMP(3),
  "last_error_code" VARCHAR(100),
  CONSTRAINT "push_deliveries_pkey" PRIMARY KEY ("notification_id", "device_id"),
  CONSTRAINT "push_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("notification_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "push_deliveries_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "push_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "push_deliveries_status_next_attempt_at_idx" ON "push_deliveries"("status", "next_attempt_at");

-- Backend-only token/outbox storage. No public-client policies or changes to existing tables.
ALTER TABLE "push_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_deliveries" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "push_devices", "push_deliveries" FROM PUBLIC, anon, authenticated;
