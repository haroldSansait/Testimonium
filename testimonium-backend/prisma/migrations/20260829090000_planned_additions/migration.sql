-- TESTIMONIUM planned additions: scheduling rules, event visibility,
-- daily reports, and durable transactional email outbox.

CREATE TYPE "Weekday" AS ENUM (
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
  'FRIDAY', 'SATURDAY', 'SUNDAY'
);

CREATE TYPE "ScheduleDateRuleMode" AS ENUM ('INHERIT', 'AVAILABLE', 'UNAVAILABLE');
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'PARISH_PRIVATE');
CREATE TYPE "ReportScope" AS ENUM ('PARISH', 'DIOCESE');
CREATE TYPE "ReportCategory" AS ENUM ('MEETING', 'ACTIVITY', 'IMPORTANT_EVENT', 'OTHER');
CREATE TYPE "EmailOutboxStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'RETRY', 'FAILED');
CREATE TYPE "EmailType" AS ENUM (
  'DOCUMENT_READY_FOR_PICKUP',
  'SCHEDULE_SUBMITTED',
  'SCHEDULE_PROPOSED_RESCHEDULE',
  'SCHEDULE_CONFIRMED'
);

ALTER TABLE "parishes"
  ADD COLUMN "scheduling_config_version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "schedules"
  ADD COLUMN "proposal_version" INTEGER NOT NULL DEFAULT 0;

-- Preserve the current public behavior before enforcing the new field.
ALTER TABLE "parish_events"
  ADD COLUMN "visibility" "EventVisibility";
UPDATE "parish_events" SET "visibility" = 'PUBLIC' WHERE "visibility" IS NULL;
ALTER TABLE "parish_events"
  ALTER COLUMN "visibility" SET DEFAULT 'PUBLIC',
  ALTER COLUMN "visibility" SET NOT NULL,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "parish_weekday_rules" (
  "rule_id" SERIAL NOT NULL,
  "parish_id" INTEGER NOT NULL,
  "weekday" "Weekday" NOT NULL,
  "is_available" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "parish_weekday_rules_pkey" PRIMARY KEY ("rule_id")
);

CREATE TABLE "parish_service_weekday_rules" (
  "rule_id" SERIAL NOT NULL,
  "parish_id" INTEGER NOT NULL,
  "event_type" "ScheduleEventType" NOT NULL,
  "weekday" "Weekday" NOT NULL,
  "is_available" BOOLEAN NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "parish_service_weekday_rules_pkey" PRIMARY KEY ("rule_id")
);

CREATE TABLE "parish_schedule_date_rules" (
  "date_rule_id" SERIAL NOT NULL,
  "parish_id" INTEGER NOT NULL,
  "exception_date" DATE NOT NULL,
  "base_mode" "ScheduleDateRuleMode" NOT NULL DEFAULT 'INHERIT',
  "reason" VARCHAR(255),
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "parish_schedule_date_rules_pkey" PRIMARY KEY ("date_rule_id")
);

CREATE TABLE "parish_schedule_date_service_overrides" (
  "override_id" SERIAL NOT NULL,
  "date_rule_id" INTEGER NOT NULL,
  "event_type" "ScheduleEventType" NOT NULL,
  "mode" "ScheduleDateRuleMode" NOT NULL,
  CONSTRAINT "parish_schedule_date_service_overrides_pkey" PRIMARY KEY ("override_id"),
  CONSTRAINT "date_service_override_mode_check" CHECK ("mode" <> 'INHERIT')
);

CREATE TABLE "daily_reports" (
  "report_id" SERIAL NOT NULL,
  "report_date" DATE NOT NULL,
  "scope" "ReportScope" NOT NULL,
  "parish_id" INTEGER,
  "title" VARCHAR(255) NOT NULL,
  "category" "ReportCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "created_by" INTEGER NOT NULL,
  "is_archived" BOOLEAN NOT NULL DEFAULT false,
  "archived_at" TIMESTAMP(3),
  "archived_by" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("report_id"),
  CONSTRAINT "daily_reports_scope_parish_check" CHECK (
    ("scope" = 'PARISH' AND "parish_id" IS NOT NULL) OR
    ("scope" = 'DIOCESE' AND "parish_id" IS NULL)
  )
);

CREATE TABLE "email_outbox" (
  "email_outbox_id" SERIAL NOT NULL,
  "transition_key" VARCHAR(255) NOT NULL,
  "recipient_email" VARCHAR(150) NOT NULL,
  "email_type" "EmailType" NOT NULL,
  "reference_type" VARCHAR(50) NOT NULL,
  "reference_id" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "EmailOutboxStatus" NOT NULL DEFAULT 'QUEUED',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error" TEXT,
  "provider_message_id" VARCHAR(255),
  "processing_token" VARCHAR(64),
  "processing_at" TIMESTAMP(3),
  "lease_expires_at" TIMESTAMP(3),
  "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("email_outbox_id")
);

CREATE UNIQUE INDEX "parish_weekday_rules_parish_id_weekday_key"
  ON "parish_weekday_rules"("parish_id", "weekday");
CREATE INDEX "parish_weekday_rules_parish_id_idx"
  ON "parish_weekday_rules"("parish_id");
CREATE UNIQUE INDEX "parish_service_weekday_rules_parish_id_event_type_weekday_key"
  ON "parish_service_weekday_rules"("parish_id", "event_type", "weekday");
CREATE INDEX "parish_service_weekday_rules_parish_id_idx"
  ON "parish_service_weekday_rules"("parish_id");
CREATE UNIQUE INDEX "parish_schedule_date_rules_parish_id_exception_date_key"
  ON "parish_schedule_date_rules"("parish_id", "exception_date");
CREATE INDEX "parish_schedule_date_rules_parish_id_exception_date_idx"
  ON "parish_schedule_date_rules"("parish_id", "exception_date");
CREATE UNIQUE INDEX "parish_schedule_date_service_overrides_date_rule_id_event_t_key"
  ON "parish_schedule_date_service_overrides"("date_rule_id", "event_type");
CREATE INDEX "parish_schedule_date_service_overrides_date_rule_id_idx"
  ON "parish_schedule_date_service_overrides"("date_rule_id");
CREATE INDEX "daily_reports_parish_id_report_date_idx" ON "daily_reports"("parish_id", "report_date");
CREATE INDEX "daily_reports_scope_report_date_idx" ON "daily_reports"("scope", "report_date");
CREATE INDEX "daily_reports_category_report_date_idx" ON "daily_reports"("category", "report_date");
CREATE INDEX "daily_reports_created_by_idx" ON "daily_reports"("created_by");
CREATE INDEX "daily_reports_is_archived_idx" ON "daily_reports"("is_archived");
CREATE UNIQUE INDEX "email_outbox_transition_key_key" ON "email_outbox"("transition_key");
CREATE INDEX "email_outbox_status_next_attempt_at_idx" ON "email_outbox"("status", "next_attempt_at");
CREATE INDEX "email_outbox_lease_expires_at_idx" ON "email_outbox"("lease_expires_at");
CREATE INDEX "email_outbox_reference_type_reference_id_idx" ON "email_outbox"("reference_type", "reference_id");

-- Bounded analytics still benefits from range-leading indexes on the existing
-- operational tables queried by the new descriptive dashboard.
CREATE INDEX "document_requests_parish_id_date_requested_idx" ON "document_requests"("parish_id", "date_requested");
CREATE INDEX "payment_transactions_status_created_at_idx" ON "payment_transactions"("status", "created_at");
CREATE INDEX "receipt_uploads_uploaded_at_idx" ON "receipt_uploads"("uploaded_at");
CREATE INDEX "request_history_new_status_created_at_idx" ON "request_history"("new_status", "created_at");
CREATE INDEX "schedules_created_at_idx" ON "schedules"("created_at");
CREATE INDEX "schedules_parish_id_created_at_idx" ON "schedules"("parish_id", "created_at");
CREATE INDEX "users_created_at_idx" ON "users"("created_at");
CREATE INDEX "parish_events_parish_id_event_date_idx" ON "parish_events"("parish_id", "event_date");
CREATE INDEX "parish_events_visibility_event_date_idx" ON "parish_events"("visibility", "event_date");

ALTER TABLE "parish_weekday_rules"
  ADD CONSTRAINT "parish_weekday_rules_parish_id_fkey"
  FOREIGN KEY ("parish_id") REFERENCES "parishes"("parish_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parish_service_weekday_rules"
  ADD CONSTRAINT "parish_service_weekday_rules_parish_id_fkey"
  FOREIGN KEY ("parish_id") REFERENCES "parishes"("parish_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parish_schedule_date_rules"
  ADD CONSTRAINT "parish_schedule_date_rules_parish_id_fkey"
  FOREIGN KEY ("parish_id") REFERENCES "parishes"("parish_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parish_schedule_date_rules"
  ADD CONSTRAINT "parish_schedule_date_rules_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "parish_schedule_date_service_overrides"
  ADD CONSTRAINT "parish_schedule_date_service_overrides_date_rule_id_fkey"
  FOREIGN KEY ("date_rule_id") REFERENCES "parish_schedule_date_rules"("date_rule_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_reports"
  ADD CONSTRAINT "daily_reports_parish_id_fkey"
  FOREIGN KEY ("parish_id") REFERENCES "parishes"("parish_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_reports"
  ADD CONSTRAINT "daily_reports_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_reports"
  ADD CONSTRAINT "daily_reports_archived_by_fkey"
  FOREIGN KEY ("archived_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Persist an explicit parish-wide default for every weekday.
INSERT INTO "parish_weekday_rules"
  ("parish_id", "weekday", "is_available", "created_at", "updated_at")
SELECT p."parish_id", weekday::"Weekday", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "parishes" p
CROSS JOIN (VALUES
  ('MONDAY'), ('TUESDAY'), ('WEDNESDAY'), ('THURSDAY'),
  ('FRIDAY'), ('SATURDAY'), ('SUNDAY')
) AS weekdays(weekday)
ON CONFLICT ("parish_id", "weekday") DO NOTHING;

-- Configurable product defaults: these are rows, not immutable application bans.
INSERT INTO "parish_service_weekday_rules"
  ("parish_id", "event_type", "weekday", "is_available", "created_at", "updated_at")
SELECT p."parish_id", service::"ScheduleEventType", 'SUNDAY'::"Weekday", false,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "parishes" p
CROSS JOIN (VALUES ('WEDDING'), ('MARRIAGE_SPECIAL'), ('FUNERAL')) AS services(service)
ON CONFLICT ("parish_id", "event_type", "weekday") DO NOTHING;
